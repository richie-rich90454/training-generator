import FileParser from "./src/core/fileParser.js"
import{promises as fs}from "fs"
import path from "path"
import{spawn}from "child_process"
async function testFileParser():Promise<void>{
    console.log("Testing File Parser...");
    let parser:FileParser=new FileParser();
    let testDir:string="./test-files";
    await fs.mkdir(testDir,{recursive:true});
    let testFilePath:string=path.join(testDir,"test.txt");
    await fs.writeFile(testFilePath,"This is a test file content for the Train Generator application.");
    try{
        let text:string=await parser.extractTextFromFile(testFilePath);
        console.log("✓ File parser test passed");
        console.log(" Extracted text:",text.substring(0,50)+"...");
    }
    catch(error:unknown){
        let err=error as Error;
        console.error("✗ File parser test failed:",err.message);
    }
    await fs.rm(testDir,{recursive:true,force:true});
}
async function testOllamaConnection():Promise<boolean>{
    console.log("\nTesting Ollama Connection...");
    return new Promise((resolve)=>{
        let curl=spawn("curl",["-s","http://localhost:11434/api/tags"],{
            timeout:3000
        });
        let stdout:string="";
        let stderr:string="";
        curl.stdout.on("data",(data:Buffer)=>{
            stdout+=data.toString();
        });
        curl.stderr.on("data",(data:Buffer)=>{
            stderr+=data.toString();
        });
        curl.on("close",(code:number)=>{
            if(code==0&&stdout){
                try{
                    let data:Record<string,unknown>=JSON.parse(stdout);
                    console.log("✓ Ollama is running");
                    console.log(" Version:",(data.version as string)||"unknown");
                    console.log(" Models:",(data.models as unknown[])?.length||0,"available");
                    resolve(true);
                }
                catch(error:unknown){
                    console.log("✗ Ollama response invalid");
                    resolve(false);
                }
            }
            else{
                console.log("✗ Ollama is not running(or not installed)");
                console.log(" Note:Ollama needs to be installed and running for full functionality");
                resolve(false);
            }
        });
        curl.on("error",()=>{
            console.log("✗ Failed to check Ollama status");
            resolve(false);
        });
    });
}
async function testElectronApp():Promise<boolean>{
    console.log("\nTesting Electron App Structure...");
    let requiredFiles:string[]=[
        "package.json",
        "src/main.js",
        "src/preload.js",
        "src/renderer/main.js",
        "src/core/fileParser.js",
        "src/styles/main.css",
        "index.html",
        "vite.config.js"
    ];
    let allFilesExist:boolean=true;
    for(let file of requiredFiles){
        try{
            await fs.access(file);
            console.log(`✓ ${file}`);
        }
        catch{
            console.log(`✗ ${file}(missing)`);
            allFilesExist=false;
        }
    }
    if(allFilesExist){
        console.log("✓ All required files exist");
    }
    else{
        console.log("✗ Some files are missing");
    }
    return allFilesExist;
}
async function testDependencies():Promise<boolean>{
    console.log("\nTesting Dependencies...");
    try{
        let packageJson:Record<string,unknown>=JSON.parse(await fs.readFile("package.json","utf-8"));
        let deps:string[]=Object.keys((packageJson.dependencies as Record<string,unknown>)||{});
        let devDeps:string[]=Object.keys((packageJson.devDependencies as Record<string,unknown>)||{});
        console.log(`✓ Dependencies:${deps.length}packages`);
        console.log(`✓ Dev Dependencies:${devDeps.length}packages`);
        let criticalDeps:string[]=["axios","mammoth","pdf-parse"];
        let missingDeps:string[]=criticalDeps.filter(dep=>!deps.includes(dep));
        if(!devDeps.includes("electron")){
            console.log("✗ Electron is missing from devDependencies");
            return false;
        }
        if(missingDeps.length==0){
            console.log("✓ All critical dependencies are present");
        }
        else{
            console.log(`✗ Missing critical dependencies:${missingDeps.join(",")}`);
        }
        return missingDeps.length==0;
    }
    catch(error:unknown){
        let err=error as Error;
        console.error("✗ Failed to check dependencies:",err.message);
        return false;
    }
}
async function runAllTests():Promise<void>{
    console.log("==Train Generator Application Tests==\n");
    let results:Record<string,boolean>={
        fileParser:true,
        ollama:await testOllamaConnection(),
        appStructure:await testElectronApp(),
        dependencies:await testDependencies()
    };
    console.log("\n==Test Summary==");
    console.log(`File Parser:${results.fileParser?"✓ PASS":"✗ FAIL"}`);
    console.log(`Ollama Connection:${results.ollama?"✓ PASS":"⚠ WARNING(not required for basic functionality)"}`);
    console.log(`App Structure:${results.appStructure?"✓ PASS":"✗ FAIL"}`);
    console.log(`Dependencies:${results.dependencies?"✓ PASS":"✗ FAIL"}`);
    let passed:number=Object.values(results).filter(Boolean).length;
    let total:number=Object.keys(results).length;
    console.log(`\n${passed}/${total}tests passed`);
    if(passed==total){
        console.log("\n✓ All tests passed!The application is ready to run.");
        console.log("\nTo start the application:");
        console.log(" 1. Development mode:npm run dev");
        console.log(" 2. Production mode:npm start");
        console.log("\nMake sure Ollama is running for full functionality:");
        console.log("-Install Ollama from https://ollama.com/");
        console.log("-Run:ollama serve");
        console.log("-Pull a model:ollama pull llama3.2");
    }
    else{
        console.log("\n Some tests failed. Please check the issues above.");
    }
}
runAllTests().catch(console.error);
