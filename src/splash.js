(function(){
    function getPlatform(){
        let ua=navigator.userAgentData
        if(ua&&ua.platform){
            let p=ua.platform.toLowerCase()
            if(p.includes("win"))return "windows"
            if(p.includes("mac"))return "macos"
            return "linux"
        }
        let legacy=(navigator.platform||"").toLowerCase()
        if(legacy.includes("win"))return "windows"
        if(legacy.includes("mac"))return "macos"
        return "linux"
    }
    document.documentElement.setAttribute("data-platform", getPlatform())
    try{
        let fontUrl=new URL("../assets/NotoSans-VariableFont_wdth_wght.ttf", window.location.href).href
        let style=document.createElement("style")
        style.textContent=`@font-face{font-family:"Noto Sans";src:url("${fontUrl}") format("truetype");font-display:swap;font-weight:1 1000}`
        document.head.appendChild(style)
    }
    catch{}
    let progressBar=document.getElementById("progress-bar")
    let loadingText=document.getElementById("loading-text")
    let versionText=document.getElementById("version-text")
    if(versionText&&window.__appVersion){
        versionText.textContent=window.__appVersion
    }
    let steps=["Initializing application...", "Loading core modules...", "Setting up file parser...", "Connecting to Ollama...", "Preparing user interface...", "Almost ready..."]
    let currentStep=0
    let totalSteps=steps.length
    let timers=[]
    function schedule(fn,delay){
        let id=setTimeout(fn,delay)
        timers.push(id)
        return id
    }
    function clearAllTimers(){
        timers.forEach(id=>clearTimeout(id))
        timers=[]
    }
    function updateProgress(){
        if(!progressBar||!loadingText)return
        if(currentStep<totalSteps){
            let progress=(currentStep/totalSteps)*100
            progressBar.style.width=`${progress}%`
            loadingText.textContent=steps[currentStep]
            currentStep++
            let nextDelay=300+Math.random()*700
            schedule(updateProgress,nextDelay)
        }
        else{
            progressBar.style.width="100%"
            loadingText.textContent="Ready! Starting application..."
        }
    }
    if(progressBar&&loadingText){
        schedule(updateProgress,500)
    }
    window.addEventListener("pagehide",clearAllTimers)
})()
