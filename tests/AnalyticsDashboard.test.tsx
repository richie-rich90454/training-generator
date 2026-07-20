import { describe, test, expect } from "vitest"
import { render, screen } from "@solidjs/testing-library"
import { AnalyticsDashboard } from "../src/renderer/components/AnalyticsDashboard.tsx"
import type { ValidatorReport } from "../src/renderer/components/AnalyticsDashboard.tsx"
import type { TrainingItem } from "../src/types/interfaces.js"
import type { RunRecord } from "../src/core/runHistoryManager.js"
interface FormatDistributionItem{
    format: string
    label: string
    count: number
}
function makeItems():TrainingItem[]{
    return [
        { format: "instruction", instruction: "What is 2+2?", input: "", output: "4" },
        { format: "instruction", instruction: "What is 3+3?", input: "", output: "6" },
        { format: "chatml", messages: [{ role: "user", content: "Hello" }, { role: "assistant", content: "Hi there" }] },
        { format: "text", text: "The quick brown fox." }
    ] as unknown as TrainingItem[]
}
function makeRuns():RunRecord[]{
    return [
        { id: "1", name: "Run 1", status: "completed", startedAt: 1000, completedAt: 3000, config: {} },
        { id: "2", name: "Run 2", status: "failed", startedAt: 2000, completedAt: 2500, config: {} },
        { id: "3", name: "Run 3", status: "running", startedAt: 3000, config: {} },
        { id: "4", name: "Run 4", status: "queued", config: {} }
    ]
}
function makeReports():ValidatorReport[]{
    return [
        { name: "Bias", passRate: 90, flaggedCount: 5 },
        { name: "Toxicity", passRate: 85, flaggedCount: 10 },
        { name: "PII", passRate: 95, flaggedCount: 2 }
    ]
}
function renderComponent(props: { items: TrainingItem[]; runs?: RunRecord[]; validatorReports?: ValidatorReport[] }){
    return render(()=><AnalyticsDashboard {...props} />)
}
function getDistribution():FormatDistributionItem[]{
    return JSON.parse(screen.getByTestId("format-distribution-data").textContent||"[]")
}
function getTopIssues():ValidatorReport[]{
    return JSON.parse(screen.getByTestId("top-issues-data").textContent||"[]")
}
describe("AnalyticsDashboard",()=>{
    test("renders total items",()=>{
        let items=makeItems()
        renderComponent({ items })
        expect(screen.getByTestId("total-items-value").textContent).toBe("4")
    })
    test("renders quality score",()=>{
        let items=makeItems()
        let reports=makeReports()
        renderComponent({ items, validatorReports: reports })
        expect(screen.getByTestId("quality-score-value").textContent).toBe("90.0%")
    })
    test("computes format distribution",()=>{
        let items=makeItems()
        renderComponent({ items })
        let distribution=getDistribution()
        expect(distribution.find((d)=>d.format==="instruction")?.count).toBe(2)
        expect(distribution.find((d)=>d.format==="messages")?.count).toBe(1)
        expect(distribution.find((d)=>d.format==="text")?.count).toBe(1)
    })
    test("computes avg output length",()=>{
        let items=makeItems()
        renderComponent({ items })
        let value=screen.getByTestId("avg-output-length-data").textContent
        expect(Number(value)).toBe(7.5)
    })
    test("computes avg instruction length",()=>{
        let items=makeItems()
        renderComponent({ items })
        let value=screen.getByTestId("avg-instruction-length-data").textContent
        expect(Number(value)).toBe(7.25)
    })
    test("renders total runs",()=>{
        let items=makeItems()
        let runs=makeRuns()
        renderComponent({ items, runs })
        expect(screen.getByTestId("total-runs-value").textContent).toBe("4")
    })
    test("renders completed runs",()=>{
        let items=makeItems()
        let runs=makeRuns()
        renderComponent({ items, runs })
        expect(screen.getByTestId("status-completed-value").textContent).toBe("1")
    })
    test("renders failed runs",()=>{
        let items=makeItems()
        let runs=makeRuns()
        renderComponent({ items, runs })
        expect(screen.getByTestId("status-failed-value").textContent).toBe("1")
    })
    test("computes avg duration",()=>{
        let items=makeItems()
        let runs=makeRuns()
        renderComponent({ items, runs })
        let value=screen.getByTestId("avg-duration-ms-data").textContent
        expect(Number(value)).toBe(1250)
    })
    test("renders validator reports",()=>{
        let items=makeItems()
        let reports=makeReports()
        renderComponent({ items, validatorReports: reports })
        let rows=screen.queryAllByTestId(/^validator-row-/)
        expect(rows.length).toBe(3)
        expect(screen.getByTestId("validator-name-Bias").textContent).toBe("Bias")
        expect(screen.getByTestId("validator-rate-Bias").textContent).toBe("90.0%")
        expect(screen.getByTestId("validator-flagged-Toxicity").textContent).toBe("10")
    })
    test("renders top issues",()=>{
        let items=makeItems()
        let reports=makeReports()
        renderComponent({ items, validatorReports: reports })
        let issues=screen.queryAllByTestId(/^issue-[A-Za-z]+$/)
        expect(issues.length).toBe(3)
        expect(screen.getByTestId("issue-name-Toxicity").textContent).toBe("Toxicity")
        expect(screen.getByTestId("issue-count-Toxicity").textContent).toBe("10")
    })
    test("handles empty items",()=>{
        renderComponent({ items: [] })
        expect(screen.getByTestId("total-items-value").textContent).toBe("0")
        expect(screen.getByTestId("format-count-instruction").textContent).toBe("0")
        expect(screen.getByTestId("format-count-messages").textContent).toBe("0")
        expect(screen.getByTestId("format-count-text").textContent).toBe("0")
    })
    test("handles empty runs",()=>{
        let items=makeItems()
        renderComponent({ items, runs: [] })
        expect(screen.getByTestId("total-runs-value").textContent).toBe("0")
        expect(screen.getByTestId("status-completed-value").textContent).toBe("0")
        expect(screen.getByTestId("status-failed-value").textContent).toBe("0")
    })
    test("handles empty validator reports",()=>{
        let items=makeItems()
        renderComponent({ items, validatorReports: [] })
        expect(screen.queryByTestId("issues-empty")).not.toBeNull()
        expect(screen.getByTestId("quality-score-value").textContent).toBe("0.0%")
    })
    test("quality score 0 when no reports",()=>{
        let items=makeItems()
        renderComponent({ items, validatorReports: [] })
        let value=screen.getByTestId("quality-score-data").textContent
        expect(Number(value)).toBe(0)
    })
    test("topIssues sorted by flaggedCount",()=>{
        let items=makeItems()
        let reports=makeReports()
        renderComponent({ items, validatorReports: reports })
        let names=getTopIssues().map((r)=>r.name)
        expect(names).toEqual(["Toxicity", "Bias", "PII"])
    })
    test("run status breakdown correct",()=>{
        let items=makeItems()
        let runs=makeRuns()
        renderComponent({ items, runs })
        expect(screen.getByTestId("status-completed-value").textContent).toBe("1")
        expect(screen.getByTestId("status-failed-value").textContent).toBe("1")
        expect(screen.getByTestId("status-running-value").textContent).toBe("1")
        expect(screen.getByTestId("status-queued-value").textContent).toBe("1")
    })
    test("cards displayed",()=>{
        let items=makeItems()
        renderComponent({ items })
        expect(screen.queryByTestId("total-items-card")).not.toBeNull()
        expect(screen.queryByTestId("quality-score-card")).not.toBeNull()
        expect(screen.queryByTestId("total-runs-card")).not.toBeNull()
        expect(screen.queryByTestId("avg-output-length-card")).not.toBeNull()
    })
    test("format labels present",()=>{
        let items=makeItems()
        renderComponent({ items })
        expect(screen.getByTestId("format-label-instruction").textContent).toBe("Instruction")
        expect(screen.getByTestId("format-label-messages").textContent).toBe("Messages")
        expect(screen.getByTestId("format-label-text").textContent).toBe("Text")
    })
    test("handles items with messages",()=>{
        let items=[
            { format: "chatml", messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }] }
        ] as unknown as TrainingItem[]
        renderComponent({ items })
        expect(screen.getByTestId("total-items-data").textContent).toBe("1")
        expect(getDistribution().find((d)=>d.format==="messages")?.count).toBe(1)
        expect(Number(screen.getByTestId("avg-output-length-data").textContent)).toBe(5)
        expect(Number(screen.getByTestId("avg-instruction-length-data").textContent)).toBe(2)
    })
    test("metric labels carry data-i18n attributes",()=>{
        renderComponent({ items: makeItems() })
        expect(screen.getByTestId("total-items-card").querySelector("[data-i18n='analytics.totalItems']")).not.toBeNull()
        expect(screen.getByTestId("quality-score-card").querySelector("[data-i18n='analytics.qualityScore']")).not.toBeNull()
        expect(screen.getByTestId("total-runs-card").querySelector("[data-i18n='analytics.totalRuns']")).not.toBeNull()
        expect(screen.getByTestId("avg-output-length-card").querySelector("[data-i18n='analytics.avgOutputLength']")).not.toBeNull()
    })
    test("section titles carry data-i18n attributes",()=>{
        renderComponent({ items: makeItems() })
        const dashboard = screen.getByTestId("analytics-dashboard")
        expect(dashboard.querySelector("[data-i18n='analytics.formatDistribution']")).not.toBeNull()
        expect(dashboard.querySelector("[data-i18n='analytics.runStatus']")).not.toBeNull()
        expect(dashboard.querySelector("[data-i18n='analytics.validatorReports']")).not.toBeNull()
        expect(dashboard.querySelector("[data-i18n='analytics.topIssues']")).not.toBeNull()
    })
    test("format labels carry dynamic data-i18n attributes",()=>{
        renderComponent({ items: makeItems() })
        expect(screen.getByTestId("format-label-instruction").getAttribute("data-i18n")).toBe("analytics.format.instruction")
        expect(screen.getByTestId("format-label-messages").getAttribute("data-i18n")).toBe("analytics.format.messages")
        expect(screen.getByTestId("format-label-text").getAttribute("data-i18n")).toBe("analytics.format.text")
    })
    test("status labels carry data-i18n attributes",()=>{
        renderComponent({ items: makeItems(), runs: makeRuns() })
        expect(screen.getByTestId("status-completed").querySelector("[data-i18n='analytics.status.completed']")).not.toBeNull()
        expect(screen.getByTestId("status-failed").querySelector("[data-i18n='analytics.status.failed']")).not.toBeNull()
        expect(screen.getByTestId("status-running").querySelector("[data-i18n='analytics.status.running']")).not.toBeNull()
        expect(screen.getByTestId("status-queued").querySelector("[data-i18n='analytics.status.queued']")).not.toBeNull()
    })
    test("validator table column headers carry data-i18n attributes",()=>{
        renderComponent({ items: makeItems(), validatorReports: makeReports() })
        const table = screen.getByTestId("validator-reports-table")
        expect(table.querySelector("th[data-i18n='analytics.column.name']")).not.toBeNull()
        expect(table.querySelector("th[data-i18n='analytics.column.passRate']")).not.toBeNull()
        expect(table.querySelector("th[data-i18n='analytics.column.flagged']")).not.toBeNull()
    })
    test("issues-empty fallback carries data-i18n attribute",()=>{
        renderComponent({ items: makeItems(), validatorReports: [] })
        expect(screen.getByTestId("issues-empty").getAttribute("data-i18n")).toBe("analytics.noIssues")
    })
})
