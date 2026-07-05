// @vitest-environment node
import {describe, it, expect, vi, beforeEach, afterEach} from "vitest"
import {FolderWatcher, isSupportedFile, createWatcherInstance, WatchEvent} from "../src/core/folderWatcher.js"
const hoisted=vi.hoisted(()=>{
    let impl: any
    let watcher: any=null
    let handlers: Map<string, Function[]>=new Map()
    function reset(): void{
        watcher=null
        handlers=new Map()
        impl=vi.fn((folders: string[], options: any)=>{
            handlers=new Map()
            watcher={
                on: vi.fn((event: string, handler: Function)=>{
                    if(!handlers.has(event)){
                        handlers.set(event, [])
                    }
                    handlers.get(event)!.push(handler)
                    return watcher
                }),
                close: vi.fn(()=>Promise.resolve()),
                options: options
            }
            return watcher
        })
    }
    function emit(event: string, filePath: string, stats?: any): void{
        let h=handlers.get(event)||[]
        for(let handler of h){
            handler(filePath, stats)
        }
    }
    function getWatcher(): any{
        return watcher
    }
    reset()
    return {
        get impl(): any{
            return impl
        },
        reset,
        emit,
        getWatcher
    }
})
vi.mock("chokidar", ()=>{
    return {
        default: {
            watch: (...args: any[])=>hoisted.impl(...args)
        },
        watch: (...args: any[])=>hoisted.impl(...args)
    }
})
describe("createWatcherInstance", ()=>{
    beforeEach(()=>{
        hoisted.reset()
    })
    it("throws if chokidar not installed", async ()=>{
        hoisted.impl.mockImplementation(()=>{
            throw new Error("chokidar not installed")
        })
        await expect(createWatcherInstance(["/foo"])).rejects.toThrow("chokidar not installed")
    })
    it("creates watcher with default ignored temp files", async ()=>{
        await createWatcherInstance(["/foo"])
        expect(hoisted.impl).toHaveBeenCalledWith(["/foo"], expect.objectContaining({
            ignored: ["*.tmp", "~$*", ".*.swp", ".DS_Store", "Thumbs.db"],
            persistent: true
        }))
    })
    it("creates watcher with custom ignored patterns", async ()=>{
        await createWatcherInstance(["/foo"], {ignored: "*.log"})
        expect(hoisted.impl).toHaveBeenCalledWith(["/foo"], expect.objectContaining({
            ignored: "*.log"
        }))
    })
    it("creates watcher with persistent false", async ()=>{
        await createWatcherInstance(["/foo"], {persistent: false})
        expect(hoisted.impl).toHaveBeenCalledWith(["/foo"], expect.objectContaining({
            persistent: false
        }))
    })
})
describe("isSupportedFile", ()=>{
    it("returns true for pdf", ()=>{
        expect(isSupportedFile("/file.pdf")).toBe(true)
    })
    it("returns true for docx", ()=>{
        expect(isSupportedFile("/file.docx")).toBe(true)
    })
    it("returns true for htm mapped to html", ()=>{
        expect(isSupportedFile("/file.htm")).toBe(true)
    })
    it("returns false for unsupported extension", ()=>{
        expect(isSupportedFile("/file.exe")).toBe(false)
    })
    it("returns false for no extension", ()=>{
        expect(isSupportedFile("/file")).toBe(false)
    })
})
describe("FolderWatcher", ()=>{
    beforeEach(()=>{
        hoisted.reset()
        vi.useFakeTimers()
    })
    afterEach(()=>{
        vi.useRealTimers()
    })
    it("constructor stores folders and options", ()=>{
        let watcher=new FolderWatcher({folders: ["/a", "/b"], options: {debounceMs: 100}})
        expect(watcher.folders).toEqual(["/a", "/b"])
        expect(watcher.getQueue()).toEqual([])
    })
    it("start initializes watcher for each folder", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a", "/b"]})
        await watcher.start()
        expect(hoisted.impl).toHaveBeenCalledWith(["/a", "/b"], expect.any(Object))
        let w=hoisted.getWatcher()
        expect(w.on).toHaveBeenCalledWith("add", expect.any(Function))
        expect(w.on).toHaveBeenCalledWith("change", expect.any(Function))
        expect(w.on).toHaveBeenCalledWith("unlink", expect.any(Function))
    })
    it("stop closes watchers", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        let w=hoisted.getWatcher()
        await watcher.stop()
        expect(w.close).toHaveBeenCalled()
    })
    it("add event enqueues supported file", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("add", "/a/file.pdf", {size: 100, mtimeMs: 12345})
        vi.advanceTimersByTime(500)
        expect(watcher.getQueue()).toHaveLength(1)
        expect(watcher.getQueue()[0].type).toBe("add")
        expect(watcher.getQueue()[0].path).toBe("/a/file.pdf")
    })
    it("change event enqueues", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("change", "/a/file.txt", {size: 50, mtimeMs: 999})
        vi.advanceTimersByTime(500)
        expect(watcher.getQueue()).toHaveLength(1)
        expect(watcher.getQueue()[0].type).toBe("change")
    })
    it("unlink event enqueues", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("unlink", "/a/file.md")
        vi.advanceTimersByTime(500)
        expect(watcher.getQueue()).toHaveLength(1)
        expect(watcher.getQueue()[0].type).toBe("unlink")
        expect(watcher.getQueue()[0].stats).toBeUndefined()
    })
    it("unsupported files are filtered", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("add", "/a/file.exe")
        vi.advanceTimersByTime(500)
        expect(watcher.getQueue()).toHaveLength(0)
    })
    it("debounce prevents duplicate rapid events", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("add", "/a/file.pdf", {size: 100, mtimeMs: 1})
        hoisted.emit("add", "/a/file.pdf", {size: 200, mtimeMs: 2})
        hoisted.emit("add", "/a/file.pdf", {size: 300, mtimeMs: 3})
        vi.advanceTimersByTime(500)
        expect(watcher.getQueue()).toHaveLength(1)
        expect(watcher.getQueue()[0].stats?.size).toBe(300)
    })
    it("debounce allows distinct events after delay", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("add", "/a/file.pdf", {size: 100, mtimeMs: 1})
        vi.advanceTimersByTime(500)
        hoisted.emit("add", "/a/file.pdf", {size: 200, mtimeMs: 2})
        vi.advanceTimersByTime(500)
        expect(watcher.getQueue()).toHaveLength(2)
    })
    it("onEvent callback invoked", async ()=>{
        let events: WatchEvent[]=[]
        let watcher=new FolderWatcher({folders: ["/a"], options: {onEvent: (e: WatchEvent)=>events.push(e)}})
        await watcher.start()
        hoisted.emit("add", "/a/file.pdf", {size: 100, mtimeMs: 1})
        vi.advanceTimersByTime(500)
        expect(events).toHaveLength(1)
        expect(events[0].type).toBe("add")
    })
    it("clearQueue empties queue", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("add", "/a/file.pdf")
        vi.advanceTimersByTime(500)
        expect(watcher.getQueue()).toHaveLength(1)
        watcher.clearQueue()
        expect(watcher.getQueue()).toHaveLength(0)
    })
    it("getQueue returns events", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("add", "/a/file1.pdf")
        hoisted.emit("change", "/a/file2.txt")
        vi.advanceTimersByTime(500)
        let queue=watcher.getQueue()
        expect(queue).toHaveLength(2)
    })
    it("multiple folders each get watcher", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a", "/b", "/c"]})
        await watcher.start()
        expect(hoisted.impl).toHaveBeenCalledWith(["/a", "/b", "/c"], expect.any(Object))
    })
    it("default debounceMs is 500", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("add", "/a/file.pdf")
        vi.advanceTimersByTime(499)
        expect(watcher.getQueue()).toHaveLength(0)
        vi.advanceTimersByTime(1)
        expect(watcher.getQueue()).toHaveLength(1)
    })
    it("stats includes size and mtime", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("add", "/a/file.pdf", {size: 1234, mtimeMs: 5678})
        vi.advanceTimersByTime(500)
        let event=watcher.getQueue()[0]
        expect(event.stats).toEqual({size: 1234, mtime: 5678})
    })
    it("stop clears pending debounce timers", async ()=>{
        let watcher=new FolderWatcher({folders: ["/a"]})
        await watcher.start()
        hoisted.emit("add", "/a/file.pdf")
        await watcher.stop()
        vi.advanceTimersByTime(500)
        expect(watcher.getQueue()).toHaveLength(0)
    })
})
