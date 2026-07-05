<template>
    <div v-if="visible" class="command-palette-overlay" data-testid="command-palette-overlay" @click="onBackdropClick">
        <div class="command-palette" data-testid="command-palette" @keydown="onKeydown">
            <input v-model="query" class="command-palette-input" type="text" placeholder="Type a command..." data-testid="command-palette-input" />
            <ul v-if="filteredCommands.length>0" class="command-list" data-testid="command-list">
                <li v-for="(command, index) in filteredCommands" :key="command.id" class="command-item" :class="{selected:index===selectedIndex}" @click="executeCommand(command)" :data-testid="'command-item-'+command.id">
                    <span v-if="command.icon" class="command-icon">{{ command.icon }}</span>
                    <span class="command-label" :data-testid="'command-label-'+command.id">{{ command.label }}</span>
                    <span v-if="command.shortcut" class="command-shortcut" :data-testid="'command-shortcut-'+command.id">{{ command.shortcut }}</span>
                </li>
            </ul>
            <div v-else class="command-empty" data-testid="command-empty">No commands found</div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue"
export interface Command{
    id: string
    label: string
    shortcut?: string
    icon?: string
    action: ()=>void
}
interface Props{
    commands: Command[]
    visible: boolean
}
let props=defineProps<Props>()
let emit=defineEmits<{
    (e: "close"): void
}>()
let query=ref<string>("")
let selectedIndex=ref<number>(0)
let filteredCommands=computed<Command[]>(()=>{
    let q=query.value.trim().toLowerCase()
    if (q.length===0){
        return props.commands
    }
    return props.commands.filter((command)=>{
        return command.label.toLowerCase().includes(q)||command.id.toLowerCase().includes(q)
    })
})
watch(query,()=>{
    selectedIndex.value=0
})
function onKeydown(event: KeyboardEvent):void{
    if (event.key==="ArrowDown"){
        event.preventDefault()
        if (filteredCommands.value.length>0){
            selectedIndex.value=Math.min(selectedIndex.value+1, filteredCommands.value.length-1)
        }
    }
    else if (event.key==="ArrowUp"){
        event.preventDefault()
        if (filteredCommands.value.length>0){
            selectedIndex.value=Math.max(selectedIndex.value-1, 0)
        }
    }
    else if (event.key==="Enter"){
        event.preventDefault()
        let command=filteredCommands.value[selectedIndex.value]
        if (command!==undefined){
            command.action()
        }
    }
    else if (event.key==="Escape"){
        event.preventDefault()
        emit("close")
    }
}
function executeCommand(command: Command):void{
    command.action()
}
function onBackdropClick(event: MouseEvent):void{
    if (event.target===event.currentTarget){
        emit("close")
    }
}
defineExpose({
    query,
    selectedIndex,
    filteredCommands
})
</script>
<style scoped>
.command-palette-overlay{
    position:fixed;
    top:0;
    left:0;
    right:0;
    bottom:0;
    background:rgba(0,0,0,0.5);
    display:flex;
    align-items:flex-start;
    justify-content:center;
    padding-top:100px;
    z-index:1000;
}
.command-palette{
    background:var(--surface-color);
    border-radius:8px;
    box-shadow:var(--shadow-3);
    width:480px;
    max-width:90%;
    overflow:hidden;
}
.command-palette-input{
    width:100%;
    padding:12px 16px;
    border:none;
    border-bottom:1px solid var(--border-color);
    font-size:14px;
    outline:none;
}
.command-list{
    list-style:none;
    margin:0;
    padding:0;
    max-height:300px;
    overflow-y:auto;
}
.command-item{
    display:flex;
    align-items:center;
    gap:8px;
    padding:10px 16px;
    cursor:pointer;
}
.command-item.selected{
    background:var(--selection-color);
}
.command-icon{
    font-size:14px;
}
.command-label{
    flex:1;
    font-size:14px;
}
.command-shortcut{
    font-size:12px;
    color:var(--text-secondary);
    background:var(--surface-variant);
    padding:2px 6px;
    border-radius:4px;
}
.command-empty{
    padding:16px;
    color:var(--text-secondary);
    font-size:14px;
}
</style>
