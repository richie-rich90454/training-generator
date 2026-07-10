import type { JSX } from "solid-js"
import { createSignal, createMemo, For, Show, createEffect, onCleanup } from "solid-js"
import { renderIcon } from "../icons.js"
import { t } from "../i18n.js"
import formsStyles from "./styles/Forms.module.css"
import configPanelStyles from "./styles/ConfigPanel.module.css"
export interface ModelComboboxProps {
    value: string
    options: string[]
    placeholder?: string
    onChange: (value: string) => void
    disabled?: boolean
    inputId?: string
    ariaLabel?: string
}
export function ModelCombobox(props: ModelComboboxProps): JSX.Element {
    let inputRef: HTMLInputElement | undefined
    let wrapperRef: HTMLDivElement | undefined
    let blurTimeout: number | null = null
    const [open, setOpen] = createSignal<boolean>(false)
    const [selectedIndex, setSelectedIndex] = createSignal<number>(-1)
    const filteredOptions = createMemo<string[]>(() => {
        const value = (props.value || "").toLowerCase()
        const options = props.options || []
        if (value.length === 0) {
            return options
        }
        return options.filter((option) => option.toLowerCase().includes(value))
    })
    createEffect(() => {
        const value = props.value || ""
        const options = filteredOptions()
        if (!open() || options.length === 0) {
            setSelectedIndex(-1)
            return
        }
        const index = options.findIndex((option) => option === value)
        setSelectedIndex(index >= 0 ? index : 0)
    })
    function clearBlurTimeout(): void {
        if (blurTimeout !== null) {
            window.clearTimeout(blurTimeout)
            blurTimeout = null
        }
    }
    function handleFocus(): void {
        clearBlurTimeout()
        setOpen(true)
    }
    function handleBlur(): void {
        clearBlurTimeout()
        blurTimeout = window.setTimeout(() => {
            setOpen(false)
            blurTimeout = null
        }, 150)
    }
    function handleInput(value: string): void {
        props.onChange(value)
        setOpen(true)
    }
    function selectOption(option: string): void {
        props.onChange(option)
        setOpen(false)
        inputRef?.focus()
    }
    function handleKeyDown(event: KeyboardEvent): void {
        if (event.key === "ArrowDown") {
            event.preventDefault()
            const options = filteredOptions()
            if (options.length === 0) return
            setSelectedIndex((prev) => Math.min(prev + 1, options.length - 1))
            setOpen(true)
        }
        else if (event.key === "ArrowUp") {
            event.preventDefault()
            const options = filteredOptions()
            if (options.length === 0) return
            setSelectedIndex((prev) => Math.max(prev - 1, 0))
            setOpen(true)
        }
        else if (event.key === "Enter") {
            event.preventDefault()
            const options = filteredOptions()
            const index = selectedIndex()
            if (options.length > 0 && index >= 0 && index < options.length) {
                selectOption(options[index])
            }
            else {
                setOpen(false)
            }
        }
        else if (event.key === "Escape") {
            event.preventDefault()
            setOpen(false)
        }
    }
    function handleDocumentMouseDown(event: MouseEvent): void {
        const target = event.target as Node
        if (wrapperRef && !wrapperRef.contains(target)) {
            setOpen(false)
        }
    }
    createEffect(() => {
        if (open()) {
            document.addEventListener("mousedown", handleDocumentMouseDown)
            onCleanup(() => {
                document.removeEventListener("mousedown", handleDocumentMouseDown)
            })
        }
    })
    return (
        <div
            ref={wrapperRef}
            class={configPanelStyles["model-combobox"]}
            style={{
                position: "relative",
                display: "flex",
                "align-items": "stretch",
                gap: "var(--spacing-xs, 4px)"
            }}
        >
            <input
                ref={inputRef}
                id={props.inputId}
                type="text"
                class={`${formsStyles["form-control"]} ${configPanelStyles["model-combobox__input"]}`}
                style={{ "border-top-right-radius": 0, "border-bottom-right-radius": 0 }}
                value={props.value}
                placeholder={props.placeholder}
                disabled={props.disabled}
                aria-label={props.ariaLabel}
                aria-autocomplete="list"
                aria-controls={open() ? `${props.inputId}-listbox` : undefined}
                aria-expanded={open()}
                aria-activedescendant={open() && selectedIndex() >= 0 ? `${props.inputId}-option-${selectedIndex()}` : undefined}
                role="combobox"
                data-testid="model-combobox-input"
                onInput={(e) => handleInput(e.currentTarget.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
            />
            <button
                type="button"
                class={configPanelStyles["model-combobox__toggle"]}
                style={{
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                    width: "40px",
                    padding: 0,
                    background: "var(--surface-color)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--text-disabled)",
                    "border-left": "none",
                    "border-top-right-radius": "var(--radius-medium)",
                    "border-bottom-right-radius": "var(--radius-medium)",
                    cursor: props.disabled ? "not-allowed" : "pointer"
                }}
                aria-label={t("modelCombobox.toggleAria")}
                data-i18n-aria-label="modelCombobox.toggleAria"
                tabindex={-1}
                disabled={props.disabled}
                data-testid="model-combobox-toggle"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (open()) {
                        setOpen(false)
                    }
                    else {
                        setOpen(true)
                        inputRef?.focus()
                    }
                }}
            >
                <span innerHTML={renderIcon("fa-chevron-down")} aria-hidden="true" />
            </button>
            <Show when={open() && filteredOptions().length > 0}>
                <ul
                    id={`${props.inputId}-listbox`}
                    class={configPanelStyles["model-combobox__listbox"]}
                    style={{
                        position: "absolute",
                        top: "calc(100% + 2px)",
                        left: 0,
                        right: 0,
                        "max-height": "200px",
                        overflow: "auto",
                        "z-index": 100,
                        margin: 0,
                        padding: "var(--spacing-xs, 4px) 0",
                        "list-style": "none",
                        background: "var(--surface-color)",
                        border: "1px solid var(--border-color)",
                        "border-radius": "var(--radius-medium)",
                        "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.12)"
                    }}
                    role="listbox"
                    aria-label={props.ariaLabel ? `${props.ariaLabel} ${t("modelCombobox.listboxAria")}` : t("modelCombobox.listboxAria")}
                    data-testid="model-combobox-listbox"
                >
                    <For each={filteredOptions()}>
                        {(option, index) => (
                            <li
                                class={configPanelStyles["model-combobox__option"]}
                                classList={{
                                    [configPanelStyles["model-combobox__option--selected"]]: index() === selectedIndex()
                                }}
                                style={{
                                    padding: "var(--spacing-sm, 8px) var(--spacing-md, 12px)",
                                    cursor: "pointer",
                                    "background-color": index() === selectedIndex() ? "var(--surface-variant)" : "transparent",
                                    color: "var(--text-primary)"
                                }}
                                id={`${props.inputId}-option-${index()}`}
                                role="option"
                                aria-selected={index() === selectedIndex()}
                                data-testid={`model-combobox-option-${option}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseEnter={() => setSelectedIndex(index())}
                                onClick={() => selectOption(option)}
                            >
                                {option}
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
        </div>
    )
}
