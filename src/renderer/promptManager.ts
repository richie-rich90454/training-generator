class PromptManager{
    private cache:Map<string,string>=new Map()
    private negativeCache:Set<string>=new Set()
    private inFlight:Map<string,Promise<string|null>>=new Map()
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
    async getPrompt(language:string,processingType:string):Promise<string|null>{
        let fileType=this.mapProcessingType(processingType)
        let fileName=this.buildFileName(language,fileType)
        if(this.cache.has(fileName)){
            return this.cache.get(fileName)!
        }
        if(this.negativeCache.has(fileName)){
            return null
        }
        let existing=this.inFlight.get(fileName)
        if(existing){
            return existing
        }
        let promise=this.loadPrompt(language,fileType,fileName)
        this.inFlight.set(fileName,promise)
        try{
            let result=await promise
            if(result!=null){
                this.cache.set(fileName,result)
            }
            else{
                this.negativeCache.add(fileName)
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
        let fileName=this.buildFileName(language,processingType)
        this.cache.delete(fileName)
        this.negativeCache.delete(fileName)
    }
}
export default PromptManager
