<template>
    <div class="dataset-preview" data-testid="dataset-preview">
        <div class="preview-toolbar">
            <button class="nav-button" type="button" :disabled="currentIndex<=0" @click="prevItem" data-testid="prev-button">{{ t('datasetPreview.prev') }}</button>
            <span class="index-display" data-testid="index-display">{{ currentIndex+1 }} / {{ total }}</span>
            <button class="nav-button" type="button" :disabled="currentIndex>=total-1" @click="nextItem" data-testid="next-button">{{ t('datasetPreview.next') }}</button>
            <button class="view-toggle" type="button" @click="toggleJson" data-testid="json-toggle">{{ showJson?t('datasetPreview.formatted'):t('datasetPreview.json') }}</button>
            <button class="action-button" type="button" @click="emitEdit" data-testid="edit-button">{{ t('datasetPreview.edit') }}</button>
            <button class="action-button" type="button" @click="emitDelete" data-testid="delete-button">{{ t('datasetPreview.delete') }}</button>
        </div>
        <div v-if="showJson" class="json-view" data-testid="json-view">
            <pre data-testid="json-content">{{ jsonText }}</pre>
        </div>
        <div v-else class="preview-content">
            <div v-if="showOriginal && hasOriginal" class="split-view" data-testid="split-view">
                <div class="original-panel" :style="{ flex: splitRatio }" data-testid="original-panel">
                    <h3 class="panel-title">{{ t('datasetPreview.original') }}</h3>
                    <pre class="original-text" data-testid="original-text">{{ originalSource }}</pre>
                </div>
                <div class="generated-panel" :style="{ flex: 1-splitRatio }" data-testid="generated-panel">
                    <component :is="GeneratedView" :item="formattedItem"></component>
                </div>
            </div>
            <div v-else class="single-view" data-testid="single-view">
                <component :is="GeneratedView" :item="formattedItem"></component>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, ref, h } from "vue"
import { t } from "../i18n.js"
import type { TrainingItem, ChatMessage } from "../../types/interfaces.js"
interface Props{
    items: TrainingItem[]
    format: "instruction"|"messages"|"text"
    showOriginal?: boolean
    selectedIndex?: number
}
let props=withDefaults(defineProps<Props>(),{
    showOriginal: false,
    selectedIndex: 0
})
let emit=defineEmits<{
    (e: "select", item: TrainingItem, index: number): void
    (e: "edit", item: TrainingItem, index: number): void
    (e: "delete", item: TrainingItem, index: number): void
}>()
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
let currentIndex=ref<number>(props.selectedIndex)
let showJson=ref<boolean>(false)
let splitRatio=ref<number>(0.5)
let currentItem=computed<TrainingItem|undefined>(()=>{
    return props.items[currentIndex.value]
})
let total=computed<number>(()=>{
    return props.items.length
})
let formattedItem=computed<FormattedView>(()=>{
    let item=currentItem.value
    if (!item){
        return { type: "text", text: "" }
    }
    if (props.format==="instruction"){
        return {
            type: "instruction",
            instruction: item.instruction || "",
            input: item.input || "",
            output: item.output || ""
        }
    }
    else if (props.format==="messages"){
        return {
            type: "messages",
            messages: item.messages || []
        }
    }
    else{
        return {
            type: "text",
            text: item.text || ""
        }
    }
})
let originalSource=computed<string>(()=>{
    let item=currentItem.value
    if (!item){
        return ""
    }
    let meta=(item.metadata || {}) as Record<string, unknown>
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
let hasOriginal=computed<boolean>(()=>{
    return originalSource.value.length>0
})
let jsonText=computed<string>(()=>{
    return JSON.stringify(currentItem.value || {}, null, 2)
})
function GeneratedView(props: { item: FormattedView }){
    let view=props.item
    if (view.type==="instruction"){
        let children=[
            h("div", { class: "card", "data-testid": "instruction-card" }, [
                h("h4", { class: "card-title" }, "Instruction"),
                h("p", { "data-testid": "instruction-text" }, view.instruction)
            ])
        ]
        if (view.input.length>0){
            children.push(
                h("div", { class: "card", "data-testid": "input-card" }, [
                    h("h4", { class: "card-title" }, t('datasetPreview.inputLabel')),
                    h("p", { "data-testid": "input-text" }, view.input)
                ])
            )
        }
        children.push(
            h("div", { class: "card", "data-testid": "output-card" }, [
                h("h4", { class: "card-title" }, t('datasetPreview.outputLabel')),
                h("p", { "data-testid": "output-text" }, view.output)
            ])
        )
        return h("div", { class: "instruction-view", "data-testid": "instruction-view" }, children)
    }
    else if (view.type==="messages"){
        let bubbles=view.messages.map((message, mIndex)=>{
            return h("div", {
                key: mIndex,
                class: ["message-bubble", message.role],
                "data-testid": "message-bubble"
            }, [
                h("span", { class: "message-role", "data-testid": "message-role" }, message.role),
                h("p", { class: "message-content", "data-testid": "message-content" }, message.content)
            ])
        })
        return h("div", { class: "messages-view", "data-testid": "messages-view" }, bubbles)
    }
    else{
        return h("div", { class: "text-view", "data-testid": "text-view" }, [
            h("pre", { "data-testid": "text-content" }, view.text)
        ])
    }
}
function toggleJson():void{
    showJson.value=!showJson.value
}
function emitSelect():void{
    let item=currentItem.value
    if (!item){
        return
    }
    emit("select", item, currentIndex.value)
}
function nextItem():void{
    if (currentIndex.value<total.value-1){
        currentIndex.value++
        emitSelect()
    }
}
function prevItem():void{
    if (currentIndex.value>0){
        currentIndex.value--
        emitSelect()
    }
}
function goToItem(index: number):void{
    if (index>=0 && index<total.value){
        currentIndex.value=index
        emitSelect()
    }
}
function emitEdit():void{
    let item=currentItem.value
    if (!item){
        return
    }
    emit("edit", item, currentIndex.value)
}
function emitDelete():void{
    let item=currentItem.value
    if (!item){
        return
    }
    emit("delete", item, currentIndex.value)
}
defineExpose({
    currentIndex,
    showJson,
    splitRatio,
    currentItem,
    total,
    formattedItem,
    originalSource,
    hasOriginal,
    nextItem,
    prevItem,
    goToItem,
    toggleJson,
    emitEdit,
    emitDelete
})
</script>
<style scoped>
.dataset-preview{
    display:flex;
    flex-direction:column;
    height:100%;
}
.preview-toolbar{
    display:flex;
    align-items:center;
    gap:8px;
    padding:8px;
    border-bottom:1px solid var(--border-color);
}
.index-display{
    min-width:60px;
    text-align:center;
}
.split-view{
    display:flex;
    flex:1;
    overflow:auto;
}
.original-panel,
.generated-panel{
    padding:8px;
    overflow:auto;
    border-right:1px solid var(--border-color);
}
.generated-panel{
    border-right:none;
}
.single-view{
    flex:1;
    padding:8px;
    overflow:auto;
}
.card{
    margin-bottom:8px;
    padding:8px;
    border:1px solid var(--border-color);
    border-radius:4px;
}
.message-bubble{
    margin-bottom:8px;
    padding:8px;
    border-radius:8px;
}
.message-bubble.user{
    background:var(--bubble-user);
}
.message-bubble.assistant{
    background:var(--bubble-assistant);
}
.message-bubble.system{
    background:var(--bubble-system);
}
.message-role{
    display:block;
    font-weight:bold;
    margin-bottom:4px;
}
pre{
    white-space:pre-wrap;
    word-break:break-word;
}
</style>