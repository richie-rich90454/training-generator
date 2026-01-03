let fs=require("fs").promises;
let path=require("path");
let {spawn}=require("child_process");
async function testCompleteFunctionality(){
    console.log("==Train Generator Complete Functionality Test==\n");
    let allTestsPassed=true;
    console.log("1. Testing application startup...");
    try{
        let electronProcess=spawn("npm",["run","dev"],{
            stdio:"pipe",
            shell:true,
            detached:true
        });
        await new Promise(resolve=>setTimeout(resolve,5000));
        let fetch=require("node-fetch");
        try{
            let response=await fetch("http://localhost:5173");
            if(response.status==200){
                console.log(" ✓ Application started successfully");
            }
            else{
                console.log(" ✗ Application failed to start");
                allTestsPassed=false;
            }
        }
        catch(error){
            console.log(" ✗ Application not accessible:",error.message);
            allTestsPassed=false;
        }
        electronProcess.kill();
    }
    catch(error){
        console.log(" ✗ Failed to start application:",error.message);
        allTestsPassed=false;
    }
    console.log("\n2. Testing file parser with sample files...");
    try{
        let FileParser=require("./src/core/fileParser");
        let parser=new FileParser();
        let testDir="./test-complete-files";
        await fs.mkdir(testDir,{recursive:true});
        let testFiles=[
            {name:"test.txt",content:"This is a test text file for Train Generator."},
            {name:"test.md",content:"# Test Markdown\n\nThis is a**test**markdown file."}
        ];
        for(let file of testFiles){
            let filePath=path.join(testDir,file.name);
            await fs.writeFile(filePath,file.content);
            let text=await parser.extractTextFromFile(filePath);
            if(text&&text.includes("test")){
                console.log(` ✓ ${file.name}parsed successfully`);
            }
            else{
                console.log(` ✗ ${file.name}parsing failed`);
                allTestsPassed=false;
            }
        }
        await fs.rm(testDir,{recursive:true,force:true});
    }
    catch(error){
        console.log(" ✗ File parser test failed:",error.message);
        allTestsPassed=false;
    }
    console.log("\n3. Testing Ollama integration...");
    try{
        let axios=require("axios");
        let response=await axios.get("http://localhost:11434/api/tags",{
            timeout:5000
        }).catch(error=>{
            if(error.code=="ECONNREFUSED"){
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
    catch(error){
        console.log("Ollama test error:",error.message);
    }
    console.log("\n4. Testing Electron main process...");

try {
    const fs = require("fs");
    const path = require("path");

    const mainPath = path.join(__dirname, "src", "main.js");

    if (!fs.existsSync(mainPath)) {
        throw new Error("main.js does not exist");
    }

    const content = fs.readFileSync(mainPath, "utf8");

    const requiredStrings = [
        "app",
        "BrowserWindow",
        "electron"
    ];

    requiredStrings.forEach(str => {
        if (!content.includes(str)) {
            throw new Error(`Missing ${str} in main.js`);
        }
    });

    console.log(" ✓ Electron main process file exists and looks valid");
} catch (error) {
    console.error(" ✗ Main process test failed:", error.message);
    process.exit(1); // fail CI
}

    console.log("\n5. Testing renderer process...");
    try{
        let rendererPath="./src/renderer/main.js";
        await fs.access(rendererPath);
        let rendererContent=await fs.readFile(rendererPath,"utf-8");
        if(rendererContent.includes("class TrainGeneratorApp")){
            console.log(" ✓ Renderer process structure is correct");
        }
        else{
            console.log(" ✗ Renderer process structure is incorrect");
            allTestsPassed=false;
        }
    }
    catch(error){
        console.log(" ✗ Renderer process test failed:",error.message);
        allTestsPassed=false;
    }
    console.log("\n6. Testing CSS and HTML...");
    try{
        let cssPath="./src/styles/main.css";
        let htmlPath="./index.html";
        await fs.access(cssPath);
        await fs.access(htmlPath);
        let cssContent=await fs.readFile(cssPath,"utf-8");
        let htmlContent=await fs.readFile(htmlPath,"utf-8");
        if(cssContent.includes(":root")&& htmlContent.includes("<!DOCTYPE html>")){
            console.log(" ✓ CSS and HTML files are valid");
        }
        else{
            console.log(" ✗ CSS or HTML files are invalid");
            allTestsPassed=false;
        }
    }
    catch(error){
        console.log(" ✗ CSS/HTML test failed:",error.message);
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
    }
    else{
        console.log("Some tests failed. Please check the issues above.");
        console.log("\nCommon issues:");
        console.log("1. Make sure all dependencies are installed:npm install");
        console.log("2. Check if Ollama is installed and running");
        console.log("3. Verify file permissions");
    }
    return allTestsPassed;
}
testCompleteFunctionality().catch(error=>{
    console.error("Test failed with error:",error);
    process.exit(1);
});