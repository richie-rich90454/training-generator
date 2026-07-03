import{ipcMain}from "electron"
import type{IpcChannel,IpcRequest,IpcResponse}from "./types/ipc.js"
export function handle<C extends IpcChannel>(channel:C,handler:(event:Electron.IpcMainInvokeEvent,request:IpcRequest<C>)=>IpcResponse<C>|Promise<IpcResponse<C>>):void{
    ipcMain.handle(channel,(event,request)=>handler(event,request))
}
