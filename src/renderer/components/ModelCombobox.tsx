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
    onRefresh?: () => void
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
    onCleanup(() => {
        clearBlurTimeout()
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
        <div ref={wrapperRef} class={configPanelStyles["model-combobox"]}>
            <input
                ref={inputRef}
                id={props.inputId}
                type="text"
                class={`${formsStyles["form-control"]} ${configPanelStyles["model-combobox__input"]}`}
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
            <Show when={props.onRefresh}>
                <button
                    type="button"
                    class={`${configPanelStyles["model-combobox__toggle"]} ${configPanelStyles["model-combobox__toggle--refresh"]}`}
                    aria-label={t("modelCombobox.refreshAria")}
                    data-i18n-aria-label="modelCombobox.refreshAria"
                    tabindex={-1}
                    disabled={props.disabled}
                    data-testid="model-combobox-refresh"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => props.onRefresh?.()}
                >
                    <span innerHTML={renderIcon("fa-sync-alt")} aria-hidden="true" />
                </button>
            </Show>
            <button
                type="button"
                class={configPanelStyles["model-combobox__toggle"]}
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
