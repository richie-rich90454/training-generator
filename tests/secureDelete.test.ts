// @vitest-environment node
import{describe, test, expect, vi, beforeEach}from"vitest"
import fs from"fs"
let fsState=vi.hoisted(()=>({
    dirs: []as string[],
    files: {}as Record<string, Buffer>,
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
        if(!this.dirs.includes(normalized)){
            this.dirs.push(normalized)
        }
    },
    addFile(p: string, content: Buffer): void{
        this.files[this.joinParts(p)]=content
    },
    childrenOf(dirPath: string): string[]{
        let normalized=this.joinParts(dirPath)
        let result: string[]=[]
        for(let filePath of Object.keys(this.files)){
            if(this.dirName(filePath)===normalized){
                result.push(this.baseName(filePath))
            }
        }
        for(let dir of this.dirs){
            if(this.dirName(dir)===normalized){
                result.push(this.baseName(dir))
            }
        }
        return [...new Set(result)]
    },
    reset(): void{
        this.dirs=[]
        this.files={}
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
            readdir: vi.fn(async(dirPath: string, options?: {withFileTypes?: boolean})=>{
                if(!fsState.dirs.includes(fsState.joinParts(dirPath))){
                    let err=new Error("ENOENT")as NodeJS.ErrnoException
                    err.code="ENOENT"
                    throw err
                }
                let names=fsState.childrenOf(dirPath)
                if(options?.withFileTypes){
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
            stat: vi.fn(async(filePath: string)=>{
                if(!(filePath in fsState.files)){
                    let err=new Error("ENOENT")as NodeJS.ErrnoException
                    err.code="ENOENT"
                    throw err
                }
                return {size: fsState.files[filePath].length}
            }),
            open: vi.fn(async(filePath: string, _flags: string)=>{
                if(!(filePath in fsState.files)){
                    let err=new Error("ENOENT")as NodeJS.ErrnoException
                    err.code="ENOENT"
                    throw err
                }
                let handle={
                    path: filePath,
                    write: vi.fn(async(buffer: Buffer, offset: number, length: number, position: number)=>{
                        let chunk=buffer.subarray(offset, offset+length)
                        let current=fsState.files[handle.path]
                        let before=current.subarray(0, position)
                        let after=current.subarray(position+chunk.length)
                        fsState.files[handle.path]=Buffer.concat([before, chunk, after])
                        return {bytesWritten: length, buffer: buffer}
                    }),
                    sync: vi.fn(async()=>{}),
                    close: vi.fn(async()=>{})
                }
                return handle
            }),
            unlink: vi.fn(async(filePath: string)=>{
                delete fsState.files[filePath]
            }),
            rmdir: vi.fn(async(dirPath: string)=>{
                let idx=fsState.dirs.indexOf(dirPath)
                if(idx!==-1){
                    fsState.dirs.splice(idx, 1)
                }
            })
        }
    }
}))
import{SecureDelete}from"../src/core/secureDelete.js"
beforeEach(()=>{
    fsState.reset()
    vi.clearAllMocks()
})
describe("SecureDelete", ()=>{
    test("constructor defaults passes to 3", ()=>{
        let deleter=new SecureDelete()
        expect(deleter.passes).toBe(3)
    })
    test("constructor accepts custom passes", ()=>{
        let deleter=new SecureDelete({passes: 7})
        expect(deleter.passes).toBe(7)
    })
    test("generateRandomBuffer returns buffer of requested length", ()=>{
        let deleter=new SecureDelete()
        let buffer=deleter.generateRandomBuffer(64)
        expect(buffer.length).toBe(64)
    })
    test("generateRandomBuffer returns different bytes across calls", ()=>{
        let deleter=new SecureDelete()
        let a=deleter.generateRandomBuffer(32)
        let b=deleter.generateRandomBuffer(32)
        expect(a.toString("hex")).not.toBe(b.toString("hex"))
    })
    test("deleteFile overwrites content for multiple passes", async()=>{
        fsState.addFile("/data/file.txt", Buffer.from("secret content"))
        let deleter=new SecureDelete({passes: 3})
        await deleter.deleteFile("/data/file.txt")
        let openResults=(fs.promises.open as any).mock.results
        expect(openResults.length).toBe(1)
        let handle=await openResults[0].value
        expect(handle.write).toHaveBeenCalledTimes(3)
        expect(handle.sync).toHaveBeenCalledTimes(3)
    })
    test("deleteFile unlinks file after overwriting", async()=>{
        fsState.addFile("/data/file.txt", Buffer.from("secret"))
        let deleter=new SecureDelete({passes: 1})
        await deleter.deleteFile("/data/file.txt")
        expect(fsState.files["/data/file.txt"]).toBeUndefined()
    })
    test("deleteFile handles empty file", async()=>{
        fsState.addFile("/data/empty.txt", Buffer.alloc(0))
        let deleter=new SecureDelete({passes: 2})
        await deleter.deleteFile("/data/empty.txt")
        expect(fsState.files["/data/empty.txt"]).toBeUndefined()
    })
    test("deleteFile throws for missing file", async()=>{
        let deleter=new SecureDelete()
        await expect(deleter.deleteFile("/missing/file.txt")).rejects.toThrow("ENOENT")
    })
    test("deleteDirectory recursively deletes files and directories", async()=>{
        fsState.addDir("/data")
        fsState.addDir("/data/sub")
        fsState.addFile("/data/a.txt", Buffer.from("a"))
        fsState.addFile("/data/sub/b.txt", Buffer.from("b"))
        let deleter=new SecureDelete()
        await deleter.deleteDirectory("/data")
        expect(fsState.files["/data/a.txt"]).toBeUndefined()
        expect(fsState.files["/data/sub/b.txt"]).toBeUndefined()
        expect(fsState.dirs).not.toContain("/data")
        expect(fsState.dirs).not.toContain("/data/sub")
    })
})
