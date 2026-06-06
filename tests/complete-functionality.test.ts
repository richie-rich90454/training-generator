import{describe,test,expect,beforeAll}from "vitest"
import{promises as fsp}from "fs"
import fs from "fs"
import path from "path"
import{fileURLToPath}from "url"
import FileParser from "../src/core/fileParser.js"
import axios from "axios"

let __dirname=path.dirname(fileURLToPath(import.meta.url))

let ollamaAvailable:boolean=false

beforeAll(async()=>{
    try{
        await axios.get("http://localhost:11434/api/tags",{timeout:5000})
        ollamaAvailable=true
    }
    catch{
        ollamaAvailable=false
    }
})

describe("File Parser with sample files",()=>{
    let testDir:string="./test-complete-files"

    test("parses text and markdown files",async()=>{
        let parser:FileParser=new FileParser()
        await fsp.mkdir(testDir,{recursive:true})
        let testFiles:{name:string;content:string}[]=[
            {name:"test.txt",content:"This is a test text file for Train Generator."},
            {name:"test.md",content:"# Test Markdown\n\nThis is a**test**markdown file."}
        ]
        try{
            for(let file of testFiles){
                let filePath:string=path.join(testDir,file.name)
                await fsp.writeFile(filePath,file.content)
                let text:string=await parser.extractTextFromFile(filePath)
                expect(text).toContain("test")
            }
        }
        finally{
            await fsp.rm(testDir,{recursive:true,force:true})
        }
    })
})

describe("Ollama integration",()=>{
    test.skipIf(()=>!ollamaAvailable)("Ollama is running and has models",async()=>{
        let response=await axios.get("http://localhost:11434/api/tags",{timeout:5000})
        expect(response.data).toHaveProperty("models")
        expect(response.data.models.length).toBeGreaterThan(0)
    })
})

describe("Electron main process",()=>{
    test("main.ts exists and contains required strings",()=>{
        let mainPath:string=path.join(__dirname,"..","src","main.ts")
        expect(fs.existsSync(mainPath)).toBe(true)
        let content:string=fs.readFileSync(mainPath,"utf8")
        let requiredStrings:string[]=["app","BrowserWindow","electron"]
        for(let str of requiredStrings){
            expect(content).toContain(str)
        }
    })
})

describe("Renderer process",()=>{
    test("renderer file exists and has TrainGeneratorApp class",async()=>{
        let rendererPath:string="./src/renderer/main.ts"
        await expect(fsp.access(rendererPath)).resolves.toBeUndefined()
        let rendererContent:string=await fsp.readFile(rendererPath,"utf-8")
        expect(rendererContent).toContain("class TrainGeneratorApp")
    })
})

describe("CSS and HTML",()=>{
    test("CSS and HTML files are valid",async()=>{
        let cssPath:string="./src/styles/main.css"
        let htmlPath:string="./index.html"
        await expect(fsp.access(cssPath)).resolves.toBeUndefined()
        await expect(fsp.access(htmlPath)).resolves.toBeUndefined()
        let cssContent:string=await fsp.readFile(cssPath,"utf-8")
        let htmlContent:string=await fsp.readFile(htmlPath,"utf-8")
        expect(cssContent).toContain(":root")
        expect(htmlContent).toContain("<!DOCTYPE html>")
    })
})
