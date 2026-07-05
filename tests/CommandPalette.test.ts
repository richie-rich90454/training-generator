import { describe, test, expect, vi } from "vitest"
import { mount } from "@vue/test-utils"
import CommandPalette from "../src/renderer/components/CommandPalette.vue"
function makeCommands(){
    return [
        { id: "open", label: "Open file", shortcut: "Ctrl+O", icon: "📂", action: vi.fn() },
        { id: "save", label: "Save file", shortcut: "Ctrl+S", action: vi.fn() },
        { id: "close", label: "Close window", action: vi.fn() }
    ]
}
function mountComponent(props: Record<string, unknown>){
    return mount(CommandPalette, { props })
}
describe("CommandPalette",()=>{
    test("renders when visible",()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        expect(wrapper.find('[data-testid="command-palette"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="command-palette-input"]').exists()).toBe(true)
    })
    test("does not render when not visible",()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: false })
        expect(wrapper.find('[data-testid="command-palette"]').exists()).toBe(false)
    })
    test("filters commands by query",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let input=wrapper.find('[data-testid="command-palette-input"]')
        await input.setValue("save")
        expect(wrapper.vm.filteredCommands.length).toBe(1)
        expect(wrapper.vm.filteredCommands[0].id).toBe("save")
        expect(wrapper.find('[data-testid="command-item-save"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="command-item-open"]').exists()).toBe(false)
    })
    test("filters commands by id",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let input=wrapper.find('[data-testid="command-palette-input"]')
        await input.setValue("close")
        expect(wrapper.vm.filteredCommands.length).toBe(1)
        expect(wrapper.vm.filteredCommands[0].id).toBe("close")
    })
    test("arrow down moves selection",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let palette=wrapper.find('[data-testid="command-palette"]')
        expect(wrapper.vm.selectedIndex).toBe(0)
        await palette.trigger("keydown", { key: "ArrowDown" })
        expect(wrapper.vm.selectedIndex).toBe(1)
    })
    test("arrow up moves selection",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let palette=wrapper.find('[data-testid="command-palette"]')
        await palette.trigger("keydown", { key: "ArrowDown" })
        await palette.trigger("keydown", { key: "ArrowDown" })
        expect(wrapper.vm.selectedIndex).toBe(2)
        await palette.trigger("keydown", { key: "ArrowUp" })
        expect(wrapper.vm.selectedIndex).toBe(1)
    })
    test("enter executes selected",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let palette=wrapper.find('[data-testid="command-palette"]')
        await palette.trigger("keydown", { key: "ArrowDown" })
        await palette.trigger("keydown", { key: "Enter" })
        expect(commands[1].action).toHaveBeenCalledTimes(1)
    })
    test("escape emits close",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let palette=wrapper.find('[data-testid="command-palette"]')
        await palette.trigger("keydown", { key: "Escape" })
        expect(wrapper.emitted("close")).toHaveLength(1)
    })
    test("click executes command",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        await wrapper.find('[data-testid="command-item-save"]').trigger("click")
        expect(commands[1].action).toHaveBeenCalledTimes(1)
    })
    test("backdrop click closes",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        await wrapper.find('[data-testid="command-palette-overlay"]').trigger("click")
        expect(wrapper.emitted("close")).toHaveLength(1)
    })
    test("highlights selected",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let palette=wrapper.find('[data-testid="command-palette"]')
        await palette.trigger("keydown", { key: "ArrowDown" })
        let item=wrapper.find('[data-testid="command-item-save"]')
        expect(item.classes()).toContain("selected")
    })
    test("no commands when no match",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let input=wrapper.find('[data-testid="command-palette-input"]')
        await input.setValue("xyz")
        expect(wrapper.find('[data-testid="command-list"]').exists()).toBe(false)
        expect(wrapper.find('[data-testid="command-empty"]').exists()).toBe(true)
        expect(wrapper.vm.filteredCommands.length).toBe(0)
    })
    test("resets selection when query changes",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let palette=wrapper.find('[data-testid="command-palette"]')
        await palette.trigger("keydown", { key: "ArrowDown" })
        expect(wrapper.vm.selectedIndex).toBe(1)
        let input=wrapper.find('[data-testid="command-palette-input"]')
        await input.setValue("open")
        expect(wrapper.vm.selectedIndex).toBe(0)
    })
    test("renders shortcut badge",()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let shortcut=wrapper.find('[data-testid="command-shortcut-open"]')
        expect(shortcut.exists()).toBe(true)
        expect(shortcut.text()).toBe("Ctrl+O")
    })
    test("renders icon",()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let icon=wrapper.find('[data-testid="command-item-open"] .command-icon')
        expect(icon.exists()).toBe(true)
        expect(icon.text()).toBe("📂")
    })
    test("arrow keys clamp selection bounds",async()=>{
        let commands=makeCommands()
        let wrapper=mountComponent({ commands: commands, visible: true })
        let palette=wrapper.find('[data-testid="command-palette"]')
        await palette.trigger("keydown", { key: "ArrowDown" })
        await palette.trigger("keydown", { key: "ArrowDown" })
        await palette.trigger("keydown", { key: "ArrowDown" })
        expect(wrapper.vm.selectedIndex).toBe(2)
        await palette.trigger("keydown", { key: "ArrowUp" })
        await palette.trigger("keydown", { key: "ArrowUp" })
        await palette.trigger("keydown", { key: "ArrowUp" })
        expect(wrapper.vm.selectedIndex).toBe(0)
    })
})
