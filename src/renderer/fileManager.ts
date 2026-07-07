import type{SelectedFile}from"../types/index.js"
import{renderIcon}from"./icons.js"
import{t}from"./i18n.js"

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
            this.app.addLog(t("log.maxFilesReached",undefined,{maxFiles:String(maxFiles)}),"warning")
            return
        }
        if(files.length>remainingSlots){
            this.app.addLog(t("log.remainingFiles",undefined,{remaining:String(remainingSlots),maxFiles:String(maxFiles)}),"warning")
            files=files.slice(0,remainingSlots)
        }
        let validFiles=files.filter(file=>{
            let ext=file.name.split(".").pop()!.toLowerCase()
            if(!ext||ext===file.name.toLowerCase())return false
            return ["pdf","docx","doc","rtf","txt","md","html"].includes(ext)
        })
        if(validFiles.length==0){
            this.app.addLog(t("toast.noValidFiles"),"warning")
            return
        }
        let addedCount=0
        let skippedCount=0
        for(let file of validFiles){
            let maxSize=100*1024*1024
            if(file.size>maxSize){
                this.app.addLog(t("toast.fileTooLarge",undefined,{name:file.name,size:this.formatFileSize(file.size)}),"warning")
                skippedCount++
                continue
            }
            if(file.name.toLowerCase().endsWith(".pdf") && file.size>20*1024*1024){
                this.app.addLog(t("log.largePdf",undefined,{name:file.name,size:this.formatFileSize(file.size)}),"info")
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
            this.app.addLog(t("log.filesAdded",undefined,{count:String(addedCount)}),"success")
        }
        if(skippedCount>0){
            this.app.addLog(t("log.filesSkippedSize",undefined,{count:String(skippedCount)}),"warning")
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
                <span class="file-icon">${renderIcon(`fa-file-${this.getFileIcon(fileObj.type)}`, 20)}</span>
                <div class="file-details">
                    <div class="file-name" title="${escapedName}">${escapedName}</div>
                    <div class="file-size">${this.formatFileSize(fileObj.size)}</div>
                </div>
            </div>
            <span class="file-status" data-i18n-aria-label="file.status.waitingAria"></span>
            <button class="file-remove" data-id="${fileId}" data-i18n-aria-label="file.removeAria" data-i18n-params-name="${escapedName}">
                ${renderIcon("fa-times")}
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
        this.app.addLog(t("log.fileRemoved",undefined,{name:fileName}),"info")
    }
    updateFileList():void{
        this.fileList.innerHTML=""
        this.fileStatuses.clear()
        if(this.selectedFiles.length==0){
            this.fileList.innerHTML=`<p class="empty-state" data-i18n="files.empty">${t("files.empty")}</p>`
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
            waiting:renderIcon("fa-clock"),
            processing:'<span class="tg-spinner">'+renderIcon("fa-spinner")+'</span>',
            completed:renderIcon("fa-check-circle"),
            failed:renderIcon("fa-times-circle")
        }
        let labelMap:Record<string,string>={
            waiting:t("file.status.waiting"),
            processing:t("file.status.processing"),
            completed:t("file.status.completed"),
            failed:t("file.status.failed")
        }
        let colorMap:Record<string,string>={
            waiting:"#A19F9D",
            processing:"#0078D4",
            completed:"#107C10",
            failed:"#D13438"
        }
        let label=labelMap[status]||t("file.status.waiting")
        let iconSvg=iconMap[status]||renderIcon("fa-clock")
        let iconColor=colorMap[status]||"#A19F9D"
        statusEl.setAttribute("aria-label",t("file.status.aria",undefined,{label}))
        statusEl.innerHTML='<span style="color:'+iconColor+'" aria-hidden="true">'+iconSvg+'</span><span class="file-status-label">'+label+"</span>"
    }
    updateProcessButton():void{
        let ollamaReady=this.app.uiManager?.ollamaStatus?.running??false
        let demoActive=this.app.processor?.demoMode??false
        this.processBtn.disabled=this.selectedFiles.length==0||(!ollamaReady&&!demoActive)
        if(!ollamaReady&&!demoActive){
            this.processBtn.title=t("processBtn.tooltip.ollamaOffline")
        }
        else if(demoActive){
            this.processBtn.title=t("processBtn.tooltip.demoActive")
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
        if(bytes===0)return "0 "+t("fileSize.bytes")
        let k=1024
        let i=Math.floor(Math.log(bytes)/Math.log(k))
        let value=parseFloat((bytes/Math.pow(k,i)).toFixed(2))
        let label=t("fileSize.bytes")
        if(i===0)label=value===1?t("fileSize.byte"):t("fileSize.bytes")
        else if(i===1)label=t("fileSize.kb")
        else if(i===2)label=t("fileSize.mb")
        else if(i>=3)label=t("fileSize.gb")
        return value+" "+label
    }
}

export default FileManager