import{describe,test,expect}from "vitest"
import path from "path"
import{fileURLToPath}from "url"
import FileParser from "../src/core/fileParser.js"

let __dirname=path.dirname(fileURLToPath(import.meta.url))

describe("PDF text extraction",()=>{
    test("extracts expected text from sample PDF",async()=>{
        let parser:FileParser=new FileParser()
        let pdfPath:string=path.join(__dirname,"fixtures","sample.pdf")
        let text:string=await parser.extractTextFromFile(pdfPath)
        expect(text).toContain("Hello World")
        expect(text).toContain("sample PDF for testing")
        expect(text).toContain("PDF text extraction should work")
    })
})
