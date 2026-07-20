import type { JSX } from "solid-js"
import { createSignal, createEffect, Show, onMount, onCleanup } from "solid-js"
import { Portal } from "solid-js/web"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import { showToast } from "../toast.js"
import { logger } from "../logger.js"
import templateEditorStyles from "./styles/TemplateEditor.module.css"
import modalStyles from "./styles/Modal.module.css"
const styles = { ...templateEditorStyles, ...modalStyles }
export interface TemplateEditorProps{
    appStore: AppStore
}
export function TemplateEditor(props: TemplateEditorProps): JSX.Element{
    let overlayRef: HTMLDivElement|undefined
    let textareaRef: HTMLTextAreaElement|undefined
    let [content, setContent]=createSignal<string>("")
    let [highlighted, setHighlighted]=createSignal<string>("")
    let [livePreview, setLivePreview]=createSignal<string>("")
    let lastFocusedElement: HTMLElement|null=null
    let prevBodyOverflow: string=""
    function escapeHtml(text: string): string{
        let div=document.createElement("div")
        div.textContent=text
        return div.innerHTML
    }
    function highlightVariables(text: string): string{
        let escaped=escapeHtml(text)
        escaped=escaped.replace(/\{text\}/g,'<span class={`${styles["tpl-var"]} ${styles["tpl-var-text"]}`}>{text}</span>')
        escaped=escaped.replace(/\{language\}/g,'<span class={`${styles["tpl-var"]} ${styles["tpl-var-language"]}`}>{language}</span>')
        escaped=escaped.replace(/\{prompt_type\}/g,'<span class={`${styles["tpl-var"]} ${styles["tpl-var-prompt"]}`}>{prompt_type}</span>')
        return escaped
    }
    function renderWithSample(text: string): string{
        return text
            .replace(/\{text\}/g,t("templateEditor.sampleText"))
            .replace(/\{language\}/g,t("templateEditor.sampleLanguage"))
            .replace(/\{prompt_type\}/g,t("templateEditor.samplePromptType"))
    }
    function updatePreviews():void{
        let value=content()
        setHighlighted(highlightVariables(value)||`<span style="color:var(--text-muted,#999)">${t("templateEditor.emptyTemplate")}</span>`)
        setLivePreview(renderWithSample(value)||t("templateEditor.emptyTemplate"))
    }
    function handleInput():void{
        let value=textareaRef?.value||""
        setContent(value)
        updatePreviews()
    }
    function handleClose():void{
        props.appStore.uiStore.closeTemplateEditor()
    }
    function handleBackdropClick(e: MouseEvent):void{
        if (e.target===overlayRef){
            handleClose()
        }
    }
    function handleLoad():void{
        let input=document.createElement("input")
        input.type="file"
        input.accept=".txt"
        input.style.display="none"
        document.body.appendChild(input)
        input.addEventListener("change",()=>{
            let file=input.files?.[0]
            if (!file){
                input.remove()
                return
            }
            let reader=new FileReader()
            reader.onload=()=>{
                let text=reader.result as string
                setContent(text)
                if (textareaRef){
                    textareaRef.value=text
                }
                updatePreviews()
                input.remove()
            }
            reader.onerror=()=>{
                logger.error("Failed to read template file")
                showToast(t("toast.templateLoadFailed"),"error")
                input.remove()
            }
            reader.readAsText(file)
        })
        input.click()
    }
    function handleSave():void{
        let value=content()
        if (!value.trim()){
            showToast(t("toast.templateEmpty"),"warning")
            return
        }
        let blob=new Blob([value],{type:"text/plain"})
        let url=URL.createObjectURL(blob)
        let a=document.createElement("a")
        a.href=url
        a.download=`${t("templateEditor.downloadFilename")}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(()=>URL.revokeObjectURL(url),1000)
    }
    function handleKeydown(e: KeyboardEvent):void{
        if (!props.appStore.uiStore.templateOpen()){
            return
        }
        if (e.key==="Escape"){
            e.preventDefault()
            handleClose()
        }
    }
    // Track open state to manage focus restoration, body scroll lock, and
    // preview initialization. Using createEffect (instead of onMount) means
    // this runs whenever templateOpen() changes, so opening and closing the
    // modal both work correctly even though the component stays mounted.
    createEffect(()=>{
        const isOpen=props.appStore.uiStore.templateOpen()
        if (isOpen){
            updatePreviews()
            lastFocusedElement=document.activeElement as HTMLElement
            prevBodyOverflow=document.body.style.overflow
            document.body.style.overflow="hidden"
            textareaRef?.focus()
        }
        else {
            if (prevBodyOverflow!==""){
                document.body.style.overflow=prevBodyOverflow
                prevBodyOverflow=""
            }
            if (lastFocusedElement&&document.contains(lastFocusedElement)){
                lastFocusedElement.focus()
                lastFocusedElement=null
            }
        }
    })
    onMount(()=>{
        document.addEventListener("keydown",handleKeydown)
    })
    onCleanup(()=>{
        document.removeEventListener("keydown",handleKeydown)
        // Restore body scroll and focus if the component is unmounted while
        // the modal is still open.
        if (prevBodyOverflow!==""){
            document.body.style.overflow=prevBodyOverflow
            prevBodyOverflow=""
        }
        if (lastFocusedElement&&document.contains(lastFocusedElement)){
            lastFocusedElement.focus()
            lastFocusedElement=null
        }
    })
    return (
        <Show when={props.appStore.uiStore.templateOpen()}>
            <Portal mount={document.body}>
                <div
                    ref={overlayRef}
                    class={styles["template-editor-overlay"]}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="template-editor-title"
                    onClick={handleBackdropClick}
                >
                    <div class={styles["template-editor-modal"]}>
                        <div class={styles["template-editor-header"]}>
                            <h2 id="template-editor-title"><Icon html={renderIcon("fa-edit", 20)} /> {t("templateEditor.title")}</h2>
                            <button
                                class={styles["template-editor-close"]}
                                aria-label={t("templateEditor.closeAria")}
                                onClick={handleClose}
                            >
                                &times;
                            </button>
                        </div>
                        <div class={styles["template-editor-body"]}>
                            <label for="template-editor-textarea"><Icon html={renderIcon("fa-code")} /> {t("templateEditor.templateLabel")}</label>
                            <textarea
                                ref={textareaRef}
                                id="template-editor-textarea"
                                class={styles["template-editor-textarea"]}
                                aria-label={t("templateEditor.contentAria")}
                                placeholder={t("templateEditor.placeholder")}
                                spellcheck={false}
                                value={content()}
                                onInput={handleInput}
                            ></textarea>
                            <label><Icon html={renderIcon("fa-highlighter")} /> {t("templateEditor.highlightedLabel")}</label>
                            <pre class={styles["template-editor-preview"]} innerHTML={highlighted()}></pre>
                            <label><Icon html={renderIcon("fa-eye")} /> {t("templateEditor.previewLabel")}</label>
                            <pre class={styles["template-editor-preview"]}>{livePreview()}</pre>
                        </div>
                        <div class={styles["template-editor-footer"]}>
                            <button class={`btn btn-secondary`} aria-label={t("templateEditor.loadAria")} onClick={handleLoad}>
                                <Icon html={renderIcon("fa-folder-open")} /> {t("templateEditor.load")}
                            </button>
                            <button class={`btn btn-primary`} aria-label={t("templateEditor.saveAria")} onClick={handleSave}>
                                <Icon html={renderIcon("fa-save")} /> {t("templateEditor.save")}
                            </button>
                            <button class={`btn btn-secondary`} aria-label={t("templateEditor.closeAria")} onClick={handleClose}>
                                <Icon html={renderIcon("fa-times")} /> {t("templateEditor.close")}
                            </button>
                        </div>
                    </div>
                </div>
            </Portal>
        </Show>
    )
}
