// @vitest-environment happy-dom
import{describe,test,expect,vi,beforeEach}from "vitest"
import{WINDOW_MINIMIZE_CHANNEL,WINDOW_MAXIMIZE_TOGGLE_CHANNEL,WINDOW_CLOSE_CHANNEL,WINDOW_IS_MAXIMIZED_CHANNEL,WINDOW_MAXIMIZED_CHANGED_EVENT}from "../src/types/ipc.ts"
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
