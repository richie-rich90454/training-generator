class PromptManager{
    private cache:Map<string,string>=new Map()
    private negativeCache:Map<string,number>=new Map()
    private inFlight:Map<string,Promise<string|null>>=new Map()
    private static readonly NEGATIVE_CACHE_TTL_MS=60_000
    private mapProcessingType(processingType:string):string{
        let processingTypeMap:Record<string,string>={
            "instruction":"instruction",
            "conversation":"conversation",
            "chunking":"chunking",
            "custom":"custom"
        }
        return processingTypeMap[processingType]||"instruction"
    }
    private buildFileName(language:string,processingType:string):string{
        let fileType=this.mapProcessingType(processingType)
        return `${language}_${fileType}.txt`
    }
    private sanitizeLocale(value:string):string{
        if(!value||typeof value!=="string"){
            return "en"
        }
        if(/[\\/]/.test(value)||value.includes("..")){
            return "en"
        }
        if(!/^[A-Za-z0-9-]+$/.test(value)){
            return "en"
        }
        return value
    }
    private isNegativeCached(fileName:string):boolean{
        let addedAt=this.negativeCache.get(fileName)
        if(addedAt===undefined){
            return false
        }
        if(Date.now()-addedAt>PromptManager.NEGATIVE_CACHE_TTL_MS){
            this.negativeCache.delete(fileName)
            return false
        }
        return true
    }
    async getPrompt(language:string,processingType:string):Promise<string|null>{
        let safeLanguage=this.sanitizeLocale(language)
        let fileType=this.mapProcessingType(processingType)
        let fileName=this.buildFileName(safeLanguage,fileType)
        if(this.cache.has(fileName)){
            return this.cache.get(fileName)!
        }
        if(this.isNegativeCached(fileName)){
            return null
        }
        let existing=this.inFlight.get(fileName)
        if(existing){
            return existing
        }
        let promise=this.loadPrompt(safeLanguage,fileType,fileName)
        this.inFlight.set(fileName,promise)
        try{
            let result=await promise
            if(result!=null){
                this.cache.set(fileName,result)
            }
            else{
                this.negativeCache.set(fileName,Date.now())
            }
            return result
        }
        finally{
            this.inFlight.delete(fileName)
        }
    }
    private async loadPrompt(language:string,fileType:string,fileName:string):Promise<string|null>{
        if(window.electronAPI?.getPrompt){
            try{
                let result=await window.electronAPI.getPrompt(language,fileType)
                if(result.success&&result.content!=null&&result.content!==""){
                    return result.content
                }
            }
            catch(error){
                console.error(`PromptManager: IPC getPrompt failed for ${fileName}`,(error as Error).message)
            }
        }
        let possiblePaths=[
            `src/prompts/${fileName}`,
            `prompts/${fileName}`,
            `./prompts/${fileName}`,
            `../prompts/${fileName}`,
        ]
        if(window.electronAPI?.readFile){
            for(let filePath of possiblePaths){
                try{
                    let result=await window.electronAPI.readFile(filePath)
                    if(result.success&&result.content){
                        return result.content
                    }
                }
                catch(error){
                    console.error(`PromptManager: failed to read prompt file ${filePath}`,(error as Error).message)
                }
            }
        }
        for(let filePath of possiblePaths){
            try{
                let response=await fetch(filePath)
                if(response.ok){
                    return await response.text()
                }
            }
            catch(error){
                console.error(`PromptManager: failed to fetch prompt file ${filePath}`,(error as Error).message)
            }
        }
        return null
    }
    async getPromptWithFallback(language:string,processingType:string):Promise<string|null>{
        let prompt=await this.getPrompt(language,processingType)
        if(prompt)return prompt
        if(language.includes("-")){
            let baseLanguage=language.split("-")[0]
            if(baseLanguage&&baseLanguage!==language){
                prompt=await this.getPrompt(baseLanguage,processingType)
                if(prompt)return prompt
            }
        }
        if(language!=="en"){
            prompt=await this.getPrompt("en",processingType)
            if(prompt)return prompt
        }
        return null
    }
    invalidateCache():void{
        this.cache.clear()
        this.negativeCache.clear()
        this.inFlight.clear()
    }
    invalidatePrompt(language:string,processingType:string):void{
        let safeLanguage=this.sanitizeLocale(language)
        let fileName=this.buildFileName(safeLanguage,processingType)
        this.cache.delete(fileName)
        this.negativeCache.delete(fileName)
    }
}
export default PromptManager
