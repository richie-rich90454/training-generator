import{describe,test,expect,beforeEach,afterEach}from "vitest"
import fs from "fs"
import path from "path"
import{fileURLToPath}from "url"
import FileParser from "../src/core/fileParser.js"

let __dirname=path.dirname(fileURLToPath(import.meta.url))
let testDir:string=path.join(__dirname,"fixtures","file-parser")

describe("FileParser",()=>{
    let parser:FileParser

    beforeEach(()=>{
        parser=new FileParser()
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
        test("creates instance with supported extensions",()=>{
            let p:FileParser=new FileParser()
            expect(p).toBeInstanceOf(FileParser)
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
        test("extracts text from .txt file",async()=>{
            let filePath:string=path.join(testDir,"test.txt")
            fs.writeFileSync(filePath,"Hello World")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("Hello World")
        })

        test("extracts text from .md file",async()=>{
            let filePath:string=path.join(testDir,"test.md")
            fs.writeFileSync(filePath,"# Heading\n\nParagraph text")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Heading")
            expect(text).toContain("Paragraph text")
        })

        test("extracts text from .html file",async()=>{
            let filePath:string=path.join(testDir,"test.html")
            fs.writeFileSync(filePath,"<html><body><h1>Title</h1><p>Content</p></body></html>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text.toLowerCase()).toContain("title")
            expect(text).toContain("Content")
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

        test("extracts text from file with unicode content",async()=>{
            let filePath:string=path.join(testDir,"unicode.txt")
            fs.writeFileSync(filePath,"Hello 世界 🌍")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("Hello 世界 🌍")
        })

        test("extracts text from large .txt file",async()=>{
            let filePath:string=path.join(testDir,"large.txt")
            let largeContent:string="A".repeat(100000)
            fs.writeFileSync(filePath,largeContent)
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text.length).toBe(100000)
        })

        test("extracts text from .rtf file",async()=>{
            let filePath:string=path.join(testDir,"test.rtf")
            fs.writeFileSync(filePath,"{\\rtf1\\ansi Hello RTF}")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(typeof text).toBe("string")
        })

        test("handles uppercase extension",async()=>{
            let filePath:string=path.join(testDir,"test.TXT")
            fs.writeFileSync(filePath,"uppercase extension")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("uppercase extension")
        })
    })

    describe("parseText",()=>{
        test("returns content as-is",async()=>{
            let filePath:string=path.join(testDir,"test.txt")
            fs.writeFileSync(filePath,"plain text content")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("plain text content")
        })

        test("preserves whitespace",async()=>{
            let filePath:string=path.join(testDir,"whitespace.txt")
            fs.writeFileSync(filePath,"  leading and trailing  ")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("  leading and trailing  ")
        })

        test("preserves newlines",async()=>{
            let filePath:string=path.join(testDir,"newlines.txt")
            fs.writeFileSync(filePath,"line1\nline2\nline3")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toBe("line1\nline2\nline3")
        })

        test("handles CRLF line endings",async()=>{
            let filePath:string=path.join(testDir,"crlf.txt")
            fs.writeFileSync(filePath,"line1\r\nline2\r\nline3")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("line1")
            expect(text).toContain("line2")
        })
    })

    describe("parseHTML",()=>{
        test("strips HTML tags",async()=>{
            let filePath:string=path.join(testDir,"test.html")
            fs.writeFileSync(filePath,"<p>Hello <strong>World</strong></p>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Hello")
            expect(text).toContain("World")
            expect(text).not.toContain("<strong>")
        })

        test("handles nested HTML",async()=>{
            let filePath:string=path.join(testDir,"nested.html")
            fs.writeFileSync(filePath,"<div><ul><li>Item 1</li><li>Item 2</li></ul></div>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Item 1")
            expect(text).toContain("Item 2")
        })

        test("handles empty HTML body",async()=>{
            let filePath:string=path.join(testDir,"empty.html")
            fs.writeFileSync(filePath,"<html><body></body></html>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(typeof text).toBe("string")
        })

        test("handles HTML with entities",async()=>{
            let filePath:string=path.join(testDir,"entities.html")
            fs.writeFileSync(filePath,"<p>5 &gt; 3 &amp; 2 &lt; 4</p>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("5")
            expect(text).toContain("3")
        })

        test("skips images in HTML",async()=>{
            let filePath:string=path.join(testDir,"img.html")
            fs.writeFileSync(filePath,"<p>Text</p><img src='test.png' alt='An image'>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Text")
        })

        test("ignores href in links",async()=>{
            let filePath:string=path.join(testDir,"links.html")
            fs.writeFileSync(filePath,"<a href='https://example.com'>Click here</a>")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Click here")
            expect(text).not.toContain("https://example.com")
        })
    })

    describe("parseMarkdown",()=>{
        test("extracts text from markdown",async()=>{
            let filePath:string=path.join(testDir,"test.md")
            fs.writeFileSync(filePath,"# Title\n\nSome **bold** text")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Title")
            expect(text).toContain("bold")
        })

        test("handles markdown with code blocks",async()=>{
            let filePath:string=path.join(testDir,"code.md")
            fs.writeFileSync(filePath,"```js\nconsole.log('hello')\n```")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("console.log")
        })

        test("handles markdown with links",async()=>{
            let filePath:string=path.join(testDir,"links.md")
            fs.writeFileSync(filePath,"[Click here](https://example.com)")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Click here")
        })

        test("handles markdown with lists",async()=>{
            let filePath:string=path.join(testDir,"list.md")
            fs.writeFileSync(filePath,"- Item 1\n- Item 2\n- Item 3")
            let text:string=await parser.extractTextFromFile(filePath)
            expect(text).toContain("Item 1")
            expect(text).toContain("Item 2")
            expect(text).toContain("Item 3")
        })
    })

    describe("extractTextFromPDF",()=>{
        test("extracts printable ASCII from buffer",()=>{
            let buffer:Buffer=Buffer.from("Hello World \x00\x01\x02")
            let text:string=parser.extractTextFromPDF(buffer)
            expect(text).toContain("Hello World")
        })

        test("strips non-printable characters",()=>{
            let buffer:Buffer=Buffer.from("Visible\x00\x01\x02Text")
            let text:string=parser.extractTextFromPDF(buffer)
            expect(text).not.toContain("\x00")
            expect(text).not.toContain("\x01")
            expect(text).not.toContain("\x02")
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

        test("handles simple text without RTF codes",()=>{
            let rtf:string="Simple text without RTF codes"
            let text:string=parser.extractPlainTextFromRTF(rtf)
            expect(text).toContain("Simple text")
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
})
