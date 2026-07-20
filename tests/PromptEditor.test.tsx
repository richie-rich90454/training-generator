import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { PromptEditor } from "../src/renderer/components/PromptEditor.tsx"
import type { PromptEditorProps, PromptVersion } from "../src/renderer/components/PromptEditor.tsx"
import type { AppStore } from "../src/renderer/stores/appStore.js"
function renderComponent(props: Partial<PromptEditorProps> & { modelValue: string }){
    let onChange=props.onChange||vi.fn()
    let onSave=props.onSave||vi.fn()
    let onRun=props.onRun||vi.fn()
    let onVariableChange=props.onVariableChange||vi.fn()
    return render(()=><PromptEditor {...props} onChange={onChange} onSave={onSave} onRun={onRun} onVariableChange={onVariableChange} />)
}
function makeModalStub(open=true){
    let closePromptEditor=vi.fn()
    let uiStore={ promptOpen:()=>open, closePromptEditor }
    let appStore={ uiStore } as unknown as AppStore
    return { appStore, closePromptEditor }
}
function renderModal(open=true){
    let stub=makeModalStub(open)
    let result=render(()=><PromptEditor appStore={stub.appStore} modelValue="" />)
    return { ...result, ...stub }
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
    test("debug divs are hidden via test-only class",()=>{
        renderComponent({ modelValue: "Hello {{name}}." })
        let debugIds=["extracted-variables","is-dirty","variable-values","selected-version-id","has-variables","preview-text"]
        for (let id of debugIds){
            let el=screen.getByTestId(id)
            // The debug divs should have aria-hidden="true" (not announced by
            // screen readers) and should NOT use inline style="display:none"
            // (we moved to a CSS class instead).
            expect(el.getAttribute("aria-hidden")).toBe("true")
            expect(el.getAttribute("style")).toBeNull()
        }
    })
    test("version name input has data-i18n-placeholder",()=>{
        renderComponent({ modelValue: "" })
        let input=screen.getByTestId("version-name-input")
        expect(input.getAttribute("data-i18n-placeholder")).toBe("promptEditor.versionNamePlaceholder")
    })
    test("toolbar buttons tag labels with data-i18n",()=>{
        renderComponent({ modelValue: "" })
        expect(screen.getByTestId("run-button").getAttribute("data-i18n")).toBe("promptEditor.run")
        expect(screen.getByTestId("save-button").getAttribute("data-i18n")).toBe("promptEditor.save")
        // Toggle preview shows "showPreview" span initially
        let togglePreview=screen.getByTestId("toggle-preview-button")
        expect(togglePreview.querySelector("[data-i18n='promptEditor.showPreview']")).not.toBeNull()
        fireEvent.click(togglePreview)
        expect(togglePreview.querySelector("[data-i18n='promptEditor.hidePreview']")).not.toBeNull()
        // Toggle history shows "showHistory" span initially
        let toggleHistory=screen.getByTestId("toggle-history-button")
        expect(toggleHistory.querySelector("[data-i18n='promptEditor.showHistory']")).not.toBeNull()
        fireEvent.click(toggleHistory)
        expect(toggleHistory.querySelector("[data-i18n='promptEditor.hideHistory']")).not.toBeNull()
    })
    test("panel titles have data-i18n attributes",async()=>{
        renderComponent({ modelValue: "Hello {{name}}.", history: [] })
        expect(screen.getByTestId("variable-panel").querySelector("[data-i18n='promptEditor.variablesTitle']")).not.toBeNull()
        fireEvent.click(screen.getByTestId("toggle-preview-button"))
        await Promise.resolve()
        expect(screen.getByTestId("preview-panel").querySelector("[data-i18n='promptEditor.previewTitle']")).not.toBeNull()
        fireEvent.click(screen.getByTestId("toggle-history-button"))
        await Promise.resolve()
        expect(screen.getByTestId("history-panel").querySelector("[data-i18n='promptEditor.historyTitle']")).not.toBeNull()
        expect(screen.getByTestId("history-empty").getAttribute("data-i18n")).toBe("promptEditor.noSavedVersions")
    })
    test("modal has aria-labelledby pointing to visible title",()=>{
        cleanup()
        renderModal(true)
        let dialog=screen.getByRole("dialog")
        expect(dialog.getAttribute("aria-labelledby")).toBe("prompt-editor-title")
        let title=document.getElementById("prompt-editor-title")
        expect(title).not.toBeNull()
        expect(title?.tagName).toBe("H2")
        cleanup()
    })
    test("modal locks body scroll when open",()=>{
        cleanup()
        document.body.style.overflow=""
        renderModal(true)
        expect(document.body.style.overflow).toBe("hidden")
        cleanup()
    })
    test("modal restores body scroll on unmount",()=>{
        cleanup()
        document.body.style.overflow="auto"
        let utils=renderModal(true)
        expect(document.body.style.overflow).toBe("hidden")
        utils.unmount()
        expect(document.body.style.overflow).toBe("auto")
        cleanup()
    })
    test("modal saves and restores focus",()=>{
        cleanup()
        let trigger=document.createElement("button")
        trigger.textContent="Open editor"
        document.body.appendChild(trigger)
        trigger.focus()
        expect(document.activeElement).toBe(trigger)
        let utils=renderModal(true)
        // Modal is open — focus should have moved away from trigger
        expect(document.activeElement).not.toBe(trigger)
        utils.unmount()
        // After unmount, focus should be restored to the trigger
        expect(document.activeElement).toBe(trigger)
        document.body.removeChild(trigger)
        cleanup()
    })
    test("Tab on last focusable wraps to first",()=>{
        cleanup()
        renderModal(true)
        let dialog=screen.getByRole("dialog")
        let selector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        let focusable=Array.from(dialog.querySelectorAll<HTMLElement>(selector))
        expect(focusable.length).toBeGreaterThan(0)
        let first=focusable[0]
        let last=focusable[focusable.length-1]
        last.focus()
        expect(document.activeElement).toBe(last)
        document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:false,bubbles:true,cancelable:true}))
        expect(document.activeElement).toBe(first)
        cleanup()
    })
    test("Shift+Tab on first focusable wraps to last",()=>{
        cleanup()
        renderModal(true)
        let dialog=screen.getByRole("dialog")
        let selector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        let focusable=Array.from(dialog.querySelectorAll<HTMLElement>(selector))
        expect(focusable.length).toBeGreaterThan(0)
        let first=focusable[0]
        let last=focusable[focusable.length-1]
        first.focus()
        expect(document.activeElement).toBe(first)
        document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",shiftKey:true,bubbles:true,cancelable:true}))
        expect(document.activeElement).toBe(last)
        cleanup()
    })
})
