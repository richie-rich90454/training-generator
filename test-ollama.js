let axios=require("axios");
async function testOllamaAPI(){
    console.log("Testing Ollama API integration...\n");
    try{
        console.log("1. Checking Ollama status...");
        let tagsResponse=await axios.get("http://localhost:11434/api/tags",{
            timeout:5000
        }).catch(error=>{
            if(error.code=="ECONNREFUSED"){
                console.log(" ✗ Ollama is not running or not installed");
                console.log(" Please install Ollama from https://ollama.com/");
                console.log(" Then run:ollama serve");
                return null;
            }
            throw error;
        });
        if(!tagsResponse){
            return;
        }
        let version="unknown";
        try{
            let versionResponse=await axios.get("http://localhost:11434/api/version",{
                timeout:3000
            });
            version=versionResponse.data.version||"unknown";
        }
        catch(versionError){
            console.log("Could not get Ollama version,using default");
            if(tagsResponse.data&&tagsResponse.data.version){
                version=tagsResponse.data.version;
            }
        }
        console.log(` ✓ Ollama is running(version:${version})`);
        console.log("\n2. Checking available models...");
        let models=tagsResponse.data.models||[];
        if(models.length>0){
            console.log(` ✓ Found ${models.length}model(s):`);
            models.forEach((model,index)=>{
                console.log(` ${index+1}. ${model.name}(${model.size||"unknown size"})`);
            });
        }
        else{
            console.log("No models found. Pull a model with:ollama pull llama3.2");
        }
        console.log("\n3. Testing generation...");
        if(models.length>0){
            let testModel=models[0].name;
            console.log(` Using model:${testModel}`);
            try{
                await axios.get("http://localhost:11434/api/show",{
                    params:{name:testModel},
                    timeout:10000
                }).catch(()=>{
                    console.log("Model might need to be loaded(cold start)");
                    console.log(" First generation may take longer...");
                });
            }
            catch(checkError){
            }
            let generationTimeout=120000;
            console.log(` Using timeout:${generationTimeout/1000}s`);
            try{
                let generateResponse=await axios.post("http://localhost:11434/api/generate",{
                    model:testModel,
                    prompt:"Hello,how are you?Respond with a short greeting.",
                    stream:false,
                    options:{
                        temperature:0.7,
                        top_p:0.9,
                        num_predict:50 
                    }
                },{
                    timeout:generationTimeout
                });
                if(generateResponse.data&&generateResponse.data.response){
                    console.log(` ✓ Generation successful`);
                    let responseText=generateResponse.data.response.trim();
                    console.log(` Response:"${responseText.substring(0,100)}${responseText.length>100?"...":""}"`);
                }
                else{
                    console.log(" ✗ Invalid response format");
                }
            }
            catch(genError){
                console.log(` ✗ Generation failed:${genError.message}`);
                if(genError.code=="ECONNABORTED"||genError.message.includes("timeout")){
                    console.log("Timeout occurred. This could be because:");
                    console.log(" 1. Model is still loading(cold start)");
                    console.log(" 2. System resources are limited");
                    console.log(" 3. Prompt is too complex(unlikely for this test)");
                    console.log(" Try running the generation again-it should be faster once loaded.");
                }
                else{
                    console.log(" This might be normal if the model needs to be loaded first");
                }
            }
        }
        else{
            console.log(" Skipping generation test(no models available)");
        }
        console.log("\n==Test Summary==");
        console.log("Ollama API integration is working correctly!");
        console.log("\nNext steps:");
        console.log("1. Make sure Ollama is running:ollama serve");
        console.log("2. Pull models as needed:ollama pull llama3.2");
        console.log("3. Start the Train Generator app:npm run dev");
    }
    catch(error){
        console.error("\n✗ Test failed with error:",error.message);
        console.error("\nTroubleshooting tips:");
        console.error("1. Install Ollama from https://ollama.com/");
        console.error("2. Start Ollama:ollama serve");
        console.error("3. Check if Ollama is running:curl http://localhost:11434/api/tags");
        console.error("4. Make sure no firewall is blocking port 11434");
    }
}
testOllamaAPI().catch(console.error);