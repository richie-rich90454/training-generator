export const FOCUSABLE_SELECTOR='a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])'
export function isFocusable(element: HTMLElement): boolean{
    if (element.hasAttribute("disabled")){
        return false
    }
    if (element.getAttribute("tabindex")==="-1"){
        return false
    }
    if (element.getAttribute("aria-hidden")==="true"){
        return false
    }
    if (element.matches('input[type="hidden"]')){
        return false
    }
    let style=window.getComputedStyle(element)
    if (style.display==="none" || style.visibility==="hidden"){
        return false
    }
    return element.matches(FOCUSABLE_SELECTOR)
}
export interface FocusManagerOptions{
    document?: Document
}
export class FocusManager{
    private doc: Document
    private trapContainer: HTMLElement|null=null
    private trapHandler: ((event: KeyboardEvent)=>void)|null=null
    constructor(options: FocusManagerOptions={}){
        this.doc=options.document ?? globalThis.document
    }
    getFocusableElements(container: HTMLElement): HTMLElement[]{
        let elements=Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
        return elements.filter((el): el is HTMLElement=>isFocusable(el as HTMLElement))
    }
    focusFirst(container: HTMLElement): void{
        let elements=this.getFocusableElements(container)
        if (elements.length>0){
            elements[0].focus()
        }
    }
    focusLast(container: HTMLElement): void{
        let elements=this.getFocusableElements(container)
        if (elements.length>0){
            elements[elements.length-1].focus()
        }
    }
    trapFocus(container: HTMLElement): void{
        this.releaseFocus()
        this.trapContainer=container
        this.trapHandler=(event: KeyboardEvent)=>{
            if (event.key!=="Tab"){
                return
            }
            let elements=this.getFocusableElements(container)
            if (elements.length===0){
                return
            }
            let active=this.doc.activeElement as HTMLElement
            let index=elements.indexOf(active)
            if (event.shiftKey){
                if (index<=0){
                    event.preventDefault()
                    elements[elements.length-1].focus()
                }
            }
            else{
                if (index===elements.length-1 || index===-1){
                    event.preventDefault()
                    elements[0].focus()
                }
            }
        }
        container.addEventListener("keydown", this.trapHandler, true)
    }
    releaseFocus(): void{
        if (this.trapContainer && this.trapHandler){
            this.trapContainer.removeEventListener("keydown", this.trapHandler, true)
        }
        this.trapContainer=null
        this.trapHandler=null
    }
    handleArrowNavigation(container: HTMLElement, event: KeyboardEvent, orientation: "horizontal"|"vertical"="vertical"): void{
        let elements=this.getFocusableElements(container)
        if (elements.length===0){
            return
        }
        let active=this.doc.activeElement as HTMLElement
        let index=elements.indexOf(active)
        if (index===-1){
            return
        }
        let nextIndex=-1
        if (orientation==="horizontal"){
            if (event.key==="ArrowRight"){
                nextIndex=(index+1)%elements.length
            }
            else if (event.key==="ArrowLeft"){
                nextIndex=(index-1+elements.length)%elements.length
            }
        }
        else{
            if (event.key==="ArrowDown"){
                nextIndex=(index+1)%elements.length
            }
            else if (event.key==="ArrowUp"){
                nextIndex=(index-1+elements.length)%elements.length
            }
        }
        if (nextIndex!==-1){
            event.preventDefault()
            elements[nextIndex].focus()
        }
    }
    registerSkipLink(targetId: string, label?: string): HTMLElement{
        let skipLink=this.doc.createElement("a")
        skipLink.href="#"+targetId
        skipLink.textContent=label ?? "Skip to main content"
        skipLink.setAttribute("role", "link")
        skipLink.className="skip-link"
        skipLink.style.position="absolute"
        skipLink.style.left="auto"
        skipLink.style.right="-10000px"
        skipLink.style.top="auto"
        skipLink.style.width="1px"
        skipLink.style.height="1px"
        skipLink.style.overflow="hidden"
        skipLink.style.zIndex="10000"
        skipLink.addEventListener("click", (event: Event)=>{
            event.preventDefault()
            let target=this.doc.getElementById(targetId)
            if (target){
                target.setAttribute("tabindex", "-1")
                target.focus()
            }
        })
        if (this.doc.body){
            this.doc.body.insertBefore(skipLink, this.doc.body.firstChild)
        }
        return skipLink
    }
}
