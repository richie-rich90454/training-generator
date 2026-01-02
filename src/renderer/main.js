class TrainGeneratorApp{
    constructor(){
        this.selectedFiles=[];
        this.processingQueue=[];
        this.isProcessing=false;
        this.outputData=[];
        this.ollamaStatus={running:false,models:[]};
        this.selectedLanguage="en";
        this.init();
    }
    async detectPlatform(){
        try{
            let platform="unknown";
            if(window.electronAPI&&window.electronAPI.getPlatform){
                platform=await window.electronAPI.getPlatform();
            }
            else{
                let userAgent=navigator.userAgent.toLowerCase();
                if(userAgent.includes("win")){
                    platform="windows";
                }
                else if(userAgent.includes("mac")){
                    platform="macos";
                }
                else if(userAgent.includes("linux")){
                    platform="linux";
                }
            }
            document.documentElement.setAttribute("data-platform",platform);
            console.log(`Platform detected:${platform}`);
        }
        catch(error){
            console.error("Failed to detect platform:",error);
            document.documentElement.setAttribute("data-platform","unknown");
        }
    }
    async init(){
        if(document.readyState=="loading"){
            await new Promise(resolve=>document.addEventListener("DOMContentLoaded",resolve));
        }
        await this.detectPlatform();
        this.cacheElements();
        this.bindEvents();
        this.loadSettings();
        this.initSettings();
        await this.checkOllamaStatus();
        this.startOllamaMonitor();
        console.log("Training Generator initialized");
    }
    cacheElements(){
        this.dropZone=document.getElementById("drop-zone");
        this.fileInput=document.getElementById("file-input");
        this.browseBtn=document.getElementById("browse-btn");
        this.fileList=document.getElementById("file-list");
        this.processBtn=document.getElementById("process-btn");
        this.clearBtn=document.getElementById("clear-btn");
        this.modelSelect=document.getElementById("model-select");
        this.processingType=document.getElementById("processing-type");
        this.outputFormat=document.getElementById("output-format");
        this.languageSelect=document.getElementById("language-select");
        this.chunkSize=document.getElementById("chunk-size");
        this.savePresetBtn=document.getElementById("save-preset");
        this.progressText=document.getElementById("progress-text");
        this.progressPercent=document.getElementById("progress-percent");
        this.progressFill=document.getElementById("progress-fill");
        this.processingLog=document.getElementById("processing-log");
        this.outputPreview=document.getElementById("output-preview");
        this.exportBtn=document.getElementById("export-btn");
        this.copyBtn=document.getElementById("copy-btn");
        this.ollamaStatusEl=document.getElementById("ollama-status");
        this.filesCountEl=document.getElementById("files-count");
        this.lastProcessedEl=document.getElementById("last-processed");
        this.settingsBtn=document.getElementById("settings-btn");
        this.settingsModal=document.getElementById("settings-modal");
        this.modalClose=document.querySelector(".modal-close");
        this.helpBtn=document.getElementById("help-btn");
    }
    bindEvents(){
        this.dropZone.addEventListener("dragover",this.handleDragOver.bind(this));
        this.dropZone.addEventListener("dragleave",this.handleDragLeave.bind(this));
        this.dropZone.addEventListener("drop",this.handleDrop.bind(this));
        this.fileInput.addEventListener("change",this.handleFileSelect.bind(this));
        this.browseBtn.addEventListener("click",()=>this.fileInput.click());
        this.processBtn.addEventListener("click",this.processFiles.bind(this));
        this.clearBtn.addEventListener("click",this.clearAll.bind(this));
        this.exportBtn.addEventListener("click",this.exportOutput.bind(this));
        this.copyBtn.addEventListener("click",this.copyOutput.bind(this));
        this.savePresetBtn.addEventListener("click",this.savePreset.bind(this));
        this.settingsBtn.addEventListener("click",()=>this.showModal(true));
        this.modalClose.addEventListener("click",()=>this.showModal(false));
        this.settingsModal.addEventListener("click",(e)=>{
            if(e.target==this.settingsModal)this.showModal(false);
        });
        this.helpBtn.addEventListener("click",()=>this.showHelp());
        this.fileInput.addEventListener("change",()=>this.updateProcessButton());
    }
    handleDragOver(e){
        e.preventDefault();
        this.dropZone.classList.add("drag-over");
    }
    handleDragLeave(e){
        e.preventDefault();
        if(!this.dropZone.contains(e.relatedTarget)){
            this.dropZone.classList.remove("drag-over");
        }
    }
    async handleDrop(e){
        e.preventDefault();
        this.dropZone.classList.remove("drag-over");
        let files=Array.from(e.dataTransfer.files);
        await this.addFiles(files);
    }
    async handleFileSelect(e){
        let files=Array.from(e.target.files);
        await this.addFiles(files);
        e.target.value="";
    }
    async addFiles(files){
        let validFiles=files.filter(file=>{
            let ext=file.name.split(".").pop().toLowerCase();
            return ["pdf","docx","doc","rtf","txt","md","html"].includes(ext);
        });
        if(validFiles.length==0){
            this.addLog("No valid files selected. Supported formats:PDF,DOCX,DOC,RTF,TXT,MD,HTML","warning");
            return;
        }
        let addedCount=0;
        let skippedCount=0;
        for(let file of validFiles){
            let maxSize=100*1024*1024;
            if(file.size>maxSize){
                this.addLog(`File too large:${file.name}(${this.formatFileSize(file.size)}). Maximum size is 100MB.`,"warning");
                skippedCount++;
                continue;
            }
            if(file.name.toLowerCase().endsWith(".pdf")&& file.size>20*1024*1024){
                this.addLog(`Large PDF detected:${file.name}(${this.formatFileSize(file.size)}). Processing may take longer.`,"info");
            }
            let fileObj={
                file:file,
                name:file.name,
                size:file.size,
                type:file.name.split(".").pop().toLowerCase(),
                path:file.path||null
            };
            this.selectedFiles.push(fileObj);
            this.addFileToList(fileObj);
            addedCount++;
        }
        this.updateProcessButton();
        if(addedCount>0){
            this.addLog(`Added ${addedCount}file(s)`,"success");
        }
        if(skippedCount>0){
            this.addLog(`Skipped ${skippedCount}file(s)due to size limits`,"warning");
        }
    }
    addFileToList(fileObj){
        let fileItem=document.createElement("div");
        fileItem.className="file-item";
        fileItem.innerHTML=`
            <div class="file-info">
                <i class="fas fa-file-${this.getFileIcon(fileObj.type)}file-icon"></i>
                <div>
                    <div class="file-name">${fileObj.name}</div>
                    <div class="file-size">${this.formatFileSize(fileObj.size)}</div>
                </div>
            </div>
            <button class="file-remove" data-name="${fileObj.name}">
                <i class="fas fa-times"></i>
            </button>
        `;
        fileItem.querySelector(".file-remove").addEventListener("click",(e)=>{
            e.stopPropagation();
            this.removeFile(fileObj.name);
        });
        if(this.fileList.querySelector(".empty-state")){
            this.fileList.innerHTML="";
        }
        this.fileList.appendChild(fileItem);
    }
    removeFile(fileName){
        this.selectedFiles=this.selectedFiles.filter(f=>f.name!==fileName);
        this.updateFileList();
        this.updateProcessButton();
        this.addLog(`Removed file:${fileName}`,"info");
    }
    updateFileList(){
        this.fileList.innerHTML="";
        if(this.selectedFiles.length==0){
            this.fileList.innerHTML="<p class=\"empty-state\">No files selected</p>";
            return;
        }
        this.selectedFiles.forEach(file=>this.addFileToList(file));
    }
    updateProcessButton(){
        this.processBtn.disabled=this.selectedFiles.length==0 ||!this.ollamaStatus.running;
        if(!this.ollamaStatus.running){
            this.processBtn.title="Ollama is not running";
        }
        else{
            this.processBtn.title="";
        }
    }
    getFileIcon(fileType){
        let icons={
            pdf:"pdf",
            docx:"word",
            doc:"word",
            rtf:"file-alt",
            txt:"file-alt",
            md:"markdown",
            html:"code"
        };
        return icons[fileType]||"file";
    }
    formatFileSize(bytes){
        if(bytes==0)return "0 Bytes";
        let k=1024;
        let sizes=["Bytes","KB","MB","GB"];
        let i=Math.floor(Math.log(bytes)/Math.log(k));
        return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+" "+sizes[i];
    }
    async checkOllamaStatus(){
        try{
            if(!window.electronAPI ||!window.electronAPI.checkOllama){
                console.warn("electronAPI not available,running in browser mode");
                this.ollamaStatusEl.querySelector("span").textContent="Ollama:Browser Mode";
                this.ollamaStatusEl.className="status-indicator status-offline";
                this.addLog("Running in browser mode(Ollama unavailable)","warning");
                return{running:false,error:"Browser mode"};
            }
            let status=await window.electronAPI.checkOllama();
            this.ollamaStatus=status;
            if(status.running){
                let versionText=status.version!=="unknown"?`v${status.version}`:"";
                this.ollamaStatusEl.querySelector("span").textContent=`Ollama:Online ${versionText}(${status.models.length}models)`;
                this.ollamaStatusEl.className="status-indicator status-online";
                this.addLog(`Ollama is running(${status.version})with ${status.models.length}models`,"success");
                this.updateModelSelect(status.models);
            }
            else{
                this.ollamaStatusEl.querySelector("span").textContent="Ollama:Offline";
                this.ollamaStatusEl.className="status-indicator status-offline";
                this.addLog("Ollama is not running. Please start Ollama to process files.","error");
            }
            this.updateProcessButton();
            return status;
        }
        catch(error){
            console.error("Error checking Ollama status:",error);
            this.ollamaStatusEl.querySelector("span").textContent="Ollama:Error";
            this.ollamaStatusEl.className="status-indicator status-offline";
            this.addLog("Failed to check Ollama status","error");
            return{running:false,error:error.message};
        }
    }
    updateModelSelect(models){
        this.modelSelect.innerHTML="";
        if(models.length==0){
            let option=document.createElement("option");
            option.value="";
            option.textContent="No models found in Ollama";
            option.disabled=true;
            option.selected=true;
            this.modelSelect.appendChild(option);
            return;
        }
        models.forEach((model,index)=>{
            let option=document.createElement("option");
            option.value=model.name;
            option.textContent=model.name;
            this.modelSelect.appendChild(option);
            if(index==0){
                option.selected=true;
            }
        });
        this.updateProcessButton();
    }
    startOllamaMonitor(){
        setInterval(()=>{
            this.checkOllamaStatus();
        },30000);
    }
    async processFiles(){
        if(this.isProcessing){
            this.addLog("Processing already in progress","warning");
            return;
        }
        if(this.selectedFiles.length==0){
            this.addLog("No files to process","warning");
            return;
        }
        if(!this.ollamaStatus.running){
            this.addLog("Cannot process:Ollama is not running","error");
            return;
        }
        this.isProcessing=true;
        this.outputData=[];
        this.processingQueue=[...this.selectedFiles];
        this.processBtn.disabled=true;
        this.processBtn.innerHTML="<i class=\"fas fa-spinner fa-spin\"></i>Processing...";
        this.clearBtn.disabled=true;
        this.exportBtn.disabled=true;
        this.copyBtn.disabled=true;
        this.browseBtn.disabled=true;
        this.fileInput.disabled=true;
        this.setProgress(0,"Starting processing...");
        this.addLog(`Starting processing of ${this.selectedFiles.length}file(s)`,"info");
        this.addLog("This may take several minutes depending on file sizes and Ollama performance","info");
        try{
            let totalItemsGenerated=0;
            let successfulFiles=0;
            let failedFiles=0;
            let totalChunks=0;
            let processedChunks=0;
            for(let file of this.processingQueue){
                let chunkSize=parseInt(this.chunkSize.value)||2000;
                let estimatedChunks=Math.max(1,Math.ceil((file.size||10000)/chunkSize));
                totalChunks+=estimatedChunks;
            }
            for(let i=0;i<this.processingQueue.length;i++){
                let file=this.processingQueue[i];
                this.setProgress(
                    (processedChunks/totalChunks)*100,
                    `Processing ${file.name}...`
                );
                this.addLog(`Processing file ${i+1}/${this.processingQueue.length}:${file.name}`,"info");
                let result=await this.processFile(file,(chunksProcessed,totalChunksInFile)=>{
                    let fileStartProgress=(processedChunks/totalChunks)*100;
                    let fileEndProgress=((processedChunks+totalChunksInFile)/totalChunks)*100;
                    let fileProgress=fileStartProgress+((chunksProcessed/totalChunksInFile)*(fileEndProgress-fileStartProgress));
                    this.setProgress(
                        fileProgress,
                        `Processing ${file.name}(chunk ${chunksProcessed}/${totalChunksInFile})`
                    );
                });
                let chunkSize=parseInt(this.chunkSize.value)||2000;
                let estimatedFileChunks=Math.max(1,Math.ceil((file.size||10000)/chunkSize));
                processedChunks+=estimatedFileChunks;
                if(result.success){
                    this.outputData.push(...result.data);
                    totalItemsGenerated+=result.data.length;
                    successfulFiles++;
                    this.addLog(`✓ Successfully processed ${file.name}(${result.data.length}items)`,"success");
                }
                else{
                    failedFiles++;
                    this.addLog(`✗ Failed to process ${file.name}:${result.error}`,"error");
                }
                this.setProgress(
                    (processedChunks/totalChunks)*100,
                    `Processed ${i+1}/${this.processingQueue.length}files`
                );
            }
            this.setProgress(100,"Processing complete!");
            let summaryMessage=`Processing complete. `;
            if(successfulFiles>0){
                summaryMessage+=`Successfully processed ${successfulFiles}file(s)and generated ${totalItemsGenerated}training items. `;
            }
            if(failedFiles>0){
                summaryMessage+=`${failedFiles}file(s)failed to process.`;
            }
            this.addLog(summaryMessage,successfulFiles>0?"success":"warning");
            this.updateOutputPreview();
            if(this.outputData.length>0){
                this.exportBtn.disabled=false;
                this.copyBtn.disabled=false;
                this.addLog(`Output ready. You can now export ${this.outputData.length}training items.`,"success");
            }
            this.filesCountEl.textContent=this.selectedFiles.length;
            this.lastProcessedEl.textContent=new Date().toLocaleTimeString();
        }
        catch(error){
            this.addLog(`Processing failed:${error.message}`,"error");
            this.setProgress(0,"Processing failed");
            this.addLog("Please check your Ollama connection and try again.","warning");
        }
        finally{
            this.isProcessing=false;
            this.processBtn.disabled=false;
            this.processBtn.innerHTML="<i class=\"fas fa-play\"></i>Process Files";
            this.clearBtn.disabled=false;
            this.browseBtn.disabled=false;
            this.fileInput.disabled=false;
            if(this.outputData.length==0){
                this.exportBtn.disabled=true;
                this.copyBtn.disabled=true;
            }
        }
    }
    async processFile(fileObj,progressCallback){
        try{
            let textContent;
            if(fileObj.file&&fileObj.file instanceof File){
                if(fileObj.type=="pdf"){
                    let arrayBuffer=await this.readFileAsArrayBuffer(fileObj.file);
                    textContent=await this.extractTextFromPDFBuffer(arrayBuffer);
                }
                else{
                    textContent=await this.readFileContent(fileObj.file);
                }
            }
            else if(fileObj.path){
                let result=await window.electronAPI.parseFile(fileObj.path,fileObj.type);
                if(!result.success){
                    throw new Error(result.error);
                }
                textContent=result.content;
            }
            else{
                throw new Error("No file path or file object available");
            }
            if(!textContent||textContent.trim().length==0){
                throw new Error("No text content extracted from file");
            }
            let chunkSize=parseInt(this.chunkSize.value)||2000;
            let chunks=this.chunkText(textContent,chunkSize);
            if(chunks.length==0){
                throw new Error("No text chunks created from file content");
            }
            let processedChunks=[];
            let model=this.modelSelect.value;
            let processingType=this.processingType.value;
            for(let i=0;i<chunks.length;i++){
                let chunk=chunks[i];
                let prompt=await this.generatePrompt(chunk,processingType);
                try{
                    let response=await window.electronAPI.generateWithOllama(model,prompt,{
                        temperature:0.7,
                        top_p:0.9
                    });
                    let trainingItems=this.createTrainingItem(chunk,response.response,processingType);
                    processedChunks.push(...trainingItems);
                    if(progressCallback){
                        progressCallback(i+1,chunks.length);
                    }
                    let chunkProgress=((i+1)/chunks.length)*100;
                    this.addLog(`Processed chunk ${i+1}/${chunks.length}(${Math.round(chunkProgress)}%)-generated ${trainingItems.length}items`,"info");
                }
                catch(error){
                    this.addLog(`Failed to process chunk ${i+1}:${error.message}`,"warning");
                }
            }
            return{
                success:true,
                data:processedChunks
            };
        }
        catch(error){
            this.addLog(`Error processing file ${fileObj.name}:${error.message}`,"error");
            return{
                success:false,
                error:error.message
            };
        }
    }
    async readFileAsArrayBuffer(file){
        return new Promise((resolve,reject)=>{
            let reader=new FileReader();
            reader.onload=(e)=>resolve(e.target.result);
            reader.onerror=(e)=>reject(new Error("Failed to read file as ArrayBuffer"));
            reader.readAsArrayBuffer(file);
        });
    }
    async extractTextFromPDFBuffer(arrayBuffer){
        try{
            let extractedText="";
            let uint8Array=new Uint8Array(arrayBuffer);
            let pdfString="";
            try{
                let decoder=new TextDecoder("latin1");
                pdfString=decoder.decode(uint8Array);
            }
            catch(e){
                let decoder=new TextDecoder("utf-8");
                pdfString=decoder.decode(uint8Array);
            }
            let btMatches=pdfString.match(/BT[\s\S]*?ET/g);
            if(btMatches&&btMatches.length>0){
                for(let match of btMatches){
                    let textMatches=match.match(/T[mdjJ]?\s*\(([^)]+)\)/g);
                    if(textMatches){
                        for(let textMatch of textMatches){
                            let textContent=textMatch.match(/\(([^)]+)\)/);
                            if(textContent&&textContent[1]){
                                extractedText+=textContent[1]+" ";
                            }
                        }
                    }
                }
            }
            if(extractedText.length<100){
                let decoder=new TextDecoder("utf-8");
                let sliceSize=Math.min(uint8Array.length,50000);
                let readableText=decoder.decode(uint8Array.slice(0,sliceSize));
                let textSequences=readableText.match(/[A-Za-z0-9\s.,;:!?()""-]{10,}/g);
                if(textSequences){
                    extractedText+=textSequences.join(" ");
                }
            }
            if(extractedText.length<50){
                let decoder=new TextDecoder("utf-8");
                let sliceSize=Math.min(uint8Array.length,100000);
                let allText=decoder.decode(uint8Array.slice(0,sliceSize));
                let cleanedText=allText.replace(/[^\x20-\x7E\n\r\t]/g," ")
                                           .replace(/\s+/g," ")
                                           .trim();
                if(cleanedText.length>100){
                    extractedText=cleanedText;
                }
            }
            extractedText=extractedText.replace(/\s+/g," ").trim();
            if(extractedText.length==0){
                throw new Error("No text could be extracted from PDF. The PDF might be scanned or image-based. For better PDF extraction,use the file dialog instead of drag & drop.");
            }
            console.log(`Extracted ${extractedText.length}characters from PDF(browser context-limited extraction)`);
            return extractedText;
        }
        catch(error){
            console.error("PDF text extraction error:",error);
            throw new Error(`Failed to extract text from PDF:${error.message}. For better PDF support,use the file dialog or convert PDFs to text format first.`);
        }
    }
    async readFileContent(file){
        return new Promise((resolve,reject)=>{
            let reader=new FileReader();
            reader.onload=(e)=>resolve(e.target.result);
            reader.onerror=(e)=>reject(new Error("Failed to read file"));
            if(file.type=="application/pdf"){
                reader.readAsArrayBuffer(file);
                reader.onload=async(e)=>{
                    try{
                        let text=await this.extractTextFromPDFBuffer(e.target.result);
                        resolve(text);
                    }
                    catch(error){
                        reject(error);
                    }
                };
            }
            else{
                reader.readAsText(file);
            }
        });
    }
    chunkText(text,chunkSize){
        let chunks=[];
        let start=0;
        while(start<text.length){
            let end=start+chunkSize;
            if(end<text.length){
                let nextPeriod=text.indexOf(".",end);
                let nextNewline=text.indexOf("\n",end);
                if(nextPeriod!==-1&&nextPeriod<end+100){
                    end=nextPeriod+1;
                }
                else if(nextNewline!==-1&&nextNewline<end+50){
                    end=nextNewline+1;
                }
            }
            chunks.push(text.substring(start,Math.min(end,text.length)));
            start=end;
        }
        return chunks;
    }
    async generatePrompt(text,processingType){
        let language=this.languageSelect.value||"en";
        this.selectedLanguage=language;
        let processingTypeMap={
            "instruction":"instruction",
            "conversation":"conversation",
            "chunking":"chunking",
            "custom":"custom"
        };
        let fileType=processingTypeMap[processingType]||"instruction";
        let fileName=`${language}_${fileType}.txt`;
        let filePath=`src/prompts/${fileName}`;
        try{
            let response=await fetch(filePath);
            if(response.ok){
                let promptTemplate=await response.text();
                return promptTemplate.replace("{{text}}",text);
            }
            else{
                let fallbackFileName=`en_${fileType}.txt`;
                let fallbackPath=`src/prompts/${fallbackFileName}`;
                let fallbackResponse=await fetch(fallbackPath);
                if(fallbackResponse.ok){
                    let promptTemplate=await fallbackResponse.text();
                    return promptTemplate.replace("{{text}}",text);
                }
                else{
                    return this.getFallbackPrompt(text,processingType);
                }
            }
        }catch(error){
            console.error(`Error loading prompt file ${fileName}:`,error);
            return this.getFallbackPrompt(text,processingType);
        }
    }
    getFallbackPrompt(text,processingType){
        let fallbackPrompts={
            instruction:`You are an AI training data generator. Your task is to extract comprehensive question-answer pairs from the provided text that cover ALL important information for instruction tuning.
TEXT TO ANALYZE:
${text}
INSTRUCTIONS:
1. Read the text thoroughly and identify ALL key concepts,facts,arguments,data points,and important information.
2. For EACH significant piece of information,create a clear,specific question that someone might ask about it. Questions and answers should be in the same language as the source text.
3. Provide detailed,accurate answers based EXCLUSIVELY on the text content.
4. Format each pair exactly as:
Question:[the question]
Answer:[the answer]
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
Question:[First question]
Answer:[First answer]
Question:[Second question]
Answer:[Second answer]
[Continue with as many pairs as needed to cover all information]`,
            conversation:`You are an AI training data generator. Your task is to create comprehensive,informative conversations between a user and an AI assistant based on ALL information in the provided text.
TEXT TO ANALYZE:
${text}
INSTRUCTIONS:
1. Read the text thoroughly and identify ALL main topics,key information,arguments,and details.
2. Create a comprehensive conversation where the user asks questions or discusses ALL important aspects of the text. Questions and responses should match the source text language.
3. The assistant should provide detailed,accurate responses based EXCLUSIVELY on the text.
4. Format the conversation exactly as:
User:[user message]
Assistant:[assistant response]
5. Make the conversation flow naturally while covering ALL key information.
6. Include 5-10+exchanges(user-assistant pairs)to cover different aspects of the text COMPLETELY.
7. The assistant"s responses should be informative,comprehensive,and directly based on the text content.
8. Cover ALL important points:main ideas,supporting details,examples,data points,conclusions.
9. If the text contains multiple sections or topics,create conversation exchanges for EACH one.
10. Ensure the conversation explores the text DEEPLY,not just superficially.
OUTPUT FORMAT:
User:[First user message]
Assistant:[First assistant response]
User:[Second user message]
Assistant:[Second assistant response]
[Continue with as many exchanges as needed to cover all information]`,
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
        };
        return fallbackPrompts[processingType]||fallbackPrompts.instruction;
    }
    createTrainingItem(input,output,processingType){
        let format=this.outputFormat.value;
        let items=[];
        if(processingType=="instruction"){
            let qaPairs=this.parseQuestionAnswerPairs(output);
            if(qaPairs.length>0){
                qaPairs.forEach(pair=>{
                    if(format=="chatml"){
                        items.push({
                            messages:[
                                {role:"user",content:pair.question},
                                {role:"assistant",content:pair.answer}
                            ]
                        });
                    }
                    else if(format=="text"){
                        items.push({text:pair.answer});
                    }
                    else if(format=="csv"){
                        items.push({input:pair.question,output:pair.answer});
                    }
                    else{
                        items.push({
                            instruction:"Answer the question based on the text",
                            input:pair.question,
                            output:pair.answer
                        });
                    }
                });
                return items;
            }
        }
        else if(processingType=="conversation"){
            let conversationTurns=this.parseConversationTurns(output);
            if(conversationTurns.length>0){
                if(format=="chatml"){
                    let messages=[];
                    conversationTurns.forEach(turn=>{
                        messages.push({role:"user",content:turn.user});
                        messages.push({role:"assistant",content:turn.assistant});
                    });
                    items.push({messages});
                }
                else{
                    conversationTurns.forEach(turn=>{
                        if(format=="text"){
                            items.push({text:turn.assistant});
                        }
                        else if(format=="csv"){
                            items.push({input:turn.user,output:turn.assistant});
                        }
                        else{
                            items.push({
                                instruction:"Respond to the user's message",
                                input:turn.user,
                                output:turn.assistant
                            });
                        }
                    });
                }
                return items;
            }
        }
        if(format=="chatml"){
            items.push({
                messages:[
                    {role:"user",content:input},
                    {role:"assistant",content:output}
                ]
            });
        }
        else if(format=="text"){
            items.push({text:output});
        }
        else if(format=="csv"){
            items.push({input,output});
        }
        else{
            items.push({
                instruction:processingType=="instruction"?"Answer the question based on the text":"Process the following text",
                input:input,
                output:output
            });
        }
        return items;
    }
    parseQuestionAnswerPairs(text){
        let pairs=[];
        let lines=text.split("\n");
        let currentQuestion="";
        let currentAnswer="";
        let inAnswer=false;
        for(let line of lines){
            let trimmedLine=line.trim();
            if(trimmedLine.match(/^question:?\s*/i)){
                if(currentQuestion&&currentAnswer){
                    pairs.push({
                        question:currentQuestion.trim(),
                        answer:currentAnswer.trim()
                    });
                }
                currentQuestion=trimmedLine.replace(/^question:?\s*/i,"");
                currentAnswer="";
                inAnswer=false;
            }
            else if(trimmedLine.match(/^answer:?\s*/i)){
                inAnswer=true;
                currentAnswer=trimmedLine.replace(/^answer:?\s*/i,"");
            }
            else if(trimmedLine){
                if(inAnswer&&currentAnswer){
                    currentAnswer+=" "+trimmedLine;
                }
                else if(currentQuestion&&!inAnswer){
                    currentQuestion+=" "+trimmedLine;
                }
            }
        }
        if(currentQuestion&&currentAnswer){
            pairs.push({
                question:currentQuestion.trim(),
                answer:currentAnswer.trim()
            });
        }
        if(pairs.length==0){
            let qaMatches=text.match(/Q:\s*(.*?)\s*A:\s*(.*?)(?=Q:|$)/gis);
            if(qaMatches){
                for(let match of qaMatches){
                    let qMatch=match.match(/Q:\s*(.*?)\s*A:\s*(.*)/is);
                    if(qMatch&&qMatch[1]&&qMatch[2]){
                        pairs.push({
                            question:qMatch[1].trim(),
                            answer:qMatch[2].trim()
                        });
                    }
                }
            }
        }
        return pairs;
    }
    parseConversationTurns(text){
        let turns=[];
        let lines=text.split("\n");
        let currentUser="";
        let currentAssistant="";
        let inUser=false;
        let inAssistant=false;
        for(let line of lines){
            let trimmedLine=line.trim();
            if(trimmedLine.match(/^user:?\s*/i)){
                if(currentUser&&currentAssistant){
                    turns.push({
                        user:currentUser.trim(),
                        assistant:currentAssistant.trim()
                    });
                }
                currentUser=trimmedLine.replace(/^user:?\s*/i,"");
                currentAssistant="";
                inUser=true;
                inAssistant=false;
            }
            else if(trimmedLine.match(/^assistant:?\s*/i)){
                inUser=false;
                inAssistant=true;
                currentAssistant=trimmedLine.replace(/^assistant:?\s*/i,"");
            }
            else if(trimmedLine){
                if(inAssistant&&currentAssistant){
                    currentAssistant+=" "+trimmedLine;
                }
                else if(inUser&&currentUser){
                    currentUser+=" "+trimmedLine;
                }
            }
        }
        if(currentUser&&currentAssistant){
            turns.push({
                user:currentUser.trim(),
                assistant:currentAssistant.trim()
            });
        }
        if(turns.length==0){
            let convMatches=text.match(/Human:\s*(.*?)\s*Assistant:\s*(.*?)(?=Human:|$)/gis);
            if(convMatches){
                for(let match of convMatches){
                    let hMatch=match.match(/Human:\s*(.*?)\s*Assistant:\s*(.*)/is);
                    if(hMatch&&hMatch[1]&&hMatch[2]){
                        turns.push({
                            user:hMatch[1].trim(),
                            assistant:hMatch[2].trim()
                        });
                    }
                }
            }
        }
        return turns;
    }
    updateOutputPreview(){
        if(this.outputData.length==0){
            this.outputPreview.innerHTML="<pre><code>//No output data yet</code></pre>";
            return;
        }
        let sample=this.outputData.slice(0,3);
        let jsonStr=JSON.stringify(sample,null,2);
        this.outputPreview.innerHTML=`<pre><code>${this.escapeHtml(jsonStr)}</code></pre>`;
    }
    async exportOutput(){
        if(this.outputData.length==0){
            this.addLog("No data to export","warning");
            return;
        }
        try{
            let format=this.outputFormat.value;
            let content="";
            let defaultFilename="training_data";
            if(format=="jsonl"){
                content=this.outputData.map(item=>JSON.stringify(item)).join("\n");
                defaultFilename+=".jsonl";
            }
            else if(format=="json"){
                content=JSON.stringify(this.outputData,null,2);
                defaultFilename+=".json";
            }
            else if(format=="csv"){
                let headers=["input","output"];
                let rows=this.outputData.map(item=>`"${item.input.replace(/"/g,'""')}","${item.output.replace(/"/g,'""')}"`);
                content=headers.join(",")+"\n"+rows.join("\n");
                defaultFilename+=".csv";
            }
            else if(format=="text"){
                content=this.outputData.map(item=>item.output).join("\n\n");
                defaultFilename+=".txt";
            }
            let savePath=await window.electronAPI.saveFileDialog(defaultFilename);
            if(!savePath){
                this.addLog("Export cancelled","info");
                return;
            }
            let result=await window.electronAPI.saveFile(savePath,content);
            if(result.success){
                this.addLog(`Exported to ${savePath}`,"success");
            }
            else{
                this.addLog(`Failed to export:${result.error}`,"error");
            }
        }
        catch(error){
            this.addLog(`Export failed:${error.message}`,"error");
        }
    }
    async copyOutput(){
        if(this.outputData.length==0){
            this.addLog("No data to copy","warning");
            return;
        }
        try{
            let format=this.outputFormat.value;
            let content="";
            if(format=="jsonl"){
                content=this.outputData.map(item=>JSON.stringify(item)).join("\n");
            }
            else if(format=="json"){
                content=JSON.stringify(this.outputData,null,2);
            }
            else if(format=="csv"){
                let headers=["input","output"];
                let rows=this.outputData.map(item=>`"${item.input.replace(/"/g,'""')}","${item.output.replace(/"/g,'""')}"`);
                content=headers.join(",")+"\n"+rows.join("\n");
            }
            else if(format=="text"){
                content=this.outputData.map(item=>item.output).join("\n\n");
            }
            await navigator.clipboard.writeText(content);
            this.addLog("Copied to clipboard","success");
        }
        catch(error){
            this.addLog(`Failed to copy:${error.message}`,"error");
        }
    }
    clearAll(){
        this.selectedFiles=[];
        this.outputData=[];
        this.updateFileList();
        this.updateOutputPreview();
        this.exportBtn.disabled=true;
        this.copyBtn.disabled=true;
        this.setProgress(0,"Ready to process");
        this.addLog("Cleared all files and output","info");
    }
    setProgress(percent,text){
        let clampedPercent=Math.max(0,Math.min(100,percent));
        this.progressFill.style.width=`${clampedPercent}%`;
        this.progressPercent.textContent=`${Math.round(clampedPercent)}%`;
        this.progressText.textContent=text;
    }
    addLog(message,type="info"){
        let logEntry=document.createElement("div");
        logEntry.className=`log-entry ${type}`;
        logEntry.innerHTML=`
            <i class="fas fa-${this.getLogIcon(type)}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;
        this.processingLog.appendChild(logEntry);
        this.processingLog.scrollTop=this.processingLog.scrollHeight;
        let entries=this.processingLog.querySelectorAll(".log-entry");
        if(entries.length>50){
            entries[0].remove();
        }
    }
    getLogIcon(type){
        let icons={
            info:"info-circle",
            success:"check-circle",
            warning:"exclamation-triangle",
            error:"times-circle"
        };
        return icons[type]||"info-circle";
    }
    escapeHtml(text){
        let div=document.createElement("div");
        div.textContent=text;
        return div.innerHTML;
    }
    loadSettings(){
        try{
            let settings=JSON.parse(localStorage.getItem("train-generator-settings")||"{}");
            if(settings.model)this.modelSelect.value=settings.model;
            if(settings.processingType)this.processingType.value=settings.processingType;
            if(settings.outputFormat)this.outputFormat.value=settings.outputFormat;
            if(settings.language)this.languageSelect.value=settings.language;
            if(settings.chunkSize)this.chunkSize.value=settings.chunkSize;
            this.selectedLanguage=this.languageSelect.value||"en";
            this.addLog("Settings loaded","info");
        }
        catch(error){
            console.error("Failed to load settings:",error);
        }
    }
    savePreset(){
        let settings={
            model:this.modelSelect.value,
            processingType:this.processingType.value,
            outputFormat:this.outputFormat.value,
            language:this.languageSelect.value,
            chunkSize:this.chunkSize.value
        };
        try{
            localStorage.setItem("train-generator-settings",JSON.stringify(settings));
            this.addLog(`Settings saved. Output language set to: ${settings.language}`,"success");
            let nonLatinLanguages=["zh-Hans", "zh-Hant", "ja", "ko"];
            if (nonLatinLanguages.includes(settings.language)) {
                this.addLog(`Note: ${settings.language} uses non-Latin script. Ensure your Ollama model supports this language.`, "warning");
            }
        }
        catch(error){
            this.addLog("Failed to save settings","error");
        }
    }
    showModal(show){
        if(show){
            this.settingsModal.classList.add("active");
        }
        else{
            this.settingsModal.classList.remove("active");
        }
    }
    showHelp(){
        this.addLog("Opening help documentation...","info");
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
                <p>•<strong>Models</strong>:Pull models using<code>ollama pull<model-name></code></p>
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
        `;
        let helpModal=document.getElementById("help-modal");
        if(!helpModal){
            helpModal=document.createElement("div");
            helpModal.id="help-modal";
            helpModal.className="modal";
            helpModal.innerHTML=`
                <div class="modal-content">
                    <div class="modal-header">
                        <h2><i class="fas fa-question-circle"></i>Help</h2>
                        <button class="modal-close help-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        ${helpContent}
                    </div>
                </div>
            `;
            document.body.appendChild(helpModal);
            helpModal.querySelector(".help-close").addEventListener("click",()=>{
                helpModal.classList.remove("active");
            });
            helpModal.addEventListener("click",(e)=>{
                if(e.target==helpModal){
                    helpModal.classList.remove("active");
                }
            });
        }
        helpModal.classList.add("active");
        this.addLog("Help documentation opened","success");
    }
    initSettings(){
        this.loadAppSettings();
        let resetSettingsBtn=document.getElementById("reset-settings");
        let saveSettingsBtn=document.getElementById("save-settings");
        if(resetSettingsBtn){
            resetSettingsBtn.addEventListener("click",()=>this.resetSettings());
        }
        if(saveSettingsBtn){
            saveSettingsBtn.addEventListener("click",()=>this.saveAppSettings());
        }
        let settingsInputs=document.querySelectorAll("#settings-modal input,#settings-modal select");
        settingsInputs.forEach(input=>{
            input.addEventListener("change",()=>{
                let autoSave=document.getElementById("auto-save");
                if(autoSave&&autoSave.checked){
                    this.saveAppSettings();
                }
            });
        });
    }
    loadAppSettings(){
        try{
            let settings=JSON.parse(localStorage.getItem("training-generator-app-settings")||"{}");
            if(settings.theme){
                let themeSelect=document.getElementById("theme-select");
                if(themeSelect)themeSelect.value=settings.theme;
                this.applyTheme(settings.theme);
            }
            if(settings.fontSize){
                let fontSizeSelect=document.getElementById("font-size");
                if(fontSizeSelect)fontSizeSelect.value=settings.fontSize;
                this.applyFontSize(settings.fontSize);
            }
            let checkboxes=["auto-save","auto-check-ollama","start-maximized","remember-window-size"];
            checkboxes.forEach(id=>{
                let checkbox=document.getElementById(id);
                if(checkbox&&settings[id]!=undefined){
                    checkbox.checked=settings[id];
                }
            });
            if(settings["max-file-size"]!=undefined){
                let maxFileSize=document.getElementById("max-file-size");
                if(maxFileSize)maxFileSize.value=settings["max-file-size"];
            }
            this.addLog("Application settings loaded","info");
        }
        catch(error){
            console.error("Failed to load application settings:",error);
        }
    }
    saveAppSettings(){
        try{
            let settings={};
            let themeSelect=document.getElementById("theme-select");
            if(themeSelect){
                settings.theme=themeSelect.value;
                this.applyTheme(themeSelect.value);
            }
            let fontSizeSelect=document.getElementById("font-size");
            if(fontSizeSelect){
                settings.fontSize=fontSizeSelect.value;
                this.applyFontSize(fontSizeSelect.value);
            }
            let checkboxes=["auto-save","auto-check-ollama","start-maximized","remember-window-size"];
            checkboxes.forEach(id=>{
                let checkbox=document.getElementById(id);
                if(checkbox){
                    settings[id]=checkbox.checked;
                }
            });
            let maxFileSize=document.getElementById("max-file-size");
            if(maxFileSize){
                settings["max-file-size"]=parseInt(maxFileSize.value)||100;
            }
            localStorage.setItem("training-generator-app-settings",JSON.stringify(settings));
            this.addLog("Application settings saved","success");
        }
        catch(error){
            this.addLog("Failed to save application settings","error");
        }
    }
    resetSettings(){
        try{
            let themeSelect=document.getElementById("theme-select");
            if(themeSelect)themeSelect.value="auto";
            let fontSizeSelect=document.getElementById("font-size");
            if(fontSizeSelect)fontSizeSelect.value="medium";
            document.getElementById("auto-save").checked=true;
            document.getElementById("auto-check-ollama").checked=true;
            document.getElementById("start-maximized").checked=false;
            document.getElementById("remember-window-size").checked=true;
            document.getElementById("max-file-size").value=100;
            this.applyTheme("auto");
            this.applyFontSize("medium");
            this.saveAppSettings();
            this.addLog("Settings reset to defaults","success");
        }
        catch(error){
            this.addLog("Failed to reset settings","error");
        }
    }
    applyTheme(theme){
        document.body.classList.remove("theme-light","theme-dark");
        if(theme=="light"){
            document.body.classList.add("theme-light");
        }
        else if(theme=="dark"){
            document.body.classList.add("theme-dark");
        }
        else{
            if(window.matchMedia&&window.matchMedia("(prefers-color-scheme:dark)").matches){
                document.body.classList.add("theme-dark");
            }
            else{
                document.body.classList.add("theme-light");
            }
        }
    }
    applyFontSize(size){
        document.body.classList.remove("font-small","font-medium","font-large");
        if(size=="small"){
            document.body.classList.add("font-small");
        }
        else if(size=="large"){
            document.body.classList.add("font-large");
        }
        else{
            document.body.classList.add("font-medium");
        }
    }
}
document.addEventListener("DOMContentLoaded",()=>{
    window.app=new TrainGeneratorApp();
});