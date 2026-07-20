import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { DatasetPreview } from "../src/renderer/components/DatasetPreview.tsx"
import type { DatasetPreviewProps } from "../src/renderer/components/DatasetPreview.tsx"
import type { TrainingItem } from "../src/types/interfaces.js"
function makeItems():TrainingItem[]{
    return [
        {
            format: "instruction",
            instruction: "What is 2+2?",
            input: "",
            output: "4",
            metadata: { original: "source one" }
        },
        {
            format: "chatml",
            messages: [
                { role: "user", content: "Hello" },
                { role: "assistant", content: "Hi there" }
            ],
            metadata: { source: "source two" }
        },
        {
            format: "text",
            text: "The quick brown fox.",
            metadata: {}
        }
    ] as unknown as TrainingItem[]
}
function renderComponent(props: Omit<DatasetPreviewProps, "items"|"format"> & { items: TrainingItem[]; format: "instruction"|"messages"|"text" }){
    let onSelect=props.onSelect||vi.fn()
    let onEdit=props.onEdit||vi.fn()
    let onDelete=props.onDelete||vi.fn()
    return render(()=><DatasetPreview {...props} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />)
}
describe("DatasetPreview",()=>{
    test("renders items",()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction" })
        expect(screen.queryByTestId("dataset-preview")).not.toBeNull()
        expect(screen.queryByTestId("instruction-view")).not.toBeNull()
        expect(screen.getByTestId("instruction-text").textContent).toBe("What is 2+2?")
    })
    test("shows current item index",()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction" })
        expect(screen.getByTestId("index-display").textContent).toBe("1 / 3")
    })
    test("nextItem increments",async()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction" })
        fireEvent.click(screen.getByTestId("next-button"))
        await Promise.resolve()
        expect(screen.getByTestId("current-index").textContent).toBe("1")
        expect(screen.getByTestId("index-display").textContent).toBe("2 / 3")
    })
    test("prevItem decrements",async()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction", selectedIndex: 1 })
        fireEvent.click(screen.getByTestId("prev-button"))
        await Promise.resolve()
        expect(screen.getByTestId("current-index").textContent).toBe("0")
        expect(screen.getByTestId("index-display").textContent).toBe("1 / 3")
    })
    test("goToItem sets index",async()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction" })
        fireEvent.click(screen.getByTestId("next-button"))
        fireEvent.click(screen.getByTestId("next-button"))
        await Promise.resolve()
        expect(screen.getByTestId("current-index").textContent).toBe("2")
        expect(screen.getByTestId("index-display").textContent).toBe("3 / 3")
    })
    test("emits select event",()=>{
        let items=makeItems()
        let onSelect=vi.fn()
        renderComponent({ items, format: "instruction", onSelect })
        fireEvent.click(screen.getByTestId("next-button"))
        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledWith(items[1], 1)
    })
    test("emits edit event",()=>{
        let items=makeItems()
        let onEdit=vi.fn()
        renderComponent({ items, format: "instruction", onEdit })
        fireEvent.click(screen.getByTestId("edit-button"))
        expect(onEdit).toHaveBeenCalledTimes(1)
        expect(onEdit).toHaveBeenCalledWith(items[0], 0)
    })
    test("emits delete event",()=>{
        let items=makeItems()
        let onDelete=vi.fn()
        renderComponent({ items, format: "instruction", onDelete })
        fireEvent.click(screen.getByTestId("delete-button"))
        expect(onDelete).toHaveBeenCalledTimes(1)
        expect(onDelete).toHaveBeenCalledWith(items[0], 0)
    })
    test("toggles JSON view",async()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction" })
        expect(screen.queryByTestId("json-view")).toBeNull()
        fireEvent.click(screen.getByTestId("json-toggle"))
        await Promise.resolve()
        expect(screen.queryByTestId("json-view")).not.toBeNull()
        expect(screen.getByTestId("json-content").textContent).toContain("What is 2+2?")
        fireEvent.click(screen.getByTestId("json-toggle"))
        await Promise.resolve()
        expect(screen.queryByTestId("json-view")).toBeNull()
    })
    test("shows original when showOriginal and has original",()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction", showOriginal: true })
        expect(screen.queryByTestId("split-view")).not.toBeNull()
        expect(screen.queryByTestId("original-panel")).not.toBeNull()
        expect(screen.getByTestId("original-text").textContent).toBe("source one")
        expect(screen.queryByTestId("generated-panel")).not.toBeNull()
    })
    test("hides original when showOriginal but no original",()=>{
        let items=makeItems()
        renderComponent({ items, format: "text", showOriginal: true, selectedIndex: 2 })
        expect(screen.queryByTestId("single-view")).not.toBeNull()
        expect(screen.queryByTestId("original-panel")).toBeNull()
        expect(screen.queryByTestId("text-view")).not.toBeNull()
    })
    test("renders instruction format",()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction" })
        expect(screen.queryByTestId("instruction-view")).not.toBeNull()
        expect(screen.getByTestId("instruction-text").textContent).toBe("What is 2+2?")
        expect(screen.getByTestId("output-text").textContent).toBe("4")
    })
    test("renders messages format",()=>{
        let items=makeItems()
        renderComponent({ items, format: "messages", selectedIndex: 1 })
        expect(screen.queryByTestId("messages-view")).not.toBeNull()
        let bubbles=screen.queryAllByTestId("message-bubble")
        expect(bubbles.length).toBe(2)
        expect(bubbles[0].querySelector('[data-testid="message-role"]')?.textContent).toBe("user")
        expect(bubbles[0].querySelector('[data-testid="message-content"]')?.textContent).toBe("Hello")
        expect(bubbles[1].querySelector('[data-testid="message-role"]')?.textContent).toBe("assistant")
        expect(bubbles[1].querySelector('[data-testid="message-content"]')?.textContent).toBe("Hi there")
    })
    test("renders text format",()=>{
        let items=makeItems()
        renderComponent({ items, format: "text", selectedIndex: 2 })
        expect(screen.queryByTestId("text-view")).not.toBeNull()
        expect(screen.getByTestId("text-content").textContent).toBe("The quick brown fox.")
    })
    test("formattedItem matches format",()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction" })
        expect(screen.getByTestId("formatted-type").textContent).toBe("instruction")
        cleanup()
        renderComponent({ items, format: "messages", selectedIndex: 1 })
        expect(screen.getByTestId("formatted-type").textContent).toBe("messages")
        cleanup()
        renderComponent({ items, format: "text", selectedIndex: 2 })
        expect(screen.getByTestId("formatted-type").textContent).toBe("text")
    })
    test("prev disabled at index 0",()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction" })
        let button=screen.getByTestId("prev-button") as HTMLButtonElement
        expect(button.disabled).toBe(true)
    })
    test("next disabled at last index",()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction", selectedIndex: 2 })
        let button=screen.getByTestId("next-button") as HTMLButtonElement
        expect(button.disabled).toBe(true)
    })
    test("displays total count",()=>{
        let items=makeItems()
        renderComponent({ items, format: "instruction" })
        expect(screen.getByTestId("index-display").textContent).toContain("3")
    })
    test("renders empty state when items array is empty", () => {
        renderComponent({ items: [], format: "instruction" })
        expect(screen.queryByTestId("empty-state")).not.toBeNull()
        expect(screen.getByTestId("empty-state").textContent).toContain("No items to preview.")
    })
    test("hides toolbar when items array is empty", () => {
        renderComponent({ items: [], format: "instruction" })
        expect(screen.queryByTestId("preview-toolbar")).toBeNull()
        expect(screen.queryByTestId("prev-button")).toBeNull()
        expect(screen.queryByTestId("next-button")).toBeNull()
    })
    test("hides content area when items array is empty", () => {
        renderComponent({ items: [], format: "instruction" })
        expect(screen.queryByTestId("single-view")).toBeNull()
        expect(screen.queryByTestId("split-view")).toBeNull()
        expect(screen.queryByTestId("json-view")).toBeNull()
    })
    test("empty state exposes role=status for screen readers", () => {
        renderComponent({ items: [], format: "instruction" })
        const empty = screen.getByTestId("empty-state")
        expect(empty.getAttribute("role")).toBe("status")
    })
    test("empty state exposes aria-label", () => {
        renderComponent({ items: [], format: "instruction" })
        const empty = screen.getByTestId("empty-state")
        expect(empty.getAttribute("aria-label")).toBe("Dataset preview is empty")
    })
    test("empty state message has data-i18n attribute", () => {
        renderComponent({ items: [], format: "instruction" })
        const msg = screen.getByTestId("empty-state").querySelector("[data-i18n='datasetPreview.empty']")
        expect(msg).not.toBeNull()
    })
    test("toolbar buttons carry data-i18n attributes", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        expect(screen.getByTestId("prev-button").getAttribute("data-i18n")).toBe("datasetPreview.prev")
        expect(screen.getByTestId("next-button").getAttribute("data-i18n")).toBe("datasetPreview.next")
        expect(screen.getByTestId("edit-button").getAttribute("data-i18n")).toBe("datasetPreview.edit")
        expect(screen.getByTestId("delete-button").getAttribute("data-i18n")).toBe("datasetPreview.delete")
    })
    test("json toggle button data-i18n tracks showJson state", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        const toggle = screen.getByTestId("json-toggle")
        expect(toggle.getAttribute("data-i18n")).toBe("datasetPreview.json")
        fireEvent.click(toggle)
        expect(toggle.getAttribute("data-i18n")).toBe("datasetPreview.formatted")
    })
    test("instruction view labels carry data-i18n attributes", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        const card = screen.getByTestId("instruction-card")
        expect(card.querySelector("[data-i18n='datasetPreview.instructionLabel']")).not.toBeNull()
        const outputCard = screen.getByTestId("output-card")
        expect(outputCard.querySelector("[data-i18n='datasetPreview.outputLabel']")).not.toBeNull()
    })
    test("input label carries data-i18n when input present", () => {
        const items = [{
            format: "instruction",
            instruction: "q",
            input: "ctx",
            output: "a",
            metadata: {}
        }] as unknown as TrainingItem[]
        renderComponent({ items, format: "instruction" })
        const inputCard = screen.getByTestId("input-card")
        expect(inputCard.querySelector("[data-i18n='datasetPreview.inputLabel']")).not.toBeNull()
    })
    test("original panel title carries data-i18n attribute", () => {
        renderComponent({ items: makeItems(), format: "instruction", showOriginal: true })
        const panel = screen.getByTestId("original-panel")
        expect(panel.querySelector("[data-i18n='datasetPreview.original']")).not.toBeNull()
    })
    test("toolbar exposes role=toolbar with aria-label", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        const toolbar = screen.getByRole("toolbar")
        expect(toolbar.getAttribute("aria-label")).toBe("Dataset preview toolbar")
        expect(toolbar.getAttribute("aria-orientation")).toBe("horizontal")
    })
    test("ArrowRight navigates to next item", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        const next = screen.getByTestId("next-button")
        fireEvent.keyDown(next, { key: "ArrowRight" })
        expect(screen.getByTestId("current-index").textContent).toBe("1")
    })
    test("ArrowLeft navigates to previous item", () => {
        renderComponent({ items: makeItems(), format: "instruction", selectedIndex: 1 })
        const prev = screen.getByTestId("prev-button")
        fireEvent.keyDown(prev, { key: "ArrowLeft" })
        expect(screen.getByTestId("current-index").textContent).toBe("0")
    })
    test("ArrowRight at last index does nothing", () => {
        renderComponent({ items: makeItems(), format: "instruction", selectedIndex: 2 })
        const next = screen.getByTestId("next-button")
        fireEvent.keyDown(next, { key: "ArrowRight" })
        expect(screen.getByTestId("current-index").textContent).toBe("2")
    })
    test("ArrowLeft at first index does nothing", () => {
        renderComponent({ items: makeItems(), format: "instruction", selectedIndex: 0 })
        const prev = screen.getByTestId("prev-button")
        fireEvent.keyDown(prev, { key: "ArrowLeft" })
        expect(screen.getByTestId("current-index").textContent).toBe("0")
    })
    test("Home jumps to first item", () => {
        renderComponent({ items: makeItems(), format: "instruction", selectedIndex: 2 })
        fireEvent.keyDown(screen.getByTestId("next-button"), { key: "Home" })
        expect(screen.getByTestId("current-index").textContent).toBe("0")
    })
    test("End jumps to last item", () => {
        renderComponent({ items: makeItems(), format: "instruction", selectedIndex: 0 })
        fireEvent.keyDown(screen.getByTestId("prev-button"), { key: "End" })
        expect(screen.getByTestId("current-index").textContent).toBe("2")
    })
    test("ArrowLeft is ignored when Ctrl is held", () => {
        renderComponent({ items: makeItems(), format: "instruction", selectedIndex: 1 })
        fireEvent.keyDown(screen.getByTestId("prev-button"), { key: "ArrowLeft", ctrlKey: true })
        expect(screen.getByTestId("current-index").textContent).toBe("1")
    })
    test("Enter key is ignored by toolbar handler", () => {
        const onSelect = vi.fn()
        renderComponent({ items: makeItems(), format: "instruction", onSelect, selectedIndex: 1 })
        fireEvent.keyDown(screen.getByTestId("prev-button"), { key: "Enter" })
        expect(screen.getByTestId("current-index").textContent).toBe("1")
    })
    test("index-display exposes role=status for screen readers", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        expect(screen.getByTestId("index-display").getAttribute("role")).toBe("status")
    })
    test("index-display exposes aria-live=polite", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        expect(screen.getByTestId("index-display").getAttribute("aria-live")).toBe("polite")
    })
    test("index-display exposes aria-atomic=true", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        expect(screen.getByTestId("index-display").getAttribute("aria-atomic")).toBe("true")
    })
    test("index-display aria-label is descriptive", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        expect(screen.getByTestId("index-display").getAttribute("aria-label")).toBe("Item 1 of 3")
    })
    test("index-display aria-label updates after navigation", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        fireEvent.click(screen.getByTestId("next-button"))
        expect(screen.getByTestId("index-display").getAttribute("aria-label")).toBe("Item 2 of 3")
    })
    test("index-display carries data-i18n-aria-label", () => {
        renderComponent({ items: makeItems(), format: "instruction" })
        expect(screen.getByTestId("index-display").getAttribute("data-i18n-aria-label")).toBe("datasetPreview.indexAria")
    })
})
