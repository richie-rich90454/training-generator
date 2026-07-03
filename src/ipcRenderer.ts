import{ipcRenderer}from "electron"
import type{IpcChannel,IpcRequest,IpcResponse}from "./types/ipc.js"
export function invoke<C extends IpcChannel>(channel:C,...args:IpcRequest<C> extends void ? [] : [request:IpcRequest<C>]):Promise<IpcResponse<C>>{
    let request=args[0]
    return ipcRenderer.invoke(channel,request) as Promise<IpcResponse<C>>
}
