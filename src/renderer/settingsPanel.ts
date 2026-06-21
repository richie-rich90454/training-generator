import type{FullAppSettings}from"../types/index.js"

export function initSettings(uiManager:any):void{
    loadAppSettings(uiManager)
    let resetSettingsBtn=document.getElementById("reset-settings")
    let saveSettingsBtn=document.getElementById("save-settings")
    if(resetSettingsBtn){
        resetSettingsBtn.addEventListener("click",()=>resetSettings(uiManager))
    }
    if(saveSettingsBtn){
        saveSettingsBtn.addEventListener("click",()=>saveAppSettings(uiManager))
    }
    let settingsInputs=document.querySelectorAll("#settings-modal input,#settings-modal select")
    settingsInputs.forEach(input=>{
        input.addEventListener("change",()=>{
            let autoSave=document.getElementById("auto-save") as HTMLInputElement|null
            if(autoSave&&autoSave.checked){
                saveAppSettings(uiManager)
            }
        })
    })
}

function loadAppSettings(uiManager:any):void{
    try{
        let settings=JSON.parse(localStorage.getItem("training-generator-app-settings")||"{}") as FullAppSettings
        if(settings.theme){
            let themeSelect=document.getElementById("theme-select") as HTMLSelectElement|null
            if(themeSelect)themeSelect.value=settings.theme
            uiManager.applyTheme(settings.theme)
        }
        if(settings.fontSize){
            let fontSizeSelect=document.getElementById("font-size") as HTMLSelectElement|null
            if(fontSizeSelect)fontSizeSelect.value=settings.fontSize
            uiManager.applyFontSize(settings.fontSize)
        }
        let checkboxes:Array<keyof FullAppSettings>=["auto-save","auto-check-ollama","start-maximized","remember-window-size"]
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
        uiManager.addLog("Application settings loaded","info")
    }
    catch(error){
        console.error("Failed to load application settings:",error)
    }
}

function saveAppSettings(uiManager:any):void{
    try{
        let settings:FullAppSettings={}
        let themeSelect=document.getElementById("theme-select") as HTMLSelectElement|null
        if(themeSelect){
            settings.theme=themeSelect.value
            uiManager.applyTheme(themeSelect.value)
        }
        let fontSizeSelect=document.getElementById("font-size") as HTMLSelectElement|null
        if(fontSizeSelect){
            settings.fontSize=fontSizeSelect.value
            uiManager.applyFontSize(fontSizeSelect.value)
        }
        let checkboxes:Array<keyof FullAppSettings>=["auto-save","auto-check-ollama","start-maximized","remember-window-size"]
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
        localStorage.setItem("training-generator-app-settings",JSON.stringify(settings))
        uiManager.addLog("Application settings saved","success")
    }
    catch(error){
        uiManager.addLog("Failed to save application settings","error")
    }
}

function resetSettings(uiManager:any):void{
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
        let maxFileSize=document.getElementById("max-file-size") as HTMLInputElement|null
        if(maxFileSize)maxFileSize.value="100"
        uiManager.applyTheme("auto")
        uiManager.applyFontSize("medium")
        saveAppSettings(uiManager)
        uiManager.addLog("Settings reset to defaults","success")
    }
    catch(error){
        uiManager.addLog("Failed to reset settings","error")
    }
}