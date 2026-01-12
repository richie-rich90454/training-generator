const axios=require("axios");
class OllamaClient{
    constructor(options ={}){
        this.options ={
            ollamaUrl:options.ollamaUrl||"http://localhost:11434",
            timeout:options.timeout||300000,
            maxRetries:options.maxRetries||2,
            ...options
        };
    }
    async checkStatus(){
        try{
            const tagsResponse=await axios.get(`${this.options.ollamaUrl}/api/tags`,{timeout:5000});
            let version="unknown";
            try{
                const versionResponse=await axios.get(`${this.options.ollamaUrl}/api/version`,{timeout:3000});
                version=versionResponse.data.version||"unknown";
            }
            catch{
                if (tagsResponse.data?.version){
                    version=tagsResponse.data.version;
                }
            }
            return{
                running:true,
                models:tagsResponse.data.models||[],
                version
            };
        }
        catch (error){
            return{running:false,error:error.message};
        }
    }
    async generate(model,prompt,options ={}){
        const promptLength=prompt.length;
        let timeout=this.options.timeout;
        if (promptLength>10000) timeout=600000;
        else if (promptLength>5000) timeout=450000;
        let lastError=null;
        for (let attempt=0;attempt<=this.options.maxRetries;attempt++){
            try{
                try{
                    await axios.get(`${this.options.ollamaUrl}/api/show`,{
                        params:{name:model},
                        timeout:10000
                    }).catch(()=>{});
                }
                catch{}
                const response=await axios.post(
                    `${this.options.ollamaUrl}/api/generate`,
                    {
                        model,
                        prompt,
                        stream:false,
                        options:{
                            temperature:options.temperature??0.7,
                            top_p:options.top_p??0.9,
                            ...options
                        }
                    },
                    {
                        timeout,
                        headers:{
                            "Content-Type":"application/json",
                            "Accept":"application/json"
                        }
                    }
                );
                if (!response.data?.response){
                    throw new Error("Invalid response from Ollama");
                }
                return{success:true,response:response.data.response};
            }
            catch (error){
                lastError=error;
                if (error.code=="ECONNABORTED"||error.message.includes("timeout")){
                    if (attempt<this.options.maxRetries){
                        await new Promise(resolve=>setTimeout(resolve,5000));
                    }
                }
                else{
                    break;
                }
            }
        }
        throw new Error(`Failed after ${this.options.maxRetries + 1}attempts:${lastError?.message||"Unknown error"}`);
    }
}
module.exports=OllamaClient;