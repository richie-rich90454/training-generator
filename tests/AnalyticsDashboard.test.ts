import { describe, test, expect } from "vitest"
import { mount } from "@vue/test-utils"
import AnalyticsDashboard from "../src/renderer/components/AnalyticsDashboard.vue"
import type { TrainingItem } from "../src/types/interfaces.js"
import type { RunRecord } from "../src/core/runHistoryManager.js"
interface ValidatorReport{
    name: string
    passRate: number
    flaggedCount: number
}
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
function mountComponent(props: Record<string, unknown>){
    return mount(AnalyticsDashboard, { props })
}
describe("AnalyticsDashboard",()=>{
    test("renders total items",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items })
        expect(wrapper.find('[data-testid="total-items-value"]').text()).toBe("4")
    })
    test("renders quality score",()=>{
        let items=makeItems()
        let reports=makeReports()
        let wrapper=mountComponent({ items, validatorReports: reports })
        expect(wrapper.find('[data-testid="quality-score-value"]').text()).toBe("90.0%")
    })
    test("computes format distribution",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items })
        let distribution=wrapper.vm.formatDistribution
        expect(distribution.find((d: FormatDistributionItem)=>d.format==="instruction")?.count).toBe(2)
        expect(distribution.find((d: FormatDistributionItem)=>d.format==="messages")?.count).toBe(1)
        expect(distribution.find((d: FormatDistributionItem)=>d.format==="text")?.count).toBe(1)
    })
    test("computes avg output length",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items })
        expect(wrapper.vm.avgOutputLength).toBe(7.5)
    })
    test("computes avg instruction length",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items })
        expect(wrapper.vm.avgInstructionLength).toBe(7.25)
    })
    test("renders total runs",()=>{
        let items=makeItems()
        let runs=makeRuns()
        let wrapper=mountComponent({ items, runs })
        expect(wrapper.find('[data-testid="total-runs-value"]').text()).toBe("4")
    })
    test("renders completed runs",()=>{
        let items=makeItems()
        let runs=makeRuns()
        let wrapper=mountComponent({ items, runs })
        expect(wrapper.find('[data-testid="status-completed-value"]').text()).toBe("1")
    })
    test("renders failed runs",()=>{
        let items=makeItems()
        let runs=makeRuns()
        let wrapper=mountComponent({ items, runs })
        expect(wrapper.find('[data-testid="status-failed-value"]').text()).toBe("1")
    })
    test("computes avg duration",()=>{
        let items=makeItems()
        let runs=makeRuns()
        let wrapper=mountComponent({ items, runs })
        expect(wrapper.vm.avgDurationMs).toBe(1250)
    })
    test("renders validator reports",()=>{
        let items=makeItems()
        let reports=makeReports()
        let wrapper=mountComponent({ items, validatorReports: reports })
        let rows=wrapper.findAll('[data-testid^="validator-row-"]')
        expect(rows.length).toBe(3)
        expect(wrapper.find('[data-testid="validator-name-Bias"]').text()).toBe("Bias")
        expect(wrapper.find('[data-testid="validator-rate-Bias"]').text()).toBe("90.0%")
        expect(wrapper.find('[data-testid="validator-flagged-Toxicity"]').text()).toBe("10")
    })
    test("renders top issues",()=>{
        let items=makeItems()
        let reports=makeReports()
        let wrapper=mountComponent({ items, validatorReports: reports })
        let issues=wrapper.findAll('.issue-item')
        expect(issues.length).toBe(3)
        expect(wrapper.find('[data-testid="issue-name-Toxicity"]').text()).toBe("Toxicity")
        expect(wrapper.find('[data-testid="issue-count-Toxicity"]').text()).toBe("10")
    })
    test("handles empty items",()=>{
        let wrapper=mountComponent({ items: [] })
        expect(wrapper.find('[data-testid="total-items-value"]').text()).toBe("0")
        expect(wrapper.find('[data-testid="format-count-instruction"]').text()).toBe("0")
        expect(wrapper.find('[data-testid="format-count-messages"]').text()).toBe("0")
        expect(wrapper.find('[data-testid="format-count-text"]').text()).toBe("0")
    })
    test("handles empty runs",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, runs: [] })
        expect(wrapper.find('[data-testid="total-runs-value"]').text()).toBe("0")
        expect(wrapper.find('[data-testid="status-completed-value"]').text()).toBe("0")
        expect(wrapper.find('[data-testid="status-failed-value"]').text()).toBe("0")
    })
    test("handles empty validator reports",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, validatorReports: [] })
        expect(wrapper.find('[data-testid="issues-empty"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="quality-score-value"]').text()).toBe("0.0%")
    })
    test("quality score 0 when no reports",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, validatorReports: [] })
        expect(wrapper.vm.qualityScore).toBe(0)
    })
    test("topIssues sorted by flaggedCount",()=>{
        let items=makeItems()
        let reports=makeReports()
        let wrapper=mountComponent({ items, validatorReports: reports })
        let names=wrapper.vm.topIssues.map((r: ValidatorReport)=>r.name)
        expect(names).toEqual(["Toxicity", "Bias", "PII"])
    })
    test("run status breakdown correct",()=>{
        let items=makeItems()
        let runs=makeRuns()
        let wrapper=mountComponent({ items, runs })
        expect(wrapper.find('[data-testid="status-completed-value"]').text()).toBe("1")
        expect(wrapper.find('[data-testid="status-failed-value"]').text()).toBe("1")
        expect(wrapper.find('[data-testid="status-running-value"]').text()).toBe("1")
        expect(wrapper.find('[data-testid="status-queued-value"]').text()).toBe("1")
    })
    test("cards displayed",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items })
        expect(wrapper.find('[data-testid="total-items-card"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="quality-score-card"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="total-runs-card"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="avg-output-length-card"]').exists()).toBe(true)
    })
    test("format labels present",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items })
        expect(wrapper.find('[data-testid="format-label-instruction"]').text()).toBe("Instruction")
        expect(wrapper.find('[data-testid="format-label-messages"]').text()).toBe("Messages")
        expect(wrapper.find('[data-testid="format-label-text"]').text()).toBe("Text")
    })
    test("handles items with messages",()=>{
        let items=[
            { format: "chatml", messages: [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }] }
        ] as unknown as TrainingItem[]
        let wrapper=mountComponent({ items })
        expect(wrapper.vm.totalItems).toBe(1)
        expect(wrapper.vm.formatDistribution.find((d: FormatDistributionItem)=>d.format==="messages")?.count).toBe(1)
        expect(wrapper.vm.avgOutputLength).toBe(5)
        expect(wrapper.vm.avgInstructionLength).toBe(2)
    })
})
