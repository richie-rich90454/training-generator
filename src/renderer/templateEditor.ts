import { showToast } from "./toast.js"

export class TemplateEditor{
    private overlay:HTMLDivElement
    private modal:HTMLDivElement
    private textarea:HTMLTextAreaElement
    private highlightedPreview:HTMLPreElement
    private livePreview:HTMLPreElement
    private focusTrapHandler:((e:KeyboardEvent)=>void)|null=null
    private lastFocusedElement:HTMLElement|null=null

    constructor(){
        this.overlay=document.createElement("div")
        this.modal=document.createElement("div")
        this.textarea=document.createElement("textarea")
        this.highlightedPreview=document.createElement("pre")
        this.livePreview=document.createElement("pre")
        this.createDOM()
        this.bindEvents()
    }

    private escapeHtml(text:string):string{
        let div=document.createElement("div")
        div.textContent=text
        return div.innerHTML
    }

    private highlightVariables(text:string):string{
        let escaped=this.escapeHtml(text)
        escaped=escaped.replace(/\{text\}/g,'<span class="tpl-var tpl-var-text">{text}</span>')
        escaped=escaped.replace(/\{language\}/g,'<span class="tpl-var tpl-var-language">{language}</span>')
        escaped=escaped.replace(/\{prompt_type\}/g,'<span class="tpl-var tpl-var-prompt">{prompt_type}</span>')
        return escaped
    }

    private renderWithSample(text:string):string{
        return text
            .replace(/\{text\}/g,"[Sample source text would appear here...]")
            .replace(/\{language\}/g,"English")
            .replace(/\{prompt_type\}/g,"instruction")
    }

    private createDOM():void{
        let styleId="template-editor-styles"
        if(!document.getElementById(styleId)){
            let style=document.createElement("style")
            style.id=styleId
            style.textContent=`
            .tpl-var{display:inline;padding:1px 4px;border-radius:3px;font-weight:bold;font-family:'Noto Sans',sans-serif}
            .tpl-var-text{background:#e3f2fd;color:#1565c0;border:1px solid #90caf9}
            .tpl-var-language{background:#e8f5e9;color:#2e7d32;border:1px solid #a5d6a7}
            .tpl-var-prompt{background:#fff3e0;color:#e65100;border:1px solid #ffcc80}
            .template-editor-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:none;justify-content:center;align-items:center}
            .template-editor-modal{background:var(--bg-primary,#fff);border-radius:8px;width:85%;max-width:900px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 4px 24px rgba(0,0,0,0.3);color:var(--text-primary,#333)}
            .template-editor-body{padding:20px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:12px}
            .template-editor-body label{font-weight:600;font-size:0.9rem;color:var(--text-secondary,#555)}
            .template-editor-textarea{width:100%;height:180px;font-family:'Noto Sans',sans-serif;font-size:0.875rem;padding:12px;border:1px solid var(--border-color,#ccc);border-radius:4px;resize:vertical;background:var(--bg-secondary,#f8f8f8);color:var(--text-primary,#333);box-sizing:border-box;line-height:1.5;tab-size:2}
            .template-editor-preview{width:100%;padding:12px;border:1px solid var(--border-color,#ccc);border-radius:4px;background:var(--bg-secondary,#f8f8f8);min-height:50px;max-height:140px;overflow:auto;font-family:'Noto Sans',sans-serif;font-size:0.875rem;white-space:pre-wrap;word-wrap:break-word;margin:0;box-sizing:border-box;line-height:1.5}
            .template-editor-footer{padding:12px 20px;border-top:1px solid var(--border-color,#e0e0e0);display:flex;gap:8px;justify-content:flex-end}
            .template-editor-header{padding:14px 20px;border-bottom:1px solid var(--border-color,#e0e0e0);display:flex;justify-content:space-between;align-items:center}
            .template-editor-header h2{margin:0;font-size:1.15rem;display:flex;align-items:center;gap:8px}
            .template-editor-close{background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-secondary,#666);padding:0 4px;line-height:1}
            .template-editor-close:hover{color:var(--text-primary,#333)}
        `
            document.head.appendChild(style)
        }

        this.overlay.className="template-editor-overlay"
        this.overlay.setAttribute("role","dialog")
        this.overlay.setAttribute("aria-modal","true")
        this.overlay.setAttribute("aria-label","Edit Prompt Template")

        this.modal.className="template-editor-modal"

        let header=document.createElement("div")
        header.className="template-editor-header"
        header.innerHTML='<h2><i class="fas fa-edit"></i> Edit Prompt Template</h2>'
        let closeBtn=document.createElement("button")
        closeBtn.className="template-editor-close"
        closeBtn.innerHTML="&times;"
        closeBtn.setAttribute("aria-label","Close template editor")
        closeBtn.addEventListener("click",()=>this.hide())
        header.appendChild(closeBtn)

        let body=document.createElement("div")
        body.className="template-editor-body"

        let textareaLabel=document.createElement("label")
        textareaLabel.innerHTML='<i class="fas fa-code"></i> Template:'
        this.textarea.className="template-editor-textarea"
        this.textarea.setAttribute("aria-label","Prompt template content")
        this.textarea.placeholder="Enter your prompt template with {text}, {language}, {prompt_type} variables..."
        this.textarea.spellcheck=false

        let previewLabel=document.createElement("label")
        previewLabel.innerHTML='<i class="fas fa-highlighter"></i> Highlighted Variables:'
        this.highlightedPreview.className="template-editor-preview"

        let liveLabel=document.createElement("label")
        liveLabel.innerHTML='<i class="fas fa-eye"></i> Live Preview (with sample values):'
        this.livePreview.className="template-editor-preview"

        body.appendChild(textareaLabel)
        body.appendChild(this.textarea)
        body.appendChild(previewLabel)
        body.appendChild(this.highlightedPreview)
        body.appendChild(liveLabel)
        body.appendChild(this.livePreview)

        let footer=document.createElement("div")
        footer.className="template-editor-footer"

        let loadBtn=document.createElement("button")
        loadBtn.className="btn btn-secondary"
        loadBtn.innerHTML='<i class="fas fa-folder-open"></i> Load Template'
        loadBtn.setAttribute("aria-label","Load template from file")
        loadBtn.addEventListener("click",()=>this.handleLoad())

        let saveBtn=document.createElement("button")
        saveBtn.className="btn btn-primary"
        saveBtn.innerHTML='<i class="fas fa-save"></i> Save Template'
        saveBtn.setAttribute("aria-label","Save template to file")
        saveBtn.addEventListener("click",()=>this.handleSave())

        let closeFooterBtn=document.createElement("button")
        closeFooterBtn.className="btn btn-secondary"
        closeFooterBtn.innerHTML='<i class="fas fa-times"></i> Close'
        closeFooterBtn.setAttribute("aria-label","Close template editor")
        closeFooterBtn.addEventListener("click",()=>this.hide())

        footer.appendChild(loadBtn)
        footer.appendChild(saveBtn)
        footer.appendChild(closeFooterBtn)

        this.modal.appendChild(header)
        this.modal.appendChild(body)
        this.modal.appendChild(footer)

        this.overlay.appendChild(this.modal)
        this.overlay.addEventListener("click",(e:Event)=>{
            if(e.target===this.overlay)this.hide()
        })

        document.body.appendChild(this.overlay)
    }

    private bindEvents():void{
        this.textarea.addEventListener("input",()=>this.updatePreviews())
        document.addEventListener("keydown",this.handleKeydown)
    }

    private handleKeydown=(e:KeyboardEvent):void=>{
        if(e.key!=="Escape"||this.overlay.style.display!=="flex")return
        if(this.hasHigherZIndexModal())return
        e.preventDefault()
        this.hide()
    }

    private hasHigherZIndexModal():boolean{
        let activeModals=document.querySelectorAll(".modal.active,[role='dialog'].active")
        let overlayZ=parseInt(getComputedStyle(this.overlay).zIndex||"10000",10)
        for(let i=0;i<activeModals.length;i++){
            let modal=activeModals[i]
            if(modal===this.overlay)continue
            let z=parseInt(getComputedStyle(modal).zIndex||"0",10)
            if(z>overlayZ)return true
        }
        return false
    }

    private updatePreviews():void{
        let content=this.textarea.value
        this.highlightedPreview.innerHTML=this.highlightVariables(content)||"<span style=\"color:var(--text-muted,#999)\">(empty template)</span>"
        let rendered=this.renderWithSample(content)
        this.livePreview.textContent=rendered||"(empty template)"
    }

    show():void{
        this.lastFocusedElement=document.activeElement as HTMLElement
        this.overlay.style.display="flex"
        this.updatePreviews()
        this.trapFocus()
        let focusable=this.overlay.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])')
        if(focusable.length>0){
            (focusable[0] as HTMLElement).focus()
        }
        else{
            this.textarea.focus()
        }
    }

    hide():void{
        this.overlay.style.display="none"
        this.removeFocusTrap()
        if(this.lastFocusedElement&&document.contains(this.lastFocusedElement)){
            this.lastFocusedElement.focus()
            this.lastFocusedElement=null
        }
    }

    loadTemplate(content:string):void{
        this.textarea.value=content
        this.updatePreviews()
    }

    getTemplate():string{
        return this.textarea.value
    }

    private trapFocus():void{
        if(this.focusTrapHandler)return
        let selector='button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
        this.focusTrapHandler=(e:KeyboardEvent)=>{
            if(e.key!=="Tab")return
            let focusable=Array.from(this.overlay.querySelectorAll<HTMLElement>(selector))
            if(focusable.length===0)return
            let first=focusable[0]
            let last=focusable[focusable.length-1]
            if(e.shiftKey&&document.activeElement===first){
                e.preventDefault()
                last.focus()
            }
            else if(!e.shiftKey&&document.activeElement===last){
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener("keydown",this.focusTrapHandler)
    }

    private removeFocusTrap():void{
        if(this.focusTrapHandler){
            document.removeEventListener("keydown",this.focusTrapHandler)
            this.focusTrapHandler=null
        }
    }

    private handleLoad():void{
        let input=document.createElement("input")
        input.type="file"
        input.accept=".txt"
        input.style.display="none"
        document.body.appendChild(input)
        input.addEventListener("change",()=>{
            let file=input.files?.[0]
            if(!file){
                input.remove()
                return
            }
            let reader=new FileReader()
            reader.onload=()=>{
                this.loadTemplate(reader.result as string)
                input.remove()
            }
            reader.onerror=()=>{
                console.error("Failed to read template file")
                showToast("Failed to read template file","error")
                input.remove()
            }
            reader.readAsText(file)
        })
        input.click()
    }

    private handleSave():void{
        let content=this.textarea.value
        if(!content.trim()){
            showToast("Cannot save an empty template","warning")
            return
        }
        let blob=new Blob([content],{type:"text/plain"})
        let url=URL.createObjectURL(blob)
        let a=document.createElement("a")
        a.href=url
        a.download="prompt_template.txt"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(()=>URL.revokeObjectURL(url),1000)
    }

    dispose():void{
        document.removeEventListener("keydown",this.handleKeydown)
        this.removeFocusTrap()
        if(this.overlay&&this.overlay.parentNode){
            this.overlay.parentNode.removeChild(this.overlay)
        }
    }
}
