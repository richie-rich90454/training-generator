// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest"
import fs from "fs"
import path from "path"
import { GdprManager, createTarGz, secureDeleteFile } from "../src/core/gdprManager.js"
let tarState=vi.hoisted(()=>({
    available: true,
    create: vi.fn()
}))
let fsState=vi.hoisted(()=>({
    dirs: [] as string[],
    files: {} as Record<string, Buffer>,
    streams: {} as Record<string, {chunks: Buffer[], listeners: Record<string, Function[]>}>,
    joinParts(...parts: string[]): string{
        return parts.join("/").replace(/\/+/g, "/")
    },
    dirName(p: string): string{
        let parts=p.split("/")
        parts.pop()
        return parts.join("/") || "/"
    },
    baseName(p: string): string{
        return p.split("/").pop() || ""
    },
    addDir(p: string): void{
        let normalized=this.joinParts(p)
        if (!this.dirs.includes(normalized)){
            this.dirs.push(normalized)
        }
    },
    addFile(p: string, content: Buffer): void{
        this.files[this.joinParts(p)]=content
    },
    childrenOf(dirPath: string): string[]{
        let normalized=this.joinParts(dirPath)
        let result: string[]=[]
        for (let filePath of Object.keys(this.files)){
            if (this.dirName(filePath)===normalized){
                result.push(this.baseName(filePath))
            }
        }
        for (let dir of this.dirs){
            if (this.dirName(dir)===normalized){
                result.push(this.baseName(dir))
            }
        }
        return [...new Set(result)]
    },
    reset(): void{
        this.dirs=[]
        this.files={}
        this.streams={}
    }
}))
vi.mock("path", ()=>({
    default: {
        join: (...parts: string[])=>parts.join("/").replace(/\/+/g, "/"),
        dirname: (p: string)=>{
            let parts=p.split("/")
            parts.pop()
            return parts.join("/") || "/"
        },
        basename: (p: string)=>p.split("/").pop() || ""
    }
}))
vi.mock("fs", ()=>({
    default: {
        promises: {
            readdir: vi.fn(async (dirPath: string, options?: {withFileTypes?: boolean})=>{
                if (!fsState.dirs.includes(fsState.joinParts(dirPath))){
                    let err=new Error("ENOENT") as NodeJS.ErrnoException
                    err.code="ENOENT"
                    throw err
                }
                let names=fsState.childrenOf(dirPath)
                if (options?.withFileTypes){
                    return names.map((name)=>{
                        let fullPath=fsState.joinParts(dirPath, name)
                        let isDir=fsState.dirs.includes(fullPath)
                        return {
                            name: name,
                            isDirectory: ()=>isDir,
                            isFile: ()=>!isDir
                        }
                    })
                }
                return names
            }),
            stat: vi.fn(async (filePath: string)=>{
                if (!(filePath in fsState.files)){
                    let err=new Error("ENOENT") as NodeJS.ErrnoException
                    err.code="ENOENT"
                    throw err
                }
                return {size: fsState.files[filePath].length}
            }),
            open: vi.fn(async (filePath: string, _flags: string)=>{
                if (!(filePath in fsState.files)){
                    let err=new Error("ENOENT") as NodeJS.ErrnoException
                    err.code="ENOENT"
                    throw err
                }
                let handle={
                    path: filePath,
                    write: vi.fn(async (buffer: Buffer, offset: number, length: number, position: number)=>{
                        let chunk=buffer.subarray(offset, offset+length)
                        let current=fsState.files[handle.path]
                        let before=current.subarray(0, position)
                        let after=current.subarray(position+chunk.length)
                        fsState.files[handle.path]=Buffer.concat([before, chunk, after])
                        return {bytesWritten: length, buffer: buffer}
                    }),
                    sync: vi.fn(async ()=>{}),
                    close: vi.fn(async ()=>{})
                }
                return handle
            }),
            unlink: vi.fn(async (filePath: string)=>{
                delete fsState.files[filePath]
            }),
            rmdir: vi.fn(async (dirPath: string)=>{
                let idx=fsState.dirs.indexOf(dirPath)
                if (idx!==-1){
                    fsState.dirs.splice(idx, 1)
                }
            })
        },
        createWriteStream: vi.fn((filePath: string)=>{
            let stream={
                chunks: [] as Buffer[],
                listeners: {} as Record<string, Function[]>,
                write: vi.fn((chunk: Buffer)=>{
                    stream.chunks.push(chunk)
                    return true
                }),
                end: vi.fn((chunk?: Buffer)=>{
                    if (chunk){
                        stream.chunks.push(chunk)
                    }
                    fsState.files[filePath]=Buffer.concat(stream.chunks)
                    let finishListeners=stream.listeners["finish"] || []
                    for (let cb of finishListeners){
                        cb()
                    }
                }),
                on: vi.fn((event: string, cb: Function)=>{
                    stream.listeners[event]=stream.listeners[event] || []
                    stream.listeners[event].push(cb)
                    return stream
                }),
                once: vi.fn((event: string, cb: Function)=>{
                    stream.listeners[event]=stream.listeners[event] || []
                    stream.listeners[event].push(cb)
                    return stream
                }),
                emit: vi.fn((event: string, ...args: any[])=>{
                    let listeners=stream.listeners[event] || []
                    for (let cb of listeners){
                        cb(...args)
                    }
                    return true
                }),
                removeListener: vi.fn((event: string, cb: Function)=>{
                    let listeners=stream.listeners[event] || []
                    let idx=listeners.indexOf(cb)
                    if (idx!==-1){
                        listeners.splice(idx, 1)
                    }
                    return stream
                }),
                listenerCount: vi.fn((event: string)=>{
                    return (stream.listeners[event] || []).length
                }),
                pipe: vi.fn()
            }
            fsState.streams[filePath]=stream
            return stream
        })
    }
}))
vi.mock("tar", ()=>{
    function fakePackStream(): NodeJS.ReadableStream{
        let stream={
            pipe: (dest: any)=>{
                process.nextTick(()=>{
                    if (dest && typeof dest.end==="function"){
                        dest.end()
                    }
                })
                return dest
            },
            on: vi.fn()
        }
        return stream as unknown as NodeJS.ReadableStream
    }
    return {
        create: (..._args: any[])=>{
            if (!tarState.available){
                throw new Error("tar module is not installed")
            }
            return fakePackStream()
        }
    }
})
vi.mock("zlib", ()=>({
    createGzip: vi.fn(()=>({
        pipe: (dest: any)=>{
            process.nextTick(()=>{
                if (dest && typeof dest.end==="function"){
                    dest.end()
                }
            })
            return dest
        },
        on: vi.fn(),
        once: vi.fn(),
        emit: vi.fn(),
        end: vi.fn()
    }))
}))
beforeEach(()=>{
    fsState.reset()
    tarState.available=true
    tarState.create.mockReset()
    vi.clearAllMocks()
})
describe("GdprManager", ()=>{
    test("constructor stores options", ()=>{
        let manager=new GdprManager({userDataPath: "/data"})
        expect(manager).toBeDefined()
    })
    test("listUserDataFiles finds files recursively", async()=>{
        fsState.addDir("/data")
        fsState.addDir("/data/settings")
        fsState.addFile("/data/config.json", Buffer.from("config"))
        fsState.addFile("/data/settings/profile.json", Buffer.from("profile"))
        let manager=new GdprManager({userDataPath: "/data"})
        let files=await manager.listUserDataFiles()
        expect(files.length).toBe(2)
        expect(files).toContain("/data/config.json")
        expect(files).toContain("/data/settings/profile.json")
    })
    test("listUserDataFiles includes pathsToInclude", async()=>{
        fsState.addDir("/data")
        fsState.addDir("/extra")
        fsState.addFile("/data/a.txt", Buffer.from("a"))
        fsState.addFile("/extra/b.txt", Buffer.from("b"))
        let manager=new GdprManager({userDataPath: "/data", pathsToInclude: ["/extra"]})
        let files=await manager.listUserDataFiles()
        expect(files.length).toBe(2)
        expect(files).toContain("/data/a.txt")
        expect(files).toContain("/extra/b.txt")
    })
    test("listUserDataFiles handles missing directories", async()=>{
        let manager=new GdprManager({userDataPath: "/missing"})
        let files=await manager.listUserDataFiles()
        expect(files).toEqual([])
    })
    test("exportAllUserData creates archive", async()=>{
        fsState.addDir("/data")
        fsState.addFile("/data/file.txt", Buffer.from("hello"))
        let manager=new GdprManager({userDataPath: "/data"})
        let result=await manager.exportAllUserData("/out/export.tgz")
        expect(result.archivePath).toBe("/out/export.tgz")
        expect(fsState.files["/out/export.tgz"]).toBeDefined()
    })
    test("exportAllUserData manifest lists files", async()=>{
        fsState.addDir("/data")
        fsState.addFile("/data/file.txt", Buffer.from("hello"))
        let manager=new GdprManager({userDataPath: "/data"})
        let result=await manager.exportAllUserData("/out/export.tgz")
        expect(result.manifest.items.length).toBe(1)
        expect(result.manifest.items[0].path).toBe("/data/file.txt")
        expect(result.manifest.items[0].size).toBe(5)
    })
    test("exportAllUserData manifest includes exportedAt", async()=>{
        fsState.addDir("/data")
        fsState.addFile("/data/file.txt", Buffer.from("hello"))
        let manager=new GdprManager({userDataPath: "/data"})
        let before=Date.now()
        let result=await manager.exportAllUserData("/out/export.tgz")
        let after=Date.now()
        expect(result.manifest.exportedAt).toBeGreaterThanOrEqual(before)
        expect(result.manifest.exportedAt).toBeLessThanOrEqual(after)
    })
    test("exportAllUserData uses default output path", async()=>{
        fsState.addDir("/data")
        fsState.addFile("/data/file.txt", Buffer.from("hello"))
        let manager=new GdprManager({userDataPath: "/data"})
        let result=await manager.exportAllUserData()
        expect(result.archivePath).toMatch(/^\/data\/gdpr-export-\d+\.tgz$/)
    })
    test("exportAllUserData uses provided output path", async()=>{
        fsState.addDir("/data")
        fsState.addFile("/data/file.txt", Buffer.from("hello"))
        let manager=new GdprManager({userDataPath: "/data"})
        let result=await manager.exportAllUserData("/custom/out.tgz")
        expect(result.archivePath).toBe("/custom/out.tgz")
    })
    test("exportAllUserData handles empty user data", async()=>{
        fsState.addDir("/data")
        let manager=new GdprManager({userDataPath: "/data"})
        let result=await manager.exportAllUserData("/out/export.tgz")
        expect(result.manifest.items).toEqual([])
        expect(fsState.files["/out/export.tgz"]).toBeDefined()
    })
    test("purgeAllUserData deletes files", async()=>{
        fsState.addDir("/data")
        fsState.addFile("/data/file.txt", Buffer.from("secret"))
        let manager=new GdprManager({userDataPath: "/data"})
        let result=await manager.purgeAllUserData()
        expect(result.deleted).toContain("/data/file.txt")
        expect(fsState.files["/data/file.txt"]).toBeUndefined()
    })
    test("purgeAllUserData removes empty directories", async()=>{
        fsState.addDir("/data")
        fsState.addDir("/data/sub")
        fsState.addFile("/data/sub/file.txt", Buffer.from("secret"))
        let manager=new GdprManager({userDataPath: "/data"})
        await manager.purgeAllUserData()
        expect(fsState.dirs).not.toContain("/data/sub")
        expect(fsState.dirs).not.toContain("/data")
    })
    test("purgeAllUserData tracks failed deletions", async()=>{
        fsState.addDir("/data")
        fsState.addFile("/data/file.txt", Buffer.from("secret"))
        let customDelete=vi.fn(async (_filePath: string)=>{
            throw new Error("delete failed")
        })
        let manager=new GdprManager({userDataPath: "/data", secureDelete: customDelete})
        let result=await manager.purgeAllUserData()
        expect(result.failed).toContain("/data/file.txt")
        expect(result.deleted).toEqual([])
    })
    test("purgeAllUserData uses custom secureDelete", async()=>{
        fsState.addDir("/data")
        fsState.addFile("/data/file.txt", Buffer.from("secret"))
        let customDelete=vi.fn(async (_filePath: string)=>{})
        let manager=new GdprManager({userDataPath: "/data", secureDelete: customDelete})
        await manager.purgeAllUserData()
        expect(customDelete).toHaveBeenCalledWith("/data/file.txt")
    })
    test("purgeAllUserData handles missing directories", async()=>{
        let manager=new GdprManager({userDataPath: "/missing"})
        let result=await manager.purgeAllUserData()
        expect(result.deleted).toEqual([])
        expect(result.failed).toEqual([])
    })
    test("purgeAllUserData includes pathsToInclude files", async()=>{
        fsState.addDir("/data")
        fsState.addDir("/extra")
        fsState.addFile("/data/a.txt", Buffer.from("a"))
        fsState.addFile("/extra/b.txt", Buffer.from("b"))
        let manager=new GdprManager({userDataPath: "/data", pathsToInclude: ["/extra"]})
        let result=await manager.purgeAllUserData()
        expect(result.deleted).toContain("/data/a.txt")
        expect(result.deleted).toContain("/extra/b.txt")
    })
})
describe("secureDeleteFile", ()=>{
    test("overwrites content with zeros", async()=>{
        fsState.addFile("/data/file.txt", Buffer.from("secret content"))
        await secureDeleteFile("/data/file.txt")
        expect(fs.promises.open).toHaveBeenCalledWith("/data/file.txt", "r+")
        let results=(fs.promises.open as any).mock.results
        let handle=await results[results.length-1].value
        expect(handle.write).toHaveBeenCalled()
        let call=handle.write.mock.calls[0]
        let buffer=call[0] as Buffer
        for (let i=0; i<buffer.length; i++){
            expect(buffer[i]).toBe(0)
        }
    })
    test("unlinks file after overwriting", async()=>{
        fsState.addFile("/data/file.txt", Buffer.from("secret"))
        await secureDeleteFile("/data/file.txt")
        expect(fsState.files["/data/file.txt"]).toBeUndefined()
    })
    test("handles empty file", async()=>{
        fsState.addFile("/data/empty.txt", Buffer.alloc(0))
        await secureDeleteFile("/data/empty.txt")
        expect(fsState.files["/data/empty.txt"]).toBeUndefined()
    })
    test("throws for missing file", async()=>{
        await expect(secureDeleteFile("/missing/file.txt")).rejects.toThrow("ENOENT")
    })
})
describe("createTarGz", ()=>{
    test("creates output file", async()=>{
        fsState.addDir("/out")
        await createTarGz(["/data/file.txt"], "/out/archive.tgz")
        expect(fsState.files["/out/archive.tgz"]).toBeDefined()
    })
    test("throws when tar not installed", async()=>{
        tarState.available=false
        await expect(createTarGz(["/data/file.txt"], "/out/archive.tgz")).rejects.toThrow("tar module is not installed")
    })
    test("propagates output stream errors", async()=>{
        fsState.addDir("/out")
        let originalCreateWriteStream=(fs.createWriteStream as any).getMockImplementation()
        ;(fs.createWriteStream as any).mockImplementationOnce((filePath: string)=>{
            let stream=originalCreateWriteStream(filePath)
            stream.end=vi.fn(()=>{
                let errorListeners=stream.listeners["error"] || []
                for (let cb of errorListeners){
                    cb(new Error("write failed"))
                }
            })
            return stream
        })
        await expect(createTarGz(["/data/file.txt"], "/out/archive.tgz")).rejects.toThrow("write failed")
    })
})