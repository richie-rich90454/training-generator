<template>
    <div class="prompt-editor" data-testid="prompt-editor">
        <div class="editor-toolbar">
            <input class="version-name-input" type="text" v-model="versionName" placeholder="Version name" data-testid="version-name-input" />
            <button class="toolbar-button" type="button" @click="togglePreview" data-testid="toggle-preview-button">{{ showPreview?"Hide Preview":"Show Preview" }}</button>
            <button class="toolbar-button" type="button" @click="toggleHistory" data-testid="toggle-history-button">{{ showHistory?"Hide History":"Show History" }}</button>
            <button class="toolbar-button" type="button" @click="runPreview" data-testid="run-button">Run</button>
            <button class="toolbar-button" type="button" @click="saveVersion('')" data-testid="save-button">Save</button>
        </div>
        <div class="editor-main">
            <div class="editor-panel">
                <textarea class="prompt-textarea" :placeholder="placeholder" v-model="localContent" @input="onInput" data-testid="prompt-textarea"></textarea>
                <div v-if="hasVariables" class="variable-panel" data-testid="variable-panel">
                    <h4 class="panel-title">Variables</h4>
                    <div v-for="variable in extractedVariables" :key="variable" class="variable-row" data-testid="variable-row">
                        <label class="variable-label" :data-testid="'variable-label-'+variable">{{ variable }}</label>
                        <input class="variable-input" type="text" :value="variableValues[variable]||''" @input="handleVariableInput(variable, $event)" :data-testid="'variable-input-'+variable" />
                    </div>
                </div>
            </div>
            <div v-if="showPreview" class="preview-panel" data-testid="preview-panel">
                <h4 class="panel-title">Preview</h4>
                <pre class="preview-text" data-testid="preview-text">{{ previewText }}</pre>
            </div>
            <div v-if="showHistory" class="history-panel" data-testid="history-panel">
                <h4 class="panel-title">History</h4>
                <div v-if="history&&history.length>0" class="history-list" data-testid="history-list">
                    <div v-for="version in history" :key="version.id" class="history-item" :class="{selected:selectedVersionId===version.id}" @click="loadVersion(version)" :data-testid="'history-item-'+version.id">
                        <span class="history-name">{{ version.name }}</span>
                        <span class="history-date">{{ formatDate(version.createdAt) }}</span>
                    </div>
                </div>
                <div v-else class="history-empty" data-testid="history-empty">No saved versions</div>
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue"
export interface PromptVersion{
    id: string
    name: string
    content: string
    createdAt: number
}
interface Props{
    modelValue: string
    variables?: Record<string, string>
    history?: PromptVersion[]
    placeholder?: string
}
let props=withDefaults(defineProps<Props>(),{
    variables: ()=>({}),
    history: ()=>[],
    placeholder: ""
})
let emit=defineEmits<{
    (e: "update:modelValue", value: string): void
    (e: "save", version: PromptVersion): void
    (e: "run", text: string): void
    (e: "variable-change", name: string, value: string): void
}>()
let localContent=ref<string>(props.modelValue)
let variableValues=ref<Record<string, string>>({ ...props.variables })
let showPreview=ref<boolean>(false)
let showHistory=ref<boolean>(false)
let selectedVersionId=ref<string|null>(null)
let versionName=ref<string>("")
watch(()=>props.modelValue,(newValue)=>{
    localContent.value=newValue
})
let extractedVariables=computed<string[]>(()=>{
    let regex=/\{\{([^{}]+)\}\}/g
    let found=new Set<string>()
    let match=regex.exec(localContent.value)
    while (match!==null){
        let name=match[1].trim()
        if (name.length>0){
            found.add(name)
        }
        match=regex.exec(localContent.value)
    }
    return Array.from(found)
})
let previewText=computed<string>(()=>{
    let text=localContent.value
    text=text.replace(/\{\{([^{}]+)\}\}/g,(match: string, name: string)=>{
        let trimmedName=name.trim()
        if (variableValues.value[trimmedName]!==undefined){
            return variableValues.value[trimmedName]
        }
        return match
    })
    return text
})
let isDirty=computed<boolean>(()=>{
    return localContent.value!==props.modelValue
})
let hasVariables=computed<boolean>(()=>{
    return extractedVariables.value.length>0
})
function onInput(event: Event):void{
    let target=event.target as HTMLTextAreaElement
    localContent.value=target.value
    emit("update:modelValue",target.value)
}
function setVariable(name: string, value: string):void{
    variableValues.value[name]=value
    emit("variable-change",name,value)
}
function handleVariableInput(name: string, event: Event):void{
    let target=event.target as HTMLInputElement
    setVariable(name,target.value)
}
function togglePreview():void{
    showPreview.value=!showPreview.value
}
function toggleHistory():void{
    showHistory.value=!showHistory.value
}
function generateId():string{
    return Math.random().toString(36).substring(2)+Date.now().toString(36)
}
function saveVersion(name: string):void{
    let finalName=name||versionName.value||"Version "+new Date().toLocaleString()
    let version: PromptVersion={
        id: generateId(),
        name: finalName,
        content: localContent.value,
        createdAt: Date.now()
    }
    emit("save",version)
}
function loadVersion(version: PromptVersion):void{
    localContent.value=version.content
    selectedVersionId.value=version.id
    emit("update:modelValue",version.content)
}
function runPreview():void{
    emit("run",previewText.value)
}
function formatDate(timestamp: number):string{
    return new Date(timestamp).toLocaleString()
}
defineExpose({
    localContent,
    variableValues,
    showPreview,
    showHistory,
    selectedVersionId,
    versionName,
    extractedVariables,
    previewText,
    isDirty,
    hasVariables,
    setVariable,
    saveVersion,
    loadVersion,
    runPreview,
    togglePreview,
    toggleHistory
})
</script>
<style scoped>
.prompt-editor{
    display:flex;
    flex-direction:column;
    height:100%;
}
.editor-toolbar{
    display:flex;
    align-items:center;
    gap:8px;
    padding:8px;
    border-bottom:1px solid var(--border-color);
}
.version-name-input{
    flex:1;
    padding:4px 8px;
    border:1px solid var(--border-color);
    border-radius:4px;
}
.toolbar-button{
    padding:4px 12px;
    border:1px solid var(--border-color);
    border-radius:4px;
    background:var(--surface-color);
    cursor:pointer;
}
.editor-main{
    display:flex;
    flex:1;
    overflow:auto;
    gap:8px;
    padding:8px;
}
.editor-panel{
    flex:1;
    display:flex;
    flex-direction:column;
    min-width:200px;
}
.prompt-textarea{
    flex:1;
    width:100%;
    min-height:120px;
    padding:8px;
    border:1px solid var(--border-color);
    border-radius:4px;
    resize:vertical;
    font-family:inherit;
}
.variable-panel{
    margin-top:8px;
    padding:8px;
    border:1px solid var(--border-color);
    border-radius:4px;
}
.variable-row{
    display:flex;
    align-items:center;
    gap:8px;
    margin-bottom:4px;
}
.variable-label{
    min-width:100px;
    font-weight:bold;
}
.variable-input{
    flex:1;
    padding:4px 8px;
    border:1px solid var(--border-color);
    border-radius:4px;
}
.preview-panel,
.history-panel{
    flex:1;
    min-width:200px;
    padding:8px;
    border:1px solid var(--border-color);
    border-radius:4px;
    overflow:auto;
}
.panel-title{
    margin:0 0 8px 0;
    font-size:14px;
    font-weight:bold;
}
.preview-text{
    white-space:pre-wrap;
    word-break:break-word;
    margin:0;
}
.history-list{
    display:flex;
    flex-direction:column;
    gap:4px;
}
.history-item{
    padding:4px 8px;
    border:1px solid var(--border-color);
    border-radius:4px;
    cursor:pointer;
}
.history-item.selected{
    background:var(--selection-color);
}
.history-name{
    display:block;
    font-weight:bold;
}
.history-date{
    display:block;
    font-size:12px;
    color:var(--text-secondary);
}
.history-empty{
    color:var(--text-disabled);
    font-style:italic;
}
</style>
