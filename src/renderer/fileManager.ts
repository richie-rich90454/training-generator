import type{SelectedFile}from"../types/index.js"

class FileManager{
    app:any
    selectedFiles:SelectedFile[]
    fileStatuses:Map<string,string>
    fileInput!:HTMLInputElement
    browseBtn!:HTMLElement
    dropZone!:HTMLElement
    fileList!:HTMLElement
    processBtn!:HTMLButtonElement
    clearBtn!:HTMLButtonElement
    filesCountEl!:HTMLElement
    lastProcessedEl!:HTMLElement

    constructor(app:any){
        this.app=app
        this.selectedFiles=[]
        this.fileStatuses=new Map()
        this.cacheElements()
    }
    cacheElements():void{
        this.dropZone=document.getElementById("drop-zone") as HTMLElement
        this.fileInput=document.getElementById("file-input") as HTMLInputElement
        this.browseBtn=document.getElementById("browse-btn") as HTMLElement
        this.fileList=document.getElementById("file-list") as HTMLElement
        this.processBtn=document.getElementById("process-btn") as HTMLButtonElement
        this.clearBtn=document.getElementById("clear-btn") as HTMLButtonElement
        this.filesCountEl=document.getElementById("files-count") as HTMLElement
        this.lastProcessedEl=document.getElementById("last-processed") as HTMLElement
    }
    handleDragOver(e:DragEvent):void{
        e.preventDefault()
        this.dropZone.classList.add("drag-over")
    }
    handleDragLeave(e:DragEvent):void{
        e.preventDefault()
        if(!this.dropZone.contains(e.relatedTarget as Node)){
            this.dropZone.classList.remove("drag-over")
        }
    }
    async handleDrop(e:DragEvent):Promise<void>{
        e.preventDefault()
        this.dropZone.classList.remove("drag-over")
        let files=Array.from(e.dataTransfer!.files)
        await this.addFiles(files)
    }
    async handleFileSelect(e:Event):Promise<void>{
        let files=Array.from((e.target as HTMLInputElement).files!)
        await this.addFiles(files)
        ;(e.target as HTMLInputElement).value=""
    }
    async addFiles(files:File[]):Promise<void>{
        let maxFiles=100
        if(this.selectedFiles.length>=maxFiles){
            this.app.addLog(`Maximum of ${maxFiles}files already selected`,"warning")
            return
        }
        let remainingSlots=maxFiles-this.selectedFiles.length
        if(files.length>remainingSlots){
            this.app.addLog(`Only ${remainingSlots}more file(s)can be added(max ${maxFiles})`,"warning")
            files=files.slice(0,remainingSlots)
        }
        let validFiles=files.filter(file=>{
            let ext=file.name.split(".").pop()!.toLowerCase()
            if(!ext||ext===file.name.toLowerCase())return false
            return ["pdf","docx","doc","rtf","txt","md","html"].includes(ext)
        })
        if(validFiles.length==0){
            this.app.addLog("No valid files selected. Supported formats:PDF,DOCX,DOC,RTF,TXT,MD,HTML","warning")
            return
        }
        let addedCount=0
        let skippedCount=0
        for(let file of validFiles){
            let maxSize=100*1024*1024
            if(file.size>maxSize){
                this.app.addLog(`File too large: ${file.name}(${this.formatFileSize(file.size)}). Maximum size is 100MB.`,"warning")
                skippedCount++
                continue
            }
            if(file.name.toLowerCase().endsWith(".pdf")&& file.size>20*1024*1024){
                this.app.addLog(`Large PDF detected: ${file.name}(${this.formatFileSize(file.size)}). Processing may take longer.`,"info")
            }
            let fileObj:SelectedFile={
                file:file,
                name:file.name,
                size:file.size,
                type:file.name.split(".").pop()!.toLowerCase(),
                path:(file as File&{path?:string}).path||null
            }
            this.selectedFiles.push(fileObj)
            this.addFileToList(fileObj)
            this.app.audit.record("file_added",{fileName:file.name,fileSize:file.size,fileType:fileObj.type})
            addedCount++
        }
        this.updateProcessButton()
        if(addedCount>0){
            this.app.addLog(`Added ${addedCount}file(s)`,"success")
        }
        if(skippedCount>0){
            this.app.addLog(`Skipped ${skippedCount}file(s)due to size limits`,"warning")
        }
    }
    addFileToList(fileObj:SelectedFile):void{
        let fileItem=document.createElement("div")
        fileItem.className="file-item"
        let escapedName=this.app.sanitizeText(fileObj.name)
        fileItem.setAttribute("data-name",escapedName)
        fileItem.innerHTML=`
            <div class="file-info">
                <i class="fas fa-file-${this.getFileIcon(fileObj.type)}file-icon"></i>
                <div>
                    <div class="file-name">${escapedName}</div>
                    <div class="file-size">${this.formatFileSize(fileObj.size)}</div>
                </div>
            </div>
            <button class="file-remove" data-name="${escapedName}">
                <i class="fas fa-times"></i>
            </button>
            <span class="file-status"></span>
        `
        fileItem.querySelector(".file-remove")!.addEventListener("click",(e:Event)=>{
            e.stopPropagation()
            this.removeFile(fileObj.name)
        })
        if(this.fileList.querySelector(".empty-state")){
            this.fileList.innerHTML=""
        }
        this.fileList.appendChild(fileItem)
        this.fileStatuses.set(fileObj.name,"waiting")
        this.updateFileStatusIcon(fileObj.name,"waiting")
    }
    removeFile(fileName:string):void{
        this.selectedFiles=this.selectedFiles.filter(f=>f.name!==fileName)
        this.fileStatuses.delete(fileName)
        this.updateFileList()
        this.updateProcessButton()
        this.app.addLog(`Removed file: ${fileName}`,"info")
    }
    updateFileList():void{
        this.fileList.innerHTML=""
        if(this.selectedFiles.length==0){
            this.fileList.innerHTML="<p class=\"empty-state\">No files selected</p>"
            return
        }
        this.fileStatuses.clear()
        this.selectedFiles.forEach(file=>{
            this.fileStatuses.set(file.name,"waiting")
            this.addFileToList(file)
        })
    }
    setFileStatus(fileName:string,status:string):void{
        this.fileStatuses.set(fileName,status)
        this.updateFileStatusIcon(fileName,status)
    }
    updateFileStatusIcon(fileName:string,status:string):void{
        let escapedName=this.app.sanitizeText(fileName)
        let fileItem=this.fileList.querySelector(`.file-item[data-name="${escapedName}"]`)
        if(!fileItem)return
        let statusEl=fileItem.querySelector(".file-status") as HTMLElement|null
        if(!statusEl){
            statusEl=document.createElement("span")
            statusEl.className="file-status"
            fileItem.appendChild(statusEl)
        }
        let iconMap:Record<string,string>={
            waiting:"fa-clock",
            processing:"fa-spinner fa-spin",
            completed:"fa-check-circle",
            failed:"fa-times-circle"
        }
        let colorMap:Record<string,string>={
            waiting:"#A19F9D",
            processing:"#0078D4",
            completed:"#107C10",
            failed:"#D13438"
        }
        statusEl.innerHTML=`<i class="fas ${iconMap[status]||"fa-clock"}" style="color:${colorMap[status]||"#A19F9D"}"></i>`
    }
    updateProcessButton():void{
        this.processBtn.disabled=this.selectedFiles.length==0 ||!this.app.uiManager.ollamaStatus.running
        if(!this.app.uiManager.ollamaStatus.running){
            this.processBtn.title="Ollama is not running"
        }
        else{
            this.processBtn.title=""
        }
    }
    getFileIcon(fileType:string):string{
        let icons:Record<string,string>={
            pdf:"pdf",
            docx:"word",
            doc:"word",
            rtf:"file-alt",
            txt:"file-alt",
            md:"markdown",
            html:"code"
        }
        return icons[fileType]||"file"
    }
    formatFileSize(bytes:number):string{
        if(bytes==0)return "0 Bytes"
        let k=1024
        let sizes=["Bytes","KB","MB","GB"]
        let i=Math.floor(Math.log(bytes)/Math.log(k))
        return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+" "+sizes[i]
    }
}

export default FileManager