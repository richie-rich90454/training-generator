import type { JSX } from "solid-js"
import { createSignal, createMemo, For, Show, createEffect } from "solid-js"
import { t } from "../i18n.js"
import commandPaletteStyles from "./styles/CommandPalette.module.css"
const styles = { ...commandPaletteStyles }
export interface Command{
    id: string
    label: string
    shortcut?: string
    icon?: string
    action: ()=>void
}
export interface CommandPaletteProps{
    commands: Command[]
    visible: ()=>boolean
    onClose: ()=>void
}
export function CommandPalette(props: CommandPaletteProps): JSX.Element{
    let inputRef: HTMLInputElement|undefined
    let [query, setQuery]=createSignal<string>("")
    let [selectedIndex, setSelectedIndex]=createSignal<number>(0)
    let filteredCommands=createMemo<Command[]>(()=>{
        let q=query().trim().toLowerCase()
        if (q.length===0){
            return props.commands
        }
        return props.commands.filter((command)=>{
            return command.label.toLowerCase().includes(q)||command.id.toLowerCase().includes(q)
        })
    })
    createEffect(()=>{
        query()
        setSelectedIndex(0)
    })
    createEffect(()=>{
        if (props.visible()){
            setQuery("")
            setSelectedIndex(0)
            inputRef?.focus()
        }
    })
    function onKeydown(event: KeyboardEvent):void{
        if (event.key==="ArrowDown"){
            event.preventDefault()
            if (filteredCommands().length>0){
                setSelectedIndex(Math.min(selectedIndex()+1, filteredCommands().length-1))
            }
        }
        else if (event.key==="ArrowUp"){
            event.preventDefault()
            if (filteredCommands().length>0){
                setSelectedIndex(Math.max(selectedIndex()-1, 0))
            }
        }
        else if (event.key==="Enter"){
            event.preventDefault()
            let command=filteredCommands()[selectedIndex()]
            if (command!==undefined){
                command.action()
            }
        }
        else if (event.key==="Escape"){
            event.preventDefault()
            props.onClose()
        }
    }
    function executeCommand(command: Command):void{
        command.action()
    }
    function onBackdropClick(event: MouseEvent):void{
        if (event.target===event.currentTarget){
            props.onClose()
        }
    }
    return (
        <Show when={props.visible()}>
            <div class={styles["command-palette-overlay"]} data-testid="command-palette-overlay" onClick={onBackdropClick}>
                <div class={styles["command-palette"]} data-testid="command-palette" onKeyDown={onKeydown}>
                    <input
                        ref={inputRef}
                        class={styles["command-palette-input"]}
                        type="text"
                        placeholder={t("commandPalette.placeholder")}
                        data-testid="command-palette-input"
                        value={query()}
                        onInput={(e)=>setQuery(e.currentTarget.value)}
                    />
                    <Show when={filteredCommands().length>0} fallback={<div class={styles["command-empty"]} data-testid="command-empty">{t("commandPalette.noCommands")}</div>}>
                        <ul class={styles["command-list"]} data-testid="command-list">
                            <For each={filteredCommands()}>
                                {(command, index)=>{
                                    return (
                                        <li
                                            class={styles["command-item"]}
                                            classList={{ selected: index()===selectedIndex() }}
                                            data-testid={"command-item-"+command.id}
                                            onClick={()=>executeCommand(command)}
                                        >
                                            <Show when={command.icon}>
                                                <span class={styles["command-icon"]} data-testid="command-icon">{command.icon}</span>
                                            </Show>
                                            <span class={styles["command-label"]} data-testid={"command-label-"+command.id}>{command.label}</span>
                                            <Show when={command.shortcut}>
                                                <span class={styles["command-shortcut"]} data-testid={"command-shortcut-"+command.id}>{command.shortcut}</span>
                                            </Show>
                                        </li>
                                    )
                                }}
                            </For>
                        </ul>
                    </Show>
                </div>
            </div>
        </Show>
    )
}
