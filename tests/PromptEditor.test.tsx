import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { PromptEditor } from "../src/renderer/components/PromptEditor.tsx"
import type { PromptEditorProps, PromptVersion } from "../src/renderer/components/PromptEditor.tsx"
function renderComponent(props: Partial<PromptEditorProps> & { modelValue: string }){
    let onChange=props.onChange||vi.fn()
    let onSave=props.onSave||vi.fn()
    let onRun=props.onRun||vi.fn()
    let onVariableChange=props.onVariableChange||vi.fn()
    return render(()=><PromptEditor {...props} onChange={onChange} onSave={onSave} onRun={onRun} onVariableChange={onVariableChange} />)
}
function getExtractedVariables():string[]{
    return JSON.parse(screen.getByTestId("extracted-variables").textContent||"[]")
}
function getVariableValues():Record<string, string>{
    return JSON.parse(screen.getByTestId("variable-values").textContent||"{}")
}
describe("PromptEditor",()=>{
    test("renders textarea with modelValue",()=>{
        renderComponent({ modelValue: "Hello world" })
        let textarea=screen.getByTestId("prompt-textarea") as HTMLTextAreaElement
        expect(textarea).not.toBeNull()
        expect(textarea.value).toBe("Hello world")
    })
    test("emits update:modelValue on input",async()=>{
        let onChange=vi.fn()
        renderComponent({ modelValue: "Hello", onChange })
        let textarea=screen.getByTestId("prompt-textarea")
        fireEvent.input(textarea, { target: { value: "Hello world" } })
        await Promise.resolve()
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith("Hello world")
    })
    test("extracts variables from double braces",()=>{
        renderComponent({ modelValue: "Hello {{name}}, you are {{age}} years old." })
        expect(getExtractedVariables()).toEqual(["name", "age"])
    })
    test("renders variable inputs",()=>{
        renderComponent({ modelValue: "Hello {{name}}, from {{city}}." })
        let rows=screen.queryAllByTestId("variable-row")
        expect(rows.length).toBe(2)
        expect(screen.queryByTestId("variable-label-name")).not.toBeNull()
        expect(screen.queryByTestId("variable-input-name")).not.toBeNull()
        expect(screen.queryByTestId("variable-label-city")).not.toBeNull()
        expect(screen.queryByTestId("variable-input-city")).not.toBeNull()
    })
    test("updates variable value and emits variable-change",async()=>{
        let onVariableChange=vi.fn()
        renderComponent({ modelValue: "Hello {{name}}.", onVariableChange })
        let input=screen.getByTestId("variable-input-name")
        fireEvent.input(input, { target: { value: "Alice" } })
        await Promise.resolve()
        expect(onVariableChange).toHaveBeenCalledTimes(1)
        expect(onVariableChange).toHaveBeenCalledWith("name", "Alice")
        expect(getVariableValues().name).toBe("Alice")
    })
    test("computes preview by replacing variables",()=>{
        renderComponent({
            modelValue: "Hello {{name}}, welcome to {{place}}.",
            variables: { name: "Alice", place: "Wonderland" }
        })
        expect(screen.getByTestId("preview-text").textContent).toBe("Hello Alice, welcome to Wonderland.")
    })
    test("toggles preview visibility",async()=>{
        renderComponent({ modelValue: "Hello {{name}}." })
        expect(screen.queryByTestId("preview-panel")).toBeNull()
        fireEvent.click(screen.getByTestId("toggle-preview-button"))
        await Promise.resolve()
        expect(screen.queryByTestId("preview-panel")).not.toBeNull()
        fireEvent.click(screen.getByTestId("toggle-preview-button"))
        await Promise.resolve()
        expect(screen.queryByTestId("preview-panel")).toBeNull()
    })
    test("save emits save event with current content",async()=>{
        let onSave=vi.fn()
        renderComponent({ modelValue: "Hello world", onSave })
        let input=screen.getByTestId("version-name-input")
        fireEvent.input(input, { target: { value: "My Version" } })
        await Promise.resolve()
        fireEvent.click(screen.getByTestId("save-button"))
        expect(onSave).toHaveBeenCalledTimes(1)
        let version=onSave.mock.calls[0][0] as PromptVersion
        expect(version.name).toBe("My Version")
        expect(version.content).toBe("Hello world")
        expect(typeof version.id).toBe("string")
        expect(typeof version.createdAt).toBe("number")
    })
    test("run emits run with preview text",()=>{
        let onRun=vi.fn()
        renderComponent({
            modelValue: "Hello {{name}}.",
            variables: { name: "Alice" },
            onRun
        })
        fireEvent.click(screen.getByTestId("run-button"))
        expect(onRun).toHaveBeenCalledTimes(1)
        expect(onRun).toHaveBeenCalledWith("Hello Alice.")
    })
    test("loadVersion updates content and emits update",async()=>{
        let onChange=vi.fn()
        let version: PromptVersion={
            id: "v1",
            name: "Version 1",
            content: "Updated content",
            createdAt: 1234567890
        }
        renderComponent({ modelValue: "Original", onChange, history: [version] })
        fireEvent.click(screen.getByTestId("toggle-history-button"))
        await Promise.resolve()
        fireEvent.click(screen.getByTestId("history-item-v1"))
        await Promise.resolve()
        expect((screen.getByTestId("prompt-textarea") as HTMLTextAreaElement).value).toBe("Updated content")
        expect(screen.getByTestId("selected-version-id").textContent).toBe("v1")
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith("Updated content")
    })
    test("history list renders",async()=>{
        let history: PromptVersion[]=[
            { id: "v1", name: "First", content: "Content one", createdAt: 1000 },
            { id: "v2", name: "Second", content: "Content two", createdAt: 2000 }
        ]
        renderComponent({ modelValue: "Hello", history })
        fireEvent.click(screen.getByTestId("toggle-history-button"))
        await Promise.resolve()
        let items=screen.queryAllByTestId(/^history-item-/)
        expect(items.length).toBe(2)
        expect(screen.getByTestId("history-item-v1").textContent).toContain("First")
        expect(screen.getByTestId("history-item-v2").textContent).toContain("Second")
    })
    test("history list shows empty message when no history",async()=>{
        renderComponent({ modelValue: "Hello", history: [] })
        fireEvent.click(screen.getByTestId("toggle-history-button"))
        await Promise.resolve()
        expect(screen.queryByTestId("history-empty")).not.toBeNull()
    })
    test("isDirty when content changed",async()=>{
        renderComponent({ modelValue: "Original" })
        expect(screen.getByTestId("is-dirty").textContent).toBe("false")
        let textarea=screen.getByTestId("prompt-textarea")
        fireEvent.input(textarea, { target: { value: "Changed" } })
        await Promise.resolve()
        expect(screen.getByTestId("is-dirty").textContent).toBe("true")
    })
    test("placeholder shown when empty",()=>{
        renderComponent({ modelValue: "", placeholder: "Enter prompt" })
        let textarea=screen.getByTestId("prompt-textarea") as HTMLTextAreaElement
        expect(textarea.placeholder).toBe("Enter prompt")
    })
    test("handles variables with spaces",()=>{
        renderComponent({ modelValue: "Hello {{  name  }}." })
        expect(getExtractedVariables()).toEqual(["name"])
        expect(screen.queryByTestId("variable-input-name")).not.toBeNull()
    })
    test("multiple variables replaced independently",()=>{
        renderComponent({
            modelValue: "{{greeting}} {{name}}! {{greeting}} again.",
            variables: { greeting: "Hi", name: "Bob" }
        })
        expect(screen.getByTestId("preview-text").textContent).toBe("Hi Bob! Hi again.")
    })
    test("preview leaves unknown variables intact",()=>{
        renderComponent({
            modelValue: "Hello {{known}} and {{unknown}}.",
            variables: { known: "World" }
        })
        expect(screen.getByTestId("preview-text").textContent).toBe("Hello World and {{unknown}}.")
    })
    test("toggles history visibility",async()=>{
        renderComponent({ modelValue: "Hello" })
        expect(screen.queryByTestId("history-panel")).toBeNull()
        fireEvent.click(screen.getByTestId("toggle-history-button"))
        await Promise.resolve()
        expect(screen.queryByTestId("history-panel")).not.toBeNull()
        fireEvent.click(screen.getByTestId("toggle-history-button"))
        await Promise.resolve()
        expect(screen.queryByTestId("history-panel")).toBeNull()
    })
    test("updates content when modelValue prop changes",()=>{
        renderComponent({ modelValue: "First" })
        expect((screen.getByTestId("prompt-textarea") as HTMLTextAreaElement).value).toBe("First")
        cleanup()
        renderComponent({ modelValue: "Second" })
        expect((screen.getByTestId("prompt-textarea") as HTMLTextAreaElement).value).toBe("Second")
    })
    test("save uses version name input when no name provided",async()=>{
        let onSave=vi.fn()
        renderComponent({ modelValue: "Hello", onSave })
        let input=screen.getByTestId("version-name-input")
        fireEvent.input(input, { target: { value: "Typed Name" } })
        await Promise.resolve()
        fireEvent.click(screen.getByTestId("save-button"))
        expect(onSave).toHaveBeenCalledTimes(1)
        let version=onSave.mock.calls[0][0] as PromptVersion
        expect(version.name).toBe("Typed Name")
    })
    test("selected history item gets highlighted",async()=>{
        let history: PromptVersion[]=[
            { id: "v1", name: "First", content: "One", createdAt: 1000 }
        ]
        renderComponent({ modelValue: "Hello", history })
        fireEvent.click(screen.getByTestId("toggle-history-button"))
        await Promise.resolve()
        fireEvent.click(screen.getByTestId("history-item-v1"))
        await Promise.resolve()
        expect(screen.getByTestId("history-item-v1").classList.contains("selected")).toBe(true)
    })
    test("variable panel hidden when no variables",()=>{
        renderComponent({ modelValue: "No variables here." })
        expect(screen.queryByTestId("variable-panel")).toBeNull()
        expect(screen.getByTestId("has-variables").textContent).toBe("false")
    })
})
