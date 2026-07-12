import{ipcMain}from "electron"
import type{BrowserWindow}from "electron"
import{WINDOW_MINIMIZE_CHANNEL,WINDOW_MAXIMIZE_TOGGLE_CHANNEL,WINDOW_CLOSE_CHANNEL,WINDOW_IS_MAXIMIZED_CHANNEL}from "./types/ipc.ts"
import type{IpcChannel,IpcRequest,IpcResponse}from "./types/ipc.ts"
export function handle<C extends IpcChannel>(channel:C,handler:(event:Electron.IpcMainInvokeEvent,request:IpcRequest<C>)=>IpcResponse<C>|Promise<IpcResponse<C>>):void{
    ipcMain.handle(channel,async(event,request)=>{
        try{
            return await handler(event,request as IpcRequest<C>)
        }
        catch(error){
            console.error(`[ipc] handler for "${channel}" failed:`,error)
            throw error
        }
    })
}
export function registerWindowControlHandlers(getMainWindow:()=>BrowserWindow|null):void{
    handle(WINDOW_MINIMIZE_CHANNEL,async()=>{
        let win=getMainWindow()
        if(win&&!win.isDestroyed())win.minimize()
    })
    handle(WINDOW_MAXIMIZE_TOGGLE_CHANNEL,async()=>{
        let win=getMainWindow()
        if(!win||win.isDestroyed())return
        if(win.isMaximized()){
            win.unmaximize()
        }
        else{
            win.maximize()
        }
    })
    handle(WINDOW_CLOSE_CHANNEL,async()=>{
        let win=getMainWindow()
        if(win&&!win.isDestroyed())win.close()
    })
    handle(WINDOW_IS_MAXIMIZED_CHANNEL,async():Promise<boolean>=>{
        let win=getMainWindow()
        if(!win||win.isDestroyed())return false
        return win.isMaximized()
    })
}
