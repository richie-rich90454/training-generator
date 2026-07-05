// @vitest-environment node
import {describe, it, expect, vi, beforeEach} from "vitest"
import {TieredStorage} from "../src/core/tieredStorage.js"
import path from "path"
let mockFsFiles: Map<string, Buffer>;
vi.mock("fs/promises", ()=>{
    return {
        readFile: vi.fn(async (filePath: string)=>{
            let data=mockFsFiles.get(filePath);
            if (data===undefined){
                let err=new Error("ENOENT") as NodeJS.ErrnoException;
                err.code="ENOENT";
                throw err;
            }
            return data;
        }),
        writeFile: vi.fn(async (filePath: string, data: Buffer)=>{
            mockFsFiles.set(filePath, Buffer.from(data));
        }),
        unlink: vi.fn(async (filePath: string)=>{
            mockFsFiles.delete(filePath);
        }),
        mkdir: vi.fn(async ()=>{
            return undefined;
        })
    };
});
vi.mock("zlib", ()=>{
    return {
        gzip: vi.fn((buffer: Buffer, callback: (err: Error|null, result?: Buffer)=>void)=>{
            let marker=Buffer.from([0x1f, 0x8b]);
            callback(null, Buffer.concat([marker, buffer]));
        }),
        gunzip: vi.fn((buffer: Buffer, callback: (err: Error|null, result?: Buffer)=>void)=>{
            callback(null, buffer.subarray(2));
        })
    };
});
describe("TieredStorage", ()=>{
    beforeEach(()=>{
        mockFsFiles=new Map();
    });
    it("should round-trip values through hot tier", async()=>{
        let store=new TieredStorage({coldDir: "/tmp/cold"});
        await store.set("key", {hello: "world"});
        let value=await store.get("key");
        expect(value).toEqual({hello: "world"});
    });
    it("should return undefined for missing keys", async()=>{
        let store=new TieredStorage({coldDir: "/tmp/cold"});
        let value=await store.get("missing");
        expect(value).toBeUndefined();
    });
    it("should promote from warm to hot on get", async()=>{
        let store=new TieredStorage({hotCapacity: 1, warmCapacity: 10, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        let stats1=store.getStats();
        expect(stats1.hot).toBe(1);
        expect(stats1.warm).toBe(1);
        let value=await store.get("a");
        expect(value).toBe(1);
        let stats2=store.getStats();
        expect(stats2.hot).toBe(1);
        expect(stats2.warm).toBe(1);
        expect(stats2.promotions).toBe(1);
    });
    it("should promote from cold to hot on get", async()=>{
        let store=new TieredStorage({hotCapacity: 1, warmCapacity: 1, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        await store.set("c", 3);
        let stats1=store.getStats();
        expect(stats1.hot).toBe(1);
        expect(stats1.warm).toBe(1);
        expect(stats1.cold).toBe(1);
        let value=await store.get("a");
        expect(value).toBe(1);
        let stats2=store.getStats();
        expect(stats2.hot).toBe(1);
        expect(stats2.promotions).toBe(1);
        expect(mockFsFiles.has(path.join("/tmp/cold", "a.gz"))).toBe(false);
    });
    it("should demote from hot to warm to cold", async()=>{
        let store=new TieredStorage({hotCapacity: 2, warmCapacity: 2, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        await store.set("c", 3);
        await store.set("d", 4);
        await store.set("e", 5);
        let stats=store.getStats();
        expect(stats.hot).toBe(2);
        expect(stats.warm).toBe(2);
        expect(stats.cold).toBe(1);
        expect(stats.demotions).toBe(4);
    });
    it("should delete keys from hot tier", async()=>{
        let store=new TieredStorage({coldDir: "/tmp/cold"});
        await store.set("a", 1);
        let removed=await store.delete("a");
        expect(removed).toBe(true);
        let value=await store.get("a");
        expect(value).toBeUndefined();
    });
    it("should delete keys from warm tier", async()=>{
        let store=new TieredStorage({hotCapacity: 1, warmCapacity: 10, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        let removed=await store.delete("a");
        expect(removed).toBe(true);
        let value=await store.get("a");
        expect(value).toBeUndefined();
    });
    it("should delete keys from cold tier", async()=>{
        let store=new TieredStorage({hotCapacity: 1, warmCapacity: 1, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        await store.set("c", 3);
        let removed=await store.delete("a");
        expect(removed).toBe(true);
        expect(mockFsFiles.has(path.join("/tmp/cold", "a.gz"))).toBe(false);
        let value=await store.get("a");
        expect(value).toBeUndefined();
    });
    it("should return false when deleting missing key", async()=>{
        let store=new TieredStorage({coldDir: "/tmp/cold"});
        let removed=await store.delete("missing");
        expect(removed).toBe(false);
    });
    it("should clear all tiers", async()=>{
        let store=new TieredStorage({hotCapacity: 1, warmCapacity: 1, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        await store.set("c", 3);
        await store.clear();
        let stats=store.getStats();
        expect(stats.hot).toBe(0);
        expect(stats.warm).toBe(0);
        expect(stats.cold).toBe(0);
        expect(stats.promotions).toBe(0);
        expect(stats.demotions).toBe(0);
    });
    it("should overwrite existing key in warm tier", async()=>{
        let store=new TieredStorage({hotCapacity: 2, warmCapacity: 10, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        await store.set("a", 3);
        let value=await store.get("a");
        expect(value).toBe(3);
        let stats=store.getStats();
        expect(stats.hot).toBe(2);
        expect(stats.warm).toBe(0);
    });
    it("should overwrite existing key in cold tier", async()=>{
        let store=new TieredStorage({hotCapacity: 1, warmCapacity: 1, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        await store.set("c", 3);
        await store.set("a", 4);
        let value=await store.get("a");
        expect(value).toBe(4);
        let stats=store.getStats();
        expect(stats.hot).toBe(1);
        expect(stats.cold).toBe(1);
        expect(mockFsFiles.has(path.join("/tmp/cold", "a.gz"))).toBe(false);
    });
    it("should track stats correctly", async()=>{
        let store=new TieredStorage({hotCapacity: 1, warmCapacity: 1, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        await store.set("c", 3);
        let stats1=store.getStats();
        expect(stats1.hot).toBe(1);
        expect(stats1.warm).toBe(1);
        expect(stats1.cold).toBe(1);
        expect(stats1.demotions).toBe(3);
        await store.get("a");
        let stats2=store.getStats();
        expect(stats2.promotions).toBe(1);
    });
    it("should use custom serializer and deserializer", async()=>{
        let store=new TieredStorage({
            hotCapacity: 1,
            warmCapacity: 1,
            coldDir: "/tmp/cold",
            serializer: (value: unknown)=>Buffer.from(value as string, "utf-8"),
            deserializer: (buffer: Buffer)=>buffer.toString("utf-8")
        });
        await store.set("a", "hello");
        await store.set("b", "world");
        await store.set("c", "!");
        let value=await store.get("a");
        expect(value).toBe("hello");
    });
    it("should compress cold tier files with gzip", async()=>{
        let store=new TieredStorage({hotCapacity: 1, warmCapacity: 1, coldDir: "/tmp/cold"});
        await store.set("a", 1);
        await store.set("b", 2);
        await store.set("c", 3);
        let filePath=path.join("/tmp/cold", "a.gz");
        expect(mockFsFiles.has(filePath)).toBe(true);
        let data=mockFsFiles.get(filePath);
        expect(data).toBeDefined();
        expect(data![0]).toBe(0x1f);
        expect(data![1]).toBe(0x8b);
    });
});
