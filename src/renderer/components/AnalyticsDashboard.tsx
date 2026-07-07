import type { JSX } from "solid-js"
import { createMemo, For, Show } from "solid-js"
import { t } from "../i18n.js"
import type { TrainingItem } from "../../types/index.js"
import type { RunRecord } from "../../core/runHistoryManager.js"
import analyticsDashboardStyles from "./styles/AnalyticsDashboard.module.css"
const styles = { ...analyticsDashboardStyles }
export interface ValidatorReport{
    name: string
    passRate: number
    flaggedCount: number
}
export interface AnalyticsDashboardProps{
    items: TrainingItem[]
    runs?: RunRecord[]
    validatorReports?: ValidatorReport[]
}
export function AnalyticsDashboard(props: AnalyticsDashboardProps): JSX.Element{
    let items=()=>props.items
    let runs=()=>props.runs||[]
    let reports=()=>props.validatorReports||[]
    let totalItems=createMemo(()=>{
        return items().length
    })
    let formatDistribution=createMemo(()=>{
        let counts={ instruction: 0, messages: 0, text: 0 }
        for (let item of items()){
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
    let avgOutputLength=createMemo(()=>{
        if (items().length===0){
            return 0
        }
        let total=0
        for (let item of items()){
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
        return total/items().length
    })
    let avgInstructionLength=createMemo(()=>{
        if (items().length===0){
            return 0
        }
        let total=0
        for (let item of items()){
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
        return total/items().length
    })
    let totalRuns=createMemo(()=>{
        return runs().length
    })
    let completedRuns=createMemo(()=>{
        return runs().filter((r)=>r.status==="completed").length
    })
    let failedRuns=createMemo(()=>{
        return runs().filter((r)=>r.status==="failed").length
    })
    let runningRuns=createMemo(()=>{
        return runs().filter((r)=>r.status==="running").length
    })
    let queuedRuns=createMemo(()=>{
        return runs().filter((r)=>r.status==="queued").length
    })
    let avgDurationMs=createMemo(()=>{
        let completedRuns=runs().filter((r)=>r.startedAt!==undefined&&r.completedAt!==undefined&&r.completedAt>=r.startedAt)
        if (completedRuns.length===0){
            return 0
        }
        let total=0
        for (let run of completedRuns){
            total+=(run.completedAt!-run.startedAt!)
        }
        return total/completedRuns.length
    })
    let qualityScore=createMemo(()=>{
        let reportsList=reports()
        if (reportsList.length===0){
            return 0
        }
        let total=0
        for (let report of reportsList){
            total+=report.passRate
        }
        return total/reportsList.length
    })
    let topIssues=createMemo(()=>{
        let reportsList=reports()
        return [...reportsList].sort((a, b)=>b.flaggedCount-a.flaggedCount)
    })
    return (
        <div class={styles["analytics-dashboard"]} data-testid="analytics-dashboard">
            <div style={{ display: "none" }} data-testid="format-distribution-data">{JSON.stringify(formatDistribution())}</div>
            <div style={{ display: "none" }} data-testid="avg-output-length-data">{avgOutputLength()}</div>
            <div style={{ display: "none" }} data-testid="avg-instruction-length-data">{avgInstructionLength()}</div>
            <div style={{ display: "none" }} data-testid="quality-score-data">{qualityScore()}</div>
            <div style={{ display: "none" }} data-testid="top-issues-data">{JSON.stringify(topIssues())}</div>
            <div style={{ display: "none" }} data-testid="total-items-data">{totalItems()}</div>
            <div style={{ display: "none" }} data-testid="avg-duration-ms-data">{avgDurationMs()}</div>
            <div class={styles["metrics-cards"]}>
                <div class={styles["metric-card"]} data-testid="total-items-card">
                    <h3 class={styles["metric-label"]}>{t("analytics.totalItems")}</h3>
                    <p class={styles["metric-value"]} data-testid="total-items-value">{totalItems()}</p>
                </div>
                <div class={styles["metric-card"]} data-testid="quality-score-card">
                    <h3 class={styles["metric-label"]}>{t("analytics.qualityScore")}</h3>
                    <p class={styles["metric-value"]} data-testid="quality-score-value">{qualityScore().toFixed(1)}%</p>
                </div>
                <div class={styles["metric-card"]} data-testid="total-runs-card">
                    <h3 class={styles["metric-label"]}>{t("analytics.totalRuns")}</h3>
                    <p class={styles["metric-value"]} data-testid="total-runs-value">{totalRuns()}</p>
                </div>
                <div class={styles["metric-card"]} data-testid="avg-output-length-card">
                    <h3 class={styles["metric-label"]}>{t("analytics.avgOutputLength")}</h3>
                    <p class={styles["metric-value"]} data-testid="avg-output-length-value">{avgOutputLength().toFixed(0)}</p>
                </div>
            </div>
            <div class={`distribution-section`} data-testid="format-distribution">
                <h3 class={styles["section-title"]}>{t("analytics.formatDistribution")}</h3>
                <div class={styles["format-list"]}>
                    <For each={formatDistribution()}>
                        {(item)=>{
                            let testId="format-row-"+item.format
                            return (
                                <div class={styles["format-row"]} data-testid={testId}>
                                    <span class={`format-label`} data-testid={"format-label-"+item.format}>{t("analytics.format."+item.format)}</span>
                                    <span class={`format-count`} data-testid={"format-count-"+item.format}>{item.count}</span>
                                </div>
                            )
                        }}
                    </For>
                </div>
            </div>
            <div class={`run-status-section`} data-testid="run-status-breakdown">
                <h3 class={styles["section-title"]}>{t("analytics.runStatus")}</h3>
                <div class={styles["status-list"]}>
                    <div class={styles["status-row"]} data-testid="status-completed">
                        <span class={`status-label`}>{t("analytics.status.completed")}</span>
                        <span class={`status-value`} data-testid="status-completed-value">{completedRuns()}</span>
                    </div>
                    <div class={styles["status-row"]} data-testid="status-failed">
                        <span class={`status-label`}>{t("analytics.status.failed")}</span>
                        <span class={`status-value`} data-testid="status-failed-value">{failedRuns()}</span>
                    </div>
                    <div class={styles["status-row"]} data-testid="status-running">
                        <span class={`status-label`}>{t("analytics.status.running")}</span>
                        <span class={`status-value`} data-testid="status-running-value">{runningRuns()}</span>
                    </div>
                    <div class={styles["status-row"]} data-testid="status-queued">
                        <span class={`status-label`}>{t("analytics.status.queued")}</span>
                        <span class={`status-value`} data-testid="status-queued-value">{queuedRuns()}</span>
                    </div>
                </div>
            </div>
            <div class={`validator-section`} data-testid="validator-reports-table">
                <h3 class={styles["section-title"]}>{t("analytics.validatorReports")}</h3>
                <table class={styles["validator-table"]}>
                    <thead>
                        <tr>
                            <th>{t("analytics.column.name")}</th>
                            <th>{t("analytics.column.passRate")}</th>
                            <th>{t("analytics.column.flagged")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={reports()}>
                            {(report)=>{
                                return (
                                    <tr class={`validator-row`} data-testid={"validator-row-"+report.name}>
                                        <td data-testid={"validator-name-"+report.name}>{report.name}</td>
                                        <td data-testid={"validator-rate-"+report.name}>{report.passRate.toFixed(1)}%</td>
                                        <td data-testid={"validator-flagged-"+report.name}>{report.flaggedCount}</td>
                                    </tr>
                                )
                            }}
                        </For>
                    </tbody>
                </table>
            </div>
            <div class={`top-issues-section`} data-testid="top-issues-list">
                <h3 class={styles["section-title"]}>{t("analytics.topIssues")}</h3>
                <Show when={topIssues().length>0} fallback={<div class={styles["issues-empty"]} data-testid="issues-empty">{t("analytics.noIssues")}</div>}>
                    <ul class={styles["issues-list"]}>
                        <For each={topIssues()}>
                            {(issue)=>{
                                return (
                                    <li class={styles["issue-item"]} data-testid={"issue-"+issue.name}>
                                        <span class={`issue-name`} data-testid={"issue-name-"+issue.name}>{issue.name}</span>
                                        <span class={`issue-count`} data-testid={"issue-count-"+issue.name}>{issue.flaggedCount}</span>
                                    </li>
                                )
                            }}
                        </For>
                    </ul>
                </Show>
            </div>
        </div>
    )
}
