const FileParserLazy=require("../core/fileParserLazy");
const OllamaClient=require("./ollamaClient");
const PromptManager=require("./promptManager");
const OutputFormatter=require("./outputFormatter");
const TextProcessor=require("./textProcessor");
class ProcessingEngine{
    constructor(options={}){
        this.options={
            ollamaUrl:options.ollamaUrl||"http://localhost:11434",
            timeout:options.timeout||300000,
            maxRetries:options.maxRetries||2,
            ...options
        };
        this.fileParser=null;
        this.ollamaClient=new OllamaClient(this.options);
        this.promptManager=new PromptManager();
        this.outputFormatter=new OutputFormatter();
        this.textProcessor=new TextProcessor();
        this.ollamaStatus={running:false,models:[]};
        this.supportedFormats=["pdf","docx","doc","rtf","txt","md","html"];
    }
    async initialize(){
        try{
            this.fileParser=new FileParserLazy();
            await this.checkOllamaStatus();
            return{success:true,ollamaStatus:this.ollamaStatus};
        }
        catch(error){
            return{success:false,error:error.message};
        }
    }
    async checkOllamaStatus(){
        this.ollamaStatus=await this.ollamaClient.checkStatus();
        return this.ollamaStatus;
    }
    async generateWithOllama(model,prompt,options={}){
        return await this.ollamaClient.generate(model,prompt,options);
    }
    async parseFile(filePath,fileType=null){
        if(!this.fileParser){
            this.fileParser=new FileParserLazy();
        }
        try{
            const path=require("path");
            const ext=fileType||path.extname(filePath).toLowerCase().replace(".","");
            if(!this.supportedFormats.includes(ext)){
                throw new Error(`Unsupported file format:${ext}. Supported formats:${this.supportedFormats.join(",")}`);
            }
            const text=await this.fileParser.parseFile(filePath,ext);
            return{success:true,content:text};
        }
        catch(error){
            return{success:false,error:error.message};
        }
    }
    async parseFiles(filePaths){
        if(!this.fileParser){
            this.fileParser=new FileParserLazy();
        }
        try{
            const results=await this.fileParser.processFiles(filePaths);
            return{success:true,results};
        }
        catch(error){
            return{success:false,error:error.message};
        }
    }
    async loadPrompt(language,processingType){
        return await this.promptManager.loadPrompt(language,processingType);
    }
    getFallbackPrompt(text,processingType,language="en"){
        return this.promptManager.getFallbackPrompt(text,processingType);
    }
    chunkText(text,chunkSize){
        return this.textProcessor.chunkText(text,chunkSize);
    }
    parseQuestionAnswerPairs(text){
        return this.outputFormatter.parseQuestionAnswerPairs(text);
    }
    parseConversationTurns(text){
        return this.outputFormatter.parseConversationTurns(text);
    }
    createTrainingItems(input,output,processingType,outputFormat){
        return this.outputFormatter.createTrainingItems(input,output,processingType,outputFormat);
    }
    formatOutput(data,format){
        return this.outputFormatter.formatOutput(data,format);
    }
    async processFile(filePath,options={}){
        const{
            model,
            processingType="instruction",
            outputFormat="jsonl",
            language="en",
            chunkSize=2000,
            temperature=0.7,
            onProgress=null
        }=options;
        const parseResult=await this.parseFile(filePath);
        if(!parseResult.success){
            return{success:false,error:`Failed to parse file:${parseResult.error}`};
        }
        const text=parseResult.content;
        const chunks=this.chunkText(text,chunkSize);
        if(onProgress){
            onProgress(0,`Processing ${chunks.length}chunks...`);
        }
        const allItems=[];
        for(let i=0;i<chunks.length;i++){
            const chunk=chunks[i];
            if(onProgress){
                onProgress((i/chunks.length)*100,`Processing chunk ${i+1}/${chunks.length}...`);
            }
            const promptResult=await this.loadPrompt(language,processingType);
            if(!promptResult.success){
                return{success:false,error:`Failed to load prompt:${promptResult.error}`};
            }
            const prompt=promptResult.content.replace("{{text}}",chunk);
            try{
                const generationResult=await this.generateWithOllama(model,prompt,{temperature});
                if(!generationResult.success){
                    console.warn(`Failed to generate for chunk ${i+1}:${generationResult.error}`);
                    continue;
                }
                const items=this.createTrainingItems(chunk,generationResult.response,processingType,outputFormat);
                allItems.push(...items);
            }
            catch(error){
                console.warn(`Error processing chunk ${i+1}:${error.message}`);
            }
        }
        if(onProgress){
            onProgress(100,"Processing complete!");
        }
        return{
            success:true,
            items:allItems,
            stats:{
                totalChunks:chunks.length,
                totalItems:allItems.length,
                fileSize:text.length
            }
        };
    }
    async processFiles(filePaths,options={}){
        const results=[];
        for(let i=0;i<filePaths.length;i++){
            const filePath=filePaths[i];
            if(options.onProgress){
                options.onProgress((i/filePaths.length)*100,`Processing file ${i+1}/${filePaths.length}:${filePath}`);
            }
            const result=await this.processFile(filePath,options);
            results.push({
                filePath,
                success:result.success,
                items:result.items||[],
                error:result.error,
                stats:result.stats
            });
        }
        return results;
    }
}
module.exports=ProcessingEngine;