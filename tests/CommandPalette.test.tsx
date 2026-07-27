import { describe, test, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@solidjs/testing-library"
import { CommandPalette, fuzzyScore } from "../src/renderer/components/CommandPalette.tsx"
import type { Command } from "../src/renderer/components/CommandPalette.tsx"
import { t } from "../src/renderer/i18n.js"
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
    beforeEach(()=>{
        // Clear recent-commands storage so each test starts with a clean
        // ordering (no recent commands).
        window.localStorage.removeItem("commandPalette.recentCommands")
    })
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
    test("fuzzyScore returns high score for exact substring match",()=>{
        const score=fuzzyScore("save", "Save file")
        expect(score).toBeGreaterThan(0)
    })
    test("fuzzyScore returns -1 for no match",()=>{
        const score=fuzzyScore("xyz", "Save file")
        expect(score).toBe(-1)
    })
    test("fuzzyScore matches subsequence (sv -> Save file)",()=>{
        const score=fuzzyScore("sv", "Save file")
        expect(score).toBeGreaterThan(0)
    })
    test("fuzzyScore gives higher score for consecutive matches",()=>{
        const consecutiveScore=fuzzyScore("sav", "Save file")
        const scatteredScore=fuzzyScore("sef", "Save file")
        expect(consecutiveScore).toBeGreaterThan(scatteredScore)
    })
    test("fuzzy search matches by subsequence (sv -> Save)",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        let input=screen.getByTestId("command-palette-input")
        // "sv" should fuzzy-match "Save file" (S-a-V-e) but not "Open file" or "Close window"
        fireEvent.input(input, { target: { value: "sv" } })
        await Promise.resolve()
        expect(screen.queryByTestId("command-item-save")).not.toBeNull()
        expect(screen.queryByTestId("command-item-open")).toBeNull()
        expect(screen.queryByTestId("command-item-close")).toBeNull()
    })
    test("fuzzy search ranks prefix match above subsequence match",async()=>{
        const commands: Command[]=[
            { id: "save", label: "Save file", action: vi.fn() },
            { id: "asave", label: "Another save", action: vi.fn() }
        ]
        renderComponent({ commands, visible: true })
        let input=screen.getByTestId("command-palette-input")
        // "save" should match both as a substring, but "Save file" should
        // rank higher because the match is at the start.
        fireEvent.input(input, { target: { value: "save" } })
        await Promise.resolve()
        const items=screen.queryAllByTestId(/^command-item-/)
        expect(items.length).toBe(2)
        expect(items[0].getAttribute("data-testid")).toBe("command-item-save")
        expect(items[1].getAttribute("data-testid")).toBe("command-item-asave")
    })
    test("recent commands appear first when query is empty",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        // Execute "save" to mark it as recent
        fireEvent.click(screen.getByTestId("command-item-save"))
        await Promise.resolve()
        // Re-render the palette (simulating reopen)
        renderComponent({ commands, visible: true })
        const items=screen.queryAllByTestId(/^command-item-/)
        // "save" should now be first
        expect(items[0].getAttribute("data-testid")).toBe("command-item-save")
    })
    test("executing a command persists it to localStorage",async()=>{
        let commands=makeCommands()
        renderComponent({ commands, visible: true })
        fireEvent.click(screen.getByTestId("command-item-save"))
        await Promise.resolve()
        const raw=window.localStorage.getItem("commandPalette.recentCommands")
        expect(raw).not.toBeNull()
        const parsed=JSON.parse(raw!) as string[]
        expect(parsed[0]).toBe("save")
    })
    test("recent commands list caps at 5 entries",async()=>{
        const commands: Command[]=[
            { id: "c1", label: "Command 1", action: vi.fn() },
            { id: "c2", label: "Command 2", action: vi.fn() },
            { id: "c3", label: "Command 3", action: vi.fn() },
            { id: "c4", label: "Command 4", action: vi.fn() },
            { id: "c5", label: "Command 5", action: vi.fn() },
            { id: "c6", label: "Command 6", action: vi.fn() }
        ]
        // Execute 6 different commands across 6 palette opens
        for (let i=0; i<6; i++){
            cleanup()
            renderComponent({ commands, visible: true })
            fireEvent.click(screen.getByTestId("command-item-c"+(i+1)))
            await Promise.resolve()
        }
        const raw=window.localStorage.getItem("commandPalette.recentCommands")
        expect(raw).not.toBeNull()
        const parsed=JSON.parse(raw!) as string[]
        expect(parsed.length).toBeLessThanOrEqual(5)
        // Most recent should be c6, then c5, etc.
        expect(parsed[0]).toBe("c6")
    })
    test("locks body scroll while open",()=>{
        document.body.style.overflow=""
        renderComponent({ commands: makeCommands(), visible: true })
        expect(document.body.style.overflow).toBe("hidden")
    })
    test("restores body scroll on unmount via onCleanup",()=>{
        document.body.style.overflow="auto"
        const utils=renderComponent({ commands: makeCommands(), visible: true })
        expect(document.body.style.overflow).toBe("hidden")
        utils.unmount()
        expect(document.body.style.overflow).toBe("auto")
    })
    test("saves and restores previously focused element",()=>{
        const trigger=document.createElement("button")
        trigger.textContent="Open palette"
        document.body.appendChild(trigger)
        trigger.focus()
        expect(document.activeElement).toBe(trigger)
        const utils=renderComponent({ commands: makeCommands(), visible: true })
        // Palette is open — focus should have moved to the input
        expect(document.activeElement).not.toBe(trigger)
        utils.unmount()
        // After unmount, focus should be restored to the trigger
        expect(document.activeElement).toBe(trigger)
        document.body.removeChild(trigger)
    })
    test("dialog has role=dialog and aria-modal=true",()=>{
        renderComponent({ commands: makeCommands(), visible: true })
        const dialog=screen.getByRole("dialog")
        expect(dialog.getAttribute("aria-modal")).toBe("true")
    })
    test("dialog aria-labelledby points to visible title",()=>{
        const { container }=renderComponent({ commands: makeCommands(), visible: true })
        const dialog=screen.getByRole("dialog")
        const labelledBy=dialog.getAttribute("aria-labelledby")
        expect(labelledBy).toBe("command-palette-title")
        const title=container.querySelector("#command-palette-title")
        expect(title).not.toBeNull()
        expect(title?.textContent ?? "").toContain(t("commandPalette.title"))
    })
    test("no-results message has data-i18n attribute",()=>{
        const { container }=renderComponent({ commands: makeCommands(), visible: true })
        const input=screen.getByTestId("command-palette-input")
        fireEvent.input(input, { target: { value: "zzzznonexistent" } })
        const noResults=container.querySelector('[data-i18n="commandPalette.noCommands"]')
        expect(noResults).not.toBeNull()
    })
    test("input placeholder has data-i18n-placeholder",()=>{
        renderComponent({ commands: makeCommands(), visible: true })
        const input=screen.getByTestId("command-palette-input") as HTMLInputElement
        expect(input.getAttribute("data-i18n-placeholder")).toBe("commandPalette.placeholder")
    })
    test("Tab on input keeps focus within dialog (forward cycle)",()=>{
        renderComponent({ commands: makeCommands(), visible: true })
        const dialog=screen.getByRole("dialog")
        const input=screen.getByTestId("command-palette-input") as HTMLInputElement
        input.focus()
        expect(document.activeElement).toBe(input)
        fireEvent.keyDown(dialog, { key: "Tab", shiftKey: false, bubbles: true, cancelable: true })
        // The input is the only focusable element, so Tab cycle keeps focus on it
        expect(document.activeElement).toBe(input)
    })
    test("Shift+Tab on input keeps focus within dialog (backward cycle)",()=>{
        renderComponent({ commands: makeCommands(), visible: true })
        const dialog=screen.getByRole("dialog")
        const input=screen.getByTestId("command-palette-input") as HTMLInputElement
        input.focus()
        expect(document.activeElement).toBe(input)
        fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })
        expect(document.activeElement).toBe(input)
    })
})
