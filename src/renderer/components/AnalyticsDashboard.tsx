import type { JSX } from "solid-js"
import { createMemo, For, Show, onMount, onCleanup } from "solid-js"
import { Portal } from "solid-js/web"
import { t } from "../i18n.js"
import type { TrainingItem } from "../../types/index.js"
import type { RunRecord } from "../../core/runHistoryManager.js"
import type { AppStore } from "../stores/appStore.js"
import { Icon } from "./Icon.js"
import { renderIcon } from "../icons.js"
import analyticsDashboardStyles from "./styles/AnalyticsDashboard.module.css"
import modalStyles from "./styles/Modal.module.css"
const styles = { ...analyticsDashboardStyles, ...modalStyles }
export interface ValidatorReport{
    name: string
    passRate: number
    flaggedCount: number
}
export interface AnalyticsDashboardProps{
    items: TrainingItem[]
    runs?: RunRecord[]
    validatorReports?: ValidatorReport[]
    appStore?: AppStore
}
export function AnalyticsDashboard(props: AnalyticsDashboardProps): JSX.Element{
    let overlayRef: HTMLDivElement|undefined
    let items=()=>props.items
    let runs=()=>props.runs||[]
    let reports=()=>props.validatorReports||[]
    function handleClose():void{
        props.appStore?.uiStore.closeAnalytics()
    }
    function handleBackdropClick(e: MouseEvent):void{
        if (e.target===overlayRef){
            handleClose()
        }
    }
    function handleKeydown(e: KeyboardEvent):void{
        if (!props.appStore?.uiStore.analyticsOpen()){
            return
        }
        if (e.key==="Escape"){
            e.preventDefault()
            handleClose()
        }
    }
    onMount(()=>{
        if (props.appStore){
            document.addEventListener("keydown",handleKeydown)
        }
    })
    onCleanup(()=>{
        if (props.appStore){
            document.removeEventListener("keydown",handleKeydown)
        }
    })
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
    function dashboardBody(): JSX.Element{
        return (
            <div class={styles["analytics-dashboard"]} data-testid="analytics-dashboard">
                <div class={styles["test-only"]} aria-hidden="true" data-testid="format-distribution-data">{JSON.stringify(formatDistribution())}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="avg-output-length-data">{avgOutputLength()}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="avg-instruction-length-data">{avgInstructionLength()}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="quality-score-data">{qualityScore()}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="top-issues-data">{JSON.stringify(topIssues())}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="total-items-data">{totalItems()}</div>
                <div class={styles["test-only"]} aria-hidden="true" data-testid="avg-duration-ms-data">{avgDurationMs()}</div>
                <div class={styles["metrics-cards"]}>
                    <div class={styles["metric-card"]} data-testid="total-items-card">
                        <h3 class={styles["metric-label"]} data-i18n="analytics.totalItems">{t("analytics.totalItems")}</h3>
                        <p class={styles["metric-value"]} data-testid="total-items-value">{totalItems()}</p>
                    </div>
                    <div class={styles["metric-card"]} data-testid="quality-score-card">
                        <h3 class={styles["metric-label"]} data-i18n="analytics.qualityScore">{t("analytics.qualityScore")}</h3>
                        <p class={styles["metric-value"]} data-testid="quality-score-value">{qualityScore().toFixed(1)}%</p>
                    </div>
                    <div class={styles["metric-card"]} data-testid="total-runs-card">
                        <h3 class={styles["metric-label"]} data-i18n="analytics.totalRuns">{t("analytics.totalRuns")}</h3>
                        <p class={styles["metric-value"]} data-testid="total-runs-value">{totalRuns()}</p>
                    </div>
                    <div class={styles["metric-card"]} data-testid="avg-output-length-card">
                        <h3 class={styles["metric-label"]} data-i18n="analytics.avgOutputLength">{t("analytics.avgOutputLength")}</h3>
                        <p class={styles["metric-value"]} data-testid="avg-output-length-value">{avgOutputLength().toFixed(0)}</p>
                    </div>
                </div>
                <div class={`distribution-section`} data-testid="format-distribution">
                    <h3 class={styles["section-title"]} data-i18n="analytics.formatDistribution">{t("analytics.formatDistribution")}</h3>
                    <div class={styles["format-list"]}>
                        <For each={formatDistribution()}>
                            {(item)=>{
                                let testId="format-row-"+item.format
                                return (
                                    <div class={styles["format-row"]} data-testid={testId}>
                                        <span class={`format-label`} data-testid={"format-label-"+item.format} data-i18n={"analytics.format."+item.format}>{t("analytics.format."+item.format)}</span>
                                        <span class={`format-count`} data-testid={"format-count-"+item.format}>{item.count}</span>
                                    </div>
                                )
                            }}
                        </For>
                    </div>
                </div>
                <div class={`run-status-section`} data-testid="run-status-breakdown">
                    <h3 class={styles["section-title"]} data-i18n="analytics.runStatus">{t("analytics.runStatus")}</h3>
                    <div class={styles["status-list"]}>
                        <div class={styles["status-row"]} data-testid="status-completed">
                            <span class={`status-label`} data-i18n="analytics.status.completed">{t("analytics.status.completed")}</span>
                            <span class={`status-value`} data-testid="status-completed-value">{completedRuns()}</span>
                        </div>
                        <div class={styles["status-row"]} data-testid="status-failed">
                            <span class={`status-label`} data-i18n="analytics.status.failed">{t("analytics.status.failed")}</span>
                            <span class={`status-value`} data-testid="status-failed-value">{failedRuns()}</span>
                        </div>
                        <div class={styles["status-row"]} data-testid="status-running">
                            <span class={`status-label`} data-i18n="analytics.status.running">{t("analytics.status.running")}</span>
                            <span class={`status-value`} data-testid="status-running-value">{runningRuns()}</span>
                        </div>
                        <div class={styles["status-row"]} data-testid="status-queued">
                            <span class={`status-label`} data-i18n="analytics.status.queued">{t("analytics.status.queued")}</span>
                            <span class={`status-value`} data-testid="status-queued-value">{queuedRuns()}</span>
                        </div>
                    </div>
                </div>
                <div class={`validator-section`} data-testid="validator-reports-table">
                    <h3 class={styles["section-title"]} data-i18n="analytics.validatorReports">{t("analytics.validatorReports")}</h3>
                    <table class={styles["validator-table"]}>
                        <thead>
                            <tr>
                                <th data-i18n="analytics.column.name">{t("analytics.column.name")}</th>
                                <th data-i18n="analytics.column.passRate">{t("analytics.column.passRate")}</th>
                                <th data-i18n="analytics.column.flagged">{t("analytics.column.flagged")}</th>
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
                    <h3 class={styles["section-title"]} data-i18n="analytics.topIssues">{t("analytics.topIssues")}</h3>
                    <Show when={topIssues().length>0} fallback={<div class={styles["issues-empty"]} data-testid="issues-empty" data-i18n="analytics.noIssues">{t("analytics.noIssues")}</div>}>
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
    if (!props.appStore){
        return dashboardBody()
    }
    return (
        <Show when={props.appStore.uiStore.analyticsOpen()}>
            <Portal mount={document.body}>
                <div
                    ref={overlayRef}
                    class={`${styles["modal"]} ${styles["active"]}`}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t("analytics.title")}
                    data-i18n-aria-label="analytics.title"
                    onClick={handleBackdropClick}
                >
                    <div class={styles["modal-content"]} style={{ "max-width": "900px", width: "85%", "max-height": "85vh", padding: "0", overflow: "hidden" }}>
                        <div class={styles["modal-header"]} style={{ "flex-shrink": "0" }}>
                            <h2>
                                <Icon html={renderIcon("fa-chart-bar")} />
                                <span data-i18n="analytics.title">{t("analytics.title")}</span>
                            </h2>
                            <button
                                class={styles["modal-close"]}
                                aria-label={t("analytics.closeAria")}
                                data-i18n-aria-label="analytics.closeAria"
                                onClick={handleClose}
                            >
                                <Icon html={renderIcon("fa-times")} />
                            </button>
                        </div>
                        <div style={{ "overflow-y": "auto", "max-height": "calc(85vh - 60px)", padding: "var(--spacing-lg)" }}>
                            {dashboardBody()}
                        </div>
                    </div>
                </div>
            </Portal>
        </Show>
    )
}
