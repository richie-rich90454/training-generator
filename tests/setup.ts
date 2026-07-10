import { createRoot } from "solid-js"

export function withRoot<T>(fn: (dispose: () => void) => T): T {
    return createRoot((dispose) => fn(dispose))
}
