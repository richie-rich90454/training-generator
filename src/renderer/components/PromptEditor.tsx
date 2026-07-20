import type { JSX } from "solid-js"
import { createSignal, createMemo, createEffect, For, Show, onMount, onCleanup } from "solid-js"
import { Portal } from "solid-js/web"
import type { AppStore } from "../stores/appStore.js"
import { t } from "../i18n.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import promptEditorStyles from "./styles/PromptEditor.module.css"
import modalStyles from "./styles/Modal.module.css"
const styles = { ...promptEditorStyles, ...modalStyles }
export interface PromptVersion{
    id: string
    name: string
    content: string
    createdAt: number
}
export interface PromptEditorProps{
    modelValue?: string
    variables?: Record<string, string>
    history?: PromptVersion[]
    placeholder?: string
    onChange?: (value: string)=>void
    onSave?: (version: PromptVersion)=>void
    onRun?: (text: string)=>void
    onVariableChange?: (name: string, value: string)=>void
    appStore?: AppStore
}
export function PromptEditor(props: PromptEditorProps): JSX.Element{
    let overlayRef: HTMLDivElement|undefined
    let lastFocusedElement: HTMLElement|null=null
    let prevBodyOverflow: string=""
    let [localContent, setLocalContent]=createSignal<string>(props.modelValue||"")
    let [variableValues, setVariableValues]=createSignal<Record<string, string>>({ ...props.variables })
    let [showPreview, setShowPreview]=createSignal<boolean>(false)
    let [showHistory, setShowHistory]=createSignal<boolean>(false)
    let [selectedVersionId, setSelectedVersionId]=createSignal<string|null>(null)
    let [versionName, setVersionName]=createSignal<string>("")
    createEffect(()=>{
        setLocalContent(props.modelValue||"")
    })
    let extractedVariables=createMemo<string[]>(()=>{
        let regex=/\{\{([^{}]+)\}\}/g
        let found=new Set<string>()
        let match=regex.exec(localContent())
        while (match!==null){
            let name=match[1].trim()
            if (name.length>0){
                found.add(name)
            }
            match=regex.exec(localContent())
        }
        return Array.from(found)
    })
    let previewText=createMemo<string>(()=>{
        let text=localContent()
        text=text.replace(/\{\{([^{}]+)\}\}/g,(match: string, name: string)=>{
            let trimmedName=name.trim()
            if (variableValues()[trimmedName]!==undefined){
                return variableValues()[trimmedName]
            }
            return match
        })
        return text
    })
    let isDirty=createMemo<boolean>(()=>{
        return localContent()!==props.modelValue
    })
    let hasVariables=createMemo<boolean>(()=>{
        return extractedVariables().length>0
    })
    function onInput(event: Event):void{
        let target=event.target as HTMLTextAreaElement
        setLocalContent(target.value)
        props.onChange?.(target.value)
    }
    function setVariable(name: string, value: string):void{
        setVariableValues((prev)=>{
            return { ...prev, [name]: value }
        })
        props.onVariableChange?.(name, value)
    }
    function handleVariableInput(name: string, event: Event):void{
        let target=event.target as HTMLInputElement
        setVariable(name, target.value)
    }
    function togglePreview():void{
        setShowPreview(!showPreview())
    }
    function toggleHistory():void{
        setShowHistory(!showHistory())
    }
    function generateId():string{
        return Math.random().toString(36).substring(2)+Date.now().toString(36)
    }
    function saveVersion(name: string):void{
        let finalName=name||versionName()||t("promptEditor.defaultVersionPrefix")+new Date().toLocaleString()
        let version: PromptVersion={
            id: generateId(),
            name: finalName,
            content: localContent(),
            createdAt: Date.now()
        }
        props.onSave?.(version)
    }
    function loadVersion(version: PromptVersion):void{
        setLocalContent(version.content)
        setSelectedVersionId(version.id)
        props.onChange?.(version.content)
    }
    function runPreview():void{
        props.onRun?.(previewText())
    }
    function formatDate(timestamp: number):string{
        return new Date(timestamp).toLocaleString()
    }
    function handleClose():void{
        props.appStore?.uiStore.closePromptEditor()
    }
    function handleBackdropClick(e: MouseEvent):void{
        if (e.target===overlayRef){
            handleClose()
        }
    }
    function handleKeydown(e: KeyboardEvent):void{
        if (!props.appStore?.uiStore.promptOpen()){
            return
        }
        if (e.key==="Escape"){
            e.preventDefault()
            handleClose()
            return
        }
        // Tab-cycle focus trap: query the live DOM so the first/last
        // focusable elements stay correct even as the editor's toolbar
        // toggles preview/history panels and changes the focusable set.
        if (e.key!=="Tab"||!overlayRef){
            return
        }
        const selector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        const focusable=Array.from(overlayRef.querySelectorAll<HTMLElement>(selector))
        if (focusable.length===0){
            return
        }
        const first=focusable[0]
        const last=focusable[focusable.length-1]
        if (e.shiftKey&&document.activeElement===first){
            e.preventDefault()
            last.focus()
        }
        else if (!e.shiftKey&&document.activeElement===last){
            e.preventDefault()
            first.focus()
        }
    }
    // Track open state to manage focus restoration and body scroll lock.
    // Using createEffect (instead of onMount) means this runs whenever the
    // open signal changes, so opening and closing the modal both restore
    // state correctly.
    createEffect(()=>{
        if (!props.appStore){
            return
        }
        const isOpen=props.appStore.uiStore.promptOpen()
        if (isOpen){
            lastFocusedElement=document.activeElement as HTMLElement
            prevBodyOverflow=document.body.style.overflow
            document.body.style.overflow="hidden"
            // Move focus into the modal so keyboard and screen reader users
            // are not stranded on the trigger element behind the overlay.
            const focusable=overlayRef?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
            )
            if (focusable && focusable.length>0){
                focusable[0].focus()
            }
        }
        else {
            if (prevBodyOverflow!==""){
                document.body.style.overflow=prevBodyOverflow
                prevBodyOverflow=""
            }
            if (lastFocusedElement && document.contains(lastFocusedElement)){
                lastFocusedElement.focus()
                lastFocusedElement=null
            }
        }
    })
    onMount(()=>{
        if (props.appStore){
            document.addEventListener("keydown",handleKeydown)
        }
    })
    onCleanup(()=>{
        if (props.appStore){
            document.removeEventListener("keydown",handleKeydown)
        }
        // Restore body scroll and focus if the component is unmounted while
        // the modal is still open.
        if (prevBodyOverflow!==""){
            document.body.style.overflow=prevBodyOverflow
            prevBodyOverflow=""
        }
        if (lastFocusedElement && document.contains(lastFocusedElement)){
            lastFocusedElement.focus()
            lastFocusedElement=null
        }
    })
    function editorBody(): JSX.Element{
        return (
            <>
                <div class={styles["editor-toolbar"]}>
                    <input
                        class={styles["version-name-input"]}
                        type="text"
                        value={versionName()}
                        placeholder={t("promptEditor.versionNamePlaceholder")}
                        data-i18n-placeholder="promptEditor.versionNamePlaceholder"
                        aria-label={t("promptEditor.versionNamePlaceholder")}
                        data-i18n-aria-label="promptEditor.versionNamePlaceholder"
                        data-testid="version-name-input"
                        onInput={(e)=>setVersionName(e.currentTarget.value)}
                    />
                    <button class={styles["toolbar-button"]} type="button" onClick={togglePreview} data-testid="toggle-preview-button">
                        <Show when={showPreview()} fallback={<span data-i18n="promptEditor.showPreview">{t("promptEditor.showPreview")}</span>}>
                            <span data-i18n="promptEditor.hidePreview">{t("promptEditor.hidePreview")}</span>
                        </Show>
                    </button>
                    <button class={styles["toolbar-button"]} type="button" onClick={toggleHistory} data-testid="toggle-history-button">
                        <Show when={showHistory()} fallback={<span data-i18n="promptEditor.showHistory">{t("promptEditor.showHistory")}</span>}>
                            <span data-i18n="promptEditor.hideHistory">{t("promptEditor.hideHistory")}</span>
                        </Show>
                    </button>
                    <button class={styles["toolbar-button"]} type="button" onClick={runPreview} data-testid="run-button" data-i18n="promptEditor.run">{t("promptEditor.run")}</button>
                    <button class={styles["toolbar-button"]} type="button" onClick={()=>saveVersion("")} data-testid="save-button" data-i18n="promptEditor.save">{t("promptEditor.save")}</button>
                </div>
                <div class={styles["editor-main"]}>
                    <div class={styles["editor-panel"]}>
                        <textarea
                            class={styles["prompt-textarea"]}
                            placeholder={props.placeholder||""}
                            aria-label={t("promptEditor.contentAria")}
                            data-i18n-aria-label="promptEditor.contentAria"
                            value={localContent()}
                            onInput={onInput}
                            data-testid="prompt-textarea"
                        ></textarea>
                        <Show when={hasVariables()}>
                            <div class={styles["variable-panel"]} data-testid="variable-panel">
                                <h4 class={styles["panel-title"]} data-i18n="promptEditor.variablesTitle">{t("promptEditor.variablesTitle")}</h4>
                                <For each={extractedVariables()}>
                                    {(variable)=>{
                                        let inputId="variable-input-"+variable.replace(/\s+/g,"-")
                                        return (
                                            <div class={styles["variable-row"]} data-testid="variable-row">
                                                <label class={styles["variable-label"]} for={inputId} data-testid={"variable-label-"+variable}>{variable}</label>
                                                <input
                                                    id={inputId}
                                                    class={styles["variable-input"]}
                                                    type="text"
                                                    value={variableValues()[variable]||""}
                                                    onInput={(e)=>handleVariableInput(variable, e)}
                                                    data-testid={"variable-input-"+variable}
                                                />
                                            </div>
                                        )
                                    }}
                                </For>
                            </div>
                        </Show>
                    </div>
                    <Show when={showPreview()}>
                        <div class={styles["preview-panel"]} data-testid="preview-panel">
                            <h4 class={styles["panel-title"]} data-i18n="promptEditor.previewTitle">{t("promptEditor.previewTitle")}</h4>
                            <pre class={styles["preview-text"]} data-testid="preview-text">{previewText()}</pre>
                        </div>
                    </Show>
                    <Show when={showHistory()}>
                        <div class={styles["history-panel"]} data-testid="history-panel">
                            <h4 class={styles["panel-title"]} data-i18n="promptEditor.historyTitle">{t("promptEditor.historyTitle")}</h4>
                            <Show when={props.history && props.history.length>0} fallback={<div class={styles["history-empty"]} data-testid="history-empty" data-i18n="promptEditor.noSavedVersions">{t("promptEditor.noSavedVersions")}</div>}>
                                <div class={styles["history-list"]} data-testid="history-list">
                                    <For each={props.history}>
                                        {(version)=>{
                                            return (
                                                <div
                                                    class={styles["history-item"]}
                                                    classList={{ selected: selectedVersionId()===version.id }}
                                                    role="button"
                                                    tabindex="0"
                                                    aria-label={version.name}
                                                    onClick={()=>loadVersion(version)}
                                                    onKeyDown={(e)=>{ if (e.key==="Enter" || e.key===" ") { e.preventDefault(); loadVersion(version) } }}
                                                    data-testid={"history-item-"+version.id}
                                                >
                                                    <span class={styles["history-name"]}>{version.name}</span>
                                                    <span class={styles["history-date"]}>{formatDate(version.createdAt)}</span>
                                                </div>
                                            )
                                        }}
                                    </For>
                                </div>
                            </Show>
                        </div>
                    </Show>
                </div>
            </>
        )
    }
    if (!props.appStore){
        return (
            <div class={styles["prompt-editor"]} data-testid="prompt-editor">
                <div class={styles["test-only"]} aria-hidden="true" data-testid="extracted-variables">{JSON.stringify(extractedVariables())}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="is-dirty">{isDirty().toString()}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="variable-values">{JSON.stringify(variableValues())}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="selected-version-id">{selectedVersionId()}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="has-variables">{hasVariables().toString()}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="preview-text">{previewText()}</div>
                {editorBody()}
            </div>
        )
    }
    return (
        <Show when={props.appStore.uiStore.promptOpen()}>
            <Portal mount={document.body}>
                <div
                    ref={overlayRef}
                    class={`${styles["modal"]} ${styles["active"]}`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="prompt-editor-title"
                    onClick={handleBackdropClick}
                >
                    <div class={styles["modal-content"]} style={{ "max-width": "900px", width: "85%", "max-height": "85vh", padding: "0", overflow: "hidden" }}>
                        <div class={styles["modal-header"]} style={{ "flex-shrink": "0" }}>
                            <h2 id="prompt-editor-title">
                                <Icon html={renderIcon("fa-edit")} />
                                <span data-i18n="promptEditor.title">{t("promptEditor.title")}</span>
                            </h2>
                            <button
                                class={styles["modal-close"]}
                                aria-label={t("promptEditor.closeAria")}
                                data-i18n-aria-label="promptEditor.closeAria"
                                onClick={handleClose}
                            >
                                <Icon html={renderIcon("fa-times")} />
                            </button>
                        </div>
                        <div class={styles["prompt-editor"]} style={{ height: "65vh" }} data-testid="prompt-editor">
                            {editorBody()}
                        </div>
                    </div>
                </div>
            </Portal>
        </Show>
    )
}
