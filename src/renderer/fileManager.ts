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
    private getEl<T extends HTMLElement>(id:string):T{
        let el=document.getElementById(id)
        if(!el){
            console.warn(`FileManager: missing DOM element #${id}`)
        }
        return el as unknown as T
    }
    cacheElements():void{
        this.dropZone=this.getEl<HTMLElement>("drop-zone")
        this.fileInput=this.getEl<HTMLInputElement>("file-input")
        this.browseBtn=this.getEl<HTMLElement>("browse-btn")
        this.fileList=this.getEl<HTMLElement>("file-list")
        this.processBtn=this.getEl<HTMLButtonElement>("process-btn")
        this.clearBtn=this.getEl<HTMLButtonElement>("clear-btn")
        this.filesCountEl=this.getEl<HTMLElement>("files-count")
        this.lastProcessedEl=this.getEl<HTMLElement>("last-processed")
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
        let files=Array.from(e.dataTransfer?.files ?? [])
        await this.addFiles(files)
    }
    async handleFileSelect(e:Event):Promise<void>{
        let target=e.target as HTMLInputElement|null
        let files=Array.from(target?.files ?? [])
        await this.addFiles(files)
        if(target)target.value=""
    }
    async addFiles(files:File[]):Promise<void>{
        let maxFiles=100
        let remainingSlots=maxFiles-this.selectedFiles.length
        if(remainingSlots<=0){
            this.app.addLog(`Maximum of ${maxFiles} files already selected`,"warning")
            return
        }
        if(files.length>remainingSlots){
            this.app.addLog(`Only ${remainingSlots} more file(s) can be added (max ${maxFiles})`,"warning")
            files=files.slice(0,remainingSlots)
        }
        let validFiles=files.filter(file=>{
            let ext=file.name.split(".").pop()!.toLowerCase()
            if(!ext||ext===file.name.toLowerCase())return false
            return ["pdf","docx","doc","rtf","txt","md","html"].includes(ext)
        })
        if(validFiles.length==0){
            this.app.addLog("No valid files selected. Supported formats: PDF, DOCX, DOC, RTF, TXT, MD, HTML","warning")
            return
        }
        let addedCount=0
        let skippedCount=0
        for(let file of validFiles){
            let maxSize=100*1024*1024
            if(file.size>maxSize){
                this.app.addLog(`File too large: ${file.name} (${this.formatFileSize(file.size)}). Maximum size is 100MB.`,"warning")
                skippedCount++
                continue
            }
            if(file.name.toLowerCase().endsWith(".pdf") && file.size>20*1024*1024){
                this.app.addLog(`Large PDF detected: ${file.name} (${this.formatFileSize(file.size)}). Processing may take longer.`,"info")
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
            this.app.addLog(`Added ${addedCount} file(s)`,"success")
        }
        if(skippedCount>0){
            this.app.addLog(`Skipped ${skippedCount} file(s) due to size limits`,"warning")
        }
    }
    addFileToList(fileObj:SelectedFile):void{
        let fileItem=document.createElement("div")
        fileItem.className="file-item"
        let escapedName=this.app.sanitizeText(fileObj.name)
        let fileId=encodeURIComponent(fileObj.name)
        fileItem.setAttribute("data-id",fileId)
        fileItem.innerHTML=`
            <div class="file-info">
                <i class="fas fa-file-${this.getFileIcon(fileObj.type)} file-icon"></i>
                <div class="file-details">
                    <div class="file-name" title="${escapedName}">${escapedName}</div>
                    <div class="file-size">${this.formatFileSize(fileObj.size)}</div>
                </div>
            </div>
            <span class="file-status" aria-label="Status: waiting"></span>
            <button class="file-remove" data-id="${fileId}" aria-label="Remove ${escapedName}">
                <i class="fas fa-times"></i>
            </button>
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
        this.fileStatuses.clear()
        if(this.selectedFiles.length==0){
            this.fileList.innerHTML="<p class=\"empty-state\">No files selected</p>"
            return
        }
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
        let fileId=encodeURIComponent(fileName)
        let fileItem=this.fileList.querySelector(`.file-item[data-id="${fileId}"]`)
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
        let labelMap:Record<string,string>={
            waiting:"Waiting",
            processing:"Processing",
            completed:"Completed",
            failed:"Failed"
        }
        let colorMap:Record<string,string>={
            waiting:"#A19F9D",
            processing:"#0078D4",
            completed:"#107C10",
            failed:"#D13438"
        }
        let label=labelMap[status]||"Waiting"
        let iconClass=iconMap[status]||"fa-clock"
        let iconColor=colorMap[status]||"#A19F9D"
        statusEl.setAttribute("aria-label","Status: "+label)
        statusEl.innerHTML='<i class="fas '+iconClass+'" style="color:'+iconColor+'" aria-hidden="true"></i><span class="file-status-label">'+label+"</span>"
    }
    updateProcessButton():void{
        let ollamaReady=this.app.uiManager?.ollamaStatus?.running??false
        let demoActive=this.app.processor?.demoMode??false
        this.processBtn.disabled=this.selectedFiles.length==0||(!ollamaReady&&!demoActive)
        if(!ollamaReady&&!demoActive){
            this.processBtn.title="Ollama is not running"
        }
        else if(demoActive){
            this.processBtn.title="Demo mode active"
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
        if(bytes===0)return "0 Bytes"
        let k=1024
        let singular=["Byte","KB","MB","GB"]
        let plural=["Bytes","KB","MB","GB"]
        let i=Math.floor(Math.log(bytes)/Math.log(k))
        let value=parseFloat((bytes/Math.pow(k,i)).toFixed(2))
        let label=value===1?singular[i]:plural[i]
        return value+" "+label
    }
}

export default FileManager