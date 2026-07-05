import { describe, test, expect } from "vitest"
import { mount } from "@vue/test-utils"
import { nextTick } from "vue"
import DatasetPreview from "../src/renderer/components/DatasetPreview.vue"
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
function mountComponent(props: Record<string, unknown>){
    return mount(DatasetPreview, { props })
}
describe("DatasetPreview",()=>{
    test("renders items",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        expect(wrapper.find('[data-testid="dataset-preview"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="instruction-view"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="instruction-text"]').text()).toBe("What is 2+2?")
    })
    test("shows current item index",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        expect(wrapper.find('[data-testid="index-display"]').text()).toBe("1 / 3")
    })
    test("nextItem increments",async()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        wrapper.vm.nextItem()
        await nextTick()
        expect(wrapper.vm.currentIndex).toBe(1)
        expect(wrapper.find('[data-testid="index-display"]').text()).toBe("2 / 3")
    })
    test("prevItem decrements",async()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction", selectedIndex: 1 })
        wrapper.vm.prevItem()
        await nextTick()
        expect(wrapper.vm.currentIndex).toBe(0)
        expect(wrapper.find('[data-testid="index-display"]').text()).toBe("1 / 3")
    })
    test("goToItem sets index",async()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        wrapper.vm.goToItem(2)
        await nextTick()
        expect(wrapper.vm.currentIndex).toBe(2)
        expect(wrapper.find('[data-testid="index-display"]').text()).toBe("3 / 3")
    })
    test("emits select event",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        wrapper.vm.nextItem()
        let events=wrapper.emitted("select")
        expect(events).toHaveLength(1)
        expect(events![0]).toEqual([items[1], 1])
    })
    test("emits edit event",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        wrapper.find('[data-testid="edit-button"]').trigger("click")
        let events=wrapper.emitted("edit")
        expect(events).toHaveLength(1)
        expect(events![0]).toEqual([items[0], 0])
    })
    test("emits delete event",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        wrapper.find('[data-testid="delete-button"]').trigger("click")
        let events=wrapper.emitted("delete")
        expect(events).toHaveLength(1)
        expect(events![0]).toEqual([items[0], 0])
    })
    test("toggles JSON view",async()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        expect(wrapper.find('[data-testid="json-view"]').exists()).toBe(false)
        await wrapper.find('[data-testid="json-toggle"]').trigger("click")
        expect(wrapper.find('[data-testid="json-view"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="json-content"]').text()).toContain("What is 2+2?")
        await wrapper.find('[data-testid="json-toggle"]').trigger("click")
        expect(wrapper.find('[data-testid="json-view"]').exists()).toBe(false)
    })
    test("shows original when showOriginal and has original",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction", showOriginal: true })
        expect(wrapper.find('[data-testid="split-view"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="original-panel"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="original-text"]').text()).toBe("source one")
        expect(wrapper.find('[data-testid="generated-panel"]').exists()).toBe(true)
    })
    test("hides original when showOriginal but no original",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "text", showOriginal: true, selectedIndex: 2 })
        expect(wrapper.find('[data-testid="single-view"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="original-panel"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="text-view"]').exists()).toBe(true)
    })
    test("renders instruction format",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        expect(wrapper.find('[data-testid="instruction-view"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="instruction-text"]').text()).toBe("What is 2+2?")
        expect(wrapper.find('[data-testid="output-text"]').text()).toBe("4")
    })
    test("renders messages format",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "messages", selectedIndex: 1 })
        expect(wrapper.find('[data-testid="messages-view"]').exists()).toBe(true)
        let bubbles=wrapper.findAll('[data-testid="message-bubble"]')
        expect(bubbles.length).toBe(2)
        expect(bubbles[0].find('[data-testid="message-role"]').text()).toBe("user")
        expect(bubbles[0].find('[data-testid="message-content"]').text()).toBe("Hello")
        expect(bubbles[1].find('[data-testid="message-role"]').text()).toBe("assistant")
        expect(bubbles[1].find('[data-testid="message-content"]').text()).toBe("Hi there")
    })
    test("renders text format",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "text", selectedIndex: 2 })
        expect(wrapper.find('[data-testid="text-view"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="text-content"]').text()).toBe("The quick brown fox.")
    })
    test("formattedItem matches format",()=>{
        let items=makeItems()
        let instructionWrapper=mountComponent({ items, format: "instruction" })
        expect(instructionWrapper.vm.formattedItem.type).toBe("instruction")
        let messagesWrapper=mountComponent({ items, format: "messages", selectedIndex: 1 })
        expect(messagesWrapper.vm.formattedItem.type).toBe("messages")
        let textWrapper=mountComponent({ items, format: "text", selectedIndex: 2 })
        expect(textWrapper.vm.formattedItem.type).toBe("text")
    })
    test("prev disabled at index 0",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        let button=wrapper.find('[data-testid="prev-button"]').element as HTMLButtonElement
        expect(button.disabled).toBe(true)
    })
    test("next disabled at last index",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction", selectedIndex: 2 })
        let button=wrapper.find('[data-testid="next-button"]').element as HTMLButtonElement
        expect(button.disabled).toBe(true)
    })
    test("displays total count",()=>{
        let items=makeItems()
        let wrapper=mountComponent({ items, format: "instruction" })
        expect(wrapper.find('[data-testid="index-display"]').text()).toContain("3")
    })
})