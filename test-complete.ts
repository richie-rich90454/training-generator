import{promises as fsp}from "fs"
import fs from "fs"
import path from "path"
import{spawn}from "child_process"
import FileParser from "./src/core/fileParser.js"
import axios from "axios"
import fetch from "node-fetch"
async function testCompleteFunctionality():Promise<boolean>{
    console.log("==Train Generator Complete Functionality Test==\n");
    let allTestsPassed:boolean=true;
    console.log("1. Testing application startup...");
    try{
        let electronProcess=spawn("npm",["run","dev"],{
            stdio:"pipe",
            shell:true,
            detached:true
        });
        await new Promise(resolve=>setTimeout(resolve,5000));
        try{
            let response:Response=await fetch("http://localhost:5173") as Response;
            if(response.status==200){
                console.log(" ✓ Application started successfully");
            }
            else{
                console.log(" ✗ Application failed to start");
                allTestsPassed=false;
            }
        }
        catch(error:unknown){
            let err=error as Error;
            console.log(" ✗ Application not accessible:",err.message);
            allTestsPassed=false;
        }
        electronProcess.kill();
    }
    catch(error:unknown){
        let err=error as Error;
        console.log(" ✗ Failed to start application:",err.message);
        allTestsPassed=false;
    }
    console.log("\n2. Testing file parser with sample files...");
    try{
        let parser:FileParser=new FileParser();
        let testDir:string="./test-complete-files";
        await fsp.mkdir(testDir,{recursive:true});
        let testFiles:{name:string,content:string}[]=[
            {name:"test.txt",content:"This is a test text file for Train Generator."},
            {name:"test.md",content:"# Test Markdown\n\nThis is a**test**markdown file."}
        ];
        for(let file of testFiles){
            let filePath:string=path.join(testDir,file.name);
            await fsp.writeFile(filePath,file.content);
            let text:string=await parser.extractTextFromFile(filePath);
            if(text&&text.includes("test")){
                console.log(` ✓ ${file.name}parsed successfully`);
            }
            else{
                console.log(` ✗ ${file.name}parsing failed`);
                allTestsPassed=false;
            }
        }
        await fsp.rm(testDir,{recursive:true,force:true});
    }
    catch(error:unknown){
        let err=error as Error;
        console.log(" ✗ File parser test failed:",err.message);
        allTestsPassed=false;
    }
    console.log("\n3. Testing Ollama integration...");
    try{
        let response=await axios.get("http://localhost:11434/api/tags",{
            timeout:5000
        }).catch((error:unknown)=>{
            let err=error as Error & {code?:string};
            if(err.code=="ECONNREFUSED"){
                console.log("Ollama not running(this is OK for testing)");
                return null;
            }
            throw error;
        });
        if(response&&response.data){
            console.log(` ✓ Ollama is running with ${response.data.models?.length || 0}models`);
        }
        else{
            console.log("Ollama integration test skipped(Ollama not running)");
        }
    }
    catch(error:unknown){
        let err=error as Error;
        console.log("Ollama test error:",err.message);
    }
    console.log("\n4. Testing Electron main process...");

try {
    let mainPath:string = path.join(__dirname, "src", "main.js");

    if (!fs.existsSync(mainPath)) {
        throw new Error("main.js does not exist");
    }

    let content:string = fs.readFileSync(mainPath, "utf8");

    let requiredStrings:string[] = [
        "app",
        "BrowserWindow",
        "electron"
    ];

    requiredStrings.forEach((str:string) => {
        if (!content.includes(str)) {
            throw new Error(`Missing ${str} in main.js`);
        }
    });

    console.log(" ✓ Electron main process file exists and looks valid");
} catch (error:unknown) {
    let err=error as Error;
    console.error(" ✗ Main process test failed:", err.message);
    process.exit(1); // fail CI
}

    console.log("\n5. Testing renderer process...");
    try{
        let rendererPath:string="./src/renderer/main.js";
        await fsp.access(rendererPath);
        let rendererContent:string=await fsp.readFile(rendererPath,"utf-8");
        if(rendererContent.includes("class TrainGeneratorApp")){
            console.log(" ✓ Renderer process structure is correct");
        }
        else{
            console.log(" ✗ Renderer process structure is incorrect");
            allTestsPassed=false;
        }
    }
    catch(error:unknown){
        let err=error as Error;
        console.log(" ✗ Renderer process test failed:",err.message);
        allTestsPassed=false;
    }
    console.log("\n6. Testing CSS and HTML...");
    try{
        let cssPath:string="./src/styles/main.css";
        let htmlPath:string="./index.html";
        await fsp.access(cssPath);
        await fsp.access(htmlPath);
        let cssContent:string=await fsp.readFile(cssPath,"utf-8");
        let htmlContent:string=await fsp.readFile(htmlPath,"utf-8");
        if(cssContent.includes(":root")&& htmlContent.includes("<!DOCTYPE html>")){
            console.log(" ✓ CSS and HTML files are valid");
        }
        else{
            console.log(" ✗ CSS or HTML files are invalid");
            allTestsPassed=false;
        }
    }
    catch(error:unknown){
        let err=error as Error;
        console.log(" ✗ CSS/HTML test failed:",err.message);
        allTestsPassed=false;
    }
    console.log("\n==Test Summary==");
    if(allTestsPassed){
        console.log("✓ All critical tests passed!");
        console.log("\nThe Train Generator application is fully functional and ready to use.");
        console.log("\nTo use the application:");
        console.log("1. Make sure Ollama is running:ollama serve");
        console.log("2. Start the app:npm run dev");
        console.log("3. Open the app in your browser(if not auto-opened)");
        console.log("4. Drag & drop files and start generating training data!");
        process.exit(0)
    }
    else{
        console.log("Some tests failed. Please check the issues above.");
        console.log("\nCommon issues:");
        console.log("1. Make sure all dependencies are installed:npm install");
        console.log("2. Check if Ollama is installed and running");
        console.log("3. Verify file permissions");
        process.exit(1)
    }
    return allTestsPassed;
}
testCompleteFunctionality().catch((error:unknown)=>{
    console.error("Test failed with error:",error);
    process.exit(1);
});
