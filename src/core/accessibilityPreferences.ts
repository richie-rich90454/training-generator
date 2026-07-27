export const HIGH_CONTRAST_CLASS: string="high-contrast"
export interface MediaQueryListLike{
    matches: boolean
    addEventListener?: (type: string, listener: ()=>void)=>void
    removeEventListener?: (type: string, listener: ()=>void)=>void
}
export interface AccessibilityPreferencesOptions{
    mediaQueryList?: MediaQueryListLike
    document?: Document
}
export interface AccessibilityPreferencesState{
    reducedMotion: boolean
    highContrast: boolean
    colorScheme: "light"|"dark"|"no-preference"
}
export function buildReducedMotionStyle(): string{
    return `*, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
}`
}
export class AccessibilityPreferences{
    private doc: Document
    private root: HTMLElement
    private reducedMotionQuery: MediaQueryListLike
    private highContrastQuery: MediaQueryList
    private colorSchemeDarkQuery: MediaQueryList
    private colorSchemeLightQuery: MediaQueryList
    private styleElement: HTMLStyleElement|null=null
    private listeners: ((prefs: AccessibilityPreferencesState)=>void)[]=[]
    constructor(options: AccessibilityPreferencesOptions={}){
        this.doc=options.document ?? globalThis.document
        this.root=this.doc.documentElement
        this.reducedMotionQuery=options.mediaQueryList ?? matchMedia("(prefers-reduced-motion: reduce)")
        this.highContrastQuery=matchMedia("(forced-colors: active)")
        this.colorSchemeDarkQuery=matchMedia("(prefers-color-scheme: dark)")
        this.colorSchemeLightQuery=matchMedia("(prefers-color-scheme: light)")
    }
    private getState(): AccessibilityPreferencesState{
        return{
            reducedMotion: this.prefersReducedMotion(),
            highContrast: this.prefersHighContrast(),
            colorScheme: this.prefersColorScheme()
        }
    }
    private notify(): void{
        let state=this.getState()
        for (let callback of this.listeners){
            callback(state)
        }
    }
    prefersReducedMotion(): boolean{
        return this.reducedMotionQuery.matches
    }
    prefersHighContrast(): boolean{
        return this.highContrastQuery.matches
    }
    prefersColorScheme(): "light"|"dark"|"no-preference"{
        if (this.colorSchemeDarkQuery.matches){
            return "dark"
        }
        if (this.colorSchemeLightQuery.matches){
            return "light"
        }
        return "no-preference"
    }
    setHighContrast(enabled: boolean): void{
        if (enabled){
            this.root.classList.add(HIGH_CONTRAST_CLASS)
        }
        else{
            this.root.classList.remove(HIGH_CONTRAST_CLASS)
        }
    }
    isHighContrast(): boolean{
        return this.root.classList.contains(HIGH_CONTRAST_CLASS)
    }
    disableAnimations(): void{
        if (!this.styleElement){
            this.styleElement=this.doc.createElement("style")
            this.styleElement.id="reduced-motion-style"
            this.styleElement.textContent=buildReducedMotionStyle()
            this.doc.head.appendChild(this.styleElement)
        }
    }
    enableAnimations(): void{
        if (this.styleElement && this.styleElement.parentNode){
            this.styleElement.parentNode.removeChild(this.styleElement)
            this.styleElement=null
        }
    }
    listen(callback: (prefs: AccessibilityPreferencesState)=>void): void{
        this.listeners.push(callback)
        let handler=()=>this.notify()
        if (this.reducedMotionQuery.addEventListener){
            this.reducedMotionQuery.addEventListener("change", handler)
        }
        this.highContrastQuery.addEventListener("change", handler)
        this.colorSchemeDarkQuery.addEventListener("change", handler)
        this.colorSchemeLightQuery.addEventListener("change", handler)
    }
}
