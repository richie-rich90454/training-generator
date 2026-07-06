let unsubscribe:(()=>void)|null=null
export function initWindowControls():void{
    let minBtn=document.querySelector<HTMLButtonElement>(".window-btn-min")
    let maxBtn=document.querySelector<HTMLButtonElement>(".window-btn-max")
    let closeBtn=document.querySelector<HTMLButtonElement>(".window-btn-close")
    if(minBtn){
        minBtn.addEventListener("click",()=>{
            window.electronAPI?.windowMinimize()
        })
    }
    if(maxBtn){
        maxBtn.addEventListener("click",()=>{
            window.electronAPI?.windowMaximizeToggle()
        })
    }
    if(closeBtn){
        closeBtn.addEventListener("click",()=>{
            window.electronAPI?.windowClose()
        })
    }
    let api=window.electronAPI
    if(api?.onWindowMaximizedChange){
        unsubscribe=api.onWindowMaximizedChange((isMaximized:boolean)=>{
            if(maxBtn){
                maxBtn.classList.toggle("is-maximized",isMaximized)
            }
        })
    }
}
export function disposeWindowControls():void{
    if(unsubscribe){
        unsubscribe()
        unsubscribe=null
    }
}
