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
})
