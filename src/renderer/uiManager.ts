import type{OllamaModel,OllamaStatus,AppSettings,FullAppSettings}from"../types/index.js"
import{createVirtualList}from"./virtualList.js"
import{applyLanguage}from"./i18n.js"
import{encryptKey,decryptKey}from"./security.js"
import{listProfiles,saveProfile,loadProfile,deleteProfile}from"./configProfiles.js"

class UIManager{
    app:any
    progressText!:HTMLElement
    progressPercent!:HTMLElement
    progressFill!:HTMLElement
    processingLog!:HTMLElement
    outputPreview!:HTMLElement
    exportBtn!:HTMLButtonElement
    copyBtn!:HTMLButtonElement
    exportFormat!:HTMLSelectElement
    ollamaStatusEl!:HTMLElement
    settingsBtn!:HTMLElement
    settingsModal!:HTMLElement
    modalClose!:HTMLElement
    helpBtn!:HTMLElement
    modelSelect!:HTMLSelectElement
    processingType!:HTMLSelectElement
    outputFormat!:HTMLSelectElement
    languageSelect!:HTMLSelectElement
    chunkSize!:HTMLInputElement
    concurrencySelect!:HTMLSelectElement
    savePresetBtn!:HTMLElement
    demoBtn!:HTMLButtonElement
    providerSelect!:HTMLSelectElement
    apiKeyInput!:HTMLInputElement
    baseUrlInput!:HTMLInputElement
    apiKeyGroup!:HTMLElement
    baseUrlGroup!:HTMLElement
    smartSizingCheckbox!:HTMLInputElement
    profileSelect!:HTMLSelectElement
    saveProfileBtn!:HTMLElement
    deleteProfileBtn!:HTMLElement
    editTemplatesBtn!:HTMLElement
    dashboardBtn!:HTMLElement
    maxParallelFilesSelect!:HTMLSelectElement
    temperatureInput!:HTMLInputElement
    temperatureValue!:HTMLElement
    ollamaStatus:OllamaStatus
    intervals:number[]
    timeouts:number[]
    selectedLanguage:string
    uiLanguage:string
    logCount:number=0
    lastFocusedElement:HTMLElement|null=null

    constructor(app:any){
        this.app=app
        this.ollamaStatus={running:false,models:[]}
        this.selectedLanguage="en"
        this.uiLanguage="en"
        this.intervals=[]
        this.timeouts=[]
        this.lastFocusedElement=null
        this.cacheElements()
        this.initTemperatureSlider()
    }
    cacheElements():void{
        this.progressText=document.getElementById("progress-text") as HTMLElement
        this.progressPercent=document.getElementById("progress-percent") as HTMLElement
        this.progressFill=document.getElementById("progress-fill") as HTMLElement
        this.processingLog=document.getElementById("processing-log") as HTMLElement
        this.outputPreview=document.getElementById("output-preview") as HTMLElement
        this.exportBtn=document.getElementById("export-btn") as HTMLButtonElement
        this.copyBtn=document.getElementById("copy-btn") as HTMLButtonElement
        this.exportFormat=document.getElementById("export-format") as HTMLSelectElement
        this.ollamaStatusEl=document.getElementById("ollama-status") as HTMLElement
        this.settingsBtn=document.getElementById("settings-btn") as HTMLElement
        this.settingsModal=document.getElementById("settings-modal") as HTMLElement
        this.modalClose=document.querySelector(".modal-close") as HTMLElement
        this.helpBtn=document.getElementById("help-btn") as HTMLElement
        this.modelSelect=document.getElementById("model-select") as HTMLSelectElement
        this.processingType=document.getElementById("processing-type") as HTMLSelectElement
        this.outputFormat=document.getElementById("output-format") as HTMLSelectElement
        this.languageSelect=document.getElementById("language-select") as HTMLSelectElement
        this.chunkSize=document.getElementById("chunk-size") as HTMLInputElement
        this.concurrencySelect=document.getElementById("concurrency") as HTMLSelectElement
        this.savePresetBtn=document.getElementById("save-preset") as HTMLElement
        this.demoBtn=document.getElementById("demo-btn") as HTMLButtonElement
        this.providerSelect=document.getElementById("provider") as HTMLSelectElement
        this.apiKeyInput=document.getElementById("api-key") as HTMLInputElement
        this.baseUrlInput=document.getElementById("base-url") as HTMLInputElement
        this.apiKeyGroup=document.getElementById("api-key-group") as HTMLElement
        this.baseUrlGroup=document.getElementById("base-url-group") as HTMLElement
        this.smartSizingCheckbox=document.getElementById("smart-sizing") as HTMLInputElement
        this.profileSelect=document.getElementById("profile-select") as HTMLSelectElement
        this.saveProfileBtn=document.getElementById("save-profile-btn") as HTMLElement
        this.deleteProfileBtn=document.getElementById("delete-profile-btn") as HTMLElement
        this.editTemplatesBtn=document.getElementById("edit-templates-btn") as HTMLElement
        this.dashboardBtn=document.getElementById("dashboard-btn") as HTMLElement
        this.maxParallelFilesSelect=document.getElementById("max-parallel-files") as HTMLSelectElement
        this.temperatureInput=document.getElementById("temperature") as HTMLInputElement
        this.temperatureValue=document.getElementById("temperature-value") as HTMLElement
    }
    initTemperatureSlider():void{
        if(!this.temperatureInput||!this.temperatureValue)return
        this.temperatureInput.addEventListener("input",()=>this.updateTemperatureDisplay())
        this.temperatureInput.addEventListener("change",()=>{
            this.updateTemperatureDisplay()
            this.savePreset()
        })
        this.updateTemperatureDisplay()
    }
    updateTemperatureDisplay():void{
        if(!this.temperatureInput||!this.temperatureValue)return
        let value=parseFloat(this.temperatureInput.value)
        let min=parseFloat(this.temperatureInput.min)||0
        let max=parseFloat(this.temperatureInput.max)||1
        if(isNaN(value))value=0.7
        let percentage=((value-min)/(max-min))*100
        this.temperatureInput.style.setProperty("--range-fill",`${percentage}%`)
        this.temperatureValue.textContent=value.toFixed(1)
    }
    setProgress(percent:number,text:string):void{
        if(isNaN(percent)||!isFinite(percent))percent=0
        let clampedPercent=Math.max(0,Math.min(100,percent))
        this.progressFill.style.width=`${clampedPercent}%`
        this.progressPercent.textContent=`${Math.round(clampedPercent)}%`
        this.progressText.textContent=text
        // Update ARIA
        let progressBar=this.progressFill.closest('[role="progressbar"]')
        if(progressBar){
            progressBar.setAttribute("aria-valuenow",String(Math.round(clampedPercent)))
            progressBar.setAttribute("aria-valuetext",text)
        }
    }
    addLog(message:string,type:string="info"):void{
        let logEntry=document.createElement("div")
        logEntry.className=`log-entry ${type}`
        logEntry.innerHTML=`
            <i class="fas fa-${this.getLogIcon(type)}"></i>
            <span>${this.sanitizeText(message)}</span>
        `
        this.processingLog.appendChild(logEntry)
        this.processingLog.scrollTop=this.processingLog.scrollHeight
        this.logCount++
        if(this.logCount>50){
            let firstChild=this.processingLog.firstElementChild
            if(firstChild)firstChild.remove()
            this.logCount--
        }
    }
    getLogIcon(type:string):string{
        let icons:Record<string,string>={
            info:"info-circle",
            success:"check-circle",
            warning:"exclamation-triangle",
            error:"times-circle"
        }
        return icons[type]||"info-circle"
    }
    private outputPreviewTimer:ReturnType<typeof setTimeout>|null=null

    updateOutputPreviewDebounced():void{
        if(this.outputPreviewTimer){
            clearTimeout(this.outputPreviewTimer)
        }
        this.outputPreviewTimer=setTimeout(()=>{
            this.updateOutputPreview()
            this.outputPreviewTimer=null
        },200)
    }

    updateOutputPreview():void{
        let data=this.app.outputManager.outputData
        if(data.length===0){
            if(this.app.isProcessing){
                this.outputPreview.innerHTML='<pre><code><div class="skeleton" style="height:20px;width:60%;margin-bottom:8px"></div><div class="skeleton" style="height:20px;width:80%;margin-bottom:8px"></div><div class="skeleton" style="height:20px;width:40%"></div></code></pre>'
            }
            else{
                this.outputPreview.innerHTML="<pre><code>//No output data yet</code></pre>"
            }
            return
        }
        if(data.length>100){
            const ITEM_HEIGHT=28
            this.outputPreview.classList.add("virtual-list-container")
            createVirtualList({
                container:this.outputPreview,
                items:data,
                itemHeight:ITEM_HEIGHT,
                renderItem:(item)=>{
                    return `<pre style="margin:0;font-family:'Noto Sans',sans-serif;font-size:.875rem;line-height:${ITEM_HEIGHT}px;white-space:pre-wrap;word-wrap:break-word">${this.escapeHtml(JSON.stringify(item))}</pre>`
                }
            })
            return
        }
        this.outputPreview.classList.remove("virtual-list-container")
        let sample=data.slice(-3)
        let jsonStr=JSON.stringify(sample,null,2)
        let totalCount=data.length
        this.outputPreview.innerHTML=`<pre><code>// Total items: ${totalCount} (showing last 3)\n${this.escapeHtml(jsonStr)}</code></pre>`
        this.outputPreview.scrollTop=this.outputPreview.scrollHeight
    }
    escapeHtml(text:string):string{
        if(text==null)return""
        let div=document.createElement("div")
        div.textContent=String(text)
        return div.innerHTML
    }
    sanitizeText(text:string):string{
        if(text==null)return""
        // Remove null bytes and control characters except whitespace
        let sanitized=String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"")
        return this.escapeHtml(sanitized)
    }
    escapeCsvField(value:string):string{
        let escaped=value.replace(/"/g,'""')
        if(/^[=+\-@]/.test(escaped))escaped="'"+escaped
        return escaped
    }
    showModal(show:boolean):void{
        this.settingsModal.classList.toggle("active",show)
        if(show){
            this.settingsModal.style.display="flex"
            this.refreshProfiles()
            this.lastFocusedElement=document.activeElement as HTMLElement
            this.trapFocus(this.settingsModal)
            let focusable=this.settingsModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
            if(focusable.length>0){
                (focusable[0] as HTMLElement).focus()
            }
        }
        else{
            this.removeFocusTrap()
            this.restoreFocus()
            window.setTimeout(()=>{
                if(!this.settingsModal.classList.contains("active")){
                    this.settingsModal.style.display="none"
                }
            },parseFloat(getComputedStyle(this.settingsModal).transitionDuration||"0.15s")*1000)
        }
    }
    showCustomModal(content:string):void{
        let body=this.settingsModal.querySelector(".modal-body")
        if(body){
            body.innerHTML=content
            this.showModal(true)
        }
    }
    focusTrapHandler:((e:Event)=>void)|null=null
    trapFocus(modalElement:HTMLElement):void{
        if(this.focusTrapHandler)return
        let focusableSelector='button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        this.focusTrapHandler=(e:Event)=>{
            let ke=e as KeyboardEvent
            if(ke.key!=="Tab")return
            let activeModals=document.querySelectorAll(".modal.active")
            if(activeModals.length===0)return
            let activeModal=activeModals[activeModals.length-1] as HTMLElement
            let focusable=activeModal.querySelectorAll(focusableSelector)
            if(focusable.length===0)return
            let first=focusable[0] as HTMLElement
            let last=focusable[focusable.length-1] as HTMLElement
            if(ke.shiftKey){
                if(document.activeElement===first){
                    ke.preventDefault()
                    last.focus()
                }
            }
            else{
                if(document.activeElement===last){
                    ke.preventDefault()
                    first.focus()
                }
            }
        }
        document.addEventListener("keydown",this.focusTrapHandler)
    }
    removeFocusTrap():void{
        if(this.focusTrapHandler){
            document.removeEventListener("keydown",this.focusTrapHandler)
            this.focusTrapHandler=null
        }
    }
    restoreFocus():void{
        if(this.lastFocusedElement){
            this.lastFocusedElement.focus()
            this.lastFocusedElement=null
        }
    }
    showHelp():void{
        this.addLog("Opening help documentation...","info")
        let helpContent=`
            <h3><i class="fas fa-question-circle"></i>Training Generator Help</h3>
            <div class="help-section">
                <h4>Getting Started</h4>
                <p>1.<strong>Upload Files</strong>:Drag & drop or click to browse for documents(PDF,DOCX,DOC,RTF,TXT,MD,HTML)</p>
                <p>2.<strong>Configure Settings</strong>:Select model,processing type,output format,and chunk size</p>
                <p>3.<strong>Process Files</strong>:Click "Process Files" to convert documents to training data</p>
                <p>4.<strong>Export Results</strong>:Save or copy the generated training data</p>
            </div>
            <div class="help-section">
                <h4>Requirements</h4>
                <p>•<strong>Ollama</strong>:Must be installed and running for AI processing</p>
                <p>•<strong>Models</strong>:Pull models using<code>ollama pull <model-name></code></p>
                <p>•<strong>File Size</strong>:Maximum 100MB per file</p>
            </div>
            <div class="help-section">
                <h4>Troubleshooting</h4>
                <p>•<strong>Ollama Not Detected</strong>:Run<code>ollama serve</code>in terminal</p>
                <p>•<strong>PDF Extraction Issues</strong>:Try converting problematic PDFs to text first</p>
                <p>•<strong>Large Files</strong>:Processing may take longer for files>20MB</p>
            </div>
            <div class="help-section">
                <h4>Need More Help?</h4>
                <p>Visit the GitHub repository for documentation and issue reporting.</p>
            </div>
        `
        let helpModal=document.getElementById("help-modal") as HTMLElement|null
        if(!helpModal){
            helpModal=document.createElement("div")
            helpModal.id="help-modal"
            helpModal.className="modal"
            helpModal.setAttribute("role","dialog")
            helpModal.setAttribute("aria-modal","true")
            helpModal.setAttribute("aria-label","Help")
            helpModal.innerHTML=`
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-question-circle"></i>Help</h2>
                        <button class="modal-close help-close" aria-label="Close help">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${helpContent}
                    </div>
                </div>
            `
            document.body.appendChild(helpModal)
            helpModal.querySelector(".help-close")!.addEventListener("click",()=>{
                helpModal!.classList.remove("active")
            })
            helpModal.addEventListener("click",(e:Event)=>{
                if(e.target==helpModal){
                    helpModal!.classList.remove("active")
                }
            })
        }
        helpModal.classList.add("active")
        this.addLog("Help documentation opened","success")
    }
    async loadSettings():Promise<void>{
        try{
            let settings=JSON.parse(localStorage.getItem("train-generator-settings")||"{}") as AppSettings
            let validProcessingTypes=["instruction","conversation","chunking","custom"]
            let validOutputFormats=["jsonl","chatml","text","csv"]
            let validLanguages=["en","zh-Hans","zh-Hant","es","fr","de","ja","ko"]
            if(settings.model&&typeof settings.model==="string"&&settings.model.length>0)this.modelSelect.value=settings.model
            if(settings.processingType&&validProcessingTypes.includes(settings.processingType))this.processingType.value=settings.processingType
            if(settings.outputFormat&&validOutputFormats.includes(settings.outputFormat))this.outputFormat.value=settings.outputFormat
            if(settings.language&&validLanguages.includes(settings.language))this.languageSelect.value=settings.language
            if(settings.chunkSize){
                let n=parseInt(settings.chunkSize)
                if(!isNaN(n)&&n>=500&&n<=10000)this.chunkSize.value=String(n)
            }
            if(settings.provider)this.providerSelect.value=settings.provider
            if(settings.apiKey){
                let decrypted=await decryptKey(settings.apiKey)
                if(decrypted!=null){
                    this.apiKeyInput.value=decrypted
                    if(decrypted===settings.apiKey && decrypted.length>0){
                        let encrypted=await encryptKey(decrypted)
                        settings.apiKey=encrypted
                        try{
                            localStorage.setItem("train-generator-settings",JSON.stringify(settings))
                        }
                        catch{}
                    }
                }
                else{
                    this.apiKeyInput.value=""
                }
            }
            if(settings.baseUrl)this.baseUrlInput.value=settings.baseUrl
            if(settings.temperature){
                let t=parseFloat(settings.temperature)
                if(!isNaN(t)&&t>=0&&t<=1){
                    this.temperatureInput.value=String(t)
                    this.updateTemperatureDisplay()
                }
            }
            this.updateProviderVisibility()
            this.selectedLanguage=this.languageSelect.value||"en"
            this.addLog("Settings loaded","info")
        }
        catch(error){
            console.error("Failed to load settings:",error)
        }
    }
    async savePreset():Promise<void>{
        let apiKeyValue=this.apiKeyInput.value
        let encryptedApiKey=""
        if(apiKeyValue){
            encryptedApiKey=await encryptKey(apiKeyValue)
        }
        let settings:AppSettings={
            model:this.modelSelect.value,
            processingType:this.processingType.value,
            outputFormat:this.outputFormat.value,
            language:this.languageSelect.value,
            chunkSize:this.chunkSize.value,
            concurrency:this.concurrencySelect.value,
            provider:this.providerSelect.value,
            apiKey:encryptedApiKey,
            baseUrl:this.baseUrlInput.value,
            temperature:this.temperatureInput.value
        }
        try{
            localStorage.setItem("train-generator-settings",JSON.stringify(settings))
            let language=settings.language
            let processingType=settings.processingType
            let processingTypeMap:Record<string,string>={
                "instruction":"instruction",
                "conversation":"conversation",
                "chunking":"chunking",
                "custom":"custom"
            }
            let fileType=processingTypeMap[processingType!]||"instruction"
            let fileName=`${language}_${fileType}.txt`
            let promptPreview=""
            let possiblePaths=[
                `src/prompts/${fileName}`,
                `prompts/${fileName}`,
                `./prompts/${fileName}`,
                `../prompts/${fileName}`,
            ]
            for(let filePath of possiblePaths){
                try{
                    if(window.electronAPI&&window.electronAPI.readFile){
                        let result=await window.electronAPI.readFile(filePath)
                        if(result.success){
                            let loadedPrompt=result.content!
                            let previewLines=loadedPrompt.split("\n").slice(0,2).join(" ")
                            if(previewLines.length>100){
                                previewLines=previewLines.substring(0,100)+"..."
                            }
                            if(loadedPrompt.includes("{{text}}")){
                                let escapedPreviewLines=this.sanitizeText(previewLines)
                                promptPreview=`(prompt:"${escapedPreviewLines}")`
                            }
                            else{
                                promptPreview=""
                            }
                            break
                        }
                    }
                }
                catch(e){
                }
                try{
                    let response=await fetch(filePath)
                    if(response.ok){
                        let loadedPrompt=await response.text()
                        let previewLines=loadedPrompt.split("\n").slice(0,2).join(" ")
                        if(previewLines.length>100){
                            previewLines=previewLines.substring(0,100)+"..."
                        }
                        let escapedPreviewLines=this.sanitizeText(previewLines)
                        promptPreview=`(prompt:"${escapedPreviewLines}")`
                        break
                    }
                }
                catch(e){

                }
            }
            this.addLog(`Settings saved. Output language set to: ${settings.language}${promptPreview}`,"success")
            let nonLatinLanguages=["zh-Hans","zh-Hant","ja","ko"]
            if(nonLatinLanguages.includes(settings.language!)){
                this.addLog(`Note: ${settings.language}uses non-Latin script. Ensure your Ollama model supports this language.`,"warning")
            }
        }
        catch(error){
            console.error("Error in savePreset:",error)
            this.addLog(`Settings saved. Output language set to: ${settings.language}`,"success")
        }
    }
    initSettings():void{
        this.loadAppSettings()
        let resetSettingsBtn=document.getElementById("reset-settings")
        let saveSettingsBtn=document.getElementById("save-settings")
        if(resetSettingsBtn){
            resetSettingsBtn.addEventListener("click",()=>this.resetSettings())
        }
        if(saveSettingsBtn){
            saveSettingsBtn.addEventListener("click",()=>this.saveAppSettings())
        }
        if(this.profileSelect){
            this.profileSelect.addEventListener("change",()=>{
                let name=this.profileSelect.value
                if(name)this.applyProfile(name)
            })
        }
        if(this.saveProfileBtn){
            this.saveProfileBtn.addEventListener("click",()=>{
                let name=window.prompt("Enter a name for this profile:")
                if(name&&name.trim()){
                    this.saveCurrentProfile(name.trim())
                }
            })
        }
        if(this.deleteProfileBtn){
            this.deleteProfileBtn.addEventListener("click",()=>this.deleteCurrentProfile())
        }
        let uiLanguageSelect=document.getElementById("ui-language-select") as HTMLSelectElement|null
        if(uiLanguageSelect){
            let savedLang=localStorage.getItem("train-generator-ui-lang")
            if(savedLang){
                uiLanguageSelect.value=savedLang
                this.applyLanguage(savedLang)
            }
            uiLanguageSelect.addEventListener("change",()=>{
                this.applyLanguage(uiLanguageSelect.value)
            })
        }
        let settingsInputs=document.querySelectorAll("#settings-modal input,#settings-modal select")
        settingsInputs.forEach(input=>{
            input.addEventListener("change",()=>{
                let autoSave=document.getElementById("auto-save") as HTMLInputElement|null
                if(autoSave&&autoSave.checked){
                    this.saveAppSettings()
                }
            })
        })
    }
    loadAppSettings():void{
        try{
            let settings=JSON.parse(localStorage.getItem("training-generator-app-settings")||"{}") as FullAppSettings
            if(settings.theme){
                let themeSelect=document.getElementById("theme-select") as HTMLSelectElement|null
                if(themeSelect)themeSelect.value=settings.theme
                this.applyTheme(settings.theme)
            }
            if(settings.fontSize){
                let fontSizeSelect=document.getElementById("font-size") as HTMLSelectElement|null
                if(fontSizeSelect)fontSizeSelect.value=settings.fontSize
                this.applyFontSize(settings.fontSize)
            }
            let checkboxes:Array<keyof FullAppSettings>=["auto-save","auto-check-ollama","start-maximized","remember-window-size","smart-sizing"]
            checkboxes.forEach(id=>{
                let checkbox=document.getElementById(id as string) as HTMLInputElement|null
                if(checkbox&&settings[id]!=undefined){
                    checkbox.checked=settings[id] as boolean
                }
            })
            if(settings["max-file-size"]!=undefined){
                let maxFileSize=document.getElementById("max-file-size") as HTMLInputElement|null
                if(maxFileSize){
                    let n=parseInt(String(settings["max-file-size"]))
                    if(!isNaN(n)&&n>=10&&n<=1000)maxFileSize.value=String(n)
                }
            }
            if(settings.maxOutputItems!=undefined){
                let maxOutputItems=document.getElementById("max-output-items") as HTMLSelectElement|null
                if(maxOutputItems)maxOutputItems.value=String(settings.maxOutputItems)
            }
            if(settings.maxChunks!=undefined){
                let maxChunks=document.getElementById("max-chunks") as HTMLSelectElement|null
                if(maxChunks)maxChunks.value=String(settings.maxChunks)
            }
            if(settings.maxParallelFiles!=undefined){
                let maxParallelFiles=document.getElementById("max-parallel-files") as HTMLSelectElement|null
                if(maxParallelFiles)maxParallelFiles.value=settings.maxParallelFiles
            }
            this.addLog("Application settings loaded","info")
        }
        catch(error){
            console.error("Failed to load application settings:",error)
        }
    }
    saveAppSettings():void{
        try{
            let settings:FullAppSettings={}
            let themeSelect=document.getElementById("theme-select") as HTMLSelectElement|null
            if(themeSelect){
                settings.theme=themeSelect.value
                this.applyTheme(themeSelect.value)
            }
            let fontSizeSelect=document.getElementById("font-size") as HTMLSelectElement|null
            if(fontSizeSelect){
                settings.fontSize=fontSizeSelect.value
                this.applyFontSize(fontSizeSelect.value)
            }
            let checkboxes:Array<keyof FullAppSettings>=["auto-save","auto-check-ollama","start-maximized","remember-window-size","smart-sizing"]
            checkboxes.forEach(id=>{
                let checkbox=document.getElementById(id as string) as HTMLInputElement|null
                if(checkbox){
                    (settings as Record<string,unknown>)[id as string]=checkbox.checked
                }
            })
            let maxFileSize=document.getElementById("max-file-size") as HTMLInputElement|null
            if(maxFileSize){
                settings["max-file-size"]=parseInt(maxFileSize.value)||100
            }
            let maxParallelFiles=document.getElementById("max-parallel-files") as HTMLSelectElement|null
            if(maxParallelFiles){
                settings.maxParallelFiles=maxParallelFiles.value
            }
            let maxOutputItems=document.getElementById("max-output-items") as HTMLSelectElement|null
            if(maxOutputItems){
                settings.maxOutputItems=parseInt(maxOutputItems.value)||100000
            }
            let maxChunks=document.getElementById("max-chunks") as HTMLSelectElement|null
            if(maxChunks){
                settings.maxChunks=parseInt(maxChunks.value)||500
            }
            localStorage.setItem("training-generator-app-settings",JSON.stringify(settings))
            this.addLog("Application settings saved","success")
        }
        catch(error){
            this.addLog("Failed to save application settings","error")
        }
    }
    resetSettings():void{
        try{
            let themeSelect=document.getElementById("theme-select") as HTMLSelectElement|null
            if(themeSelect)themeSelect.value="auto"
            let fontSizeSelect=document.getElementById("font-size") as HTMLSelectElement|null
            if(fontSizeSelect)fontSizeSelect.value="medium"
            let autoSave=document.getElementById("auto-save") as HTMLInputElement|null
            if(autoSave)autoSave.checked=true
            let autoCheckOllama=document.getElementById("auto-check-ollama") as HTMLInputElement|null
            if(autoCheckOllama)autoCheckOllama.checked=true
            let startMaximized=document.getElementById("start-maximized") as HTMLInputElement|null
            if(startMaximized)startMaximized.checked=false
            let rememberWindowSize=document.getElementById("remember-window-size") as HTMLInputElement|null
            if(rememberWindowSize)rememberWindowSize.checked=true
            let smartSizing=document.getElementById("smart-sizing") as HTMLInputElement|null
            if(smartSizing)smartSizing.checked=true
            let maxFileSize=document.getElementById("max-file-size") as HTMLInputElement|null
            if(maxFileSize)maxFileSize.value="100"
            let maxOutputItems=document.getElementById("max-output-items") as HTMLSelectElement|null
            if(maxOutputItems)maxOutputItems.value="100000"
            let maxChunks=document.getElementById("max-chunks") as HTMLSelectElement|null
            if(maxChunks)maxChunks.value="500"
            let maxParallelFiles=document.getElementById("max-parallel-files") as HTMLSelectElement|null
            if(maxParallelFiles)maxParallelFiles.value="1"
            this.applyTheme("auto")
            this.applyFontSize("medium")
            this.saveAppSettings()
            this.addLog("Settings reset to defaults","success")
        }
        catch(error){
            this.addLog("Failed to reset settings","error")
        }
    }
    applyTheme(theme:string):void{
        document.body.classList.remove("theme-light","theme-dark")
        if(theme=="light"){
            document.body.classList.add("theme-light")
        }
        else if(theme=="dark"){
            document.body.classList.add("theme-dark")
        }
        else{
            if(window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches){
                document.body.classList.add("theme-dark")
            }
            else{
                document.body.classList.add("theme-light")
            }
        }
    }
    applyFontSize(size:string):void{
        document.body.classList.remove("font-small","font-medium","font-large")
        if(size=="small"){
            document.body.classList.add("font-small")
        }
        else if(size=="large"){
            document.body.classList.add("font-large")
        }
        else{
            document.body.classList.add("font-medium")
        }
    }
    applyLanguage(lang:string):void{
        this.uiLanguage=lang
        applyLanguage(lang)
        localStorage.setItem("train-generator-ui-lang",lang)
    }
    async refreshProfiles():Promise<void>{
        let profiles=await listProfiles()
        let currentValue=this.profileSelect.value
        this.profileSelect.innerHTML='<option value="" data-i18n="settings.profileSelect.default">-- Select a profile --</option>'
        for(let p of profiles){
            let option=document.createElement("option")
            option.value=p.name
            option.textContent=p.name
            this.profileSelect.appendChild(option)
        }
        if(currentValue&&profiles.some(p=>p.name===currentValue)){
            this.profileSelect.value=currentValue
        }
    }
    async applyProfile(name:string):Promise<void>{
        if(!name)return
        let profile=await loadProfile(name)
        if(!profile)return
        this.modelSelect.value=profile.model||""
        this.processingType.value=profile.processingType||"instruction"
        this.outputFormat.value=profile.outputFormat||"jsonl"
        this.languageSelect.value=profile.language||"en"
        this.chunkSize.value=profile.chunkSize||"2000"
        this.concurrencySelect.value=profile.concurrency||"3"
        this.providerSelect.value=profile.provider||"ollama"
        if(profile.baseUrl)this.baseUrlInput.value=profile.baseUrl
        if(profile.smartSizing!==undefined&&this.smartSizingCheckbox)this.smartSizingCheckbox.checked=profile.smartSizing
        this.updateProviderVisibility()
        this.selectedLanguage=profile.language||"en"
        if(this.app&&this.app.initProvider)this.app.initProvider()
        this.addLog(`Profile "${name}" applied`,"success")
    }
    async saveCurrentProfile(name:string):Promise<void>{
        let profile={
            name,
            model:this.modelSelect.value,
            processingType:this.processingType.value,
            outputFormat:this.outputFormat.value,
            language:this.languageSelect.value,
            chunkSize:this.chunkSize.value,
            concurrency:this.concurrencySelect.value,
            provider:this.providerSelect.value,
            baseUrl:this.baseUrlInput.value,
            smartSizing:this.smartSizingCheckbox?.checked??false,
            createdAt:new Date().toISOString()
        }
        await saveProfile(profile)
        await this.refreshProfiles()
        this.profileSelect.value=name
        this.addLog(`Profile "${name}" saved`,"success")
    }
    async deleteCurrentProfile():Promise<void>{
        let name=this.profileSelect.value
        if(!name)return
        let confirmed=window.confirm(`Delete profile "${name}"?`)
        if(!confirmed)return
        await deleteProfile(name)
        await this.refreshProfiles()
        this.addLog(`Profile "${name}" deleted`,"success")
    }
    updateModelSelect(models:OllamaModel[]):void{
        this.modelSelect.innerHTML=""
        if(models.length==0){
            let option=document.createElement("option")
            option.value=""
            option.textContent="Loading models..."
            option.disabled=true
            option.selected=true
            option.classList.add("skeleton")
            this.modelSelect.appendChild(option)
            return
        }
        models.forEach((model,index)=>{
            let option=document.createElement("option")
            let safeName=String(model.name||"").replace(/[\u0000-\u001F<>"'&]/g,"")
            option.value=safeName
            option.textContent=safeName
            this.modelSelect.appendChild(option)
            if(index==0){
                option.selected=true
            }
        })
        this.app.fileManager.updateProcessButton()
    }
    async checkOllamaStatus():Promise<OllamaStatus>{
        try{
            if(!window.electronAPI ||!window.electronAPI.checkOllama){
                console.warn("electronAPI not available,running in browser mode")
                this.ollamaStatusEl.querySelector("span")!.textContent="Ollama:Browser Mode"
                this.ollamaStatusEl.className="status-indicator status-offline"
                this.addLog("Running in browser mode(Ollama unavailable)","warning")
                return{running:false,models:[],error:"Browser mode"}
            }
            let status=await window.electronAPI.checkOllama()
            this.ollamaStatus=status
            if(status.running){
                let versionText=status.version&&status.version!=="unknown"?`v${String(status.version).replace(/[\x00-\x1F<>"'&]/g,"")}`:""
                this.ollamaStatusEl.querySelector("span")!.textContent=`Ollama:Online ${versionText}(${status.models.length}models)`
                this.ollamaStatusEl.className="status-indicator status-online"
                this.addLog(`Ollama is running(${status.version})with ${status.models.length}models`,"success")
                this.updateModelSelect(status.models)
            }
            else{
                this.ollamaStatusEl.querySelector("span")!.textContent="Ollama:Offline"
                this.ollamaStatusEl.className="status-indicator status-offline"
                this.addLog("Ollama is not running. Please start Ollama to process files.","error")
            }
            this.app.fileManager.updateProcessButton()
            return status
        }
        catch(error){
            console.error("Error checking Ollama status:",error)
            this.ollamaStatusEl.querySelector("span")!.textContent="Ollama:Error"
            this.ollamaStatusEl.className="status-indicator status-offline"
            this.addLog("Failed to check Ollama status","error")
            return{running:false,models:[],error:(error as Error).message}
        }
    }
    updateProviderVisibility():void{
        let isCloud=this.providerSelect.value!=="ollama"
        if(isCloud){
            this.apiKeyGroup.classList.remove("form-group-hidden")
            this.apiKeyGroup.classList.add("form-group-visible")
            this.baseUrlGroup.classList.remove("form-group-hidden")
            this.baseUrlGroup.classList.add("form-group-visible")
        }
        else{
            this.apiKeyGroup.classList.remove("form-group-visible")
            this.apiKeyGroup.classList.add("form-group-hidden")
            this.baseUrlGroup.classList.remove("form-group-visible")
            this.baseUrlGroup.classList.add("form-group-hidden")
        }
    }
    startOllamaMonitor():void{
        let intervalId=window.setInterval(()=>{
            this.checkOllamaStatus()
        },30000)
        this.intervals.push(intervalId)
    }
}

export default UIManager