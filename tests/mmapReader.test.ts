// @vitest-environment node
import{describe, test, expect, vi, beforeEach}from "vitest"
import fs from "fs"
let mockState=vi.hoisted(()=>({
    mapShouldThrow: false,
    mapError: new Error("mmap-io error"),
    mapResult: Buffer.alloc(0)
}));
let mmapMapMock=vi.fn((size: number, _prot: number, _flags: number, fd: number)=>{
    if (mockState.mapShouldThrow){
        throw mockState.mapError;
    }
    return mockState.mapResult;
});
vi.mock("fs", ()=>{
    return{
        default:{
            promises:{
                stat: vi.fn(),
                readFile: vi.fn()
            },
            openSync: vi.fn(),
            closeSync: vi.fn()
        }
    };
});
vi.mock("mmap-io", ()=>{
    return{
        PROT_READ: 1,
        MAP_SHARED: 2,
        map: (size: number, prot: number, flags: number, fd: number)=>mmapMapMock(size, prot, flags, fd)
    };
});
import{MmapReader, readFileSmart, chunkMmapBuffer}from "../src/core/mmapReader.js"
beforeEach(()=>{
    vi.clearAllMocks();
    mockState.mapShouldThrow=false;
    mockState.mapError=new Error("mmap-io error");
    mockState.mapResult=Buffer.alloc(0);
});
describe("MmapReader", ()=>{
    test("constructor sets filePath and default threshold", ()=>{
        let reader=new MmapReader({ filePath: "/tmp/large.bin" });
        expect(reader.filePath).toBe("/tmp/large.bin");
        expect(reader.thresholdBytes).toBe(100*1024*1024);
    });
    test("constructor accepts custom threshold", ()=>{
        let reader=new MmapReader({ filePath: "/tmp/file.bin", thresholdBytes: 50*1024*1024 });
        expect(reader.thresholdBytes).toBe(50*1024*1024);
    });
    test("shouldUseMmap returns true for file size at threshold", ()=>{
        let reader=new MmapReader({ filePath: "/tmp/file.bin", thresholdBytes: 100 });
        expect(reader.shouldUseMmap(100)).toBe(true);
    });
    test("shouldUseMmap returns true for file size above threshold", ()=>{
        let reader=new MmapReader({ filePath: "/tmp/file.bin", thresholdBytes: 100 });
        expect(reader.shouldUseMmap(101)).toBe(true);
    });
    test("shouldUseMmap returns false for file size below threshold", ()=>{
        let reader=new MmapReader({ filePath: "/tmp/file.bin", thresholdBytes: 100 });
        expect(reader.shouldUseMmap(99)).toBe(false);
    });
    test("shouldUseMmap returns false for zero size", ()=>{
        let reader=new MmapReader({ filePath: "/tmp/file.bin", thresholdBytes: 100 });
        expect(reader.shouldUseMmap(0)).toBe(false);
    });
    test("getSize returns stat size", async()=>{
        (fs.promises.stat as any).mockResolvedValue({ size: 12345 });
        let reader=new MmapReader({ filePath: "/tmp/file.bin" });
        let size=await reader.getSize();
        expect(size).toBe(12345);
        expect(fs.promises.stat).toHaveBeenCalledWith("/tmp/file.bin");
    });
    test("getSize propagates missing file error", async()=>{
        (fs.promises.stat as any).mockRejectedValue(new Error("ENOENT"));
        let reader=new MmapReader({ filePath: "/tmp/missing.bin" });
        await expect(reader.getSize()).rejects.toThrow("ENOENT");
    });
    test("read uses fs for small file", async()=>{
        (fs.promises.stat as any).mockResolvedValue({ size: 1024 });
        let fsBuffer=Buffer.from("small file content");
        (fs.promises.readFile as any).mockResolvedValue(fsBuffer);
        let reader=new MmapReader({ filePath: "/tmp/small.bin" });
        let result=await reader.read();
        expect(result).toBe(fsBuffer);
        expect(fs.promises.readFile).toHaveBeenCalledWith("/tmp/small.bin");
        expect(mmapMapMock).not.toHaveBeenCalled();
    });
    test("read uses mmap for large file", async()=>{
        (fs.promises.stat as any).mockResolvedValue({ size: 200*1024*1024 });
        mockState.mapResult=Buffer.from("mapped large content");
        (fs.openSync as any).mockReturnValue(42);
        let reader=new MmapReader({ filePath: "/tmp/large.bin" });
        let result=await reader.read();
        expect(result).toBe(mockState.mapResult);
        expect(fs.openSync).toHaveBeenCalledWith("/tmp/large.bin", "r");
        expect(mmapMapMock).toHaveBeenCalledWith(200*1024*1024, 1, 2, 42);
        expect(fs.closeSync).toHaveBeenCalledWith(42);
    });
    test("read closes fd even when mmap throws", async()=>{
        let warnSpy=vi.spyOn(console, "warn").mockImplementation(()=>{});
        (fs.promises.stat as any).mockResolvedValue({ size: 200*1024*1024 });
        mockState.mapShouldThrow=true;
        mockState.mapError=new Error("mmap failed");
        (fs.openSync as any).mockReturnValue(7);
        let fsBuffer=Buffer.from("fallback content");
        (fs.promises.readFile as any).mockResolvedValue(fsBuffer);
        let reader=new MmapReader({ filePath: "/tmp/large.bin" });
        let result=await reader.read();
        expect(result).toBe(fsBuffer);
        expect(fs.closeSync).toHaveBeenCalledWith(7);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
    test("read falls back to fs and logs warning when mmap-io fails", async()=>{
        let warnSpy=vi.spyOn(console, "warn").mockImplementation(()=>{});
        (fs.promises.stat as any).mockResolvedValue({ size: 200*1024*1024 });
        mockState.mapShouldThrow=true;
        mockState.mapError=new Error("mmap-io not installed");
        (fs.openSync as any).mockReturnValue(3);
        let fsBuffer=Buffer.from("fallback content");
        (fs.promises.readFile as any).mockResolvedValue(fsBuffer);
        let reader=new MmapReader({ filePath: "/tmp/large.bin" });
        let result=await reader.read();
        expect(result).toBe(fsBuffer);
        expect(fs.promises.readFile).toHaveBeenCalledWith("/tmp/large.bin");
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
    test("read propagates fs error for small file", async()=>{
        (fs.promises.stat as any).mockResolvedValue({ size: 1024 });
        (fs.promises.readFile as any).mockRejectedValue(new Error("read error"));
        let reader=new MmapReader({ filePath: "/tmp/small.bin" });
        await expect(reader.read()).rejects.toThrow("read error");
    });
    test("read handles missing file", async()=>{
        (fs.promises.stat as any).mockRejectedValue(new Error("ENOENT: no such file"));
        let reader=new MmapReader({ filePath: "/tmp/missing.bin" });
        await expect(reader.read()).rejects.toThrow("ENOENT");
    });
});
describe("readFileSmart", ()=>{
    test("returns content and usedMmap=false for small file", async()=>{
        (fs.promises.stat as any).mockResolvedValue({ size: 1024 });
        let fsBuffer=Buffer.from("smart small content");
        (fs.promises.readFile as any).mockResolvedValue(fsBuffer);
        let result=await readFileSmart("/tmp/smart.bin");
        expect(result.content).toBe(fsBuffer);
        expect(result.usedMmap).toBe(false);
    });
    test("returns content and usedMmap=true for large file", async()=>{
        (fs.promises.stat as any).mockResolvedValue({ size: 200*1024*1024 });
        mockState.mapResult=Buffer.from("smart large content");
        (fs.openSync as any).mockReturnValue(99);
        let result=await readFileSmart("/tmp/smart.bin");
        expect(result.content).toBe(mockState.mapResult);
        expect(result.usedMmap).toBe(true);
    });
    test("accepts custom threshold", async()=>{
        (fs.promises.stat as any).mockResolvedValue({ size: 60*1024*1024 });
        let fsBuffer=Buffer.from("medium content");
        (fs.promises.readFile as any).mockResolvedValue(fsBuffer);
        let result=await readFileSmart("/tmp/medium.bin", 100*1024*1024);
        expect(result.content).toBe(fsBuffer);
        expect(result.usedMmap).toBe(false);
    });
    test("handles missing file", async()=>{
        (fs.promises.stat as any).mockRejectedValue(new Error("ENOENT"));
        await expect(readFileSmart("/tmp/missing.bin")).rejects.toThrow("ENOENT");
    });
});
describe("chunkMmapBuffer", ()=>{
    test("splits buffer into equal chunks", ()=>{
        let buffer=Buffer.from("abcdefghij");
        let chunks=chunkMmapBuffer(buffer, 3);
        expect(chunks.length).toBe(4);
        expect(chunks[0].toString()).toBe("abc");
        expect(chunks[1].toString()).toBe("def");
        expect(chunks[2].toString()).toBe("ghi");
        expect(chunks[3].toString()).toBe("j");
    });
    test("returns single chunk when chunkSize equals buffer length", ()=>{
        let buffer=Buffer.from("abcdef");
        let chunks=chunkMmapBuffer(buffer, 6);
        expect(chunks.length).toBe(1);
        expect(chunks[0].toString()).toBe("abcdef");
    });
    test("returns empty array for chunkSize zero", ()=>{
        let buffer=Buffer.from("abcdef");
        let chunks=chunkMmapBuffer(buffer, 0);
        expect(chunks).toEqual([]);
    });
    test("returns empty array for negative chunkSize", ()=>{
        let buffer=Buffer.from("abcdef");
        let chunks=chunkMmapBuffer(buffer, -1);
        expect(chunks).toEqual([]);
    });
    test("returns empty array for empty buffer", ()=>{
        let buffer=Buffer.alloc(0);
        let chunks=chunkMmapBuffer(buffer, 4);
        expect(chunks).toEqual([]);
    });
    test("subarray references original buffer memory", ()=>{
        let buffer=Buffer.from("abcdefghij");
        let chunks=chunkMmapBuffer(buffer, 4);
        expect(chunks[0].buffer).toBe(buffer.buffer);
    });
});
