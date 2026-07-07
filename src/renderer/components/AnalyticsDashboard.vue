<template>
    <div class="analytics-dashboard" data-testid="analytics-dashboard">
        <div class="metrics-cards">
            <div class="metric-card" data-testid="total-items-card">
                <h3 class="metric-label">{{ t('analytics.totalItems') }}</h3>
                <p class="metric-value" data-testid="total-items-value">{{ totalItems }}</p>
            </div>
            <div class="metric-card" data-testid="quality-score-card">
                <h3 class="metric-label">{{ t('analytics.qualityScore') }}</h3>
                <p class="metric-value" data-testid="quality-score-value">{{ qualityScore.toFixed(1) }}%</p>
            </div>
            <div class="metric-card" data-testid="total-runs-card">
                <h3 class="metric-label">{{ t('analytics.totalRuns') }}</h3>
                <p class="metric-value" data-testid="total-runs-value">{{ totalRuns }}</p>
            </div>
            <div class="metric-card" data-testid="avg-output-length-card">
                <h3 class="metric-label">{{ t('analytics.avgOutputLength') }}</h3>
                <p class="metric-value" data-testid="avg-output-length-value">{{ avgOutputLength.toFixed(0) }}</p>
            </div>
        </div>
        <div class="distribution-section" data-testid="format-distribution">
            <h3 class="section-title">{{ t('analytics.formatDistribution') }}</h3>
            <div class="format-list">
                <div v-for="item in formatDistribution" :key="item.format" class="format-row" :data-testid="'format-row-'+item.format">
                    <span class="format-label" :data-testid="'format-label-'+item.format">{{ t(`analytics.format.${item.format}`) }}</span>
                    <span class="format-count" :data-testid="'format-count-'+item.format">{{ item.count }}</span>
                </div>
            </div>
        </div>
        <div class="run-status-section" data-testid="run-status-breakdown">
            <h3 class="section-title">{{ t('analytics.runStatus') }}</h3>
            <div class="status-list">
                <div class="status-row" data-testid="status-completed">
                    <span class="status-label">{{ t('analytics.status.completed') }}</span>
                    <span class="status-value" data-testid="status-completed-value">{{ completedRuns }}</span>
                </div>
                <div class="status-row" data-testid="status-failed">
                    <span class="status-label">{{ t('analytics.status.failed') }}</span>
                    <span class="status-value" data-testid="status-failed-value">{{ failedRuns }}</span>
                </div>
                <div class="status-row" data-testid="status-running">
                    <span class="status-label">{{ t('analytics.status.running') }}</span>
                    <span class="status-value" data-testid="status-running-value">{{ runningRuns }}</span>
                </div>
                <div class="status-row" data-testid="status-queued">
                    <span class="status-label">{{ t('analytics.status.queued') }}</span>
                    <span class="status-value" data-testid="status-queued-value">{{ queuedRuns }}</span>
                </div>
            </div>
        </div>
        <div class="validator-section" data-testid="validator-reports-table">
            <h3 class="section-title">{{ t('analytics.validatorReports') }}</h3>
            <table class="validator-table">
                <thead>
                    <tr>
                        <th>{{ t('analytics.column.name') }}</th>
                        <th>{{ t('analytics.column.passRate') }}</th>
                        <th>{{ t('analytics.column.flagged') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="report in validatorReports" :key="report.name" class="validator-row" :data-testid="'validator-row-'+report.name">
                        <td :data-testid="'validator-name-'+report.name">{{ report.name }}</td>
                        <td :data-testid="'validator-rate-'+report.name">{{ report.passRate.toFixed(1) }}%</td>
                        <td :data-testid="'validator-flagged-'+report.name">{{ report.flaggedCount }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="top-issues-section" data-testid="top-issues-list">
            <h3 class="section-title">{{ t('analytics.topIssues') }}</h3>
            <ul v-if="topIssues.length>0" class="issues-list">
                <li v-for="issue in topIssues" :key="issue.name" class="issue-item" :data-testid="'issue-'+issue.name">
                    <span class="issue-name" :data-testid="'issue-name-'+issue.name">{{ issue.name }}</span>
                    <span class="issue-count" :data-testid="'issue-count-'+issue.name">{{ issue.flaggedCount }}</span>
                </li>
            </ul>
            <div v-else class="issues-empty" data-testid="issues-empty">{{ t('analytics.noIssues') }}</div>
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed } from "vue"
import { t } from "../i18n.js"
import type { TrainingItem } from "../../types/interfaces.js"
import type { RunRecord } from "../../core/runHistoryManager.js"
export interface ValidatorReport{
    name: string
    passRate: number
    flaggedCount: number
}
interface Props{
    items: TrainingItem[]
    runs?: RunRecord[]
    validatorReports?: ValidatorReport[]
}
let props=withDefaults(defineProps<Props>(),{
    runs: ()=>[],
    validatorReports: ()=>[]
})
let totalItems=computed<number>(()=>{
    return props.items.length
})
let formatDistribution=computed<{format: string, label: string, count: number}[]>(()=>{
    let counts={ instruction: 0, messages: 0, text: 0 }
    for (let item of props.items){
        if (item.format==="instruction"){
            counts.instruction++
        }
        else if (item.format==="chatml"){
            counts.messages++
        }
        else if (item.format==="text"){
            counts.text++
        }
    }
    return [
        { format: "instruction", label: "Instruction", count: counts.instruction },
        { format: "messages", label: "Messages", count: counts.messages },
        { format: "text", label: "Text", count: counts.text }
    ]
})
let avgOutputLength=computed<number>(()=>{
    if (props.items.length===0){
        return 0
    }
    let total=0
    for (let item of props.items){
        if (item.format==="instruction"){
            total+=(item.output||"").length
        }
        else if (item.format==="chatml"){
            let messages=item.messages||[]
            let lastAssistant=""
            for (let i=messages.length-1; i>=0; i--){
                if (messages[i].role==="assistant"){
                    lastAssistant=messages[i].content
                    break
                }
            }
            total+=lastAssistant.length
        }
        else if (item.format==="text"){
            total+=(item.text||"").length
        }
    }
    return total/props.items.length
})
let avgInstructionLength=computed<number>(()=>{
    if (props.items.length===0){
        return 0
    }
    let total=0
    for (let item of props.items){
        if (item.format==="instruction"){
            total+=(item.instruction||"").length
        }
        else if (item.format==="chatml"){
            let messages=item.messages||[]
            let firstUser=""
            for (let message of messages){
                if (message.role==="user"){
                    firstUser=message.content
                    break
                }
            }
            total+=firstUser.length
        }
    }
    return total/props.items.length
})
let totalRuns=computed<number>(()=>{
    return (props.runs||[]).length
})
let completedRuns=computed<number>(()=>{
    return (props.runs||[]).filter((r)=>r.status==="completed").length
})
let failedRuns=computed<number>(()=>{
    return (props.runs||[]).filter((r)=>r.status==="failed").length
})
let runningRuns=computed<number>(()=>{
    return (props.runs||[]).filter((r)=>r.status==="running").length
})
let queuedRuns=computed<number>(()=>{
    return (props.runs||[]).filter((r)=>r.status==="queued").length
})
let avgDurationMs=computed<number>(()=>{
    let runs=(props.runs||[]).filter((r)=>r.startedAt!==undefined&&r.completedAt!==undefined&&r.completedAt>=r.startedAt)
    if (runs.length===0){
        return 0
    }
    let total=0
    for (let run of runs){
        total+=(run.completedAt!-run.startedAt!)
    }
    return total/runs.length
})
let qualityScore=computed<number>(()=>{
    let reports=props.validatorReports||[]
    if (reports.length===0){
        return 0
    }
    let total=0
    for (let report of reports){
        total+=report.passRate
    }
    return total/reports.length
})
let topIssues=computed<ValidatorReport[]>(()=>{
    let reports=props.validatorReports||[]
    return [...reports].sort((a, b)=>b.flaggedCount-a.flaggedCount)
})
defineExpose({
    totalItems,
    formatDistribution,
    avgOutputLength,
    avgInstructionLength,
    totalRuns,
    completedRuns,
    failedRuns,
    runningRuns,
    queuedRuns,
    avgDurationMs,
    qualityScore,
    topIssues
})
</script>
<style scoped>
.analytics-dashboard{
    display:flex;
    flex-direction:column;
    gap:16px;
    padding:16px;
}
.metrics-cards{
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));
    gap:12px;
}
.metric-card{
    padding:12px;
    border:1px solid var(--border-color);
    border-radius:var(--radius-large);
    background:var(--surface-color);
}
.metric-label{
    margin:0 0 6px 0;
    font-size:12px;
    color:var(--text-secondary);
}
.metric-value{
    margin:0;
    font-size:22px;
    font-weight:bold;
}
.section-title{
    margin:0 0 8px 0;
    font-size:14px;
    font-weight:bold;
}
.format-list,
.status-list{
    display:flex;
    flex-direction:column;
    gap:4px;
}
.format-row,
.status-row,
.issue-item{
    display:flex;
    justify-content:space-between;
    padding:6px 8px;
    border:1px solid var(--border-color);
    border-radius:var(--radius-medium);
}
.validator-table{
    width:100%;
    border-collapse:collapse;
}
.validator-table th,
.validator-table td{
    padding:8px;
    border:1px solid var(--border-color);
    text-align:left;
}
.issues-list{
    list-style:none;
    margin:0;
    padding:0;
    display:flex;
    flex-direction:column;
    gap:4px;
}
.issues-empty{
    color:var(--text-disabled);
    font-style:italic;
}
</style>
