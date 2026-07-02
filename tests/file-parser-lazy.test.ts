import{describe,test,expect,beforeEach,afterEach}from "vitest"
import fs from "fs"
import path from "path"
import{fileURLToPath}from "url"
import FileParserLazy from "../src/core/fileParserLazy.js"

let __dirname=path.dirname(fileURLToPath(import.meta.url))
let testDir:string=path.join(__dirname,"fixtures","file-parser-lazy")

describe("FileParserLazy",()=>{
    let parser:FileParserLazy

    beforeEach(()=>{
        parser=new FileParserLazy()
        if(!fs.existsSync(testDir)){
            fs.mkdirSync(testDir,{recursive:true})
        }
    })

    afterEach(()=>{
        if(fs.existsSync(testDir)){
            fs.rmSync(testDir,{recursive:true,force:true})
        }
    })

    describe("constructor",()=>{
        test("creates instance with empty dependencies",()=>{
            let p:FileParserLazy=new FileParserLazy()
            expect(p).toBeInstanceOf(FileParserLazy)
        })

        test("initializes all dependencies as null",()=>{
            let p:FileParserLazy=new FileParserLazy()
            expect(p.dependencies.mammoth).toBeNull()
            expect(p.dependencies.pdfParse).toBeNull()
            expect(p.dependencies.officeParser).toBeNull()
            expect(p.dependencies.RtfParser).toBeNull()
            expect(p.dependencies.htmlToText).toBeNull()
        })

        test("has supported file extensions",()=>{
            let extensions:string[]=["pdf","docx","doc","rtf","txt","md","html"]
            for(let ext of extensions){
                expect(parser.supportedFormats).toContain(ext)
            }
        })

        test("supportedFormats has correct length",()=>{
            expect(parser.supportedFormats.length).toBe(8)
        })
    })

    describe("extractTextFromFile",()=>{
        test("extracts text from .txt file without loading heavy deps",async()=>{
            let filePath:string=path.join(testDir,"test.txt")
            fs.writeFileSync(filePath,"Hello Lazy World")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("Hello Lazy World")
        })

        test("extracts text from .md file",async()=>{
            let filePath:string=path.join(testDir,"test.md")
            fs.writeFileSync(filePath,"# Lazy Title\n\nLazy content")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Lazy Title")
        })

        test("extracts text from .html file",async()=>{
            let filePath:string=path.join(testDir,"test.html")
            fs.writeFileSync(filePath,"<p>Lazy HTML</p>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Lazy HTML")
        })

        test("throws for unsupported file type",async()=>{
            let filePath:string=path.join(testDir,"test.xyz")
            fs.writeFileSync(filePath,"data")
            await expect(parser.extractTextFromFile(filePath)).rejects.toThrow()
        })

        test("throws for non-existent file",async()=>{
            let filePath:string=path.join(testDir,"nonexistent.txt")
            await expect(parser.extractTextFromFile(filePath)).rejects.toThrow()
        })

        test("extracts text from empty .txt file",async()=>{
            let filePath:string=path.join(testDir,"empty.txt")
            fs.writeFileSync(filePath,"")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("")
        })

        test("extracts unicode content",async()=>{
            let filePath:string=path.join(testDir,"unicode.txt")
            fs.writeFileSync(filePath,"こんにちは 世界 🌍")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("こんにちは 世界 🌍")
        })

        test("handles uppercase extension",async()=>{
            let filePath:string=path.join(testDir,"test.TXT")
            fs.writeFileSync(filePath,"uppercase extension")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("uppercase extension")
        })
    })

    describe("lazy loading",()=>{
        test("does not load mammoth for txt files",async()=>{
            let filePath:string=path.join(testDir,"test.txt")
            fs.writeFileSync(filePath,"text content")
            await parser.extractTextFromFile(filePath)
            expect(parser.dependencies.mammoth).toBeNull()
        })

        test("does not load pdf-parse for txt files",async()=>{
            let filePath:string=path.join(testDir,"test.txt")
            fs.writeFileSync(filePath,"text content")
            await parser.extractTextFromFile(filePath)
            expect(parser.dependencies.pdfParse).toBeNull()
        })

        test("loads html-to-text for html files",async()=>{
            let filePath:string=path.join(testDir,"test.html")
            fs.writeFileSync(filePath,"<p>test</p>")
            await parser.extractTextFromFile(filePath)
            expect(parser.dependencies.htmlToText).toBeDefined()
            expect(parser.dependencies.htmlToText).not.toBeNull()
        })

        test("loads mammoth for docx files",async()=>{
            let filePath:string=path.join(testDir,"test.docx")
            fs.writeFileSync(filePath,"not a real docx")
            try{
                await parser.extractTextFromFile(filePath)
            }
            catch{
                // Expected to fail with invalid docx
            }
            expect(parser.dependencies.mammoth).toBeDefined()
            expect(parser.dependencies.mammoth).not.toBeNull()
        })

        test("loads pdf-parse for pdf files",async()=>{
            let filePath:string=path.join(testDir,"test.pdf")
            fs.writeFileSync(filePath,"not a real pdf")
            try{
                await parser.extractTextFromFile(filePath)
            }
            catch{
                // Expected to fail with invalid pdf
            }
            // pdf-parse dependency should have been attempted to load
            expect(parser.dependencies.pdfParse).not.toBeNull()
        })

        test("loads officeParser for doc files",async()=>{
            let filePath:string=path.join(testDir,"test.doc")
            fs.writeFileSync(filePath,"not a real doc")
            try{
                await parser.extractTextFromFile(filePath)
            }
            catch{
                // Expected to fail with invalid doc
            }
            expect(parser.dependencies.officeParser).toBeDefined()
            expect(parser.dependencies.officeParser).not.toBeNull()
        })
    })

    describe("loadDependency caching",()=>{
        test("caches loaded dependencies",async()=>{
            let filePath:string=path.join(testDir,"test.html")
            fs.writeFileSync(filePath,"<p>test</p>")
            await parser.extractTextFromFile(filePath)
            let firstRef=parser.dependencies.htmlToText
            await parser.extractTextFromFile(filePath)
            let secondRef=parser.dependencies.htmlToText
            expect(firstRef).toBe(secondRef)
        })

        test("returns same dependency on repeated loadDependency calls",async()=>{
            let first=await parser.loadDependency("htmlToText")
            let second=await parser.loadDependency("htmlToText")
            expect(first).toBe(second)
        })
    })

    describe("parseText",()=>{
        test("returns content as-is",async()=>{
            let filePath:string=path.join(testDir,"test.txt")
            fs.writeFileSync(filePath,"raw text")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("raw text")
        })

        test("preserves whitespace and newlines",async()=>{
            let filePath:string=path.join(testDir,"whitespace.txt")
            fs.writeFileSync(filePath,"  line1\n  line2  ")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("  line1\n  line2  ")
        })

        test("handles CRLF line endings",async()=>{
            let filePath:string=path.join(testDir,"crlf.txt")
            fs.writeFileSync(filePath,"line1\r\nline2")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("line1")
            expect(text).toContain("line2")
        })
    })

    describe("parseHTML",()=>{
        test("strips HTML tags",async()=>{
            let filePath:string=path.join(testDir,"test.html")
            fs.writeFileSync(filePath,"<p>Hello <em>Lazy</em></p>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Hello")
            expect(text).toContain("Lazy")
            expect(text).not.toContain("<em>")
        })

        test("ignores href in links",async()=>{
            let filePath:string=path.join(testDir,"links.html")
            fs.writeFileSync(filePath,"<a href='https://example.com'>Click here</a>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Click here")
            expect(text).not.toContain("https://example.com")
        })

        test("skips images",async()=>{
            let filePath:string=path.join(testDir,"img.html")
            fs.writeFileSync(filePath,"<p>Text</p><img src='test.png' alt='An image'>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Text")
        })
    })

    describe("parseRTF",()=>{
        test("extracts text from RTF file",async()=>{
            let filePath:string=path.join(testDir,"test.rtf")
            fs.writeFileSync(filePath,"{\\rtf1\\ansi Hello RTF}")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(typeof text).toBe("string")
        })
    })

    describe("extractTextFromPDF",()=>{
        test("extracts printable ASCII from buffer",()=>{
            let buffer:Buffer=Buffer.from("Hello World \x00\x01\x02 hidden")
            let text:string=parser.extractTextFromPDF(buffer)
            expect(text).toContain("Hello World")
        })

        test("trims whitespace from result",()=>{
            let buffer:Buffer=Buffer.from("   trimmed   ")
            let text:string=parser.extractTextFromPDF(buffer)
            expect(text).toBe("trimmed")
        })

        test("handles empty buffer",()=>{
            let buffer:Buffer=Buffer.from("")
            let text:string=parser.extractTextFromPDF(buffer)
            expect(text).toBe("")
        })
    })

    describe("extractTextFromBuffer",()=>{
        test("extracts printable ASCII from buffer",()=>{
            let buffer:Buffer=Buffer.from("Visible text \x01\x02")
            let text:string=parser.extractTextFromBuffer(buffer)
            expect(text).toContain("Visible text")
        })

        test("trims whitespace from result",()=>{
            let buffer:Buffer=Buffer.from("   spaces   ")
            let text:string=parser.extractTextFromBuffer(buffer)
            expect(text).toBe("spaces")
        })
    })

    describe("extractPlainTextFromRTF",()=>{
        test("strips RTF control words",()=>{
            let rtf:string="Hello \\b{}World"
            let text:string=parser.extractPlainTextFromRTF(rtf)
            expect(text).toContain("Hello")
            expect(text).toContain("World")
        })

        test("trims whitespace",()=>{
            let rtf:string="  spaced  "
            let text:string=parser.extractPlainTextFromRTF(rtf)
            expect(text).toBe("spaced")
        })

        test("strips content inside braces",()=>{
            let rtf:string="Before {\\rtf1 inside} After"
            let text:string=parser.extractPlainTextFromRTF(rtf)
            expect(text).toContain("Before")
            expect(text).toContain("After")
            expect(text).not.toContain("inside")
        })
    })

    describe("dispose",()=>{
        test("resets all dependencies to null",async()=>{
            let filePath:string=path.join(testDir,"test.html")
            fs.writeFileSync(filePath,"<p>test</p>")
            await parser.extractTextFromFile(filePath)
            expect(parser.dependencies.htmlToText).not.toBeNull()
            parser.dispose()
            expect(parser.dependencies.mammoth).toBeNull()
            expect(parser.dependencies.pdfParse).toBeNull()
            expect(parser.dependencies.officeParser).toBeNull()
            expect(parser.dependencies.RtfParser).toBeNull()
            expect(parser.dependencies.htmlToText).toBeNull()
        })

        test("allows reuse after dispose",async()=>{
            let filePath:string=path.join(testDir,"test.txt")
            fs.writeFileSync(filePath,"after dispose")
            await parser.extractTextFromFile(filePath)
            parser.dispose()
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("after dispose")
        })
    })

    describe("processFiles",()=>{
        test("processes multiple files and returns results",async()=>{
            let filePath1:string=path.join(testDir,"file1.txt")
            let filePath2:string=path.join(testDir,"file2.txt")
            fs.writeFileSync(filePath1,"Content 1")
            fs.writeFileSync(filePath2,"Content 2")
            let results=await parser.processFiles([filePath1,filePath2])
            expect(results.length).toBe(2)
            expect(results[0].success).toBe(true)
            expect(results[0].text).toBe("Content 1")
            expect(results[1].success).toBe(true)
            expect(results[1].text).toBe("Content 2")
        })

        test("handles mix of valid and invalid files",async()=>{
            let validPath:string=path.join(testDir,"valid.txt")
            let invalidPath:string=path.join(testDir,"nonexistent.txt")
            fs.writeFileSync(validPath,"Valid content")
            let results=await parser.processFiles([validPath,invalidPath])
            expect(results.length).toBe(2)
            expect(results[0].success).toBe(true)
            expect(results[1].success).toBe(false)
            expect(results[1].error).toBeTruthy()
        })

        test("returns empty array for empty input",async()=>{
            let results=await parser.processFiles([])
            expect(results).toEqual([])
        })

        test("includes filePath in each result",async()=>{
            let filePath:string=path.join(testDir,"path-test.txt")
            fs.writeFileSync(filePath,"content")
            let results=await parser.processFiles([filePath])
            expect(results[0].filePath).toBe(filePath)
        })
    })

    describe("streamTextFile",()=>{
        test("streams large text file content",async()=>{
            let filePath:string=path.join(testDir,"stream.txt")
            let content:string="Line 1\nLine 2\nLine 3"
            fs.writeFileSync(filePath,content)
            let text:string=await parser["streamTextFile"](filePath)
            expect(text).toBe(content)
        })

        test("handles empty file",async()=>{
            let filePath:string=path.join(testDir,"empty-stream.txt")
            fs.writeFileSync(filePath,"")
            let text:string=await parser["streamTextFile"](filePath)
            expect(text).toBe("")
        })
    })
})
