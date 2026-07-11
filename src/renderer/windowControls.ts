let unsubscribe:(()=>void)|null=null
function ensureApi():NonNullable<typeof window.electronAPI>|null{
    let api=window.electronAPI
    if(!api){
        console.warn("[windowControls] window.electronAPI is not available")
        return null
    }
    return api
}
function handleWindowBtn(btn:HTMLButtonElement|null,action:()=>void,label:string):void{
    if(!btn){
        console.warn(`[windowControls] ${label} button not found`)
        return
    }
    let clickHandler=(e:MouseEvent)=>{
        e.stopPropagation()
        action()
    }
    let keyHandler=(e:KeyboardEvent)=>{
        if(e.key==="Enter"||e.key===" "){
            e.preventDefault()
            action()
        }
    }
    btn.addEventListener("click",clickHandler)
    btn.addEventListener("keydown",keyHandler)
}
export function initWindowControls():void{
    let minBtn=document.querySelector<HTMLButtonElement>(".window-btn-min")
    let maxBtn=document.querySelector<HTMLButtonElement>(".window-btn-max")
    let closeBtn=document.querySelector<HTMLButtonElement>(".window-btn-close")
    let api=ensureApi()
    if(!api){
        return
    }
    handleWindowBtn(minBtn,()=>api.windowMinimize(),"minimize")
    handleWindowBtn(maxBtn,()=>api.windowMaximizeToggle(),"maximize")
    handleWindowBtn(closeBtn,()=>api.windowClose(),"close")
    if(api.onWindowMaximizedChange){
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
