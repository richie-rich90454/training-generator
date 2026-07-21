import{describe,test,expect,vi,beforeEach}from "vitest"

// Strict structural type matching what `applyTaskbarProgress` expects for the
// `mainWindow` parameter. Using this instead of `ReturnType<typeof vi.fn>`
// avoids the Mock-vs-Procedure assignability errors that vitest's Mock type
// triggers when assigned to a strict callable signature.
interface MockWindow{
    isDestroyed():boolean
    setProgressBar(p:number):void
}

// Mock electron so importing src/main.ts (which has top-level side effects) is safe.
// Only the surface area touched at import time needs to be mocked; the pure
// functions under test (mapSetProgressPayload / dockBadgeForProgress /
// applyTaskbarProgress) take all their dependencies as parameters.
vi.mock("electron",()=>{
    return{
        app:{
            getPath:vi.fn(()=>process.cwd()),
            setPath:vi.fn(),
            getAppPath:vi.fn(()=>process.cwd()),
            commandLine:{appendSwitch:vi.fn()},
            whenReady:vi.fn(()=>Promise.resolve()),
            on:vi.fn(),
            getVersion:vi.fn(()=>"1.0.0"),
            quit:vi.fn(),
            requestSingleInstanceLock:vi.fn(()=>true),
            exit:vi.fn(),
            disableHardwareAcceleration:vi.fn()
        },
        BrowserWindow:vi.fn(function(){
            return{
                loadFile:vi.fn(()=>Promise.resolve()),
                loadURL:vi.fn(()=>Promise.resolve()),
                on:vi.fn(),
                once:vi.fn(),
                show:vi.fn(),
                hide:vi.fn(),
                focus:vi.fn(),
                close:vi.fn(),
                center:vi.fn(),
                restore:vi.fn(),
                setMenu:vi.fn(),
                setBackgroundMaterial:vi.fn(),
                isDestroyed:vi.fn(()=>false),
                isMinimized:vi.fn(()=>false),
                isVisible:vi.fn(()=>true),
                isFocused:vi.fn(()=>true),
                isMaximized:vi.fn(()=>false),
                minimize:vi.fn(),
                maximize:vi.fn(),
                unmaximize:vi.fn(),
                webContents:{
                    executeJavaScript:vi.fn(()=>Promise.resolve()),
                    openDevTools:vi.fn(),
                    setWindowOpenHandler:vi.fn(),
                    on:vi.fn(),
                    once:vi.fn(),
                    send:vi.fn(),
                    getURL:vi.fn(()=>"")
                }
            }
        }),
        ipcMain:{handle:vi.fn(),on:vi.fn()},
        dialog:{showOpenDialog:vi.fn(),showSaveDialog:vi.fn(),showErrorBox:vi.fn()},
        protocol:{registerSchemesAsPrivileged:vi.fn(),handle:vi.fn()},
        nativeImage:{createFromPath:vi.fn(()=>({isEmpty:vi.fn(()=>false)}))},
        Tray:vi.fn(function(){return{setToolTip:vi.fn(),setContextMenu:vi.fn(),on:vi.fn(),setImage:vi.fn(),isDestroyed:vi.fn(()=>false),destroy:vi.fn(),popUpContextMenu:vi.fn()}}),
        Menu:{buildFromTemplate:vi.fn(()=>({on:vi.fn(),popup:vi.fn()}))},
        shell:{openExternal:vi.fn(),openPath:vi.fn()},
        safeStorage:{isEncryptionAvailable:vi.fn(()=>false),encryptString:vi.fn(),decryptString:vi.fn()}
    }
})

vi.mock("axios",()=>{
    return{
        default:{
            get:vi.fn().mockResolvedValue({data:{models:[]}}),
            post:vi.fn().mockResolvedValue({data:{response:"test"}})
        }
    }
})

vi.mock("../src/core/fileParserLazy.js",()=>({default:vi.fn()}))

// Lazy-imported so the vi.mock calls above are hoisted before the module loads.
let mapSetProgressPayload:(value:number)=>number
let dockBadgeForProgress:(value:number)=>string
// `applyTaskbarProgress` is typed loosely here so we can pass a minimal mock
// object that only implements `isDestroyed` and `setProgressBar` — the real
// signature requires a full `BrowserWindow` (175+ properties) which would
// force us to mock all of Electron. The function itself only touches the two
// methods on the window, so the cast is sound at runtime.
let applyTaskbarProgress:(
    mainWindow:unknown,
    value:number,
    options:{platform:string;dock?:{setBadge:(text:string)=>void}|null}
)=>void

beforeEach(async()=>{
    vi.clearAllMocks()
    const mainModule=await import("../src/main.js")
    mapSetProgressPayload=mainModule.mapSetProgressPayload
    dockBadgeForProgress=mainModule.dockBadgeForProgress
    applyTaskbarProgress=mainModule.applyTaskbarProgress as typeof applyTaskbarProgress
})

function createMockWindow(overrides:{isDestroyed?:()=>boolean;setProgressBar?:(p:number)=>void}={}):MockWindow{
    return{
        isDestroyed:overrides.isDestroyed ?? vi.fn(()=>false),
        setProgressBar:overrides.setProgressBar ?? vi.fn()
    }
}

describe("mapSetProgressPayload",()=>{
    test("0 maps to 0",()=>{
        expect(mapSetProgressPayload(0)).toBe(0)
    })
    test("0.5 maps to 0.5",()=>{
        expect(mapSetProgressPayload(0.5)).toBe(0.5)
    })
    test("1 maps to 1",()=>{
        expect(mapSetProgressPayload(1)).toBe(1)
    })
    test("-1 (indeterminate) maps to 2 (Electron indeterminate sentinel)",()=>{
        expect(mapSetProgressPayload(-1)).toBe(2)
    })
    test("-2 (clear) maps to -1 (Electron remove sentinel)",()=>{
        expect(mapSetProgressPayload(-2)).toBe(-1)
    })
    test("1.5 (above range) clamps to 1",()=>{
        expect(mapSetProgressPayload(1.5)).toBe(1)
    })
    test("-0.5 (below range, not -1/-2) clamps to 0",()=>{
        expect(mapSetProgressPayload(-0.5)).toBe(0)
    })
    test("-5 (below range, not -1/-2) clamps to 0",()=>{
        expect(mapSetProgressPayload(-5)).toBe(0)
    })
    test("NaN maps to 0 (defensive)",()=>{
        expect(mapSetProgressPayload(NaN)).toBe(0)
    })
})

describe("dockBadgeForProgress",()=>{
    test("0 maps to '0%'",()=>{
        expect(dockBadgeForProgress(0)).toBe("0%")
    })
    test("0.5 maps to '50%'",()=>{
        expect(dockBadgeForProgress(0.5)).toBe("50%")
    })
    test("1 maps to '100%'",()=>{
        expect(dockBadgeForProgress(1)).toBe("100%")
    })
    test("-1 (indeterminate) maps to '' (cleared)",()=>{
        expect(dockBadgeForProgress(-1)).toBe("")
    })
    test("-2 (clear) maps to '' (cleared)",()=>{
        expect(dockBadgeForProgress(-2)).toBe("")
    })
    test("0.423 rounds to '42%'",()=>{
        expect(dockBadgeForProgress(0.423)).toBe("42%")
    })
    test("0.426 rounds to '43%'",()=>{
        expect(dockBadgeForProgress(0.426)).toBe("43%")
    })
    test("1.5 (above range) clamps to '100%'",()=>{
        expect(dockBadgeForProgress(1.5)).toBe("100%")
    })
    test("NaN maps to '0%' (defensive)",()=>{
        expect(dockBadgeForProgress(NaN)).toBe("0%")
    })
})

describe("applyTaskbarProgress",()=>{
    test("calls setProgressBar with mapped value on Linux (no dock badge)",()=>{
        const win=createMockWindow()
        applyTaskbarProgress(win,0.5,{platform:"linux"})
        expect(win.setProgressBar).toHaveBeenCalledWith(0.5)
    })
    test("calls setProgressBar with 0 for value 0",()=>{
        const win=createMockWindow()
        applyTaskbarProgress(win,0,{platform:"linux"})
        expect(win.setProgressBar).toHaveBeenCalledWith(0)
    })
    test("calls setProgressBar with 1 for value 1",()=>{
        const win=createMockWindow()
        applyTaskbarProgress(win,1,{platform:"linux"})
        expect(win.setProgressBar).toHaveBeenCalledWith(1)
    })
    test("calls setProgressBar with 2 for indeterminate (-1)",()=>{
        const win=createMockWindow()
        applyTaskbarProgress(win,-1,{platform:"linux"})
        expect(win.setProgressBar).toHaveBeenCalledWith(2)
    })
    test("calls setProgressBar with -1 for clear (-2)",()=>{
        const win=createMockWindow()
        applyTaskbarProgress(win,-2,{platform:"linux"})
        expect(win.setProgressBar).toHaveBeenCalledWith(-1)
    })
    test("clamps 1.5 to 1",()=>{
        const win=createMockWindow()
        applyTaskbarProgress(win,1.5,{platform:"linux"})
        expect(win.setProgressBar).toHaveBeenCalledWith(1)
    })
    test("clamps -0.5 to 0",()=>{
        const win=createMockWindow()
        applyTaskbarProgress(win,-0.5,{platform:"linux"})
        expect(win.setProgressBar).toHaveBeenCalledWith(0)
    })
    test("clamps -5 to 0 (not treated as clear)",()=>{
        const win=createMockWindow()
        applyTaskbarProgress(win,-5,{platform:"linux"})
        expect(win.setProgressBar).toHaveBeenCalledWith(0)
    })
    test("NaN maps to 0",()=>{
        const win=createMockWindow()
        applyTaskbarProgress(win,NaN,{platform:"linux"})
        expect(win.setProgressBar).toHaveBeenCalledWith(0)
    })

    test("on macOS, also calls dock.setBadge with percentage text",()=>{
        const win=createMockWindow()
        const dock={setBadge:vi.fn()}
        applyTaskbarProgress(win,0.42,{platform:"darwin",dock})
        expect(win.setProgressBar).toHaveBeenCalledWith(0.42)
        expect(dock.setBadge).toHaveBeenCalledWith("42%")
    })
    test("on macOS with value 0, dock badge is '0%'",()=>{
        const win=createMockWindow()
        const dock={setBadge:vi.fn()}
        applyTaskbarProgress(win,0,{platform:"darwin",dock})
        expect(dock.setBadge).toHaveBeenCalledWith("0%")
    })
    test("on macOS with value 1, dock badge is '100%'",()=>{
        const win=createMockWindow()
        const dock={setBadge:vi.fn()}
        applyTaskbarProgress(win,1,{platform:"darwin",dock})
        expect(dock.setBadge).toHaveBeenCalledWith("100%")
    })
    test("on macOS with indeterminate (-1), dock badge is cleared",()=>{
        const win=createMockWindow()
        const dock={setBadge:vi.fn()}
        applyTaskbarProgress(win,-1,{platform:"darwin",dock})
        expect(win.setProgressBar).toHaveBeenCalledWith(2)
        expect(dock.setBadge).toHaveBeenCalledWith("")
    })
    test("on macOS with clear (-2), dock badge is cleared",()=>{
        const win=createMockWindow()
        const dock={setBadge:vi.fn()}
        applyTaskbarProgress(win,-2,{platform:"darwin",dock})
        expect(win.setProgressBar).toHaveBeenCalledWith(-1)
        expect(dock.setBadge).toHaveBeenCalledWith("")
    })

    test("on Windows, does not call dock.setBadge",()=>{
        const win=createMockWindow()
        const dock={setBadge:vi.fn()}
        applyTaskbarProgress(win,0.5,{platform:"win32",dock})
        expect(win.setProgressBar).toHaveBeenCalledWith(0.5)
        expect(dock.setBadge).not.toHaveBeenCalled()
    })
    test("on Linux, does not call dock.setBadge",()=>{
        const win=createMockWindow()
        const dock={setBadge:vi.fn()}
        applyTaskbarProgress(win,0.5,{platform:"linux",dock})
        expect(win.setProgressBar).toHaveBeenCalledWith(0.5)
        expect(dock.setBadge).not.toHaveBeenCalled()
    })

    test("on macOS with null dock, does not throw and still sets progress bar",()=>{
        const win=createMockWindow()
        expect(()=>applyTaskbarProgress(win,0.5,{platform:"darwin",dock:null})).not.toThrow()
        expect(win.setProgressBar).toHaveBeenCalledWith(0.5)
    })
    test("on macOS with undefined dock, does not throw",()=>{
        const win=createMockWindow()
        expect(()=>applyTaskbarProgress(win,0.5,{platform:"darwin"})).not.toThrow()
        expect(win.setProgressBar).toHaveBeenCalledWith(0.5)
    })

    test("null window does not throw and does not call setProgressBar",()=>{
        const win=null
        expect(()=>applyTaskbarProgress(win,0.5,{platform:"linux"})).not.toThrow()
    })
    test("destroyed window does not throw and does not call setProgressBar",()=>{
        const win=createMockWindow({isDestroyed:vi.fn(()=>true)})
        const setProgressBar=win.setProgressBar
        applyTaskbarProgress(win,0.5,{platform:"linux"})
        expect(setProgressBar).not.toHaveBeenCalled()
    })

    test("swallows setProgressBar errors (no throw)",()=>{
        const win=createMockWindow({
            setProgressBar:vi.fn(()=>{throw new Error("platform unsupported")})
        })
        vi.spyOn(console,"warn").mockImplementation(()=>{})
        expect(()=>applyTaskbarProgress(win,0.5,{platform:"linux"})).not.toThrow()
        expect(console.warn).toHaveBeenCalled()
    })
    test("swallows dock.setBadge errors (no throw)",()=>{
        const win=createMockWindow()
        const dock={setBadge:vi.fn(()=>{throw new Error("dock unavailable")})}
        vi.spyOn(console,"warn").mockImplementation(()=>{})
        expect(()=>applyTaskbarProgress(win,0.5,{platform:"darwin",dock})).not.toThrow()
        expect(console.warn).toHaveBeenCalled()
    })
})
