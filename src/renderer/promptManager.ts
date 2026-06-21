class PromptManager{
    private cache:Map<string,string>=new Map()
    private fallbackCache:Map<string,string>=new Map()

    async getPrompt(language:string,processingType:string):Promise<string|null>{
        let processingTypeMap:Record<string,string>={
            "instruction":"instruction",
            "conversation":"conversation",
            "chunking":"chunking",
            "custom":"custom"
        }
        let fileType=processingTypeMap[processingType]||"instruction"
        let fileName=`${language}_${fileType}.txt`
        if(this.cache.has(fileName)){
            return this.cache.get(fileName)!
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
                        this.cache.set(fileName,result.content)
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
                    let text=await response.text()
                    this.cache.set(fileName,text)
                    return text
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
        this.fallbackCache.clear()
    }

    invalidatePrompt(language:string,processingType:string):void{
        let processingTypeMap:Record<string,string>={
            "instruction":"instruction",
            "conversation":"conversation",
            "chunking":"chunking",
            "custom":"custom"
        }
        let fileType=processingTypeMap[processingType]||"instruction"
        let fileName=`${language}_${fileType}.txt`
        this.cache.delete(fileName)
    }
}

export default PromptManager