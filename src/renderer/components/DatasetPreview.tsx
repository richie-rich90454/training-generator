import type { JSX } from "solid-js"
import { createSignal, createMemo, Show, For } from "solid-js"
import { t } from "../i18n.js"
import type { TrainingItem, ChatMessage } from "../../types/index.js"
import datasetPreviewStyles from "./styles/DatasetPreview.module.css"
const styles = { ...datasetPreviewStyles }
export interface DatasetPreviewProps{
    items: TrainingItem[]
    format: "instruction"|"messages"|"text"
    showOriginal?: boolean
    selectedIndex?: number
    onSelect?: (item: TrainingItem, index: number)=>void
    onEdit?: (item: TrainingItem, index: number)=>void
    onDelete?: (item: TrainingItem, index: number)=>void
}
type InstructionView={
    type: "instruction"
    instruction: string
    input: string
    output: string
}
type MessagesView={
    type: "messages"
    messages: ChatMessage[]
}
type TextView={
    type: "text"
    text: string
}
type FormattedView=InstructionView|MessagesView|TextView
function GeneratedView(props: { item: FormattedView }): JSX.Element{
    let view=props.item
    if (view.type==="instruction"){
        return (
            <div class={`instruction-view`} data-testid="instruction-view">
                <div class={styles["card"]} data-testid="instruction-card">
                    <h4 class={`card-title`}>{t("datasetPreview.instructionLabel")}</h4>
                    <p data-testid="instruction-text">{view.instruction}</p>
                </div>
                <Show when={view.input.length>0}>
                    <div class={styles["card"]} data-testid="input-card">
                        <h4 class={`card-title`}>{t("datasetPreview.inputLabel")}</h4>
                        <p data-testid="input-text">{view.input}</p>
                    </div>
                </Show>
                <div class={styles["card"]} data-testid="output-card">
                    <h4 class={`card-title`}>{t("datasetPreview.outputLabel")}</h4>
                    <p data-testid="output-text">{view.output}</p>
                </div>
            </div>
        )
    }
    else if (view.type==="messages"){
        return (
            <div class={`messages-view`} data-testid="messages-view">
                <For each={view.messages}>
                    {(message)=>{
                        return (
                            <div class={"message-bubble "+message.role} data-testid="message-bubble">
                                <span class={styles["message-role"]} data-testid="message-role">{message.role}</span>
                                <p class={`message-content`} data-testid="message-content">{message.content}</p>
                            </div>
                        )
                    }}
                </For>
            </div>
        )
    }
    else{
        return (
            <div class={`text-view`} data-testid="text-view">
                <pre data-testid="text-content">{view.text}</pre>
            </div>
        )
    }
}
export function DatasetPreview(props: DatasetPreviewProps): JSX.Element{
    let [currentIndex, setCurrentIndex]=createSignal<number>(props.selectedIndex||0)
    let [showJson, setShowJson]=createSignal<boolean>(false)
    let currentItem=createMemo<TrainingItem|undefined>(()=>{
        return props.items[currentIndex()]
    })
    let total=createMemo<number>(()=>{
        return props.items.length
    })
    let formattedItem=createMemo<FormattedView>(()=>{
        let item=currentItem()
        if (!item){
            return { type: "text", text: "" }
        }
        if (props.format==="instruction"){
            return {
                type: "instruction",
                instruction: item.instruction||"",
                input: item.input||"",
                output: item.output||""
            }
        }
        else if (props.format==="messages"){
            return {
                type: "messages",
                messages: item.messages||[]
            }
        }
        else{
            return {
                type: "text",
                text: item.text||""
            }
        }
    })
    let originalSource=createMemo<string>(()=>{
        let item=currentItem()
        if (!item){
            return ""
        }
        let meta=(item.metadata||{}) as Record<string, unknown>
        let original=meta.original
        if (typeof original==="string" && original.length>0){
            return original
        }
        let source=meta.source
        if (typeof source==="string" && source.length>0){
            return source
        }
        return ""
    })
    let hasOriginal=createMemo<boolean>(()=>{
        return originalSource().length>0
    })
    let jsonText=createMemo<string>(()=>{
        return JSON.stringify(currentItem()||{}, null, 2)
    })
    function emitSelect():void{
        let item=currentItem()
        if (!item){
            return
        }
        props.onSelect?.(item, currentIndex())
    }
    function nextItem():void{
        if (currentIndex()<total()-1){
            setCurrentIndex(currentIndex()+1)
            emitSelect()
        }
    }
    function prevItem():void{
        if (currentIndex()>0){
            setCurrentIndex(currentIndex()-1)
            emitSelect()
        }
    }
    function goToItem(index: number):void{
        if (index>=0 && index<total()){
            setCurrentIndex(index)
            emitSelect()
        }
    }
    function emitEdit():void{
        let item=currentItem()
        if (!item){
            return
        }
        props.onEdit?.(item, currentIndex())
    }
    function emitDelete():void{
        let item=currentItem()
        if (!item){
            return
        }
        props.onDelete?.(item, currentIndex())
    }
    function toggleJson():void{
        setShowJson(!showJson())
    }
    return (
        <div class={styles["dataset-preview"]} data-testid="dataset-preview">
            <div style={{ display: "none" }} data-testid="current-index">{currentIndex()}</div>
            <div style={{ display: "none" }} data-testid="formatted-type">{formattedItem().type}</div>
            <div class={styles["preview-toolbar"]}>
                <button class={`nav-button`} type="button" disabled={currentIndex()<=0} onClick={prevItem} data-testid="prev-button">{t("datasetPreview.prev")}</button>
                <span class={styles["index-display"]} data-testid="index-display">{currentIndex()+1} / {total()}</span>
                <button class={`nav-button`} type="button" disabled={currentIndex()>=total()-1} onClick={nextItem} data-testid="next-button">{t("datasetPreview.next")}</button>
                <button class={`view-toggle`} type="button" onClick={toggleJson} data-testid="json-toggle">{showJson()?t("datasetPreview.formatted"):t("datasetPreview.json")}</button>
                <button class={`action-button`} type="button" onClick={emitEdit} data-testid="edit-button">{t("datasetPreview.edit")}</button>
                <button class={`action-button`} type="button" onClick={emitDelete} data-testid="delete-button">{t("datasetPreview.delete")}</button>
            </div>
            <Show when={showJson()} fallback={
                <div class={`preview-content`}>
                    <Show when={props.showOriginal && hasOriginal()} fallback={
                        <div class={styles["single-view"]} data-testid="single-view">
                            <GeneratedView item={formattedItem()} />
                        </div>
                    }>
                        <div class={styles["split-view"]} data-testid="split-view">
                            <div class={styles["original-panel"]} data-testid="original-panel">
                                <h3 class={`panel-title`}>{t("datasetPreview.original")}</h3>
                                <pre class={`original-text`} data-testid="original-text">{originalSource()}</pre>
                            </div>
                            <div class={styles["generated-panel"]} data-testid="generated-panel">
                                <GeneratedView item={formattedItem()} />
                            </div>
                        </div>
                    </Show>
                </div>
            }>
                <div class={`json-view`} data-testid="json-view">
                    <pre data-testid="json-content">{jsonText()}</pre>
                </div>
            </Show>
        </div>
    )
}
