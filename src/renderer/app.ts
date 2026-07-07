import type{SelectedFile,TrainingItem,ProcessFileResult}from"../types/index.js"
import PromptManager from"./promptManager.js"
import FileManager from"./fileManager.js"
import UIManager from"./uiManager.js"
import OutputManager from"./outputManager.js"
import Processor from"./processor.js"
import{createProvider}from"./provider.js"
import type{ProviderManager}from"./provider.js"
import{semanticChunk,simpleChunk}from"./chunker.js"
import{deduplicate}from"./deduplicator.js"
import{t}from"./i18n.js"
import{showToast}from"./toast.js"
import{Logger,LogLevel}from"./logger.js"
import{chunkInWorker,dedupInWorker}from"./workers/workerPool.js"
import{showConfirm}from"./confirm.js"
import{renderIcon}from"./icons.js"
import{saveCheckpoint,loadCheckpoint,clearCheckpoint}from"./checkpoint.js"
import{getCacheStats,resetCacheStats,warmCache}from"./cache.js"
import type{ProvenanceData}from"./provenance.js"
import{TemplateEditor}from"./templateEditor.js"
import{AuditTrail}from"./audit.js"
import{validateItems,type QualityReport}from"./qualityValidator.js"
import{Dashboard}from"./dashboard.js"
import{Devtools}from"./devtools.js"
import{initWindowControls}from"./windowControls.js"
import{OnboardingTour,DEFAULT_TOUR_STEPS,STORAGE_KEY}from"../core/onboardingTour.js"

class TrainGeneratorApp{
    fileManager:FileManager
    uiManager:UIManager
    outputManager:OutputManager
    promptManager:PromptManager
    processor:Processor
    templateEditor:TemplateEditor
    logger:Logger
    processingQueue:SelectedFile[]
    isProcessing:boolean
    checkpointInterval:number|null=null
    eventListeners:Array<{element:HTMLElement|Window|Document;event:string;handler:EventListener}>
    providerManager:ProviderManager|null=null
    audit:AuditTrail
    qualityReport:QualityReport|null=null
    dashboard:Dashboard
    devtools:Devtools

    constructor(){
        this.fileManager=new FileManager(this)
        this.uiManager=new UIManager(this)
        this.outputManager=new OutputManager(this)
        this.promptManager=new PromptManager()
        this.processor=new Processor()
        this.templateEditor=new TemplateEditor()
        this.logger=new Logger()
        this.processingQueue=[]
        this.isProcessing=false
        this.eventListeners=[]
        this.audit=new AuditTrail()
        this.dashboard=new Dashboard()
        this.devtools=new Devtools()
        this.init()
    }

    addLog(message:string,type:string="info"):void{
        let level:LogLevel=type==="error"?"error":type==="warning"?"warn":"info"
        this.logger[level]("app",message)
        this.uiManager.addLog(message,type)
    }
    setProgress(percent:number,text:string):void{
        this.uiManager.setProgress(percent,text)
    }
    updateOutputPreview():void{
        this.uiManager.updateOutputPreviewDebounced()
    }
    escapeHtml(text:string):string{
        return this.uiManager.escapeHtml(text)
    }
    sanitizeText(text:string):string{
        return this.uiManager.sanitizeText(text)
    }
    updateProcessButton():void{
        this.fileManager.updateProcessButton()
    }

    async detectPlatform():Promise<void>{
        try{
            let platform="unknown"
            if(window.electronAPI&&window.electronAPI.getPlatform){
                platform=await window.electronAPI.getPlatform()
            }
            else{
                let userAgent=navigator.userAgent.toLowerCase()
                if(userAgent.includes("win")){
                    platform="windows"
                }
                else if(userAgent.includes("mac")){
                    platform="macos"
                }
                else if(userAgent.includes("linux")){
                    platform="linux"
                }
            }
            document.documentElement.setAttribute("data-platform",platform)
        }
        catch(error){
            this.logger.error("app",t("log.detectPlatformFailed"),{error:(error as Error).message})
            document.documentElement.setAttribute("data-platform","unknown")
        }
    }
    async init():Promise<void>{
        if(document.readyState=="loading"){
            await new Promise<void>(resolve=>{document.addEventListener("DOMContentLoaded",()=>resolve())})
        }
        await this.detectPlatform()
        initWindowControls()
        window.addEventListener("unhandledrejection",(event)=>{
            this.logger.error("app",t("log.unhandledRejection"),{reason:String(event.reason)})
            showToast(t("toast.unexpectedError"),"error")
        })
        window.addEventListener("error",(event)=>{
            this.logger.error("app",t("log.unhandledError"),{message:event.message,filename:event.filename,lineno:event.lineno})
        })
        await this.checkForProgress()
        await this.loadCheckpointState()
        this.bindEvents()
        this.setupSplitter()
        this.logger.addListener((entry)=>{
            window.electronAPI?.writeLog?.(entry)
        })
        this.logger.addListener((entry)=>{
            this.devtools.addLog(entry)
        })
        this.uiManager.loadSettings()
        this.initProvider()
        this.processor.concurrency=parseInt(this.uiManager.concurrencySelect.value)||3
        this.uiManager.initSettings()
        await this.uiManager.checkOllamaStatus()
        this.uiManager.startOllamaMonitor()
        this.maybeStartTour()

    }
    maybeStartTour():void{
        try{
            if(typeof localStorage!=="undefined"&&localStorage.getItem(STORAGE_KEY)==="true"){
                return
            }
            let tour=new OnboardingTour({ steps: DEFAULT_TOUR_STEPS })
            window.setTimeout(()=>tour.start(), 500)
        }
        catch(error){
            this.logger.error("app",t("log.tourStartFailed"),{error:(error as Error).message})
        }
    }
    bindEvents():void{
        this.addEventListener(this.fileManager.dropZone,"dragover",this.fileManager.handleDragOver.bind(this.fileManager) as EventListener)
        this.addEventListener(this.fileManager.dropZone,"dragleave",this.fileManager.handleDragLeave.bind(this.fileManager) as EventListener)
        this.addEventListener(this.fileManager.dropZone,"drop",this.fileManager.handleDrop.bind(this.fileManager) as unknown as EventListener)
        this.addEventListener(this.fileManager.fileInput,"change",this.fileManager.handleFileSelect.bind(this.fileManager))
        this.addEventListener(this.fileManager.browseBtn,"click",(e)=>{
            e.stopPropagation()
            this.fileManager.fileInput.click()
        })
        this.addEventListener(this.fileManager.dropZone,"click",(e)=>{
            if(e.target!==this.fileManager.browseBtn&&!this.fileManager.browseBtn.contains(e.target as Node)){
                this.fileManager.fileInput.click()
            }
        })
        this.addEventListener(this.fileManager.dropZone,"keydown",(e)=>{
            let ke=e as KeyboardEvent
            if(ke.key===" "||ke.key==="Enter"){
                ke.preventDefault()
                this.fileManager.fileInput.click()
            }
        })
        this.addEventListener(this.fileManager.processBtn,"click",this.processFiles.bind(this))
        this.addEventListener(this.fileManager.clearBtn,"click",this.clearAll.bind(this))
        this.addEventListener(this.uiManager.exportBtn,"click",()=>{
            let format=this.uiManager.exportFormat?.value||"jsonl"
            this.audit.record("export_triggered",{format,itemCount:this.outputManager.outputData.length})
            this.outputManager.exportOutput(format)
        })
        this.addEventListener(this.uiManager.copyBtn,"click",this.outputManager.copyOutput.bind(this.outputManager))
        this.addEventListener(this.uiManager.savePresetBtn,"click",()=>{
            this.uiManager.savePreset.bind(this.uiManager)()
            this.audit.record("settings_changed",{
                model:this.uiManager.modelSelect.value,
                processingType:this.uiManager.processingType.value,
                outputFormat:this.uiManager.outputFormat.value,
                language:this.uiManager.languageSelect.value,
                provider:this.uiManager.providerSelect.value
            })
        })
        this.addEventListener(this.uiManager.settingsBtn,"click",()=>this.uiManager.showModal(true))
        this.addEventListener(this.uiManager.modalClose,"click",()=>this.uiManager.showModal(false))
        this.addEventListener(this.uiManager.settingsModal,"click",(e:Event)=>{
            if((e as MouseEvent).target==this.uiManager.settingsModal)this.uiManager.showModal(false)
        })
        this.addEventListener(this.uiManager.helpBtn,"click",async()=>{
            let module=await import("./helpContent.js")
            this.uiManager.showHelp()
        })
        let docsLink=document.getElementById("docs-link")
        if(docsLink){
            this.addEventListener(docsLink,"click",(e:Event)=>{
                e.preventDefault()
                this.openUserGuide()
            })
        }
        this.addEventListener(this.uiManager.providerSelect,"change",()=>{
            this.uiManager.updateProviderVisibility()
            this.initProvider()
        })
        this.addEventListener(this.uiManager.apiKeyInput,"change",()=>this.initProvider())
        this.addEventListener(this.uiManager.baseUrlInput,"change",()=>this.initProvider())
        this.addEventListener(this.uiManager.demoBtn,"click",()=>{
            if(this.processor.demoMode){
                this.processor.disableDemoMode()
                this.uiManager.demoBtn.innerHTML=`${renderIcon("fa-magic")} ${t("processing.demo")}`
                this.uiManager.demoBtn.classList.remove("active")
                this.logger.info("app",t("log.demoModeDisabled"))
                this.fileManager.updateProcessButton()
            }
            else{
                this.processor.enableDemoMode()
                this.uiManager.demoBtn.innerHTML=`${renderIcon("fa-magic")} ${t("processing.demoActive")}`
                this.uiManager.demoBtn.classList.add("active")
                this.logger.info("app",t("log.demoModeEnabled"))
                this.fileManager.updateProcessButton()
            }
        })
        this.addEventListener(this.uiManager.editTemplatesBtn,"click",()=>{
            this.templateEditor.show()
        })
        if(this.uiManager.dashboardBtn){
            this.addEventListener(this.uiManager.dashboardBtn,"click",()=>{
                this.dashboard.toggle()
            })
        }
        // Global keyboard shortcuts
        this.addEventListener(document,"keydown",((e:KeyboardEvent)=>{
            let tag=(e.target as HTMLElement).tagName
            if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return
            if(e.ctrlKey||e.metaKey){
                switch(e.key.toLowerCase()){
                    case"o":
                        e.preventDefault()
                        this.fileManager.fileInput.click()
                        break
                    case"enter":
                        e.preventDefault()
                        if(this.isProcessing){
                            this.stopProcessing()
                        }
                        else if(this.fileManager.selectedFiles.length>0){
                            this.processFiles()
                        }
                        break
                    case"e":
                        e.preventDefault()
                        let fmt=this.uiManager.exportFormat?.value||"jsonl"
                        this.outputManager.exportOutput(fmt)
                        break
                    case"k":
                        e.preventDefault()
                        this.showShortcutsHelp()
                        break
                }
                if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==="c"){
                    e.preventDefault()
                    this.outputManager.copyOutput()
                }
                if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==="d"){
                    e.preventDefault()
                    this.devtools.toggle()
                }
            }
            if(e.key==="Escape"){
                if(this.isProcessing){
                    this.stopProcessing()
                }
                else{
                    let activeModals=document.querySelectorAll(".modal.active")
                    if(activeModals.length>0){
                        let topModal=activeModals[activeModals.length-1] as HTMLElement
                        if(topModal===this.uiManager.settingsModal){
                            this.uiManager.showModal(false)
                        }
                        else{
                            topModal.classList.remove("active")
                        }
                    }
                }
            }
        }) as EventListener)
        this.addEventListener(window,"beforeunload",(e:Event)=>{
            if(this.isProcessing){
                e.preventDefault();
                (e as BeforeUnloadEvent).returnValue=""
            }
        })
    }
    stopProcessing():void{
        this.processor.abort()
        this.isProcessing=false
        this.dashboard.stop()
        if(this.checkpointInterval!==null){
            window.clearInterval(this.checkpointInterval)
            this.checkpointInterval=null
        }
        this.fileManager.processBtn.disabled=false
        this.fileManager.processBtn.innerHTML=`${renderIcon("fa-play")} ${t("processing.start")}`
        this.fileManager.clearBtn.disabled=false
        this.fileManager.browseBtn.removeAttribute("disabled")
        this.fileManager.fileInput.disabled=false
        if(this.outputManager.outputData.length>0){
            this.uiManager.exportBtn.disabled=false
            this.uiManager.copyBtn.disabled=false
        }
        this.setProgress(0,t("processing.stopped"))
        let progressSection=this.uiManager.progressFill.closest(".progress-section")
        if(progressSection)progressSection.classList.add("stopped")
        this.logger.warn("app",t("log.processingStopped"))
        this.audit.record("processing_stopped",{})
    }
    showShortcutsHelp():void{
        let shortcuts=[
            ["Ctrl+O",t("shortcuts.selectFiles")],
            ["Ctrl+Enter",t("shortcuts.startStop")],
            ["Ctrl+E",t("shortcuts.export")],
            ["Ctrl+Shift+C",t("shortcuts.copy")],
            ["Ctrl+Shift+D",t("shortcuts.devtools")],
            ["Ctrl+K",t("shortcuts.help")],
            ["Escape",t("shortcuts.close")],
            ["Tab / Shift+Tab",t("shortcuts.navigate")],
            ["Space",t("shortcuts.toggle")],
        ]
        let html=`<div class="shortcuts-help"><h3>${t("shortcuts.title")}</h3><table>`
        for(let[key,desc]of shortcuts){
            html+=`<tr><td><kbd>${key}</kbd></td><td>${desc}</td></tr>`
        }
        html+='</table></div>'
        this.uiManager.showCustomModal(html)
    }
    async openUserGuide():Promise<void>{
        try{
            if(window.electronAPI&&window.electronAPI.openUserGuide){
                let result=await window.electronAPI.openUserGuide()
                if(!result.success){
                    this.addLog(t("log.openUserGuideFailed",undefined,{error:result.error||""}),"error")
                }
                else{
                    this.addLog(t("log.openedUserGuide"),"success")
                }
            }
            else{
                this.addLog(t("log.userGuideElectronOnly"),"warning")
            }
        }
        catch(error){
            this.addLog(t("log.openUserGuideFailed",undefined,{error:(error as Error).message}),"error")
        }
    }
    initProvider():void{
        try{
            this.providerManager?.stopHealthChecks()
            let type=this.uiManager.providerSelect.value
            let config={
                apiKey:this.uiManager.apiKeyInput.value,
                baseUrl:this.uiManager.baseUrlInput.value
            }
            this.providerManager=createProvider(type,config)
            this.processor.provider=this.providerManager
            this.providerManager.startHealthChecks(60000)
            this.logger.info("app",t("log.providerSet",undefined,{type}))
        }
        catch(error){
            this.logger.error("app",t("log.providerInitFailed",undefined,{error:(error as Error).message}))
        }
    }

    async processFiles():Promise<void>{
        if(this.isProcessing){
            this.logger.warn("app",t("log.processingAlreadyInProgress"))
            return
        }
        if(this.fileManager.selectedFiles.length==0){
            this.logger.warn("app",t("log.noFilesToProcess"))
            return
        }
        if(!this.uiManager.ollamaStatus.running && !this.processor.demoMode){
            this.logger.error("app",t("log.cannotProcessOllamaOffline"))
            showToast(t("toast.ollamaNotRunning"),"error")
            return
        }
        this.isProcessing=true
        this.outputManager.outputData=[]
        this.processingQueue=[...this.fileManager.selectedFiles]
        let progressSection=this.uiManager.progressFill.closest(".progress-section")
        if(progressSection)progressSection.classList.remove("stopped")
        // Start checkpoint interval
        this.checkpointInterval=window.setInterval(()=>{
            let completedChunks:Record<string,number>={}
            for(let file of this.processingQueue){
                let status=this.fileManager.fileStatuses.get(file.name)
                if(status==="completed")completedChunks[file.name]=1
                else completedChunks[file.name]=0
            }
            saveCheckpoint({
                files:this.fileManager.selectedFiles,
                completedChunks,
                outputData:this.outputManager.outputData,
                config:{
                    model:this.uiManager.modelSelect.value,
                    processingType:this.uiManager.processingType.value,
                    chunkSize:parseInt(this.uiManager.chunkSize.value)||2000,
                    concurrency:parseInt(this.uiManager.concurrencySelect.value)||3,
                    provider:this.uiManager.providerSelect.value
                },
                timestamp:Date.now()
            })
        },30000)
        for(let file of this.processingQueue){
            this.fileManager.setFileStatus(file.name,"waiting")
        }
        this.fileManager.processBtn.disabled=true
        this.fileManager.processBtn.innerHTML=`<span class="tg-spinner">${renderIcon("fa-spinner")}</span>${t("processing.running")}`
        this.fileManager.clearBtn.disabled=true
        this.uiManager.exportBtn.disabled=true
        this.uiManager.copyBtn.disabled=true
        this.fileManager.browseBtn.setAttribute("disabled","")
        this.fileManager.fileInput.disabled=true
        this.setProgress(0,t("processing.starting"))
        this.logger.info("app",t("log.startingProcessing",undefined,{count:String(this.fileManager.selectedFiles.length)}))
        this.logger.info("app",t("log.processingTimeEstimate"))
        this.audit.record("processing_started",{
            fileCount:this.fileManager.selectedFiles.length,
            model:this.uiManager.modelSelect.value,
            provider:this.uiManager.providerSelect.value,
            processingType:this.uiManager.processingType.value
        })
        try{
            let totalItemsGenerated=0
            let successfulFiles=0
            let failedFiles=0
            let totalChunks=0
            let processedChunks=0

            // --- Pre-fetching pipeline ---
            this.setProgress(0,t("processing.preloading"))
            this.logger.info("app",t("processing.preloadingDetail",undefined,{count:String(this.processingQueue.length)}))

            type PreloadedEntry={file:SelectedFile;chunks:string[]}
            let preloadedData:PreloadedEntry[]=[]

            // Step 1: Read all file contents in parallel
            let readPromises=this.processingQueue.map(async(file):Promise<{file:SelectedFile;textContent:string}>=>{
                let textContent:string
                if(file.file&&file.file instanceof File){
                    if(file.type=="pdf"){
                        if(file.path){
                            let result=await window.electronAPI!.parseFile(file.path,"pdf")
                            if(!result.success){
                                this.logger.warn("app",t("log.pdfParseFallback",undefined,{name:file.name}))
                                let arrayBuffer=await this.readFileAsArrayBuffer(file.file)
                                textContent=await this.extractTextFromPDFBuffer(arrayBuffer)
                            }else{
                                textContent=result.content!
                            }
                        }else{
                            let arrayBuffer=await this.readFileAsArrayBuffer(file.file)
                            textContent=await this.extractTextFromPDFBuffer(arrayBuffer)
                        }
                    }else{
                        textContent=await this.readFileContent(file.file)
                    }
                }else if(file.path){
                    let result=await window.electronAPI!.parseFile(file.path,file.type)
                    if(!result.success){
                        throw new Error(result.error)
                    }
                    textContent=result.content!
                }else{
                    throw new Error(t("error.noFileOrPath"))
                }
                return{file,textContent}
            })

            let readResults=await Promise.all(readPromises)
            this.setProgress(0,t("processing.chunking",undefined,{current:"0",total:String(this.processingQueue.length)}))
            this.logger.info("app",t("log.preloadComplete"))

            // Step 2: Pre-chunk all files
            let chunkSize=Math.min(10000,Math.max(500,parseInt(this.uiManager.chunkSize.value)||8000))
            for(let i=0;i<readResults.length;i++){
                let{file,textContent}=readResults[i]
                this.setProgress(0,t("processing.chunking",undefined,{current:String(i+1),total:String(this.processingQueue.length)}))
                if(!textContent||textContent.trim().length==0){
                    preloadedData.push({file,chunks:[]})
                }else{
                    let smartSizing=this.uiManager.smartSizingCheckbox?.checked??false
                    let chunks=await chunkInWorker(textContent,chunkSize,100,smartSizing)
                    if(chunks.length===0){
                        chunks=simpleChunk(textContent,chunkSize)
                    }
                    preloadedData.push({file,chunks})
                }
            }

            this.setProgress(0,t("processing.prechunkingComplete"))
            this.logger.info("app",t("log.prechunkingComplete"))

            let fileChunkMap=new Map<typeof preloadedData[0],number>()
            for(let entry of preloadedData){
                let estimatedFileChunks=Math.max(1,entry.chunks.length||Math.ceil((entry.file.size||10000)/chunkSize))
                fileChunkMap.set(entry,estimatedFileChunks)
                totalChunks+=estimatedFileChunks
            }
            // --- End pre-fetching pipeline ---

            // Start dashboard
            this.dashboard.start()
            this.dashboard.update({
                chunksTotal:totalChunks,
                activeProvider:this.uiManager.providerSelect.value||"--"
            })

            // Parallel file processing with concurrency limit
            let maxParallel=parseInt(this.uiManager.maxParallelFilesSelect?.value||"1")||1
            let queue=[...preloadedData]
            let running=0
            let completedFiles=0

            await new Promise<void>((resolve)=>{
                let processNext=()=>{
                    if(queue.length===0&&running===0){
                        resolve()
                        return
                    }
                    // Resource-aware throttling: check memory
                    if(performance&&(performance as any).memory){
                        let mem=(performance as any).memory as {usedJSHeapSize:number;jsHeapSizeLimit:number}
                        if(mem.jsHeapSizeLimit>0&&(mem.usedJSHeapSize/mem.jsHeapSizeLimit)>0.8){
                            // Reduce effective concurrency when memory is tight
                            let effectiveConcurrency=Math.max(1,Math.floor(maxParallel/2))
                            if(running>=effectiveConcurrency&&queue.length>0){
                                return  // Wait for a slot to free up
                            }
                        }
                    }
                    while(running<maxParallel&&queue.length>0){
                        let entry=queue.shift()!
                        let file=entry.file
                        let fileChunks=fileChunkMap.get(entry)!
                        let fileIndex=completedFiles
                        running++
                        this.fileManager.setFileStatus(file.name,"processing")
                        this.logger.info("app",t("log.processingFile",undefined,{index:String(fileIndex+1),total:String(this.processingQueue.length),name:file.name}))
                        this.processFile(file,(chunksProcessed:number,totalChunksInFile:number)=>{
                            this.setProgress(
                                ((processedChunks+(chunksProcessed/totalChunksInFile)*fileChunks)/totalChunks)*100,
                                t("processing.fileChunk",undefined,{name:file.name,current:String(chunksProcessed),total:String(totalChunksInFile)})
                            )
                            this.dashboard.update({
                                chunksDone:processedChunks+Math.floor((chunksProcessed/totalChunksInFile)*fileChunks),
                                activeProvider:this.uiManager.providerSelect.value||"--"
                            })
                            let cs=getCacheStats()
                            this.dashboard.update({
                                cacheHitRate:cs.totalRequests>0?Math.round((cs.hits/cs.totalRequests)*100):0
                            })
                        },entry.chunks).then((result:ProcessFileResult)=>{
                            processedChunks+=fileChunks
                            completedFiles++
                            running--
                            if(result.success){
                                this.fileManager.setFileStatus(file.name,"completed")
                                this.outputManager.outputData.push(...result.data!)
                                totalItemsGenerated+=result.data!.length
                                successfulFiles++
                                this.logger.info("app",t("log.fileProcessedSuccess",undefined,{name:file.name,count:String(result.data!.length)}))
                            }
                            else{
                                this.fileManager.setFileStatus(file.name,"failed")
                                failedFiles++
                                this.logger.error("app",t("log.fileProcessedError",undefined,{name:file.name,error:result.error||""}))
                            }
                            this.setProgress(
                                Math.min(99,(processedChunks/totalChunks)*100),
                                t("processing.filesProgress",undefined,{completed:String(completedFiles),total:String(this.processingQueue.length)})
                            )
                            this.dashboard.update({
                                chunksDone:processedChunks,
                                activeProvider:this.uiManager.providerSelect.value||"--"
                            })
                            let cs=getCacheStats()
                            this.dashboard.update({
                                cacheHitRate:cs.totalRequests>0?Math.round((cs.hits/cs.totalRequests)*100):0
                            })
                            processNext()
                        })
                    }
                }
                processNext()
            })

            this.setProgress(100,t("processing.complete"))
            let summaryMessage=successfulFiles>0
                ?t("toast.processingSummarySuccess",undefined,{successful:String(successfulFiles),total:String(this.processingQueue.length),count:String(totalItemsGenerated)})
                :t("toast.processingSummaryWarning",undefined,{successful:String(successfulFiles),total:String(this.processingQueue.length),failed:String(failedFiles),count:String(totalItemsGenerated)})
            if(successfulFiles>0){
                this.logger.info("app",summaryMessage)
            }
            else{
                this.logger.warn("app",summaryMessage)
            }
            showToast(summaryMessage,successfulFiles>0?"success":"warning")
            this.audit.record("processing_completed",{itemsGenerated:totalItemsGenerated,successfulFiles,failedFiles})
            await clearCheckpoint()
            this.uiManager.updateOutputPreview()
            if(this.outputManager.outputData.length>0){
                this.uiManager.exportBtn.disabled=false
                this.uiManager.copyBtn.disabled=false
                this.logger.info("app",t("log.outputReady",undefined,{count:String(this.outputManager.outputData.length)}))
            }
            this.fileManager.filesCountEl.textContent=String(this.fileManager.selectedFiles.length)
            this.fileManager.lastProcessedEl.textContent=new Date().toLocaleTimeString()
        }
        catch(error){
            this.logger.error("app",t("processing.failed"),{error:(error as Error).message})
            showToast(t("toast.processingFailed"),"error")
            this.setProgress(0,t("processing.failed"))
            this.logger.warn("app",t("log.checkOllamaConnection"))
        }
        finally{
            this.isProcessing=false
            this.dashboard.stop()
            if(this.checkpointInterval!==null){
                window.clearInterval(this.checkpointInterval)
                this.checkpointInterval=null
            }
            this.fileManager.processBtn.disabled=false
            this.fileManager.processBtn.innerHTML=`${renderIcon("fa-play")}${t("processing.start")}`
            this.fileManager.clearBtn.disabled=false
            this.fileManager.browseBtn.removeAttribute("disabled")
            this.fileManager.fileInput.disabled=false
            if(this.outputManager.outputData.length==0){
                this.uiManager.exportBtn.disabled=true
                this.uiManager.copyBtn.disabled=true
            }
            if(this.outputManager.outputData.length>0){
                this.qualityReport=validateItems(this.outputManager.outputData)
            }
            this.showStats()
        }
    }
    showStats():void{
        let r=this.processor.stats.report
        let warnings=this.processor.stats.checkWarnings(this.outputManager.outputData.length)
        let warningsHtml=""
        if(warnings.length>0){
            warningsHtml='<div class="stats-warnings">'+warnings.map(w=>`<p class="warning">${w}</p>`).join("")+'</div>'
        }
        let cs=getCacheStats()
        let hitRate=cs.totalRequests>0?Math.round((cs.hits/cs.totalRequests)*100):0
        let as=this.audit.getSummary()
        let auditOpsHtml=""
        let labelSuffix=t("common.labelSuffix")
        for(let op in as.operations){
            let opLabel=t(`audit.${op}`)
            if(opLabel===`audit.${op}`)opLabel=op
            auditOpsHtml+=`<tr><td>${opLabel}${labelSuffix}</td><td>${as.operations[op]}</td></tr>`
        }
        let qrHtml=""
        if(this.qualityReport){
            qrHtml=`<div class="settings-actions">
                <button id="quality-report-btn" class="btn btn-secondary" aria-label="${t("qualityReport.viewAria")}">
                    ${renderIcon("fa-clipboard-check")} ${t("qualityReport.buttonLabel",undefined,{rate:String(this.qualityReport.passRate),count:String(this.qualityReport.flaggedItems)})}
                </button>
            </div>`
        }
        let html=`<div class="stats-panel">
            <h3>${t("stats.title")}</h3>
            <table>
                <tr><td>${t("stats.totalChunks")}${labelSuffix}</td><td>${r.totalChunks}</td></tr>
                <tr><td>${t("stats.successful")}${labelSuffix}</td><td>${r.successfulChunks}</td></tr>
                <tr><td>${t("stats.failed")}${labelSuffix}</td><td>${r.failedChunks}</td></tr>
                <tr><td>${t("stats.successRate")}${labelSuffix}</td><td>${r.successRate}${t("common.percent")}</td></tr>
                <tr><td>${t("stats.promptTokens")}${labelSuffix}</td><td>${r.promptTokens.toLocaleString()}</td></tr>
                <tr><td>${t("stats.responseTokens")}${labelSuffix}</td><td>${r.totalTokens.toLocaleString()}</td></tr>
                <tr><td>${t("stats.timeElapsed")}${labelSuffix}</td><td>${r.elapsedFormatted}</td></tr>
                <tr><td>${t("stats.tokensPerSecond")}${labelSuffix}</td><td>${r.tokensPerSecond.toLocaleString()}</td></tr>
                <tr><td>${t("stats.duplicatesRemoved")}${labelSuffix}</td><td>${r.deduplicatedCount}</td></tr>
            </table>
            <h3>${t("stats.cacheTitle")}</h3>
            <table>
                <tr><td>${t("stats.cache.hits")}${labelSuffix}</td><td>${cs.hits}</td></tr>
                <tr><td>${t("stats.cache.misses")}${labelSuffix}</td><td>${cs.misses}</td></tr>
                <tr><td>${t("stats.cache.totalRequests")}${labelSuffix}</td><td>${cs.totalRequests}</td></tr>
                <tr><td>${t("stats.cache.hitRate")}${labelSuffix}</td><td>${hitRate}${t("common.percent")}</td></tr>
                <tr><td>${t("stats.cache.tokensSaved")}${labelSuffix}</td><td>${cs.estimatedTokensSaved.toLocaleString()}</td></tr>
                <tr><td>${t("stats.cache.costSaved")}${labelSuffix}</td><td>${t("devtools.cache.currencyPrefix")}${cs.estimatedCostSaved.toFixed(4)}</td></tr>
            </table>
            <h3>${t("stats.auditTitle")}</h3>
            <table>
                <tr><td>${t("stats.audit.totalOperations")}${labelSuffix}</td><td>${as.totalOperations}</td></tr>
                ${auditOpsHtml}
            </table>
            <div class="settings-actions">
                <button id="warm-cache-btn" class="btn btn-secondary" aria-label="${t("stats.warmCacheAria")}">
                    ${renderIcon("fa-database")} ${t("stats.warmCache")}
                </button>
            </div>
            ${qrHtml}
            ${warningsHtml}
        </div>`
        this.logger.info("app",t("stats.processingComplete",undefined,{successful:String(r.successfulChunks),total:String(r.totalChunks),rate:String(r.successRate),tokens:r.totalTokens.toLocaleString(),time:r.elapsedFormatted}))
        this.uiManager.showCustomModal(html)
        // Wire up the warm cache button after DOM is inserted
        setTimeout(()=>{
            let warmBtn=document.getElementById("warm-cache-btn")
            if(warmBtn){
                warmBtn.addEventListener("click",()=>this.handleWarmCache())
            }
            let qrBtn=document.getElementById("quality-report-btn")
            if(qrBtn){
                qrBtn.addEventListener("click",()=>this.showQualityReport())
            }
        },100)
    }
    showQualityReport():void{
        if(!this.qualityReport)return
        let r=this.qualityReport
        let labelSuffix=t("common.labelSuffix")
        let breakdownHtml=""
        for(let reason in r.breakdown){
            let reasonLabel=t(`qualityReport.reason.${reason}`)
            if(reasonLabel===`qualityReport.reason.${reason}`)reasonLabel=reason
            breakdownHtml+=`<tr><td>${reasonLabel}${labelSuffix}</td><td>${r.breakdown[reason]}</td></tr>`
        }
        let flagsHtml=""
        let maxFlags=20
        for(let i=0;i<Math.min(r.flags.length,maxFlags);i++){
            let f=r.flags[i]
            let preview=this.escapeHtml((f.item.instruction||f.item.input||f.item.messages?.map(m=>m.content).join(" ")||"").substring(0,100))
            let reasons=f.reasons.map(reason=>{
                let reasonLabel=t(`qualityReport.reason.${reason}`)
                if(reasonLabel===`qualityReport.reason.${reason}`)return reason
                return reasonLabel
            }).join(", ")
            flagsHtml+=`<tr><td>#${f.itemIndex+1}</td><td class="flag-reasons">${reasons}</td><td class="flag-preview">${preview}${t("common.ellipsis")}</td></tr>`
        }
        let moreHtml=r.flags.length>maxFlags?t("qualityReport.moreFlagged",undefined,{count:String(r.flags.length-maxFlags)}):""
        let html=`<div class="quality-report">
            <h3>${t("qualityReport.title")}</h3>
            <table>
                <tr><td>${t("qualityReport.totalItems")}${labelSuffix}</td><td>${r.totalItems}</td></tr>
                <tr><td>${t("qualityReport.flaggedItems")}${labelSuffix}</td><td>${r.flaggedItems}</td></tr>
                <tr><td>${t("qualityReport.passRate")}${labelSuffix}</td><td>${r.passRate}${t("common.percent")}</td></tr>
            </table>
            <h4>${t("qualityReport.breakdown")}</h4>
            <table>${breakdownHtml||`<tr><td colspan='2'>${t("qualityReport.noIssues")}</td></tr>`}</table>
            ${r.flags.length>0?`<h4>${t("qualityReport.flaggedItemsTitle",undefined,{count:String(Math.min(r.flags.length,maxFlags))})}</h4><table><tr><th>${t("qualityReport.column.index")}</th><th>${t("qualityReport.column.reasons")}</th><th>${t("qualityReport.column.preview")}</th></tr>${flagsHtml}</table>${moreHtml}`:""}
        </div>`
        this.uiManager.showCustomModal(html)
    }
    async handleWarmCache():Promise<void>{
        try{
            let fileInput=document.createElement("input")
            fileInput.type="file"
            fileInput.accept=".json,.jsonl"
            fileInput.addEventListener("change",async()=>{
                let file=fileInput.files?.[0]
                if(!file)return
                try{
                    let text=await file.text()
                    let items:any[]=[]
                    // Try JSON array first
                    try{
                        items=JSON.parse(text)
                        if(!Array.isArray(items))items=[]
                    }
                    catch{
                        // Try JSONL (one JSON object per line)
                        let lines=text.split("\n").filter(l=>l.trim())
                        for(let line of lines){
                            try{items.push(JSON.parse(line))}catch(e){}
                        }
                    }
                    if(items.length===0){
                        showToast(t("toast.noValidItems"),"error")
                        return
                    }
                    let model=this.uiManager.modelSelect.value
                    let language=this.uiManager.languageSelect.value||"en"
                    let prompt=await this.promptManager.getPromptWithFallback(language,this.uiManager.processingType.value)||""
                    let warmed=await warmCache(items,model,prompt)
                    showToast(t("toast.cacheWarmed",undefined,{warmed:String(warmed),total:String(items.length)}),"success")
                    this.addLog(t("log.cacheWarmed",undefined,{warmed:String(warmed)}),"success")
                }
                catch(err){
                    showToast(t("toast.readFileFailed",undefined,{error:(err as Error).message}),"error")
                }
            })
            fileInput.click()
        }
        catch(err){
            showToast(t("toast.warmCacheFailed",undefined,{error:(err as Error).message}),"error")
        }
    }
    async processFile(fileObj:SelectedFile,progressCallback?:(chunksProcessed:number,totalChunks:number)=>void,preloadedChunks?:string[]):Promise<ProcessFileResult>{
        try{
            let chunks:string[]
            if(preloadedChunks!==undefined){
                chunks=preloadedChunks
            }else{
                let textContent:string
                if(fileObj.file&&fileObj.file instanceof File){
                    if(fileObj.type=="pdf"){
                        if(fileObj.path){
                            let result=await window.electronAPI!.parseFile(fileObj.path,"pdf")
                            if(!result.success){
                                this.logger.warn("app",t("log.pdfParseFallback",undefined,{name:fileObj.name}))
                                let arrayBuffer=await this.readFileAsArrayBuffer(fileObj.file)
                                textContent=await this.extractTextFromPDFBuffer(arrayBuffer)
                            }
                            else{
                                textContent=result.content!
                            }
                        }
                        else{
                            let arrayBuffer=await this.readFileAsArrayBuffer(fileObj.file)
                            textContent=await this.extractTextFromPDFBuffer(arrayBuffer)
                        }
                    }
                    else{
                        textContent=await this.readFileContent(fileObj.file)
                    }
                }
                else if(fileObj.path){
                    let result=await window.electronAPI!.parseFile(fileObj.path,fileObj.type)
                    if(!result.success){
                        throw new Error(result.error)
                    }
                    textContent=result.content!
                }
                else{
                    throw new Error(t("error.noFileOrPath"))
                }
                if(!textContent||textContent.trim().length==0){
                    throw new Error(t("error.noTextContent"))
                }
                let chunkSize=Math.min(10000,Math.max(500,parseInt(this.uiManager.chunkSize.value)||8000))
                let smartSizing=this.uiManager.smartSizingCheckbox?.checked??false
                chunks=await chunkInWorker(textContent,chunkSize,100,smartSizing)
                if(chunks.length===0){
                    chunks=simpleChunk(textContent,chunkSize)
                }
                textContent=(null as any) // Allow GC of text content
            }
            if(chunks.length==0){
                throw new Error(t("error.noChunksCreated"))
            }
            let processedChunks:TrainingItem[]=[]
            let model=this.uiManager.modelSelect.value
            let processingType=this.uiManager.processingType.value

            let provenanceBase:Omit<ProvenanceData,'chunkIndex'>={
                sourceFile:fileObj.name,
                model:model,
                promptType:processingType,
                timestamp:new Date().toISOString()
            }

            processedChunks=await this.processor.processChunks(
                chunks,
                model,
                processingType,
                this.generatePrompt.bind(this),
                this.outputManager.createTrainingItem.bind(this.outputManager),
                (index:number,total:number,items:TrainingItem[])=>{
                    if(progressCallback){
                        progressCallback(index+1,total)
                    }
                    let chunkProgress=((index+1)/total)*100
                    this.logger.info("app",t("log.chunkProcessed",undefined,{index:String(index+1),total:String(total),percent:String(Math.round(chunkProgress)),count:String(items.length)}))
                    this.updateOutputPreview()
                },
                (index:number,error:string)=>{
                    this.logger.warn("app",t("log.chunkFailed",undefined,{index:String(index+1),error}))
                },
                provenanceBase
            )
            let{items:dedupedItems,removed}=await dedupInWorker(processedChunks)
            if(removed>0){
                this.logger.info("app",t("log.duplicatesRemoved",undefined,{removed:String(removed)}))
            }
            this.processor.stats.deduplicatedCount=removed
            processedChunks=[] // Release pre-dedup array
            return{
                success:true,
                data:dedupedItems
            }
        }
        catch(error){
            this.logger.error("app",t("log.errorProcessingFile",undefined,{name:fileObj.name}),{error:(error as Error).message})
            return{
                success:false,
                error:(error as Error).message||t("error.failedToProcessFile")
            }
        }
    }
    async readFileAsArrayBuffer(file:File):Promise<ArrayBuffer>{
        return new Promise((resolve,reject)=>{
            let reader=new FileReader()
            reader.onload=(e)=>resolve(e.target!.result as ArrayBuffer)
            reader.onerror=(e)=>reject(new Error(t("error.failedToReadFileAsArrayBuffer")))
            reader.readAsArrayBuffer(file)
        })
    }
    async extractTextFromPDFBuffer(arrayBuffer:ArrayBuffer):Promise<string>{
        try{
            let extractedText=""
            let uint8Array=new Uint8Array(arrayBuffer)
            let pdfString=""
            try{
                let decoder=new TextDecoder("latin1")
                pdfString=decoder.decode(uint8Array)
            }
            catch(e){
                let decoder=new TextDecoder("utf-8")
                pdfString=decoder.decode(uint8Array)
            }
            let btMatches=pdfString.match(/BT[\s\S]*?ET/g)
            if(btMatches&&btMatches.length>0){
                for(let match of btMatches){
                    let textMatches=match.match(/T[mdjJ]?\s*\(([^)]+)\)/g)
                    if(textMatches){
                        for(let textMatch of textMatches){
                            let textContent=textMatch.match(/\(([^)]+)\)/)
                            if(textContent&&textContent[1]){
                                extractedText+=textContent[1]+" "
                            }
                        }
                    }
                }
            }
            if(extractedText.length<100){
                let decoder=new TextDecoder("utf-8")
                let sliceSize=Math.min(uint8Array.length,50000)
                let readableText=decoder.decode(uint8Array.slice(0,sliceSize))
                let textSequences=readableText.match(/[A-Za-z0-9\s.,;:!?()""-]{10,}/g)
                if(textSequences){
                    extractedText=textSequences.join(" ")
                }
            }
            if(extractedText.length<50){
                let decoder=new TextDecoder("utf-8")
                let sliceSize=Math.min(uint8Array.length,100000)
                let allText=decoder.decode(uint8Array.slice(0,sliceSize))
                let cleanedText=allText.replace(/[^\x20-\x7E\n\r\t]/g," ")
                                           .replace(/\s+/g," ")
                                           .trim()
                if(cleanedText.length>100){
                    extractedText=cleanedText
                }
            }
            extractedText=extractedText.replace(/\s+/g," ").trim()
            if(extractedText.length==0){
                throw new Error(t("error.pdfNoText"))
            }
            console.log(t("log.pdfExtracted",undefined,{length:String(extractedText.length)}))
            return extractedText
        }
        catch(error){
            console.error("PDF text extraction error:",error)
            throw new Error(t("error.pdfExtractFailed",undefined,{error:(error as Error).message}))
        }
    }
    async readFileContent(file:File):Promise<string>{
        return new Promise((resolve,reject)=>{
            let reader=new FileReader()
            reader.onerror=(e)=>reject(new Error(t("error.failedToReadFile")))
            if(file.type=="application/pdf"){
                reader.onload=async(e)=>{
                    try{
                        let text=await this.extractTextFromPDFBuffer(e.target!.result as ArrayBuffer)
                        resolve(text)
                    }
                    catch(error){
                        reject(error)
                    }
                }
                reader.readAsArrayBuffer(file)
            }
            else{
                reader.onload=(e)=>resolve(e.target!.result as string)
                reader.readAsText(file)
            }
        })
    }
    chunkText(text:string,chunkSize:number=2000):string[]{
        return simpleChunk(text,chunkSize)
    }
    async generatePrompt(text:string,processingType:string):Promise<string>{
        let language=this.uiManager.languageSelect.value||"en"
        this.uiManager.selectedLanguage=language
        let loadedPrompt=await this.promptManager.getPromptWithFallback(language,processingType)
        if(loadedPrompt){
            this.logger.info("app",t("log.usingPrompt",undefined,{language,processingType}))
            return loadedPrompt.replace("{{text}}",text)
        }
        this.logger.warn("app",t("log.usingFallbackPrompt",undefined,{language}))
        return this.getFallbackPrompt(text,processingType,language)
    }
    // Fallback system prompts (compact, token-efficient). If distinguishing system vs user
    // prompts is needed, use {prompt_type} marker: replace with "system" or "user" at runtime.
    getFallbackPrompt(text:string,processingType:string,language:string="en"):string{
        let key:`prompt.system.${string}`=`prompt.system.${processingType}` as `prompt.system.${string}`
        let prompt=t(key,language)
        if(prompt===key){
            prompt=t("prompt.system.instruction",language)
        }
        return prompt.replace("{{text}}",text)
    }
    async saveProgress():Promise<void>{
        try{
            if(!window.electronAPI?.saveProgress)return
            let data={
                files:this.fileManager.selectedFiles,
                outputData:this.outputManager.outputData,
                timestamp:Date.now()
            }
            await window.electronAPI.saveProgress(data)
        }
        catch(error){
            this.logger.error("app",t("log.saveProgressFailed"),{error:(error as Error).message})
        }
    }
    async checkForProgress():Promise<void>{
        try{
            if(!window.electronAPI?.loadProgress)return
            let result=await window.electronAPI.loadProgress()
            if(result.success&&result.data&&result.data.outputData?.length>0){
                this.logger.info("app",t("log.foundSavedProgress"))
            }
        }
        catch(error){
            this.logger.error("app",t("log.checkProgressFailed"),{error:(error as Error).message})
        }
    }
    async loadCheckpointState():Promise<void>{
        try{
            let checkpoint=await loadCheckpoint()
            if(checkpoint && checkpoint.outputData && checkpoint.outputData.length>0){
                let confirmed=await showConfirm(t("confirm.resumeCheckpoint",undefined,{count:String(checkpoint.outputData.length)}))
                if(confirmed){
                    this.fileManager.selectedFiles=checkpoint.files
                    this.outputManager.outputData=checkpoint.outputData
                    this.fileManager.updateFileList()
                    this.uiManager.updateOutputPreview()
                    this.uiManager.exportBtn.disabled=false
                    this.uiManager.copyBtn.disabled=false
                    this.logger.info("app",t("log.checkpointRestored",undefined,{items:String(checkpoint.outputData.length),files:String(checkpoint.files.length)}))
                    showToast(t("toast.stateRestored"),"success")
                }
                else{
                    await clearCheckpoint()
                }
            }
        }
        catch(error){
            this.logger.error("app",t("log.loadCheckpointFailed"),{error:(error as Error).message})
        }
    }
    clearAll():void{
        let hasFiles=this.fileManager.selectedFiles.length>0
        let hasOutput=this.outputManager.outputData.length>0
        if(hasFiles||hasOutput){
            showConfirm(t("confirm.clearAll")).then(confirmed=>{
                if(confirmed){
                    this.fileManager.selectedFiles=[]
                    this.fileManager.fileStatuses.clear()
                    this.outputManager.outputData=[]
                    this.qualityReport=null
                    this.fileManager.updateFileList()
                    this.updateOutputPreview()
                    this.uiManager.exportBtn.disabled=true
                    this.uiManager.copyBtn.disabled=true
                    this.setProgress(0,t("processing.ready"))
                    this.audit.record("clear_all",{})
                    this.logger.info("app",t("log.clearedAll"))
                    showToast(t("toast.allCleared"),"success")
                }
            })
            return
        }
        this.fileManager.selectedFiles=[]
        this.fileManager.fileStatuses.clear()
        this.outputManager.outputData=[]
        this.qualityReport=null
        this.fileManager.updateFileList()
        this.updateOutputPreview()
        this.uiManager.exportBtn.disabled=true
        this.uiManager.copyBtn.disabled=true
        this.setProgress(0,t("processing.ready"))
        this.audit.record("clear_all",{})
        this.logger.info("app",t("log.clearedAll"))
    }
    addEventListener(element:HTMLElement|Window|Document,event:string,handler:EventListener):void{
        element.addEventListener(event,handler)
        this.eventListeners.push({element,event,handler})
    }
    removeAllEventListeners():void{
        this.eventListeners.forEach(({element,event,handler})=>{
            element.removeEventListener(event,handler)
        })
        this.eventListeners=[]
    }
    clearAllIntervals():void{
        this.uiManager.intervals.forEach(intervalId=>window.clearInterval(intervalId))
        this.uiManager.intervals=[]
    }
    clearAllTimeouts():void{
        this.uiManager.timeouts.forEach(timeoutId=>window.clearTimeout(timeoutId))
        this.uiManager.timeouts=[]
    }
    async exportLogs():Promise<void>{
        try{
            let jsonlData=this.logger.exportJSONL()
            let auditData=this.audit.exportJSONL()
            if(auditData){
                jsonlData+="\n"+auditData
            }
            if(window.electronAPI&&window.electronAPI.exportLogs){
                await window.electronAPI.exportLogs(jsonlData)
            }
        }
        catch(error){
            console.error(t("log.exportLogsConsole"),error)
        }
    }
    dispose():void{
        this.removeAllEventListeners()
        this.clearAllIntervals()
        this.clearAllTimeouts()
        this.dashboard.stop()
        this.devtools.dispose()
        if(this.checkpointInterval!==null){
            window.clearInterval(this.checkpointInterval)
            this.checkpointInterval=null
        }
        if(this.providerManager){
            this.providerManager.stopHealthChecks()
            this.providerManager=null
        }
        this.fileManager.selectedFiles=[]
        this.processingQueue=[]
        this.outputManager.outputData=[]
        this.uiManager.ollamaStatus={running:false,models:[]}
        if(window.app==this){
            window.app=null
        }
    }
    setupSplitter():void{
        let splitter=document.getElementById("splitter-bar") as HTMLElement|null
        if(!splitter)return
        let leftColumn=document.querySelector(".left-column") as HTMLElement|null
        let rightColumn=document.querySelector(".right-column") as HTMLElement|null
        let contentGrid=document.querySelector(".content-grid") as HTMLElement|null
        if(!leftColumn||!rightColumn||!contentGrid)return

        let savedRatio=localStorage.getItem("train-generator-splitter")
        let leftPercent=50
        if(savedRatio){
            let n=parseFloat(savedRatio)
            if(!isNaN(n)&&n>=10&&n<=90)leftPercent=n
        }
        contentGrid.style.gridTemplateColumns=`${leftPercent}fr 4px ${100-leftPercent}fr`

        let isDragging=false
        let startX=0
        let startLeftPercent=0

        let onMouseDown=(e:MouseEvent)=>{
            isDragging=true
            startX=e.clientX
            startLeftPercent=leftPercent
            splitter.classList.add("splitter-active")
            document.body.style.cursor="col-resize"
            document.body.style.userSelect="none"
            e.preventDefault()
        }

        let onMouseMove=(e:MouseEvent)=>{
            if(!isDragging)return
            let gridWidth=contentGrid.getBoundingClientRect().width
            let dx=e.clientX-startX
            let newLeftPercent=startLeftPercent+(dx/gridWidth)*100
            newLeftPercent=Math.max(10,Math.min(90,newLeftPercent))
            leftPercent=newLeftPercent
            contentGrid.style.gridTemplateColumns=`${leftPercent}fr 4px ${100-leftPercent}fr`
        }

        let onMouseUp=()=>{
            if(!isDragging)return
            isDragging=false
            splitter.classList.remove("splitter-active")
            document.body.style.cursor=""
            document.body.style.userSelect=""
            localStorage.setItem("train-generator-splitter",String(Math.round(leftPercent)))
        }

        splitter.addEventListener("mousedown",onMouseDown as EventListener)
        document.addEventListener("mousemove",onMouseMove as EventListener)
        document.addEventListener("mouseup",onMouseUp as EventListener)

        // Keyboard resize
        splitter.addEventListener("keydown",(e:Event)=>{
            let ke=e as KeyboardEvent
            if(ke.key==="ArrowLeft"){
                leftPercent=Math.max(10,leftPercent-5)
                contentGrid.style.gridTemplateColumns=`${leftPercent}fr 4px ${100-leftPercent}fr`
                localStorage.setItem("train-generator-splitter",String(Math.round(leftPercent)))
            }
            else if(ke.key==="ArrowRight"){
                leftPercent=Math.min(90,leftPercent+5)
                contentGrid.style.gridTemplateColumns=`${leftPercent}fr 4px ${100-leftPercent}fr`
                localStorage.setItem("train-generator-splitter",String(Math.round(leftPercent)))
            }
        })
    }
}

document.addEventListener("DOMContentLoaded",()=>{
    window.app=new TrainGeneratorApp()
})