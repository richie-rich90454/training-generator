// @vitest-environment happy-dom
import{describe,test,expect,vi,beforeEach,afterEach}from "vitest"
import{WINDOW_MINIMIZE_CHANNEL,WINDOW_MAXIMIZE_TOGGLE_CHANNEL,WINDOW_CLOSE_CHANNEL,WINDOW_IS_MAXIMIZED_CHANNEL,WINDOW_MAXIMIZED_CHANGED_EVENT}from "../src/types/ipc.ts"
import{initWindowControls,disposeWindowControls}from "../src/renderer/windowControls.ts"
let state=vi.hoisted(()=>({
    exposedAPI:undefined as any,
    listeners:{} as Record<string,Array<(...args:any[])=>void>>
}))
vi.mock("electron",()=>{
    return{
        contextBridge:{
            exposeInMainWorld:vi.fn((name:string,api:unknown)=>{
                state.exposedAPI=api
            })
        },
        ipcRenderer:{
            invoke:vi.fn(),
            on:vi.fn((channel:string,cb:(...args:any[])=>void)=>{
                state.listeners[channel]=state.listeners[channel]||[]
                state.listeners[channel].push(cb)
            }),
            off:vi.fn((channel:string,cb:(...args:any[])=>void)=>{
                if(state.listeners[channel]){
                    state.listeners[channel]=state.listeners[channel].filter(fn=>fn!==cb)
                }
            })
        }
    }
})
import "../src/preload.ts"
import{ipcRenderer,contextBridge}from "electron"
describe("Window control IPC channel constants",()=>{
    test("WINDOW_MINIMIZE_CHANNEL is 'window:minimize'",()=>{
        expect(WINDOW_MINIMIZE_CHANNEL).toBe("window:minimize")
    })
    test("WINDOW_MAXIMIZE_TOGGLE_CHANNEL is 'window:maximizeToggle'",()=>{
        expect(WINDOW_MAXIMIZE_TOGGLE_CHANNEL).toBe("window:maximizeToggle")
    })
    test("WINDOW_CLOSE_CHANNEL is 'window:close'",()=>{
        expect(WINDOW_CLOSE_CHANNEL).toBe("window:close")
    })
    test("WINDOW_IS_MAXIMIZED_CHANNEL is 'window:isMaximized'",()=>{
        expect(WINDOW_IS_MAXIMIZED_CHANNEL).toBe("window:isMaximized")
    })
    test("WINDOW_MAXIMIZED_CHANGED_EVENT is 'window:maximizedChanged'",()=>{
        expect(WINDOW_MAXIMIZED_CHANGED_EVENT).toBe("window:maximizedChanged")
    })
})
describe("Preload exposes window control methods",()=>{
    beforeEach(()=>{
        state.listeners={}
    })
    test("exposes all 5 window control methods",()=>{
        expect(state.exposedAPI.windowMinimize).toBeDefined()
        expect(state.exposedAPI.windowMaximizeToggle).toBeDefined()
        expect(state.exposedAPI.windowClose).toBeDefined()
        expect(state.exposedAPI.windowIsMaximized).toBeDefined()
        expect(state.exposedAPI.onWindowMaximizedChange).toBeDefined()
    })
    test("contextBridge.exposeInMainWorld was called with electronAPI",()=>{
        expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith("electronAPI",expect.any(Object))
    })
    test("windowMinimize calls invoke with WINDOW_MINIMIZE_CHANNEL",async()=>{
        await state.exposedAPI.windowMinimize()
        expect(ipcRenderer.invoke).toHaveBeenCalledWith(WINDOW_MINIMIZE_CHANNEL,undefined)
    })
    test("windowMaximizeToggle calls invoke with WINDOW_MAXIMIZE_TOGGLE_CHANNEL",async()=>{
        await state.exposedAPI.windowMaximizeToggle()
        expect(ipcRenderer.invoke).toHaveBeenCalledWith(WINDOW_MAXIMIZE_TOGGLE_CHANNEL,undefined)
    })
    test("windowClose calls invoke with WINDOW_CLOSE_CHANNEL",async()=>{
        await state.exposedAPI.windowClose()
        expect(ipcRenderer.invoke).toHaveBeenCalledWith(WINDOW_CLOSE_CHANNEL,undefined)
    })
    test("windowIsMaximized calls invoke with WINDOW_IS_MAXIMIZED_CHANNEL",async()=>{
        await state.exposedAPI.windowIsMaximized()
        expect(ipcRenderer.invoke).toHaveBeenCalledWith(WINDOW_IS_MAXIMIZED_CHANNEL,undefined)
    })
})
describe("onWindowMaximizedChange",()=>{
    beforeEach(()=>{
        state.listeners={}
    })
    test("registers listener via ipcRenderer.on with WINDOW_MAXIMIZED_CHANGED_EVENT",()=>{
        let cb=vi.fn()
        state.exposedAPI.onWindowMaximizedChange(cb)
        expect(ipcRenderer.on).toHaveBeenCalledWith(WINDOW_MAXIMIZED_CHANGED_EVENT,expect.any(Function))
    })
    test("returns an unsubscribe function",()=>{
        let unsub=state.exposedAPI.onWindowMaximizedChange(()=>{})
        expect(typeof unsub).toBe("function")
    })
    test("calling unsubscribe removes listener via ipcRenderer.off",()=>{
        let unsub=state.exposedAPI.onWindowMaximizedChange(()=>{})
        unsub()
        expect(ipcRenderer.off).toHaveBeenCalledWith(WINDOW_MAXIMIZED_CHANGED_EVENT,expect.any(Function))
    })
    test("callback fires with correct boolean when event emits",()=>{
        let cb=vi.fn()
        state.exposedAPI.onWindowMaximizedChange(cb)
        let handlers=state.listeners[WINDOW_MAXIMIZED_CHANGED_EVENT]||[]
        expect(handlers.length).toBe(1)
        handlers[0]({},true)
        expect(cb).toHaveBeenCalledWith(true)
        handlers[0]({},false)
        expect(cb).toHaveBeenCalledWith(false)
    })
})
describe("renderer window controls",()=>{
    let mockUnsubscribe:ReturnType<typeof vi.fn>
    let mockOnWindowMaximizedChange:ReturnType<typeof vi.fn>
    let savedElectronAPI:unknown
    beforeEach(()=>{
        vi.spyOn(console,"warn").mockImplementation(()=>{})
        savedElectronAPI=(window as any).electronAPI
        mockUnsubscribe=vi.fn()
        mockOnWindowMaximizedChange=vi.fn((cb:(isMaximized:boolean)=>void)=>{
            return mockUnsubscribe
        })
        ;(window as any).electronAPI={
            windowMinimize:vi.fn(),
            windowMaximizeToggle:vi.fn(),
            windowClose:vi.fn(),
            onWindowMaximizedChange:mockOnWindowMaximizedChange
        }
        document.body.innerHTML='<div class="window-controls"><button class="window-btn window-btn-min"></button><button class="window-btn window-btn-max"></button><button class="window-btn window-btn-close"></button></div>'
        disposeWindowControls()
    })
    afterEach(()=>{
        disposeWindowControls()
        ;(window as any).electronAPI=savedElectronAPI
        document.body.innerHTML=""
    })
    test("clicking min button calls windowMinimize",()=>{
        initWindowControls()
        let minBtn=document.querySelector<HTMLButtonElement>(".window-btn-min")!
        minBtn.click()
        expect((window as any).electronAPI.windowMinimize).toHaveBeenCalled()
    })
    test("clicking max button calls windowMaximizeToggle",()=>{
        initWindowControls()
        let maxBtn=document.querySelector<HTMLButtonElement>(".window-btn-max")!
        maxBtn.click()
        expect((window as any).electronAPI.windowMaximizeToggle).toHaveBeenCalled()
    })
    test("clicking close button calls windowClose",()=>{
        initWindowControls()
        let closeBtn=document.querySelector<HTMLButtonElement>(".window-btn-close")!
        closeBtn.click()
        expect((window as any).electronAPI.windowClose).toHaveBeenCalled()
    })
    test("subscribes to onWindowMaximizedChange",()=>{
        initWindowControls()
        expect(mockOnWindowMaximizedChange).toHaveBeenCalledWith(expect.any(Function))
    })
    test("maximized=true adds is-maximized class to max button",()=>{
        initWindowControls()
        let cb=mockOnWindowMaximizedChange.mock.calls[0][0] as any
        let maxBtn=document.querySelector<HTMLButtonElement>(".window-btn-max")!
        cb(true)
        expect(maxBtn.classList.contains("is-maximized")).toBe(true)
    })
    test("maximized=false removes is-maximized class from max button",()=>{
        initWindowControls()
        let cb=mockOnWindowMaximizedChange.mock.calls[0][0] as any
        let maxBtn=document.querySelector<HTMLButtonElement>(".window-btn-max")!
        cb(true)
        cb(false)
        expect(maxBtn.classList.contains("is-maximized")).toBe(false)
    })
    test("disposeWindowControls calls unsubscribe",()=>{
        initWindowControls()
        disposeWindowControls()
        expect(mockUnsubscribe).toHaveBeenCalled()
    })
    test("handles missing electronAPI gracefully",()=>{
        ;(window as any).electronAPI=undefined
        initWindowControls()
        let minBtn=document.querySelector<HTMLButtonElement>(".window-btn-min")!
        expect(()=>minBtn.click()).not.toThrow()
    })
})
