export type AnnouncePriority="polite"|"assertive"
export interface A11yAnnouncerOptions{
    document?: Document
    politeId?: string
    assertiveId?: string
}
export function createAriaLiveRegion(doc: Document, id: string, priority: AnnouncePriority): HTMLElement{
    let region=doc.createElement("div")
    region.id=id
    region.setAttribute("aria-live", priority)
    region.setAttribute("aria-atomic", "true")
    region.setAttribute("aria-relevant", "additions text")
    if (priority==="assertive"){
        region.setAttribute("role", "alert")
    }
    else{
        region.setAttribute("role", "status")
    }
    region.style.position="absolute"
    region.style.left="-10000px"
    region.style.width="1px"
    region.style.height="1px"
    region.style.overflow="hidden"
    region.style.clip="rect(0, 0, 0, 0)"
    region.style.whiteSpace="nowrap"
    region.style.border="0"
    return region
}
export function formatAnnouncement(message: string, priority: AnnouncePriority): string{
    let trimmed=message.trim()
    let prefix=priority==="assertive"?"Alert":"Status"
    let formatted=prefix+": "+trimmed
    if (trimmed.length>0 && !/[.!?。！？]$/.test(trimmed)){
        formatted=formatted+"."
    }
    return formatted
}
export class A11yAnnouncer{
    private doc: Document
    private politeId: string
    private assertiveId: string
    private politeRegion: HTMLElement|null=null
    private assertiveRegion: HTMLElement|null=null
    private politeTimer: ReturnType<typeof setTimeout>|null=null
    private assertiveTimer: ReturnType<typeof setTimeout>|null=null
    private clearDelay=5000
    constructor(options: A11yAnnouncerOptions={}){
        this.doc=options.document ?? globalThis.document
        this.politeId=options.politeId ?? "a11y-announcer-polite"
        this.assertiveId=options.assertiveId ?? "a11y-announcer-assertive"
    }
    ensureRegions(): void{
        if (!this.doc.body){
            return
        }
        this.politeRegion=this.doc.getElementById(this.politeId) as HTMLElement|null
        if (!this.politeRegion){
            this.politeRegion=createAriaLiveRegion(this.doc, this.politeId, "polite")
            this.doc.body.appendChild(this.politeRegion)
        }
        this.assertiveRegion=this.doc.getElementById(this.assertiveId) as HTMLElement|null
        if (!this.assertiveRegion){
            this.assertiveRegion=createAriaLiveRegion(this.doc, this.assertiveId, "assertive")
            this.doc.body.appendChild(this.assertiveRegion)
        }
    }
    announce(message: string, priority: AnnouncePriority="polite"): void{
        this.ensureRegions()
        let region=priority==="assertive"?this.assertiveRegion!:this.politeRegion!
        let formatted=formatAnnouncement(message, priority)
        if (region.textContent===formatted){
            region.textContent=""
            region.textContent=formatted
        }
        else{
            region.textContent=formatted
        }
        if (priority==="assertive"){
            if (this.assertiveTimer){
                clearTimeout(this.assertiveTimer)
            }
            this.assertiveTimer=setTimeout(()=>{
                region.textContent=""
                this.assertiveTimer=null
            }, this.clearDelay)
        }
        else{
            if (this.politeTimer){
                clearTimeout(this.politeTimer)
            }
            this.politeTimer=setTimeout(()=>{
                region.textContent=""
                this.politeTimer=null
            }, this.clearDelay)
        }
    }
    announceProgress(current: number, total: number, message?: string): void{
        let progress=total>0?Math.round((current/total)*100):0
        let text="Progress: "+current+" of "+total+" ("+progress+"%)"
        if (message){
            text=text+". "+message
        }
        this.announce(text, "polite")
    }
    announceError(message: string): void{
        this.announce(message, "assertive")
    }
    announceSuccess(message: string): void{
        this.announce(message, "polite")
    }
    clear(priority?: AnnouncePriority): void{
        if (priority){
            let region=priority==="assertive"?this.assertiveRegion:this.politeRegion
            if (region){
                region.textContent=""
            }
            if (priority==="assertive"){
                if (this.assertiveTimer){
                    clearTimeout(this.assertiveTimer)
                    this.assertiveTimer=null
                }
            }
            else{
                if (this.politeTimer){
                    clearTimeout(this.politeTimer)
                    this.politeTimer=null
                }
            }
        }
        else{
            if (this.politeRegion){
                this.politeRegion.textContent=""
            }
            if (this.assertiveRegion){
                this.assertiveRegion.textContent=""
            }
            if (this.politeTimer){
                clearTimeout(this.politeTimer)
                this.politeTimer=null
            }
            if (this.assertiveTimer){
                clearTimeout(this.assertiveTimer)
                this.assertiveTimer=null
            }
        }
    }
}
