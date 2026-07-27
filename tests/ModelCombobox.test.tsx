import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { ModelCombobox, type ModelComboboxProps } from "../src/renderer/components/ModelCombobox.tsx"
function renderComponent(props: Partial<ModelComboboxProps> & { options: string[]; value?: string }) {
    const [value, setValue] = createSignal<string>(props.value ?? "")
    const externalOnChange = props.onChange
    const onChange = (newValue: string): void => {
        setValue(newValue)
        externalOnChange?.(newValue)
    }
    return render(() => (
        <ModelCombobox
            value={value()}
            options={props.options}
            onChange={onChange}
            placeholder={props.placeholder ?? "Model"}
            inputId={props.inputId ?? "test-model"}
            ariaLabel={props.ariaLabel ?? "Model"}
            disabled={props.disabled}
        />
    ))
}
describe("ModelCombobox", () => {
    test("renders input and dropdown button", () => {
        renderComponent({ options: ["llama3", "mistral"] })
        expect(screen.queryByTestId("model-combobox-input")).not.toBeNull()
        expect(screen.queryByTestId("model-combobox-toggle")).not.toBeNull()
    })
    test("typing filters options", async () => {
        renderComponent({ options: ["llama3", "llama2", "mistral"] })
        const input = screen.getByTestId("model-combobox-input")
        fireEvent.focus(input)
        fireEvent.input(input, { target: { value: "lla" } })
        await Promise.resolve()
        expect(screen.queryByTestId("model-combobox-option-llama3")).not.toBeNull()
        expect(screen.queryByTestId("model-combobox-option-llama2")).not.toBeNull()
        expect(screen.queryByTestId("model-combobox-option-mistral")).toBeNull()
    })
    test("clicking an option calls onChange with the option value", async () => {
        const onChange = vi.fn()
        renderComponent({ options: ["llama3", "mistral"], onChange })
        const input = screen.getByTestId("model-combobox-input")
        fireEvent.focus(input)
        await Promise.resolve()
        fireEvent.click(screen.getByTestId("model-combobox-option-mistral"))
        await Promise.resolve()
        expect(onChange).toHaveBeenCalledWith("mistral")
    })
    test("typing a custom value calls onChange with that value", async () => {
        const onChange = vi.fn()
        renderComponent({ options: ["llama3", "mistral"], onChange })
        const input = screen.getByTestId("model-combobox-input")
        fireEvent.input(input, { target: { value: "custom-model" } })
        await Promise.resolve()
        expect(onChange).toHaveBeenCalledWith("custom-model")
    })
    test("keyboard navigation selects an option", async () => {
        const onChange = vi.fn()
        renderComponent({ options: ["llama3", "mistral", "codellama"], onChange })
        const input = screen.getByTestId("model-combobox-input")
        fireEvent.focus(input)
        await Promise.resolve()
        fireEvent.keyDown(input, { key: "ArrowDown" })
        await Promise.resolve()
        fireEvent.keyDown(input, { key: "ArrowDown" })
        await Promise.resolve()
        fireEvent.keyDown(input, { key: "Enter" })
        await Promise.resolve()
        expect(onChange).toHaveBeenCalledWith("codellama")
    })
})
