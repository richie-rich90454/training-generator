import type { JSX } from "solid-js"
import { createSignal, createMemo, For, Show, createEffect, onCleanup } from "solid-js"
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

/**
 * Fuzzy-match a query against a target string. Returns a score (higher is
 * better) or -1 when there is no match.
 *
 * The matching strategy is subsequence-based: every character of the query
 * must appear in the target, in order, but not necessarily contiguously.
 * Consecutive matches are scored higher than scattered ones, and matches at
 * word boundaries (space, camelCase transition, start of string) get a
 * bonus. This is the same style of fuzzy matching used by VS Code's
 * Quick Open and most modern command palettes.
 *
 * Examples:
 *   fuzzyScore("save", "Save file")     -> high score (prefix match)
 *   fuzzyScore("sv", "Save file")       -> medium score (subsequence)
 *   fuzzyScore("sf", "Save file")       -> low score (scattered)
 *   fuzzyScore("xyz", "Save file")      -> -1 (no match)
 */
export function fuzzyScore(query: string, target: string): number{
    if (query.length===0){
        return 0
    }
    const q=query.toLowerCase()
    const tgt=target.toLowerCase()
    if (tgt.includes(q)){
        // Exact substring match — highest score. Longer targets score lower
        // because they are less specific.
        return 1000 - (tgt.length - q.length)
    }
    let qi=0
    let score=0
    let consecutive=0
    let lastMatchIndex=-2
    for (let ti=0; ti<tgt.length && qi<q.length; ti++){
        if (tgt[ti]===q[qi]){
            // Bonus for consecutive matches.
            if (ti===lastMatchIndex+1){
                consecutive++
                score+=10*consecutive
            }
            else{
                consecutive=0
                score+=1
            }
            // Bonus for word-boundary matches (start of string, after space,
            // or camelCase transition).
            if (ti===0 || tgt[ti-1]===" " || (tgt[ti-1]!==tgt[ti-1].toUpperCase() && tgt[ti]===tgt[ti].toUpperCase())){
                score+=15
            }
            lastMatchIndex=ti
            qi++
        }
    }
    if (qi<q.length){
        return -1
    }
    return score
}

const RECENT_COMMANDS_STORAGE_KEY="commandPalette.recentCommands"
const MAX_RECENT_COMMANDS=5

function loadRecentCommandIds(): string[]{
    try{
        const raw=window.localStorage.getItem(RECENT_COMMANDS_STORAGE_KEY)
        if (!raw){
            return []
        }
        const parsed=JSON.parse(raw)
        if (!Array.isArray(parsed)){
            return []
        }
        return parsed.filter((v): v is string=>typeof v==="string").slice(0, MAX_RECENT_COMMANDS)
    }
    catch{
        return []
    }
}

function saveRecentCommandId(id: string, currentRecent: string[]): string[]{
    // Remove duplicates then prepend. Keep at most MAX_RECENT_COMMANDS.
    const filtered=currentRecent.filter((c)=>c!==id)
    const next=[id, ...filtered].slice(0, MAX_RECENT_COMMANDS)
    try{
        window.localStorage.setItem(RECENT_COMMANDS_STORAGE_KEY, JSON.stringify(next))
    }
    catch{
        // Ignore storage errors (private mode, quota, etc.).
    }
    return next
}

export function CommandPalette(props: CommandPaletteProps): JSX.Element{
    let inputRef: HTMLInputElement|undefined
    let overlayRef: HTMLDivElement|undefined
    let lastFocusedElement: HTMLElement|null=null
    let prevBodyOverflow: string=""
    let [query, setQuery]=createSignal<string>("")
    let [selectedIndex, setSelectedIndex]=createSignal<number>(0)
    let [recentCommandIds, setRecentCommandIds]=createSignal<string[]>(loadRecentCommandIds())
    let filteredCommands=createMemo<Command[]>(()=>{
        let q=query().trim().toLowerCase()
        if (q.length===0){
            // When the query is empty, show recent commands first, then the
            // remaining commands in their original order. Duplicates are
            // removed so a command that is already in the recent list does
            // not appear twice.
            const recent=recentCommandIds()
            const recentSet=new Set(recent)
            const recentCommands: Command[]=[]
            const restCommands: Command[]=[]
            for (const cmd of props.commands){
                if (recentSet.has(cmd.id)){
                    recentCommands.push(cmd)
                }
                else{
                    restCommands.push(cmd)
                }
            }
            // Sort recentCommands by their position in recentCommandIds
            // (most recent first).
            recentCommands.sort((a, b)=>{
                return recent.indexOf(a.id) - recent.indexOf(b.id)
            })
            return [...recentCommands, ...restCommands]
        }
        // Fuzzy match against both label and id. Keep only commands with a
        // non-negative score, and sort by descending score (best matches
        // first). Ties are broken by original order to keep the UI stable.
        const scored=props.commands.map((command, originalIndex)=>{
            const labelScore=fuzzyScore(q, command.label)
            const idScore=fuzzyScore(q, command.id)
            const bestScore=Math.max(labelScore, idScore)
            return { command, score: bestScore, originalIndex }
        }).filter((entry)=>entry.score>=0)
        scored.sort((a, b)=>{
            if (b.score!==a.score){
                return b.score - a.score
            }
            return a.originalIndex - b.originalIndex
        })
        return scored.map((entry)=>entry.command)
    })
    createEffect(()=>{
        query()
        setSelectedIndex(0)
    })
    createEffect(()=>{
        if (props.visible()){
            // Save the previously focused element so we can restore focus
            // back to it when the palette closes. This is critical for
            // keyboard and screen reader users who activated the palette
            // via a keyboard shortcut (e.g. Ctrl+K).
            lastFocusedElement=document.activeElement as HTMLElement
            // Lock body scroll while the palette is open to prevent the
            // background from scrolling behind the overlay.
            prevBodyOverflow=document.body.style.overflow
            document.body.style.overflow="hidden"
            setQuery("")
            setSelectedIndex(0)
            // Reload recent commands from localStorage in case another
            // window/tab updated them since the palette was last opened.
            setRecentCommandIds(loadRecentCommandIds())
            inputRef?.focus()
        }
        else {
            // Restore body scroll only if we were the one who hid it.
            if (prevBodyOverflow!==""){
                document.body.style.overflow=prevBodyOverflow
                prevBodyOverflow=""
            }
            // Restore focus to the element that had focus before the palette
            // opened, but only if it is still in the DOM.
            if (lastFocusedElement && document.contains(lastFocusedElement)){
                lastFocusedElement.focus()
                lastFocusedElement=null
            }
        }
    })
    // If the component is unmounted while the palette is still open (e.g.
    // because the whole tree is torn down), make sure we restore body
    // overflow and focus. Without this the page would be stuck with
    // overflow:hidden and no focused element.
    onCleanup(()=>{
        if (prevBodyOverflow!==""){
            document.body.style.overflow=prevBodyOverflow
            prevBodyOverflow=""
        }
        if (lastFocusedElement && document.contains(lastFocusedElement)){
            lastFocusedElement.focus()
            lastFocusedElement=null
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
                executeCommand(command)
            }
        }
        else if (event.key==="Escape"){
            event.preventDefault()
            props.onClose()
        }
        else if (event.key==="Tab"&&overlayRef){
            // Tab-cycle focus trap: keep Tab focus within the palette
            // dialog. The list options are navigated via Arrow keys and
            // are not in the tab order, so this primarily cycles focus
            // back to the input when there is no other focusable element.
            const selector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
            const focusable=Array.from(overlayRef.querySelectorAll<HTMLElement>(selector))
            if (focusable.length===0){
                return
            }
            const first=focusable[0]
            const last=focusable[focusable.length-1]
            if (event.shiftKey&&document.activeElement===first){
                event.preventDefault()
                last.focus()
            }
            else if (!event.shiftKey&&document.activeElement===last){
                event.preventDefault()
                first.focus()
            }
        }
    }
    function executeCommand(command: Command):void{
        // Record this command as recent BEFORE invoking its action, so that
        // even if the action throws the recent list is still updated.
        setRecentCommandIds(saveRecentCommandId(command.id, recentCommandIds()))
        command.action()
        props.onClose()
    }
    function onBackdropClick(event: MouseEvent):void{
        if (event.target===event.currentTarget){
            props.onClose()
        }
    }
    return (
        <Show when={props.visible()}>
            <div
                class={styles["command-palette-overlay"]}
                data-testid="command-palette-overlay"
                onClick={onBackdropClick}
                role="presentation"
            >
                <div
                    class={styles["command-palette"]}
                    data-testid="command-palette"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="command-palette-title"
                    onKeyDown={onKeydown}
                    ref={overlayRef}
                >
                    <h2 id="command-palette-title" class="sr-only" data-i18n="commandPalette.title">
                        {t("commandPalette.title")}
                    </h2>
                    <input
                        ref={inputRef}
                        class={styles["command-palette-input"]}
                        type="text"
                        placeholder={t("commandPalette.placeholder")}
                        data-i18n-placeholder="commandPalette.placeholder"
                        aria-label={t("commandPalette.inputAria")}
                        data-i18n-aria-label="commandPalette.inputAria"
                        aria-autocomplete="list"
                        aria-controls="command-palette-listbox"
                        aria-expanded={filteredCommands().length > 0}
                        aria-activedescendant={filteredCommands().length > 0 ? `command-item-${filteredCommands()[selectedIndex()]?.id}` : undefined}
                        role="combobox"
                        data-testid="command-palette-input"
                        value={query()}
                        onInput={(e)=>setQuery(e.currentTarget.value)}
                    />
                    <Show when={filteredCommands().length>0} fallback={<div class={styles["command-empty"]} data-testid="command-empty" data-i18n="commandPalette.noCommands">{t("commandPalette.noCommands")}</div>}>
                        <ul id="command-palette-listbox" class={styles["command-list"]} role="listbox" data-testid="command-list">
                            <For each={filteredCommands()}>
                                {(command, index)=>{
                                    return (
                                        <li
                                            id={`command-item-${command.id}`}
                                            class={styles["command-item"]}
                                            classList={{ selected: index()===selectedIndex() }}
                                            role="option"
                                            aria-selected={index()===selectedIndex()}
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
