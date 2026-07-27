import type { JSX } from "solid-js"
export interface IconProps {
    html: string
    class?: string
}
export function Icon(props: IconProps): JSX.Element {
    return <span class={props.class} innerHTML={props.html} aria-hidden="true" />
}
