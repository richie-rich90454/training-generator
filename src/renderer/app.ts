import '@fortawesome/fontawesome-free/css/all.min.css'
import type{SelectedFile,TrainingItem,ProcessFileResult}from"../types/index.js"
import PromptManager from"./promptManager.js"
import FileManager from"./fileManager.js"
import UIManager from"./uiManager.js"
import OutputManager from"./outputManager.js"
import Processor from"./processor.js"
import{createProvider}from"./provider.js"
import{semanticChunk,simpleChunk}from"./chunker.js"
import{deduplicate}from"./deduplicator.js"
import{showToast}from"./toast.js"
import{chunkInWorker,dedupInWorker}from"./workers/workerPool.js"
import{showConfirm}from"./confirm.js"

class TrainGeneratorApp{
    fileManager:FileManager
    uiManager:UIManager
    outputManager:OutputManager
    promptManager:PromptManager
    processor:Processor
    processingQueue:SelectedFile[]
    isProcessing:boolean
    eventListeners:Array<{element:HTMLElement|Window|Document;event:string;handler:EventListener}>

    constructor(){
        this.fileManager=new FileManager(this)
        this.uiManager=new UIManager(this)
        this.outputManager=new OutputManager(this)
        this.promptManager=new PromptManager()
        this.processor=new Processor()
        this.processingQueue=[]
        this.isProcessing=false
        this.eventListeners=[]
        this.init()
    }

    addLog(message:string,type:string="info"):void{
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
    escapeCsvField(value:string):string{
        return this.uiManager.escapeCsvField(value)
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
            console.error("Failed to detect platform:",error)
            document.documentElement.setAttribute("data-platform","unknown")
        }
    }
    async init():Promise<void>{
        if(document.readyState=="loading"){
            await new Promise<void>(resolve=>{document.addEventListener("DOMContentLoaded",()=>resolve())})
        }
        await this.detectPlatform()
        await this.checkForProgress()
        this.bindEvents()
        this.setupSplitter()
        this.uiManager.loadSettings()
        this.initProvider()
        this.processor.concurrency=parseInt(this.uiManager.concurrencySelect.value)||3
        this.uiManager.initSettings()
        await this.uiManager.checkOllamaStatus()
        this.uiManager.startOllamaMonitor()
        this.registerServiceWorker()
    }
    bindEvents():void{
        this.addEventListener(this.fileManager.dropZone,"dragover",this.fileManager.handleDragOver.bind(this.fileManager) as EventListener)
        this.addEventListener(this.fileManager.dropZone,"dragleave",this.fileManager.handleDragLeave.bind(this.fileManager) as EventListener)
        this.addEventListener(this.fileManager.dropZone,"drop",this.fileManager.handleDrop.bind(this.fileManager) as unknown as EventListener)
        this.addEventListener(this.fileManager.fileInput,"change",this.fileManager.handleFileSelect.bind(this.fileManager))
        this.addEventListener(this.fileManager.browseBtn,"click",()=>this.fileManager.fileInput.click())
        this.addEventListener(this.fileManager.processBtn,"click",this.processFiles.bind(this))
        this.addEventListener(this.fileManager.clearBtn,"click",this.clearAll.bind(this))
        this.addEventListener(this.uiManager.exportBtn,"click",this.outputManager.exportOutput.bind(this.outputManager))
        this.addEventListener(this.uiManager.copyBtn,"click",this.outputManager.copyOutput.bind(this.outputManager))
        this.addEventListener(this.uiManager.savePresetBtn,"click",this.uiManager.savePreset.bind(this.uiManager))
        this.addEventListener(this.uiManager.settingsBtn,"click",()=>this.uiManager.showModal(true))
        this.addEventListener(this.uiManager.modalClose,"click",()=>this.uiManager.showModal(false))
        this.addEventListener(this.uiManager.settingsModal,"click",(e:Event)=>{
            if((e as MouseEvent).target==this.uiManager.settingsModal)this.uiManager.showModal(false)
        })
        this.addEventListener(this.uiManager.helpBtn,"click",async()=>{
            let module=await import("./helpContent.js")
            this.uiManager.showHelp()
        })
        this.addEventListener(this.uiManager.providerSelect,"change",()=>{
            this.uiManager.updateProviderVisibility()
            this.initProvider()
        })
        this.addEventListener(this.uiManager.apiKeyInput,"change",()=>this.initProvider())
        this.addEventListener(this.uiManager.baseUrlInput,"change",()=>this.initProvider())
        this.addEventListener(this.uiManager.demoBtn,"click",()=>{
            if(this.processor.demoMode){
                this.processor.disableDemoMode()
                this.uiManager.demoBtn.innerHTML='<i class="fas fa-magic"></i> Demo'
                this.uiManager.demoBtn.classList.remove("active")
                this.addLog("Demo mode disabled","info")
            }
            else{
                this.processor.enableDemoMode()
                this.uiManager.demoBtn.innerHTML='<i class="fas fa-magic"></i> Demo (Active)'
                this.uiManager.demoBtn.classList.add("active")
                this.addLog("Demo mode enabled - processing without Ollama","info")
            }
        })
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
                        this.outputManager.exportOutput()
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
            }
            if(e.key==="Escape"){
                if(this.isProcessing){
                    this.stopProcessing()
                }
                else{
                    this.uiManager.showModal(false)
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
        this.fileManager.processBtn.disabled=false
        this.fileManager.processBtn.innerHTML='<i class="fas fa-play"></i> Process Files'
        this.fileManager.clearBtn.disabled=false
        this.fileManager.browseBtn.removeAttribute("disabled")
        this.fileManager.fileInput.disabled=false
        if(this.outputManager.outputData.length>0){
            this.uiManager.exportBtn.disabled=false
            this.uiManager.copyBtn.disabled=false
        }
        this.setProgress(0,"Processing stopped")
        this.addLog("Processing stopped by user","warning")
    }
    showShortcutsHelp():void{
        let shortcuts=[
            ["Ctrl+O","Select files"],
            ["Ctrl+Enter","Start/Stop processing"],
            ["Ctrl+E","Export output"],
            ["Ctrl+Shift+C","Copy output to clipboard"],
            ["Ctrl+K","Show this help"],
            ["Escape","Close modal / Stop processing"],
            ["Tab / Shift+Tab","Navigate between elements"],
            ["Space","Toggle checkbox / Activate button"],
        ]
        let html='<div class="shortcuts-help"><h3>Keyboard Shortcuts</h3><table>'
        for(let[key,desc]of shortcuts){
            html+=`<tr><td><kbd>${key}</kbd></td><td>${desc}</td></tr>`
        }
        html+='</table></div>'
        this.uiManager.showCustomModal(html)
    }
    initProvider():void{
        let type=this.uiManager.providerSelect.value
        let config={
            apiKey:this.uiManager.apiKeyInput.value,
            baseUrl:this.uiManager.baseUrlInput.value
        }
        this.processor.provider=createProvider(type,config)
        this.addLog(`Provider set to ${type}`,"info")
    }
    async registerServiceWorker():Promise<void>{
        if(!("serviceWorker" in navigator))return
        try{
            let registration=await navigator.serviceWorker.register("./sw.js")
            this.addLog("Service Worker registered for offline support","info")
            registration.addEventListener("updatefound",()=>{
                let newWorker=registration.installing
                if(newWorker){
                    newWorker.addEventListener("statechange",()=>{
                        if(newWorker.state==="installed"&&navigator.serviceWorker.controller){
                            this.addLog("New version available - reload to update","info")
                        }
                    })
                }
            })
        }
        catch(error){
            console.warn("Service Worker registration failed:",error)
        }
    }
    async processFiles():Promise<void>{
        if(this.isProcessing){
            this.addLog("Processing already in progress","warning")
            return
        }
        if(this.fileManager.selectedFiles.length==0){
            this.addLog("No files to process","warning")
            return
        }
        if(!this.uiManager.ollamaStatus.running){
            this.addLog("Cannot process:Ollama is not running","error")
            showToast("Ollama is not running","error")
            return
        }
        this.isProcessing=true
        this.outputManager.outputData=[]
        this.processingQueue=[...this.fileManager.selectedFiles]
        for(let file of this.processingQueue){
            this.fileManager.setFileStatus(file.name,"waiting")
        }
        this.fileManager.processBtn.disabled=true
        this.fileManager.processBtn.innerHTML="<i class=\"fas fa-spinner fa-spin\"></i>Processing..."
        this.fileManager.clearBtn.disabled=true
        this.uiManager.exportBtn.disabled=true
        this.uiManager.copyBtn.disabled=true
        this.fileManager.browseBtn.setAttribute("disabled","")
        this.fileManager.fileInput.disabled=true
        this.setProgress(0,"Starting processing...")
        this.addLog(`Starting processing of ${this.fileManager.selectedFiles.length}file(s)`,"info")
        this.addLog("This may take several minutes depending on file sizes and Ollama performance","info")
        try{
            let totalItemsGenerated=0
            let successfulFiles=0
            let failedFiles=0
            let totalChunks=0
            let processedChunks=0
            for(let file of this.processingQueue){
                let chunkSize=Math.min(10000,Math.max(500,parseInt(this.uiManager.chunkSize.value)||2000))
                let estimatedChunks=Math.max(1,Math.ceil((file.size||10000)/chunkSize))
                totalChunks+=estimatedChunks
            }
            for(let i=0;i<this.processingQueue.length;i++){
                let file=this.processingQueue[i]
                this.fileManager.setFileStatus(file.name,"processing")
                this.setProgress(
                    (processedChunks/totalChunks)*100,
                    `Processing ${file.name}...`
                )
                this.addLog(`Processing file ${i+1}/${this.processingQueue.length}: ${file.name}`,"info")
                let result=await this.processFile(file,(chunksProcessed:number,totalChunksInFile:number)=>{
                    let fileStartProgress=(processedChunks/totalChunks)*100
                    let fileEndProgress=((processedChunks+totalChunksInFile)/totalChunks)*100
                    let fileProgress=fileStartProgress+((chunksProcessed/totalChunksInFile)*(fileEndProgress-fileStartProgress))
                    this.setProgress(
                        fileProgress,
                        `Processing ${file.name}(chunk ${chunksProcessed}/${totalChunksInFile})`
                    )
                })
                let chunkSize=Math.min(10000,Math.max(500,parseInt(this.uiManager.chunkSize.value)||2000))
                let estimatedFileChunks=Math.max(1,Math.ceil((file.size||10000)/chunkSize))
                processedChunks+=estimatedFileChunks
                if(result.success){
                    this.fileManager.setFileStatus(file.name,"completed")
                    this.outputManager.outputData.push(...result.data!)
                    totalItemsGenerated+=result.data!.length
                    successfulFiles++
                    this.addLog(`✅ Successfully processed ${file.name}(${result.data!.length}items)`,"success")
                }
                else{
                    this.fileManager.setFileStatus(file.name,"failed")
                    failedFiles++
                    this.addLog(`鉁?Failed to process ${file.name}: ${result.error}`,"error")
                }
                this.setProgress(
                    (processedChunks/totalChunks)*100,
                    `Processed ${i+1}/${this.processingQueue.length}files`
                )
            }
            this.setProgress(100,"Processing complete!")
            let summaryMessage=`Processing complete. `
            if(successfulFiles>0){
                summaryMessage+=`Successfully processed ${successfulFiles}file(s)and generated ${totalItemsGenerated}training items. `
            }
            if(failedFiles>0){
                summaryMessage+=`${failedFiles}file(s)failed to process.`
            }
            this.addLog(summaryMessage,successfulFiles>0?"success":"warning")
            showToast(summaryMessage,successfulFiles>0?"success":"warning")
            this.uiManager.updateOutputPreview()
            if(this.outputManager.outputData.length>0){
                this.uiManager.exportBtn.disabled=false
                this.uiManager.copyBtn.disabled=false
                this.addLog(`Output ready. You can now export ${this.outputManager.outputData.length}training items.`,"success")
            }
            this.fileManager.filesCountEl.textContent=String(this.fileManager.selectedFiles.length)
            this.fileManager.lastProcessedEl.textContent=new Date().toLocaleTimeString()
        }
        catch(error){
            this.addLog("Processing failed due to an unexpected error","error")
            showToast("Processing failed due to an unexpected error","error")
            this.setProgress(0,"Processing failed")
            this.addLog("Please check your Ollama connection and try again.","warning")
        }
        finally{
            this.isProcessing=false
            this.fileManager.processBtn.disabled=false
            this.fileManager.processBtn.innerHTML="<i class=\"fas fa-play\"></i>Process Files"
            this.fileManager.clearBtn.disabled=false
            this.fileManager.browseBtn.removeAttribute("disabled")
            this.fileManager.fileInput.disabled=false
            if(this.outputManager.outputData.length==0){
                this.uiManager.exportBtn.disabled=true
                this.uiManager.copyBtn.disabled=true
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
        let html=`<div class="stats-panel">
            <h3>Processing Statistics</h3>
            <table>
                <tr><td>Total Chunks:</td><td>${r.totalChunks}</td></tr>
                <tr><td>Successful:</td><td>${r.successfulChunks}</td></tr>
                <tr><td>Failed:</td><td>${r.failedChunks}</td></tr>
                <tr><td>Success Rate:</td><td>${r.successRate}%</td></tr>
                <tr><td>Prompt Tokens:</td><td>${r.promptTokens.toLocaleString()}</td></tr>
                <tr><td>Response Tokens:</td><td>${r.totalTokens.toLocaleString()}</td></tr>
                <tr><td>Time Elapsed:</td><td>${r.elapsedFormatted}</td></tr>
                <tr><td>Tokens/Second:</td><td>${r.tokensPerSecond.toLocaleString()}</td></tr>
                <tr><td>Duplicates Removed:</td><td>${r.deduplicatedCount}</td></tr>
            </table>
            ${warningsHtml}
        </div>`
        this.addLog(`Processing complete: ${r.successfulChunks}/${r.totalChunks} chunks (${r.successRate}%), ${r.totalTokens.toLocaleString()} tokens, ${r.elapsedFormatted}`,"info")
        this.uiManager.showCustomModal(html)
    }
    async processFile(fileObj:SelectedFile,progressCallback?:(chunksProcessed:number,totalChunks:number)=>void):Promise<ProcessFileResult>{
        try{
            let textContent:string
            if(fileObj.file&&fileObj.file instanceof File){
                if(fileObj.type=="pdf"){
                    if(fileObj.path){
                        let result=await window.electronAPI.parseFile(fileObj.path,"pdf")
                        if(!result.success){
                            this.addLog(`Main process PDF parse failed for ${fileObj.name}, falling back to browser extraction`,"warning")
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
                let result=await window.electronAPI.parseFile(fileObj.path,fileObj.type)
                if(!result.success){
                    throw new Error(result.error)
                }
                textContent=result.content!
            }
            else{
                throw new Error("No file path or file object available")
            }
            if(!textContent||textContent.trim().length==0){
                throw new Error("No text content extracted from file")
            }
            let chunkSize=Math.min(10000,Math.max(500,parseInt(this.uiManager.chunkSize.value)||2000))
            let chunks=await chunkInWorker(textContent,chunkSize,100)
            if(chunks.length===0){
                chunks=simpleChunk(textContent,chunkSize)
            }
            textContent=(null as any) // Allow GC of text content
            if(chunks.length==0){
                throw new Error("No text chunks created from file content")
            }
            let processedChunks:TrainingItem[]=[]
            let model=this.uiManager.modelSelect.value
            let processingType=this.uiManager.processingType.value

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
                    this.addLog(`Processed chunk ${index+1}/${total}(${Math.round(chunkProgress)}%)-generated ${items.length}items`,"info")
                    this.updateOutputPreview()
                },
                (index:number,error:string)=>{
                    this.addLog(`Failed to process chunk ${index+1}: ${error}`,"warning")
                }
            )
            let{items:dedupedItems,removed}=await dedupInWorker(processedChunks)
            if(removed>0){
                this.addLog(`Removed ${removed} duplicate items from output`,"info")
            }
            this.processor.stats.deduplicatedCount=removed
            processedChunks=[] // Release pre-dedup array
            return{
                success:true,
                data:dedupedItems
            }
        }
        catch(error){
            this.addLog(`Error processing file ${fileObj.name}`,"error")
            return{
                success:false,
                error:"Failed to process file"
            }
        }
    }
    async readFileAsArrayBuffer(file:File):Promise<ArrayBuffer>{
        return new Promise((resolve,reject)=>{
            let reader=new FileReader()
            reader.onload=(e)=>resolve(e.target!.result as ArrayBuffer)
            reader.onerror=(e)=>reject(new Error("Failed to read file as ArrayBuffer"))
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
                throw new Error("No text could be extracted from PDF. The PDF might be scanned or image-based. For better PDF extraction,use the file dialog instead of drag & drop.")
            }
            console.log(`Extracted ${extractedText.length}characters from PDF(browser context-limited extraction)`)
            return extractedText
        }
        catch(error){
            console.error("PDF text extraction error:",error)
            throw new Error(`Failed to extract text from PDF: ${(error as Error).message}. For better PDF support,use the file dialog or convert PDFs to text format first.`)
        }
    }
    async readFileContent(file:File):Promise<string>{
        return new Promise((resolve,reject)=>{
            let reader=new FileReader()
            reader.onerror=(e)=>reject(new Error("Failed to read file"))
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
            this.addLog(`Using ${language}prompt for ${processingType}`,"info")
            return loadedPrompt.replace("{{text}}",text)
        }
        this.addLog(`Using hardcoded fallback prompt for ${language}`,"warning")
        return this.getFallbackPrompt(text,processingType,language)
    }
    // Fallback system prompts (compact, token-efficient). If distinguishing system vs user
    // prompts is needed, use {prompt_type} marker: replace with "system" or "user" at runtime.
    getFallbackPrompt(text:string,processingType:string,language:string="en"):string{
        let fallbackPrompts:Record<string,string>={
            instruction:`Extract Q&A pairs from the text. Cover all key concepts, facts, and data points.
TEXT:
${text}
RULES:
- Same language as source text.
- One Q&A per important point; for lists/procedures, one question per item.
- Answers based exclusively on the text.
OUTPUT (blank line between pairs):
Question: [question]
Answer: [answer]`,
            conversation:`Generate a natural User-Assistant conversation covering all information below.
TEXT:
${text}
RULES:
- Same language as source; answers based exclusively on the text.
- Cover every main topic and key detail in separate exchanges.
OUTPUT (blank line between exchanges):
User: [message]
Assistant: [response]`,
            chunking:`Summarize the text below. Preserve all key points, arguments, data, examples, and conclusions.
TEXT:
${text}
RULES:
- Target ~40-50% of original length; preserve logical flow.
- No information absent from the original text.
OUTPUT: summary text only.`,
            custom:`Extract structured information from the text below.
TEXT:
${text}
RULES:
Extract: key concepts, themes, facts, data, statistics, arguments, evidence, examples,
definitions, relationships, conclusions, implications. For procedures: all steps.
For comparisons: key differences/similarities. For lists: all items with descriptions.
OUTPUT: structured analysis covering everything important.`
        }
        return fallbackPrompts[processingType]||fallbackPrompts.instruction
    }
    async saveProgress():Promise<void>{
        try{
            let data={
                files:this.fileManager.selectedFiles,
                outputData:this.outputManager.outputData,
                timestamp:Date.now()
            }
            await window.electronAPI.saveProgress(data)
        }
        catch{}
    }
    async checkForProgress():Promise<void>{
        try{
            let result=await window.electronAPI.loadProgress()
            if(result.success&&result.data&&result.data.outputData?.length>0){
                this.addLog("Found saved progress from previous session","info")
            }
        }
        catch{}
    }
    clearAll():void{
        let hasFiles=this.fileManager.selectedFiles.length>0
        let hasOutput=this.outputManager.outputData.length>0
        if(hasFiles||hasOutput){
            showConfirm("Are you sure you want to clear all files and output?").then(confirmed=>{
                if(confirmed){
                    this.fileManager.selectedFiles=[]
                    this.fileManager.fileStatuses.clear()
                    this.outputManager.outputData=[]
                    this.fileManager.updateFileList()
                    this.updateOutputPreview()
                    this.uiManager.exportBtn.disabled=true
                    this.uiManager.copyBtn.disabled=true
                    this.setProgress(0,"Ready to process")
                    this.addLog("Cleared all files and output","info")
                    showToast("All files and output cleared","success")
                }
            })
            return
        }
        this.fileManager.selectedFiles=[]
        this.fileManager.fileStatuses.clear()
        this.outputManager.outputData=[]
        this.fileManager.updateFileList()
        this.updateOutputPreview()
        this.uiManager.exportBtn.disabled=true
        this.uiManager.copyBtn.disabled=true
        this.setProgress(0,"Ready to process")
        this.addLog("Cleared all files and output","info")
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
    dispose():void{
        this.removeAllEventListeners()
        this.clearAllIntervals()
        this.clearAllTimeouts()
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