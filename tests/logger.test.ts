// @vitest-environment node
import{describe, test, expect, vi, beforeEach}from"vitest"
import fs from"fs"
import{Logger, LogLevel, LogEntry, levelToNumber, formatLogEntry}from"../src/core/logger.js"
let fsState=vi.hoisted(()=>({
    files: {} as Record<string, string>,
    join(...parts: string[]): string{
        return parts.join("/").replace(/\/+/g, "/")
    },
    dirname(p: string): string{
        let parts=p.split("/")
        parts.pop()
        return parts.join("/") || "/"
    },
    basename(p: string, ext?: string): string{
        let name=p.split("/").pop() || ""
        if (ext && name.endsWith(ext)){
            name=name.slice(0, -ext.length)
        }
        return name
    },
    extname(p: string): string{
        let name=p.split("/").pop() || ""
        let idx=name.lastIndexOf(".")
        return idx > 0 ? name.slice(idx) : ""
    },
    reset(): void{
        this.files={}
    },
    addFile(p: string, content: string): void{
        this.files[this.join(p)]=content
    }
}))
vi.mock("path", ()=>({
    default: {
        join: (...parts: string[])=>fsState.join(...parts),
        dirname: (p: string)=>fsState.dirname(p),
        basename: (p: string, ext?: string)=>fsState.basename(p, ext),
        extname: (p: string)=>fsState.extname(p)
    }
}))
vi.mock("fs", ()=>({
    default: {
        existsSync: vi.fn((p: string)=>fsState.join(p) in fsState.files),
        statSync: vi.fn((p: string)=>{
            let content=fsState.files[fsState.join(p)] ?? ""
            return {size: Buffer.byteLength(content, "utf8")}
        }),
        renameSync: vi.fn((src: string, dst: string)=>{
            let s=fsState.join(src)
            let d=fsState.join(dst)
            if (!(s in fsState.files)){
                let err=new Error("ENOENT") as NodeJS.ErrnoException
                err.code="ENOENT"
                throw err
            }
            fsState.files[d]=fsState.files[s]
            delete fsState.files[s]
        }),
        unlinkSync: vi.fn((p: string)=>{
            delete fsState.files[fsState.join(p)]
        }),
        appendFileSync: vi.fn((p: string, data: string)=>{
            let normalized=fsState.join(p)
            fsState.files[normalized]=(fsState.files[normalized] ?? "") + data
        }),
        mkdirSync: vi.fn((_p: string, _options?: any)=>{}),
        writeFileSync: vi.fn((p: string, data: string)=>{
            fsState.files[fsState.join(p)]=data
        })
    }
}))
beforeEach(()=>{
    fsState.reset()
    vi.clearAllMocks()
})
describe("levelToNumber", ()=>{
    test("maps levels in ascending order", ()=>{
        expect(levelToNumber("debug")).toBe(0)
        expect(levelToNumber("info")).toBe(1)
        expect(levelToNumber("warn")).toBe(2)
        expect(levelToNumber("error")).toBe(3)
    })
})
describe("formatLogEntry", ()=>{
    test("returns JSON for json format", ()=>{
        let entry: LogEntry={timestamp: "2024-01-01T00:00:00.000Z", level: "info", message: "hello"}
        let result=formatLogEntry(entry, "json")
        expect(JSON.parse(result)).toEqual(entry)
    })
    test("returns text for text format", ()=>{
        let entry: LogEntry={timestamp: "2024-01-01T00:00:00.000Z", level: "info", message: "hello"}
        let result=formatLogEntry(entry, "text")
        expect(result).toBe("2024-01-01T00:00:00.000Z INFO hello")
    })
    test("text includes context", ()=>{
        let entry: LogEntry={timestamp: "2024-01-01T00:00:00.000Z", level: "info", message: "hello", context: {id: 1}}
        let result=formatLogEntry(entry, "text")
        expect(result).toBe('2024-01-01T00:00:00.000Z INFO hello {"id":1}')
    })
    test("text includes trace", ()=>{
        let entry: LogEntry={timestamp: "2024-01-01T00:00:00.000Z", level: "error", message: "fail", trace: ["at a", "at b"]}
        let result=formatLogEntry(entry, "text")
        expect(result).toBe("2024-01-01T00:00:00.000Z ERROR fail at a\nat b")
    })
})
describe("Logger level filtering", ()=>{
    test("default level filters debug and emits info", ()=>{
        let logger=new Logger({file: "/logs/app.log"})
        logger.debug("dbg")
        expect(fsState.files["/logs/app.log"]).toBeUndefined()
        logger.info("msg")
        expect(fsState.files["/logs/app.log"]).toBeDefined()
    })
    test("info is emitted when level is info", ()=>{
        let logger=new Logger({level: "info", file: "/logs/app.log"})
        logger.info("msg")
        let parsed=JSON.parse(fsState.files["/logs/app.log"].trim())
        expect(parsed.message).toBe("msg")
    })
    test("warn is emitted when level is info", ()=>{
        let logger=new Logger({level: "info", file: "/logs/app.log"})
        logger.warn("msg")
        expect(fsState.files["/logs/app.log"]).toBeDefined()
    })
    test("error is emitted when level is info", ()=>{
        let logger=new Logger({level: "info", file: "/logs/app.log"})
        logger.error("msg")
        expect(fsState.files["/logs/app.log"]).toBeDefined()
    })
    test("info is filtered when level is warn", ()=>{
        let logger=new Logger({level: "warn", file: "/logs/app.log"})
        logger.info("msg")
        expect(fsState.files["/logs/app.log"]).toBeUndefined()
    })
    test("warn is emitted when level is warn", ()=>{
        let logger=new Logger({level: "warn", file: "/logs/app.log"})
        logger.warn("msg")
        expect(fsState.files["/logs/app.log"]).toBeDefined()
    })
    test("error is emitted when level is warn", ()=>{
        let logger=new Logger({level: "warn", file: "/logs/app.log"})
        logger.error("msg")
        expect(fsState.files["/logs/app.log"]).toBeDefined()
    })
})
describe("Logger context", ()=>{
    test("context is included in entry", ()=>{
        let logger=new Logger({file: "/logs/app.log"})
        logger.info("msg", {user: "alice"})
        let parsed=JSON.parse(fsState.files["/logs/app.log"].trim())
        expect(parsed.context).toEqual({user: "alice"})
    })
    test("child logger includes parent context", ()=>{
        let parent=new Logger({file: "/logs/app.log", level: "debug"})
        let child=parent.child({module: "auth"})
        child.info("msg")
        let parsed=JSON.parse(fsState.files["/logs/app.log"].trim())
        expect(parsed.context).toEqual({module: "auth"})
    })
    test("child logger merges parent and child context", ()=>{
        let parent=new Logger({file: "/logs/app.log"})
        let child=parent.child({a: 1})
        let grandchild=child.child({b: 2})
        grandchild.info("msg")
        let parsed=JSON.parse(fsState.files["/logs/app.log"].trim())
        expect(parsed.context).toEqual({a: 1, b: 2})
    })
    test("child logger overrides parent context", ()=>{
        let parent=new Logger({file: "/logs/app.log"})
        let child=parent.child({a: 1})
        let grandchild=child.child({a: 2})
        grandchild.info("msg")
        let parsed=JSON.parse(fsState.files["/logs/app.log"].trim())
        expect(parsed.context).toEqual({a: 2})
    })
    test("child logger inherits level config", ()=>{
        let parent=new Logger({level: "error", file: "/logs/app.log"})
        let child=parent.child({module: "auth"})
        child.warn("warn-msg")
        expect(fsState.files["/logs/app.log"]).toBeUndefined()
        child.error("error-msg")
        expect(fsState.files["/logs/app.log"]).toBeDefined()
    })
})
describe("Logger output formats", ()=>{
    test("writes JSON format by default", ()=>{
        let logger=new Logger({file: "/logs/app.log"})
        logger.info("msg")
        let line=fsState.files["/logs/app.log"].trim()
        let parsed=JSON.parse(line)
        expect(parsed.message).toBe("msg")
        expect(parsed.level).toBe("info")
    })
    test("writes text format when configured", ()=>{
        let logger=new Logger({file: "/logs/app.log", format: "text"})
        logger.info("msg")
        let line=fsState.files["/logs/app.log"].trim()
        expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T.* INFO msg$/)
    })
})
describe("Logger file behavior", ()=>{
    test("file appends entries", ()=>{
        let logger=new Logger({file: "/logs/app.log"})
        logger.info("a")
        logger.info("b")
        let lines=fsState.files["/logs/app.log"].trim().split("\n")
        expect(lines.length).toBe(2)
        expect(JSON.parse(lines[0]).message).toBe("a")
        expect(JSON.parse(lines[1]).message).toBe("b")
    })
    test("getLogPath returns file path", ()=>{
        let logger=new Logger({file: "/logs/app.log"})
        expect(logger.getLogPath()).toBe("/logs/app.log")
    })
    test("getLogPath returns undefined when no file", ()=>{
        let logger=new Logger()
        expect(logger.getLogPath()).toBeUndefined()
    })
    test("rotateIfNeeded renames file when too large", ()=>{
        fsState.addFile("/logs/app.log", "x".repeat(100))
        let logger=new Logger({file: "/logs/app.log", maxSizeBytes: 50})
        logger.rotateIfNeeded()
        expect(fsState.files["/logs/app.log"]).toBeUndefined()
        expect(fsState.files["/logs/app.log.1"]).toBe("x".repeat(100))
    })
    test("rotateIfNeeded does nothing when file is small", ()=>{
        fsState.addFile("/logs/app.log", "small")
        let logger=new Logger({file: "/logs/app.log", maxSizeBytes: 1000})
        logger.rotateIfNeeded()
        expect(fsState.files["/logs/app.log"]).toBe("small")
        expect(fsState.files["/logs/app.log.1"]).toBeUndefined()
    })
    test("maxFiles limits rotations", ()=>{
        fsState.addFile("/logs/app.log", "current")
        fsState.addFile("/logs/app.log.1", "one")
        fsState.addFile("/logs/app.log.2", "two")
        let logger=new Logger({file: "/logs/app.log", maxSizeBytes: 0, maxFiles: 3})
        logger.rotateIfNeeded()
        expect(fsState.files["/logs/app.log"]).toBeUndefined()
        expect(fsState.files["/logs/app.log.1"]).toBe("current")
        expect(fsState.files["/logs/app.log.2"]).toBe("one")
        expect(fsState.files["/logs/app.log.3"]).toBeUndefined()
    })
    test("rotation deletes oldest when maxFiles reached", ()=>{
        fsState.addFile("/logs/app.log", "current")
        fsState.addFile("/logs/app.log.1", "one")
        fsState.addFile("/logs/app.log.2", "two")
        let logger=new Logger({file: "/logs/app.log", maxSizeBytes: 0, maxFiles: 3})
        logger.rotateIfNeeded()
        expect(fsState.files["/logs/app.log.3"]).toBeUndefined()
        expect(fsState.files["/logs/app.log.2"]).toBe("one")
    })
})
describe("Logger console output", ()=>{
    test("console output when enabled", ()=>{
        let spy=vi.spyOn(console, "log").mockImplementation(()=>{})
        let logger=new Logger({console: true})
        logger.info("msg")
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
    })
    test("console output includes message", ()=>{
        let spy=vi.spyOn(console, "log").mockImplementation(()=>{})
        let logger=new Logger({console: true, format: "text"})
        logger.info("msg")
        let call=spy.mock.calls[0][0] as string
        expect(call).toContain("INFO")
        expect(call).toContain("msg")
        spy.mockRestore()
    })
})