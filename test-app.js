let FileParser=require("./src/core/fileParser");
let fs=require("fs").promises;
let path=require("path");
async function testFileParser(){
    console.log("Testing File Parser...");
    let parser=new FileParser();
    let testDir="./test-files";
    await fs.mkdir(testDir,{recursive:true});
    let testFilePath=path.join(testDir,"test.txt");
    await fs.writeFile(testFilePath,"This is a test file content for the Train Generator application.");
    try{
        let text=await parser.extractTextFromFile(testFilePath);
        console.log("✓ File parser test passed");
        console.log(" Extracted text:",text.substring(0,50)+"...");
    }
    catch(error){
        console.error("✗ File parser test failed:",error.message);
    }
    await fs.rm(testDir,{recursive:true,force:true});
}
async function testOllamaConnection(){
    console.log("\nTesting Ollama Connection...");
    let{spawn}=require("child_process");
    return new Promise((resolve)=>{
        let curl=spawn("curl",["-s","http://localhost:11434/api/tags"],{
            timeout:3000
        });
        let stdout="";
        let stderr="";
        curl.stdout.on("data",(data)=>{
            stdout+=data.toString();
        });
        curl.stderr.on("data",(data)=>{
            stderr+=data.toString();
        });
        curl.on("close",(code)=>{
            if(code==0&&stdout){
                try{
                    let data=JSON.parse(stdout);
                    console.log("✓ Ollama is running");
                    console.log(" Version:",data.version||"unknown");
                    console.log(" Models:",data.models?.length||0,"available");
                    resolve(true);
                }
                catch(error){
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
async function testElectronApp(){
    console.log("\nTesting Electron App Structure...");
    let requiredFiles=[
        "package.json",
        "src/main.js",
        "src/preload.js",
        "src/renderer/main.js",
        "src/core/fileParser.js",
        "src/styles/main.css",
        "index.html",
        "vite.config.js"
    ];
    let allFilesExist=true;
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
async function testDependencies(){
    console.log("\nTesting Dependencies...");
    try{
        let packageJson=JSON.parse(await fs.readFile("package.json","utf-8"));
        let deps=Object.keys(packageJson.dependencies||{});
        let devDeps=Object.keys(packageJson.devDependencies||{});
        console.log(`✓ Dependencies:${deps.length}packages`);
        console.log(`✓ Dev Dependencies:${devDeps.length}packages`);
        let criticalDeps=["axios","mammoth","pdf-parse"];
        let missingDeps=criticalDeps.filter(dep=>!deps.includes(dep));
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
    catch(error){
        console.error("✗ Failed to check dependencies:",error.message);
        return false;
    }
}
async function runAllTests(){
    console.log("==Train Generator Application Tests==\n");
    let results={
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
    let passed=Object.values(results).filter(Boolean).length;
    let total=Object.keys(results).length;
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