import type{LogEntry}from"./logger.js"
import{getCacheStats}from"./cache.js"
import{t}from"./i18n.js"
const MAX_LOG_ENTRIES=1000
const LOG_LEVELS=["debug","info","warn","error"] as const
type LogLevel=typeof LOG_LEVELS[number]
export class Devtools{
    private container:HTMLElement
    private visible:boolean=false
    private logFilter:string="all"
    private logEntries:LogEntry[]=[]
    private logOutput:HTMLElement|null=null
    private cacheContent:HTMLElement|null=null
    private workerContent:HTMLElement|null=null
    private memoryContent:HTMLElement|null=null
    private pendingRender:false|number=false
    private keydownHandler:((e:KeyboardEvent)=>void)|null=null
    private static isDevelopment():boolean{
        try{
            return typeof process!=="undefined"&&process.env&&process.env.NODE_ENV==="development"
        }catch{
            return false
        }
    }
    constructor(){
        this.container=this.createContainer()
        document.body.appendChild(this.container)
        this.bindEvents()
        if(Devtools.isDevelopment()){
            this.keydownHandler=(e:KeyboardEvent)=>{
                if(e.ctrlKey&&e.shiftKey&&e.key==="D"){
                    e.preventDefault()
                    this.toggle()
                }
            }
            document.addEventListener("keydown",this.keydownHandler)
        }
    }
    private createContainer():HTMLElement{
        let panel=document.createElement("div")
        panel.id="devtools-panel"
        panel.className="devtools-panel"
        panel.style.display="none"
        panel.innerHTML=`
      <div class="devtools-header">
        <h3>${t("devtools.title")}</h3>
        <button id="devtools-close" class="devtools-close">&times;</button>
      </div>
      <div class="devtools-tabs">
        <button class="devtools-tab active" data-tab="logs">${t("devtools.tab.logs")}</button>
        <button class="devtools-tab" data-tab="cache">${t("devtools.tab.cache")}</button>
        <button class="devtools-tab" data-tab="workers">${t("devtools.tab.workers")}</button>
        <button class="devtools-tab" data-tab="memory">${t("devtools.tab.memory")}</button>
      </div>
      <div class="devtools-content">
        <div class="devtools-tab-content active" id="devtools-logs">
          <div class="devtools-log-controls">
            <select id="devtools-log-filter">
              <option value="all">${t("devtools.logLevel.all")}</option>
              <option value="debug">${t("devtools.logLevel.debug")}</option>
              <option value="info">${t("devtools.logLevel.info")}</option>
              <option value="warn">${t("devtools.logLevel.warn")}</option>
              <option value="error">${t("devtools.logLevel.error")}</option>
            </select>
            <button id="devtools-clear-logs">${t("devtools.clearLogs")}</button>
          </div>
          <div id="devtools-log-output"></div>
        </div>
        <div class="devtools-tab-content" id="devtools-cache">
          <div id="devtools-cache-content">${t("common.loading")}</div>
        </div>
        <div class="devtools-tab-content" id="devtools-workers">
          <div id="devtools-worker-content">${t("common.loading")}</div>
        </div>
        <div class="devtools-tab-content" id="devtools-memory">
          <div id="devtools-memory-content">${t("common.loading")}</div>
        </div>
      </div>
    `
        this.logOutput=panel.querySelector("#devtools-log-output")
        this.cacheContent=panel.querySelector("#devtools-cache-content")
        this.workerContent=panel.querySelector("#devtools-worker-content")
        this.memoryContent=panel.querySelector("#devtools-memory-content")
        return panel
    }
    private bindEvents():void{
        let closeBtn=this.container.querySelector("#devtools-close")
        closeBtn?.addEventListener("click",()=>this.hide())
        let tabs=this.container.querySelectorAll(".devtools-tab")
        tabs.forEach(tab=>{
            tab.addEventListener("click",()=>{
                let tabName=(tab as HTMLElement).dataset.tab
                this.switchTab(tabName||"logs")
            })
        })
        let logFilter=this.container.querySelector("#devtools-log-filter") as HTMLSelectElement|null
        logFilter?.addEventListener("change",()=>{
            this.logFilter=logFilter.value
            this.renderLogs()
        })
        let clearLogsBtn=this.container.querySelector("#devtools-clear-logs")
        clearLogsBtn?.addEventListener("click",()=>{
            this.logEntries=[]
            this.renderLogs()
        })
    }
    private switchTab(tabName:string):void{
        let validTabs=["logs","cache","workers","memory"]
        if(!validTabs.includes(tabName))return
        let tabs=this.container.querySelectorAll(".devtools-tab")
        tabs.forEach(t=>t.classList.remove("active"))
        let activeTab=this.container.querySelector(`.devtools-tab[data-tab="${tabName}"]`)
        activeTab?.classList.add("active")
        let contents=this.container.querySelectorAll(".devtools-tab-content")
        contents.forEach(c=>c.classList.remove("active"))
        let activeContent=this.container.querySelector(`#devtools-${tabName}`)
        activeContent?.classList.add("active")
        if(tabName!=="logs"){
            this.refresh()
        }
    }
    show():void{
        if(!Devtools.isDevelopment())return
        this.container.style.display="block"
        this.visible=true
        this.refresh()
    }
    hide():void{
        this.container.style.display="none"
        this.visible=false
    }
    toggle():void{
        this.visible?this.hide():this.show()
    }
    addLog(entry:LogEntry):void{
        this.logEntries.push(entry)
        if(this.logEntries.length>MAX_LOG_ENTRIES){
            this.logEntries.shift()
        }
        if(this.visible&&this.isLogsTabActive()&&!this.pendingRender){
            this.pendingRender=requestAnimationFrame(()=>{
                this.pendingRender=false
                this.renderLogs()
            })
        }
    }
    private isLogsTabActive():boolean{
        let logsTab=this.container.querySelector("#devtools-logs")
        return logsTab?.classList.contains("active")??false
    }
    private renderLogs():void{
        if(!this.logOutput)return
        let filtered=this.logEntries
        if(this.logFilter!=="all"){
            filtered=this.logEntries.filter(e=>e.level===this.logFilter)
        }
        this.logOutput.innerHTML=""
        if(filtered.length===0){
            let empty=document.createElement("div")
            empty.className="devtools-empty"
            empty.textContent=t("devtools.noLogEntries")
            this.logOutput.appendChild(empty)
            return
        }
        let fragment=document.createDocumentFragment()
        for(let entry of filtered){
            let level=(LOG_LEVELS.includes(entry.level as LogLevel)?entry.level:"info") as LogLevel
            let levelClass=`log-level-${level}`
            let time=new Date(entry.timestamp).toLocaleTimeString()
            let row=document.createElement("div")
            row.className=`devtools-log-entry ${levelClass}`
            let timeSpan=document.createElement("span")
            timeSpan.className="log-time"
            timeSpan.textContent=time
            let levelSpan=document.createElement("span")
            levelSpan.className="log-level"
            levelSpan.textContent=`[${level.toUpperCase()}]`
            let moduleSpan=document.createElement("span")
            moduleSpan.className="log-module"
            moduleSpan.textContent=entry.module
            let messageSpan=document.createElement("span")
            messageSpan.className="log-message"
            messageSpan.textContent=entry.message
            row.appendChild(timeSpan)
            row.appendChild(levelSpan)
            row.appendChild(moduleSpan)
            row.appendChild(messageSpan)
            fragment.appendChild(row)
        }
        this.logOutput.appendChild(fragment)
        this.logOutput.scrollTop=this.logOutput.scrollHeight
    }
    refresh():void{
        this.updateCacheTab()
        this.updateWorkerTab()
        this.updateMemoryTab()
    }
    private updateCacheTab():void{
        if(!this.cacheContent)return
        let cs=getCacheStats()
        let hitRate=cs.totalRequests>0?Math.round((cs.hits/cs.totalRequests)*100):0
        this.cacheContent.innerHTML=`
      <table>
        <tr><td>${t("devtools.cache.hits")}</td><td>${cs.hits}</td></tr>
        <tr><td>${t("devtools.cache.misses")}</td><td>${cs.misses}</td></tr>
        <tr><td>${t("devtools.cache.totalRequests")}</td><td>${cs.totalRequests}</td></tr>
        <tr><td>${t("devtools.cache.hitRate")}</td><td>${hitRate}%</td></tr>
        <tr><td>${t("devtools.cache.tokensSaved")}</td><td>${cs.estimatedTokensSaved.toLocaleString("en-US")}</td></tr>
        <tr><td>${t("devtools.cache.costSaved")}</td><td>${t("devtools.cache.currencyPrefix")}${cs.estimatedCostSaved.toFixed(4)}</td></tr>
      </table>
    `
    }
    private updateWorkerTab():void{
        if(!this.workerContent)return
        let workerCount=typeof Worker!=="undefined"?2:0
        let workerStatus=typeof Worker!=="undefined"
            ?t("devtools.workers.statusAvailable")
            :t("devtools.workers.statusUnavailable")
        this.workerContent.innerHTML=`
      <table>
        <tr><td>${t("devtools.workers.pool")}</td><td>${workerCount}${t("devtools.workers.countSuffix")}</td></tr>
        <tr><td>${t("devtools.workers.status")}</td><td>${workerStatus}</td></tr>
        <tr><td>${t("devtools.workers.types")}</td><td>${t("devtools.workers.chunkWorker")}, ${t("devtools.workers.dedupWorker")}</td></tr>
      </table>
    `
    }
    private updateMemoryTab():void{
        if(!this.memoryContent)return
        if(performance&&(performance as any).memory){
            let mem=(performance as any).memory as{
                usedJSHeapSize:number
                totalJSHeapSize:number
                jsHeapSizeLimit:number
            }
            let usedMB=(mem.usedJSHeapSize/1048576).toFixed(2)
            let totalMB=(mem.totalJSHeapSize/1048576).toFixed(2)
            let limitMB=(mem.jsHeapSizeLimit/1048576).toFixed(2)
            let usagePercent=mem.jsHeapSizeLimit>0
                ?((mem.usedJSHeapSize/mem.jsHeapSizeLimit)*100).toFixed(1)
                :"0"
            this.memoryContent.innerHTML=`
        <table>
          <tr><td>${t("devtools.memory.usedHeap")}</td><td>${usedMB}${t("devtools.memory.mbSuffix")}</td></tr>
          <tr><td>${t("devtools.memory.totalHeap")}</td><td>${totalMB}${t("devtools.memory.mbSuffix")}</td></tr>
          <tr><td>${t("devtools.memory.heapLimit")}</td><td>${limitMB}${t("devtools.memory.mbSuffix")}</td></tr>
          <tr><td>${t("devtools.memory.usage")}</td><td>${usagePercent}%</td></tr>
        </table>
      `
        }
        else{
            this.memoryContent.innerHTML=`
        <p>${t("devtools.memory.unavailable")}</p>
        <p>${t("devtools.memory.preciseFlagHint")}</p>
      `
        }
    }
    private escapeHtml(text:string):string{
        let div=document.createElement("div")
        div.textContent=text
        return div.innerHTML
    }
    dispose():void{
        this.logEntries=[]
        this.visible=false
        if(this.keydownHandler){
            document.removeEventListener("keydown",this.keydownHandler)
            this.keydownHandler=null
        }
        if(this.pendingRender){
            cancelAnimationFrame(this.pendingRender)
            this.pendingRender=false
        }
        if(this.container&&this.container.parentNode){
            this.container.parentNode.removeChild(this.container)
        }
        this.logOutput=null
        this.cacheContent=null
        this.workerContent=null
        this.memoryContent=null
    }
}
