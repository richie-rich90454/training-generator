// @vitest-environment node
import {describe, it, expect, vi, beforeEach} from "vitest"
import {SmartCache, computeEvictionScore, compressData, decompressData} from "../src/core/smartCache.js"
import * as zstdModule from "@mongodb-js/zstd"
vi.mock("@mongodb-js/zstd", ()=>{
    return {
        compress: vi.fn(async (data: Buffer)=>{
            let reversed=Buffer.from(data.toString("utf-8").split("").reverse().join(""), "utf-8");
            return Buffer.concat([Buffer.from([0x28, 0xb5, 0x2f, 0xfd]), reversed]);
        }),
        decompress: vi.fn(async (data: Buffer)=>{
            if (data.length>=4&&data[0]===0x28&&data[1]===0xb5&&data[2]===0x2f&&data[3]===0xfd){
                let reversed=data.subarray(4).toString("utf-8");
                return Buffer.from(reversed.split("").reverse().join(""), "utf-8");
            }
            return data;
        })
    };
});
describe("SmartCache", ()=>{
    beforeEach(async()=>{
        vi.useRealTimers();
        vi.mocked(zstdModule).compress.mockClear();
        vi.mocked(zstdModule).decompress.mockClear();
    });
    it("should round-trip values through get and set", async()=>{
        let cache=new SmartCache();
        await cache.set("key", {hello: "world"});
        let value=await cache.get("key");
        expect(value).toEqual({hello: "world"});
    });
    it("should return undefined for missing keys", async()=>{
        let cache=new SmartCache();
        let value=await cache.get("missing");
        expect(value).toBeUndefined();
    });
    it("should update lastAccessed on get and influence eviction", async()=>{
        let cache=new SmartCache({maxEntries: 2});
        await cache.set("a", "first");
        await cache.set("b", "second");
        await new Promise(r=>setTimeout(r, 10));
        await cache.get("a");
        await cache.set("c", "third");
        let a=await cache.get("a");
        let b=await cache.get("b");
        expect(a).toBe("first");
        expect(b).toBeUndefined();
    });
    it("should track hit count", async()=>{
        let cache=new SmartCache();
        await cache.set("a", "value");
        await cache.get("a");
        let stats=cache.getStats();
        expect(stats.hitCount).toBe(1);
    });
    it("should track miss count", async()=>{
        let cache=new SmartCache();
        await cache.get("missing");
        let stats=cache.getStats();
        expect(stats.missCount).toBe(1);
    });
    it("should overwrite existing key", async()=>{
        let cache=new SmartCache();
        await cache.set("a", "first");
        await cache.set("a", "second");
        let value=await cache.get("a");
        expect(value).toBe("second");
    });
    it("should return true when deleting existing key", async()=>{
        let cache=new SmartCache();
        await cache.set("a", "value");
        let removed=await cache.delete("a");
        expect(removed).toBe(true);
        let value=await cache.get("a");
        expect(value).toBeUndefined();
    });
    it("should return false when deleting missing key", async()=>{
        let cache=new SmartCache();
        let removed=await cache.delete("missing");
        expect(removed).toBe(false);
    });
    it("should clear entries and reset stats", async()=>{
        let cache=new SmartCache();
        await cache.set("a", "value");
        await cache.get("missing");
        await cache.clear();
        let stats=cache.getStats();
        expect(stats.entries).toBe(0);
        expect(stats.totalSize).toBe(0);
        expect(stats.hitCount).toBe(0);
        expect(stats.missCount).toBe(0);
        expect(stats.evictionCount).toBe(0);
    });
    it("should evict oldest entry when maxEntries exceeded", async()=>{
        let cache=new SmartCache({maxEntries: 2});
        await cache.set("a", "first");
        await new Promise(r=>setTimeout(r, 5));
        await cache.set("b", "second");
        await cache.set("c", "third");
        let stats=cache.getStats();
        expect(stats.entries).toBe(2);
        let a=await cache.get("a");
        let b=await cache.get("b");
        let c=await cache.get("c");
        expect(a).toBeUndefined();
        expect(b).toBe("second");
        expect(c).toBe("third");
    });
    it("should evict large entries when maxSizeBytes exceeded", async()=>{
        let cache=new SmartCache({maxSizeBytes: 50});
        await cache.set("small", "x");
        await cache.set("large", "this is a much larger value that exceeds the limit when both are stored");
        let stats=cache.getStats();
        expect(stats.totalSize).toBeLessThanOrEqual(50);
        let large=await cache.get("large");
        expect(large).toBeUndefined();
    });
    it("should evict old entries when maxAgeMs exceeded on get", async()=>{
        vi.useFakeTimers();
        let cache=new SmartCache({maxAgeMs: 100});
        await cache.set("a", "first");
        vi.advanceTimersByTime(150);
        let value=await cache.get("a");
        expect(value).toBeUndefined();
        let stats=cache.getStats();
        expect(stats.missCount).toBe(1);
        expect(stats.evictionCount).toBe(1);
        vi.useRealTimers();
    });
    it("should remove expired entries during compact", async()=>{
        vi.useFakeTimers();
        let cache=new SmartCache({maxAgeMs: 100});
        await cache.set("a", "value");
        vi.advanceTimersByTime(150);
        await cache.compact();
        let value=await cache.get("a");
        expect(value).toBeUndefined();
        vi.useRealTimers();
    });
    it("should compact entries by combined eviction score", async()=>{
        vi.useFakeTimers();
        let cache=new SmartCache({maxEntries: 1});
        await cache.set("small", "a");
        vi.advanceTimersByTime(10);
        await cache.set("large", "this is a very large value with much higher size score");
        let small=await cache.get("small");
        let large=await cache.get("large");
        expect(small).toBe("a");
        expect(large).toBeUndefined();
        vi.useRealTimers();
    });
    it("should track eviction count", async()=>{
        let cache=new SmartCache({maxEntries: 1});
        await cache.set("a", "value1");
        await cache.set("b", "value2");
        let stats=cache.getStats();
        expect(stats.evictionCount).toBe(1);
    });
    it("should favor keeping frequently accessed entries", async()=>{
        let cache=new SmartCache({maxEntries: 2});
        await cache.set("a", "value");
        await cache.set("b", "value");
        await new Promise(r=>setTimeout(r, 10));
        await cache.get("a");
        await cache.set("c", "value");
        let a=await cache.get("a");
        let b=await cache.get("b");
        expect(a).toBe("value");
        expect(b).toBeUndefined();
    });
    it("should track totalSize correctly", async()=>{
        let cache=new SmartCache();
        await cache.set("a", "x");
        let stats1=cache.getStats();
        expect(stats1.totalSize).toBeGreaterThan(0);
        await cache.delete("a");
        let stats2=cache.getStats();
        expect(stats2.totalSize).toBe(0);
    });
    it("should not compress when compress option is false", async()=>{
        let cache=new SmartCache({compress: false});
        await cache.set("a", {hello: "world"});
        let value=await cache.get("a");
        expect(value).toEqual({hello: "world"});
    });
});
describe("compression helpers", ()=>{
    it("should compress data when zstd is available", async()=>{
        let result=await compressData({hello: "world"});
        expect(result.compressed).toBe(true);
        expect(result.buffer.length).toBeGreaterThan(0);
        let value=await decompressData(result.buffer);
        expect(value).toEqual({hello: "world"});
    });
    it("should decompress uncompressed buffer", async()=>{
        let buffer=Buffer.from(JSON.stringify({hello: "world"}), "utf-8");
        let value=await decompressData(buffer);
        expect(value).toEqual({hello: "world"});
    });
    it("should fallback to uncompressed when zstd unavailable", async()=>{
        let mocked=vi.mocked(zstdModule);
        mocked.compress.mockImplementation(async()=>{throw new Error("not installed");});
        mocked.decompress.mockImplementation(async()=>{throw new Error("not installed");});
        let result=await compressData({hello: "world"});
        expect(result.compressed).toBe(false);
        let value=await decompressData(result.buffer);
        expect(value).toEqual({hello: "world"});
        mocked.compress.mockRestore();
        mocked.decompress.mockRestore();
    });
});
describe("computeEvictionScore", ()=>{
    it("should increase with age", ()=>{
        let now=1000;
        let old=computeEvictionScore({key: "a", value: 1, size: 10, createdAt: 0, lastAccessed: 0, accessCount: 0}, now);
        let young=computeEvictionScore({key: "b", value: 1, size: 10, createdAt: 900, lastAccessed: 900, accessCount: 0}, now);
        expect(old).toBeGreaterThan(young);
    });
    it("should increase with size", ()=>{
        let now=1000;
        let large=computeEvictionScore({key: "a", value: 1, size: 100, createdAt: 900, lastAccessed: 900, accessCount: 0}, now);
        let small=computeEvictionScore({key: "b", value: 1, size: 10, createdAt: 900, lastAccessed: 900, accessCount: 0}, now);
        expect(large).toBeGreaterThan(small);
    });
    it("should increase with idle time", ()=>{
        let now=1000;
        let idle=computeEvictionScore({key: "a", value: 1, size: 10, createdAt: 900, lastAccessed: 100, accessCount: 0}, now);
        let recent=computeEvictionScore({key: "b", value: 1, size: 10, createdAt: 900, lastAccessed: 900, accessCount: 0}, now);
        expect(idle).toBeGreaterThan(recent);
    });
});
