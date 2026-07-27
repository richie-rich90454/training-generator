import{describe,test,expect,beforeAll}from "vitest"
import{promises as fs}from "fs"
import path from "path"
import{spawn}from "child_process"
import FileParser from "../src/core/fileParser.js"

describe("File Parser",()=>{
    test("extracts text from a text file",async()=>{
        let parser:FileParser=new FileParser()
        let testDir:string="./test-files"
        await fs.mkdir(testDir,{recursive:true})
        let testFilePath:string=path.join(testDir,"test.txt")
        await fs.writeFile(testFilePath,"This is a test file content for the Train Generator application.")
        try{
            let text:string=await parser.extractTextFromFile(testFilePath)
            expect(text).toContain("test file content")
        }
        finally{
            await fs.rm(testDir,{recursive:true,force:true})
        }
    })
})

describe("Ollama Connection",()=>{
    let ollamaAvailable:boolean=false

    beforeAll(async()=>{
        ollamaAvailable=await new Promise<boolean>((resolve)=>{
            let curl=spawn("curl",["-s","http://localhost:11434/api/tags"],{
                timeout:3000
            })
            let stdout:string=""
            curl.stdout.on("data",(data:Buffer)=>{
                stdout+=data.toString()
            })
            curl.on("close",(code:number)=>{
                resolve(code==0&&stdout.length>0)
            })
            curl.on("error",()=>{
                resolve(false)
            })
        })
    })

    test.skipIf(()=>!ollamaAvailable)("Ollama is running and responding",async()=>{
        let response=await fetch("http://localhost:11434/api/tags")
        let data=await response.json() as Record<string,unknown>
        expect(data).toHaveProperty("models")
    })
})

describe("App Structure",()=>{
    let requiredFiles:string[]=[
        "package.json",
        "src/main.ts",
        "src/preload.ts",
        "src/renderer/App.tsx",
        "src/core/fileParser.ts",
        "src/styles/main.css",
        "index.html",
        "vite.config.ts"
    ]

    test.each(requiredFiles)("%s exists",async(file:string)=>{
        await expect(fs.access(file)).resolves.toBeUndefined()
    })
})

describe("Dependencies",()=>{
    test("critical dependencies are present",async()=>{
        let packageJson:Record<string,unknown>=JSON.parse(await fs.readFile("package.json","utf-8"))
        let deps:string[]=Object.keys((packageJson.dependencies as Record<string,unknown>)||{})
        let devDeps:string[]=Object.keys((packageJson.devDependencies as Record<string,unknown>)||{})
        let criticalDeps:string[]=["axios","mammoth","pdf-parse"]
        for(let dep of criticalDeps){
            expect(deps).toContain(dep)
        }
        expect(devDeps).toContain("electron")
    })
})
