import { describe, test, expect } from "vitest"
import { mount } from "@vue/test-utils"
import { nextTick } from "vue"
import PromptEditor from "../src/renderer/components/PromptEditor.vue"
interface PromptVersion{
    id: string
    name: string
    content: string
    createdAt: number
}
function mountComponent(props: Record<string, unknown>){
    return mount(PromptEditor, { props })
}
describe("PromptEditor",()=>{
    test("renders textarea with modelValue",()=>{
        let wrapper=mountComponent({ modelValue: "Hello world" })
        let textarea=wrapper.find('[data-testid="prompt-textarea"]')
        expect(textarea.exists()).toBe(true)
        expect((textarea.element as HTMLTextAreaElement).value).toBe("Hello world")
    })
    test("emits update:modelValue on input",async()=>{
        let wrapper=mountComponent({ modelValue: "Hello" })
        let textarea=wrapper.find('[data-testid="prompt-textarea"]')
        await textarea.setValue("Hello world")
        expect(wrapper.emitted("update:modelValue")).toHaveLength(1)
        expect(wrapper.emitted("update:modelValue")![0]).toEqual(["Hello world"])
    })
    test("extracts variables from double braces",()=>{
        let wrapper=mountComponent({ modelValue: "Hello {{name}}, you are {{age}} years old." })
        expect(wrapper.vm.extractedVariables).toEqual(["name", "age"])
    })
    test("renders variable inputs",()=>{
        let wrapper=mountComponent({ modelValue: "Hello {{name}}, from {{city}}." })
        let rows=wrapper.findAll('[data-testid="variable-row"]')
        expect(rows.length).toBe(2)
        expect(wrapper.find('[data-testid="variable-label-name"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="variable-input-name"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="variable-label-city"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="variable-input-city"]').exists()).toBe(true)
    })
    test("updates variable value and emits variable-change",async()=>{
        let wrapper=mountComponent({ modelValue: "Hello {{name}}." })
        let input=wrapper.find('[data-testid="variable-input-name"]')
        await input.setValue("Alice")
        expect(wrapper.emitted("variable-change")).toHaveLength(1)
        expect(wrapper.emitted("variable-change")![0]).toEqual(["name", "Alice"])
        expect(wrapper.vm.variableValues.name).toBe("Alice")
    })
    test("computes preview by replacing variables",()=>{
        let wrapper=mountComponent({
            modelValue: "Hello {{name}}, welcome to {{place}}.",
            variables: { name: "Alice", place: "Wonderland" }
        })
        expect(wrapper.vm.previewText).toBe("Hello Alice, welcome to Wonderland.")
    })
    test("toggles preview visibility",async()=>{
        let wrapper=mountComponent({ modelValue: "Hello {{name}}." })
        expect(wrapper.find('[data-testid="preview-panel"]').exists()).toBe(false)
        await wrapper.find('[data-testid="toggle-preview-button"]').trigger("click")
        expect(wrapper.find('[data-testid="preview-panel"]').exists()).toBe(true)
        await wrapper.find('[data-testid="toggle-preview-button"]').trigger("click")
        expect(wrapper.find('[data-testid="preview-panel"]').exists()).toBe(false)
    })
    test("save emits save event with current content",()=>{
        let wrapper=mountComponent({ modelValue: "Hello world" })
        wrapper.vm.saveVersion("My Version")
        let events=wrapper.emitted("save")
        expect(events).toHaveLength(1)
        let version=events![0][0] as PromptVersion
        expect(version.name).toBe("My Version")
        expect(version.content).toBe("Hello world")
        expect(typeof version.id).toBe("string")
        expect(typeof version.createdAt).toBe("number")
    })
    test("run emits run with preview text",()=>{
        let wrapper=mountComponent({
            modelValue: "Hello {{name}}.",
            variables: { name: "Alice" }
        })
        wrapper.vm.runPreview()
        let events=wrapper.emitted("run")
        expect(events).toHaveLength(1)
        expect(events![0]).toEqual(["Hello Alice."])
    })
    test("loadVersion updates content and emits update",()=>{
        let wrapper=mountComponent({ modelValue: "Original" })
        let version: PromptVersion={
            id: "v1",
            name: "Version 1",
            content: "Updated content",
            createdAt: 1234567890
        }
        wrapper.vm.loadVersion(version)
        expect(wrapper.vm.localContent).toBe("Updated content")
        expect(wrapper.vm.selectedVersionId).toBe("v1")
        expect(wrapper.emitted("update:modelValue")).toHaveLength(1)
        expect(wrapper.emitted("update:modelValue")![0]).toEqual(["Updated content"])
    })
    test("history list renders",async()=>{
        let history: PromptVersion[]=[
            { id: "v1", name: "First", content: "Content one", createdAt: 1000 },
            { id: "v2", name: "Second", content: "Content two", createdAt: 2000 }
        ]
        let wrapper=mountComponent({ modelValue: "Hello", history })
        await wrapper.find('[data-testid="toggle-history-button"]').trigger("click")
        let items=wrapper.findAll('[data-testid^="history-item-"]')
        expect(items.length).toBe(2)
        expect(wrapper.find('[data-testid="history-item-v1"]').text()).toContain("First")
        expect(wrapper.find('[data-testid="history-item-v2"]').text()).toContain("Second")
    })
    test("history list shows empty message when no history",async()=>{
        let wrapper=mountComponent({ modelValue: "Hello", history: [] })
        await wrapper.find('[data-testid="toggle-history-button"]').trigger("click")
        expect(wrapper.find('[data-testid="history-empty"]').exists()).toBe(true)
    })
    test("isDirty when content changed",async()=>{
        let wrapper=mountComponent({ modelValue: "Original" })
        expect(wrapper.vm.isDirty).toBe(false)
        let textarea=wrapper.find('[data-testid="prompt-textarea"]')
        await textarea.setValue("Changed")
        expect(wrapper.vm.isDirty).toBe(true)
    })
    test("placeholder shown when empty",()=>{
        let wrapper=mountComponent({ modelValue: "", placeholder: "Enter prompt" })
        let textarea=wrapper.find('[data-testid="prompt-textarea"]')
        expect((textarea.element as HTMLTextAreaElement).placeholder).toBe("Enter prompt")
    })
    test("handles variables with spaces",()=>{
        let wrapper=mountComponent({ modelValue: "Hello {{  name  }}." })
        expect(wrapper.vm.extractedVariables).toEqual(["name"])
        expect(wrapper.find('[data-testid="variable-input-name"]').exists()).toBe(true)
    })
    test("multiple variables replaced independently",()=>{
        let wrapper=mountComponent({
            modelValue: "{{greeting}} {{name}}! {{greeting}} again.",
            variables: { greeting: "Hi", name: "Bob" }
        })
        expect(wrapper.vm.previewText).toBe("Hi Bob! Hi again.")
    })
    test("preview leaves unknown variables intact",()=>{
        let wrapper=mountComponent({
            modelValue: "Hello {{known}} and {{unknown}}.",
            variables: { known: "World" }
        })
        expect(wrapper.vm.previewText).toBe("Hello World and {{unknown}}.")
    })
    test("toggles history visibility",async()=>{
        let wrapper=mountComponent({ modelValue: "Hello" })
        expect(wrapper.find('[data-testid="history-panel"]').exists()).toBe(false)
        await wrapper.find('[data-testid="toggle-history-button"]').trigger("click")
        expect(wrapper.find('[data-testid="history-panel"]').exists()).toBe(true)
        await wrapper.find('[data-testid="toggle-history-button"]').trigger("click")
        expect(wrapper.find('[data-testid="history-panel"]').exists()).toBe(false)
    })
    test("updates content when modelValue prop changes",async()=>{
        let wrapper=mountComponent({ modelValue: "First" })
        await wrapper.setProps({ modelValue: "Second" })
        expect(wrapper.vm.localContent).toBe("Second")
    })
    test("save uses version name input when no name provided",async()=>{
        let wrapper=mountComponent({ modelValue: "Hello" })
        let input=wrapper.find('[data-testid="version-name-input"]')
        await input.setValue("Typed Name")
        await wrapper.find('[data-testid="save-button"]').trigger("click")
        let events=wrapper.emitted("save")
        expect(events).toHaveLength(1)
        let version=events![0][0] as PromptVersion
        expect(version.name).toBe("Typed Name")
    })
    test("selected history item gets highlighted",async()=>{
        let history: PromptVersion[]=[
            { id: "v1", name: "First", content: "One", createdAt: 1000 }
        ]
        let wrapper=mountComponent({ modelValue: "Hello", history })
        await wrapper.find('[data-testid="toggle-history-button"]').trigger("click")
        await wrapper.find('[data-testid="history-item-v1"]').trigger("click")
        expect(wrapper.find('[data-testid="history-item-v1"]').classes()).toContain("selected")
    })
    test("variable panel hidden when no variables",()=>{
        let wrapper=mountComponent({ modelValue: "No variables here." })
        expect(wrapper.find('[data-testid="variable-panel"]').exists()).toBe(false)
        expect(wrapper.vm.hasVariables).toBe(false)
    })
})
