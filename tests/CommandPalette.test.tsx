import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@solidjs/testing-library"
import { CommandPalette } from "../src/renderer/components/CommandPalette.tsx"
import type { Command } from "../src/renderer/components/CommandPalette.tsx"
function makeCommands():Command[]{
    return [
        { id: "open", label: "Open file", shortcut: "Ctrl+O", icon: "📂", action: vi.fn() },
        { id: "save", label: "Save file", shortcut: "Ctrl+S", action: vi.fn() },
        { id: "close", label: "Close window", action: vi.fn() }
    ]
}
function renderComponent(props: { commands: Command[]; visible: boolean; onClose?: ()=>void }){
    let onClose=props.onClose||vi.fn()
    return render(()=><CommandPalette commands={props.commands} visible={()=>props.visible} onClose={onClose} />)
}
function getSelectedId():string|null{
    let items=screen.queryAllByTestId(/^command-item-/)
    for (let item of items){
        if (item.classList.contains("selected")){
            return item.getAttribute("data-testid")
        }
    }
    return null
}
describe("CommandPalette",()=>{
    test("renders when visible",()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        expect(screen.queryByTestId("command-palette")).not.toBeNull()
        expect(screen.queryByTestId("command-palette-input")).not.toBeNull()
    })
    test("does not render when not visible",()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: false })
        expect(screen.queryByTestId("command-palette")).toBeNull()
    })
    test("filters commands by query",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let input=screen.getByTestId("command-palette-input")
        fireEvent.input(input, { target: { value: "save" } })
        await Promise.resolve()
        expect(screen.queryAllByTestId(/^command-item-/).length).toBe(1)
        expect(screen.queryByTestId("command-item-save")).not.toBeNull()
        expect(screen.queryByTestId("command-item-open")).toBeNull()
    })
    test("filters commands by id",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let input=screen.getByTestId("command-palette-input")
        fireEvent.input(input, { target: { value: "close" } })
        await Promise.resolve()
        expect(screen.queryAllByTestId(/^command-item-/).length).toBe(1)
        expect(screen.queryByTestId("command-item-close")).not.toBeNull()
    })
    test("arrow down moves selection",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let palette=screen.getByTestId("command-palette")
        expect(getSelectedId()).toBe("command-item-open")
        fireEvent.keyDown(palette, { key: "ArrowDown" })
        await Promise.resolve()
        expect(getSelectedId()).toBe("command-item-save")
    })
    test("arrow up moves selection",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let palette=screen.getByTestId("command-palette")
        fireEvent.keyDown(palette, { key: "ArrowDown" })
        fireEvent.keyDown(palette, { key: "ArrowDown" })
        expect(getSelectedId()).toBe("command-item-close")
        fireEvent.keyDown(palette, { key: "ArrowUp" })
        await Promise.resolve()
        expect(getSelectedId()).toBe("command-item-save")
    })
    test("enter executes selected",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let palette=screen.getByTestId("command-palette")
        fireEvent.keyDown(palette, { key: "ArrowDown" })
        fireEvent.keyDown(palette, { key: "Enter" })
        await Promise.resolve()
        expect(commands[1].action).toHaveBeenCalledTimes(1)
    })
    test("escape emits close",async()=>{
        let commands=makeCommands()
        let onClose=vi.fn()
        renderComponent({ commands, visible: true, onClose })
        let palette=screen.getByTestId("command-palette")
        fireEvent.keyDown(palette, { key: "Escape" })
        await Promise.resolve()
        expect(onClose).toHaveBeenCalledTimes(1)
    })
    test("click executes command",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        fireEvent.click(screen.getByTestId("command-item-save"))
        await Promise.resolve()
        expect(commands[1].action).toHaveBeenCalledTimes(1)
    })
    test("backdrop click closes",async()=>{
        let commands=makeCommands()
        let onClose=vi.fn()
        renderComponent({ commands, visible: true, onClose })
        fireEvent.click(screen.getByTestId("command-palette-overlay"))
        await Promise.resolve()
        expect(onClose).toHaveBeenCalledTimes(1)
    })
    test("highlights selected",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let palette=screen.getByTestId("command-palette")
        fireEvent.keyDown(palette, { key: "ArrowDown" })
        await Promise.resolve()
        expect(screen.getByTestId("command-item-save").classList.contains("selected")).toBe(true)
    })
    test("no commands when no match",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let input=screen.getByTestId("command-palette-input")
        fireEvent.input(input, { target: { value: "xyz" } })
        await Promise.resolve()
        expect(screen.queryByTestId("command-list")).toBeNull()
        expect(screen.queryByTestId("command-empty")).not.toBeNull()
        expect(screen.queryAllByTestId(/^command-item-/).length).toBe(0)
    })
    test("resets selection when query changes",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let palette=screen.getByTestId("command-palette")
        fireEvent.keyDown(palette, { key: "ArrowDown" })
        expect(getSelectedId()).toBe("command-item-save")
        let input=screen.getByTestId("command-palette-input")
        fireEvent.input(input, { target: { value: "open" } })
        await Promise.resolve()
        expect(getSelectedId()).toBe("command-item-open")
    })
    test("renders shortcut badge",()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let shortcut=screen.getByTestId("command-shortcut-open")
        expect(shortcut).not.toBeNull()
        expect(shortcut.textContent).toBe("Ctrl+O")
    })
    test("renders icon",()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let item=screen.getByTestId("command-item-open")
        let icon=item.querySelector("[data-testid='command-icon']")
        expect(icon).not.toBeNull()
        expect(icon!.textContent).toBe("📂")
    })
    test("arrow keys clamp selection bounds",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let palette=screen.getByTestId("command-palette")
        fireEvent.keyDown(palette, { key: "ArrowDown" })
        fireEvent.keyDown(palette, { key: "ArrowDown" })
        fireEvent.keyDown(palette, { key: "ArrowDown" })
        expect(getSelectedId()).toBe("command-item-close")
        fireEvent.keyDown(palette, { key: "ArrowUp" })
        fireEvent.keyDown(palette, { key: "ArrowUp" })
        fireEvent.keyDown(palette, { key: "ArrowUp" })
        await Promise.resolve()
        expect(getSelectedId()).toBe("command-item-open")
    })
})
