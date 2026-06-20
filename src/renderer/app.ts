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
        this.uiManager.loadSettings()
        this.initProvider()
        this.processor.concurrency=parseInt(this.uiManager.concurrencySelect.value)||3
        this.uiManager.initSettings()
        await this.uiManager.checkOllamaStatus()
        this.uiManager.startOllamaMonitor()
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
        this.addEventListener(this.uiManager.helpBtn,"click",()=>this.uiManager.showHelp())
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
                    if(this.outputManager.outputData.length+result.data!.length>50000){
                        let remaining=Math.max(0,50000-this.outputManager.outputData.length)
                        if(remaining>0)this.outputManager.outputData.push(...result.data!.slice(0,remaining))
                        totalItemsGenerated+=Math.min(result.data!.length,remaining)
                        successfulFiles++
                        this.addLog(`鉁?Processed ${file.name}(truncated to ${this.outputManager.outputData.length}total items)`,"warning")
                        break
                    }
                    this.outputManager.outputData.push(...result.data!)
                    totalItemsGenerated+=result.data!.length
                    successfulFiles++
                    this.addLog(`鉁?Successfully processed ${file.name}(${result.data!.length}items)`,"success")
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
        let html=`<div class="stats-panel">
            <h3>Processing Statistics</h3>
            <table>
                <tr><td>Total Chunks:</td><td>${r.totalChunks}</td></tr>
                <tr><td>Successful:</td><td>${r.successfulChunks}</td></tr>
                <tr><td>Failed:</td><td>${r.failedChunks}</td></tr>
                <tr><td>Success Rate:</td><td>${r.successRate}%</td></tr>
                <tr><td>Total Tokens:</td><td>${r.totalTokens.toLocaleString()}</td></tr>
                <tr><td>Time Elapsed:</td><td>${r.elapsedFormatted}</td></tr>
                <tr><td>Tokens/Second:</td><td>${r.tokensPerSecond.toLocaleString()}</td></tr>
                <tr><td>Duplicates Removed:</td><td>${r.deduplicatedCount}</td></tr>
            </table>
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
            if(textContent.length>5*1024*1024){
                this.addLog(`Truncating large text from ${fileObj.name}(exceeds 5MB limit)`,"warning")
                textContent=textContent.substring(0,5*1024*1024)
            }
            let chunkSize=Math.min(10000,Math.max(500,parseInt(this.uiManager.chunkSize.value)||2000))
            let chunks=semanticChunk(textContent,chunkSize,100)
            if(chunks.length===0){
                chunks=simpleChunk(textContent,chunkSize)
            }
            if(chunks.length==0){
                throw new Error("No text chunks created from file content")
            }
            let maxChunks=200
            if(chunks.length>maxChunks){
                this.addLog(`File has ${chunks.length}chunks, limiting to ${maxChunks}to prevent excessive API calls`,"warning")
                chunks=chunks.slice(0,maxChunks)
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
            let{items:dedupedItems,removed}=deduplicate(processedChunks)
            if(removed>0){
                this.addLog(`Removed ${removed} duplicate items from output`,"info")
            }
            this.processor.stats.deduplicatedCount=removed
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
    getFallbackPrompt(text:string,processingType:string,language:string="en"):string{
        let fallbackPrompts:Record<string,string>={
            instruction:`You are an AI training data generator. Your task is to extract comprehensive question-answer pairs from the provided text that cover ALL important information for instruction tuning.
TEXT TO ANALYZE:
${text}
INSTRUCTIONS:
1. Read the text thoroughly and identify ALL key concepts,facts,arguments,data points,and important information.
2. For EACH significant piece of information,create a clear,specific question that someone might ask about it. Questions and answers should be in the same language as the source text.
3. Provide detailed,accurate answers based EXCLUSIVELY on the text content.
4. Format each pair exactly as:
Question: [the question]
Answer: [the answer]
5. Create DIVERSE question types:
   -Factual questions(who,what,when,where)
   -Conceptual questions(how,why,explain)
   -Analytical questions(compare,contrast,analyze)
   -Application questions(how to use,implement,apply)
   -Inference questions(what can be concluded,implied)
6. Ensure answers are COMPREHENSIVE but concise,covering all relevant details from the text.
7. Generate AS MANY high-quality question-answer pairs as needed to cover ALL important information in the text. Aim for 5-10+pairs depending on text density.
8. Do NOT skip any important information. Cover ALL key points mentioned in the text.
9. If the text contains lists,procedures,or steps,create questions for EACH item/step.
10. If the text contains examples,create questions about each example.
OUTPUT FORMAT:
Question: [First question]
Answer: [First answer]

Question: [Second question]
Answer: [Second answer]

[Continue with as many pairs as needed to cover all information, with a blank line between each question-answer pair]`,
            conversation:`You are an AI training data generator. Your task is to create comprehensive,informative conversations between a user and an AI assistant based on ALL information in the provided text.
TEXT TO ANALYZE:
${text}
INSTRUCTIONS:
1. Read the text thoroughly and identify ALL main topics,key information,arguments,and details.
2. Create a comprehensive conversation where the user asks questions or discusses ALL important aspects of the text. Questions and responses should match the source text language.
3. The assistant should provide detailed,accurate responses based EXCLUSIVELY on the text.
4. Format the conversation exactly as:
User: [user message]
Assistant: [assistant response]
5. Make the conversation flow naturally while covering ALL key information.
6. Include 5-10+exchanges(user-assistant pairs)to cover different aspects of the text COMPLETELY.
7. The assistant"s responses should be informative,comprehensive,and directly based on the text content.
8. Cover ALL important points:main ideas,supporting details,examples,data points,conclusions.
9. If the text contains multiple sections or topics,create conversation exchanges for EACH one.
10. Ensure the conversation explores the text DEEPLY,not just superficially.
OUTPUT FORMAT:
User: [First user message]
Assistant: [First assistant response]

User: [Second user message]
Assistant: [Second assistant response]

[Continue with as many exchanges as needed to cover all information, with a blank line between each user-assistant pair]`,
            chunking:`You are an AI training data generator. Your task is to create a comprehensive,detailed summary of the provided text that captures ALL essential information.
TEXT TO SUMMARIZE:
${text}
INSTRUCTIONS:
1. Read the text carefully and identify ALL main points,key arguments,essential information,supporting details,and conclusions.
2. Create a summary that:
   -Captures the COMPLETE core message and purpose of the text
   -Includes ALL important facts,data points,and details
   -Maintains the original meaning,context,and nuance
   -Is comprehensive yet concise
   -Preserves the logical flow and structure of the original
3. The summary should be approximately 40-50%of the original text length to ensure completeness.
4. Write in clear,professional language.
5. Do not add any information not present in the original text.
6. Do not omit any significant information from the original text.
7. Include ALL key examples,evidence,and supporting points mentioned.
OUTPUT FORMAT:
Provide only the summary text.`,
            custom:`You are an AI training data generator. Your task is to analyze the provided text and extract COMPREHENSIVE structured information that can be used for AI training.
TEXT TO ANALYZE:
${text}
INSTRUCTIONS:
1. Read the text thoroughly and identify ALL:
   -Key concepts,themes,and topics
   -Important facts,data points,statistics
   -Main arguments,narratives,thesis statements
   -Supporting evidence,examples,case studies
   -Technical terms,definitions,jargon(with explanations)
   -Relationships,connections,dependencies between information
   -Conclusions,implications,recommendations
2. Organize ALL information in a structured,hierarchical way that would be optimal for AI training.
3. Focus on extracting COMPLETE,factual,verifiable information from the text.
4. If the text contains instructions or procedures,extract ALL steps in detail.
5. If the text contains comparisons or contrasts,highlight ALL key differences and similarities.
6. If the text contains lists,extract ALL items with their descriptions.
7. Format your analysis in a clear,organized,comprehensive manner that captures EVERYTHING important from the text.
OUTPUT FORMAT:
Provide your analysis in a well-structured,comprehensive format.`
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
}

document.addEventListener("DOMContentLoaded",()=>{
    window.app=new TrainGeneratorApp()
})