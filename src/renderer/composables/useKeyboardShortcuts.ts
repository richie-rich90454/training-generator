export interface ShortcutModifiers{
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    meta?: boolean
}
export interface Shortcut{
    id: string
    key: string
    modifiers?: ShortcutModifiers
    handler: ()=>boolean|void
    scope?: string
}
export interface ParsedShortcut{
    key: string
    modifiers: ShortcutModifiers
}
export interface ShortcutOptions{
    preventDefault?: boolean
    scope?: string
}
export function parseShortcut(shortcutStr: string): ParsedShortcut{
    let parts=shortcutStr.split("+").map((p)=>p.trim().toLowerCase())
    let key=""
    let modifiers: ShortcutModifiers={}
    let i=0
    while (i<parts.length){
        let part=parts[i]
        if (part==="ctrl"||part==="control"){
            modifiers.ctrl=true
        }
        else if (part==="shift"){
            modifiers.shift=true
        }
        else if (part==="alt"||part==="option"){
            modifiers.alt=true
        }
        else if (part==="meta"||part==="cmd"||part==="command"||part==="win"){
            modifiers.meta=true
        }
        else{
            key=part
        }
        i++
    }
    return { key: key, modifiers: modifiers }
}
export function formatShortcut(shortcut: ParsedShortcut): string{
    let parts: string[]=[]
    if (shortcut.modifiers.meta){
        parts.push("Cmd")
    }
    if (shortcut.modifiers.ctrl){
        parts.push("Ctrl")
    }
    if (shortcut.modifiers.alt){
        parts.push("Alt")
    }
    if (shortcut.modifiers.shift){
        parts.push("Shift")
    }
    let key=shortcut.key
    if (key.length===1){
        key=key.toUpperCase()
    }
    else if (key.length>1){
        key=key.charAt(0).toUpperCase()+key.slice(1).toLowerCase()
    }
    parts.push(key)
    return parts.join("+")
}
export function useKeyboardShortcuts(shortcuts: Shortcut[], options?: ShortcutOptions): {unregister: ()=>void}{
    let preventDefault=options?.preventDefault===true
    let scope=options?.scope
    function listener(event: KeyboardEvent):void{
        let eventKey=event.key.toLowerCase()
        let i=0
        while (i<shortcuts.length){
            let shortcut=shortcuts[i]
            if (scope!==undefined&&shortcut.scope!==undefined&&shortcut.scope!==scope){
                i++
                continue
            }
            let shortcutKey=shortcut.key.toLowerCase()
            let modifiers=shortcut.modifiers||{}
            let ctrl=modifiers.ctrl===true
            let shift=modifiers.shift===true
            let alt=modifiers.alt===true
            let meta=modifiers.meta===true
            if (eventKey===shortcutKey&&event.ctrlKey===ctrl&&event.shiftKey===shift&&event.altKey===alt&&event.metaKey===meta){
                let result=shortcut.handler()
                if (preventDefault||result===false){
                    event.preventDefault()
                }
            }
            i++
        }
    }
    window.addEventListener("keydown", listener)
    return {
        unregister: ()=>{
            window.removeEventListener("keydown", listener)
        }
    }
}
