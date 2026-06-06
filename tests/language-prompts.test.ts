import{describe,test,expect}from "vitest"
import fs from "fs"
import path from "path"
import{fileURLToPath}from "url"

let __dirname=path.dirname(fileURLToPath(import.meta.url))
let promptsDir:string=path.join(__dirname,"..","src","prompts")

describe("Language prompt files",()=>{
    test("prompts directory exists",()=>{
        expect(fs.existsSync(promptsDir)).toBe(true)
    })

    test("prompt files are present in directory",()=>{
        let files:string[]=fs.readdirSync(promptsDir)
        expect(files.length).toBeGreaterThan(0)
    })

    let languagesInDropdown:string[]=["en","zh-Hans","zh-Hant","es","fr","de","ja","ko"]
    let requiredTypes:string[]=["instruction","conversation","chunking","custom"]

    test.each(languagesInDropdown)("language %s has all prompt files",(lang:string)=>{
        for(let type of requiredTypes){
            let fileName:string=`${lang}_${type}.txt`
            let filePath:string=path.join(promptsDir,fileName)
            expect(fs.existsSync(filePath)).toBe(true)
        }
    })

    test("English fallback files exist",()=>{
        for(let type of requiredTypes){
            let fileName:string=`en_${type}.txt`
            let filePath:string=path.join(promptsDir,fileName)
            expect(fs.existsSync(filePath)).toBe(true)
        }
    })

    test("prompt files contain {{text}} placeholder",()=>{
        let files:string[]=fs.readdirSync(promptsDir)
        for(let file of files){
            if(!file.endsWith(".txt")) continue
            let filePath:string=path.join(promptsDir,file)
            let content:string=fs.readFileSync(filePath,"utf8")
            expect(content).toContain("{{text}}")
        }
    })

    test("all files follow naming convention",()=>{
        let files:string[]=fs.readdirSync(promptsDir)
        let filePattern:RegExp=/^[a-z]{2}(-[A-Za-z]{2,5})?_(instruction|conversation|chunking|custom)\.txt$/
        let invalidFiles:string[]=files.filter(file=>!filePattern.test(file))
        expect(invalidFiles).toHaveLength(0)
    })
})
