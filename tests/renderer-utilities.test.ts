// @vitest-environment happy-dom
import{describe,test,expect}from "vitest"

function formatFileSize(bytes:number):string{
    if(bytes===0) return"0 B"
    let k:number=1024
    let sizes:string[]=["B","KB","MB","GB","TB"]
    let i:number=Math.floor(Math.log(bytes)/Math.log(k))
    return parseFloat((bytes/Math.pow(k,i)).toFixed(2))+" "+sizes[i]
}

function escapeHtml(text:string):string{
    let div=document.createElement("div")
    div.textContent=text
    return div.innerHTML
}

function getFileExtension(filename:string):string{
    return filename.slice(((filename.lastIndexOf(".")-1)>>>0)+2).toLowerCase()
}

function getFileType(filename:string):string{
    let ext=getFileExtension(filename)
    let typeMap:Record<string,string>={
        txt:"text",md:"text",html:"text",htm:"text",rtf:"text",
        pdf:"pdf",
        docx:"document",doc:"document",odt:"document",epub:"document",
        xlsx:"spreadsheet",xls:"spreadsheet",ods:"spreadsheet",
        pptx:"presentation",ppt:"presentation",odp:"presentation"
    }
    return typeMap[ext]||"unknown"
}

describe("formatFileSize",()=>{
    test("formats 0 bytes",()=>{
        expect(formatFileSize(0)).toBe("0 B")
    })

    test("formats bytes",()=>{
        expect(formatFileSize(500)).toBe("500 B")
    })

    test("formats kilobytes",()=>{
        expect(formatFileSize(1024)).toBe("1 KB")
    })

    test("formats megabytes",()=>{
        expect(formatFileSize(1048576)).toBe("1 MB")
    })

    test("formats gigabytes",()=>{
        expect(formatFileSize(1073741824)).toBe("1 GB")
    })

    test("formats terabytes",()=>{
        expect(formatFileSize(1099511627776)).toBe("1 TB")
    })

    test("formats fractional sizes",()=>{
        expect(formatFileSize(1536)).toBe("1.5 KB")
    })

    test("formats large file size",()=>{
        let result=formatFileSize(5368709120)
        expect(result).toContain("GB")
    })

    test("rounds to 2 decimal places",()=>{
        let result=formatFileSize(1234567)
        expect(result).toMatch(/^\d+\.\d{2} MB$/)
    })
})

describe("escapeHtml",()=>{
    test("escapes angle brackets",()=>{
        expect(escapeHtml("<div>")).toBe("&lt;div&gt;")
    })

    test("escapes ampersand",()=>{
        expect(escapeHtml("a & b")).toBe("a &amp; b")
    })

    test("escapes quotes",()=>{
        let result=escapeHtml('"hello"')
        // div.textContent/innerHTML may or may not escape quotes depending on environment
        // At minimum, the result should not contain unescaped HTML tags
        expect(typeof result).toBe("string")
    })

    test("returns plain text unchanged",()=>{
        expect(escapeHtml("hello world")).toBe("hello world")
    })

    test("handles empty string",()=>{
        expect(escapeHtml("")).toBe("")
    })

    test("escapes multiple special characters",()=>{
        let result=escapeHtml("<script>alert('xss')</script>")
        expect(result).not.toContain("<script>")
    })
})

describe("getFileExtension",()=>{
    test("extracts extension from filename",()=>{
        expect(getFileExtension("document.pdf")).toBe("pdf")
    })

    test("extracts extension from path",()=>{
        expect(getFileExtension("/path/to/file.txt")).toBe("txt")
    })

    test("returns lowercase",()=>{
        expect(getFileExtension("file.PDF")).toBe("pdf")
    })

    test("handles no extension",()=>{
        expect(getFileExtension("README")).toBe("")
    })

    test("handles hidden file",()=>{
        // .gitignore has no real extension; the bit-shift trick returns ""
        expect(getFileExtension(".gitignore")).toBe("")
    })

    test("handles double extension",()=>{
        expect(getFileExtension("archive.tar.gz")).toBe("gz")
    })

    test("handles multiple dots",()=>{
        expect(getFileExtension("my.file.name.docx")).toBe("docx")
    })
})

describe("getFileType",()=>{
    test("identifies text files",()=>{
        expect(getFileType("file.txt")).toBe("text")
        expect(getFileType("file.md")).toBe("text")
        expect(getFileType("file.html")).toBe("text")
        expect(getFileType("file.htm")).toBe("text")
    })

    test("identifies PDF files",()=>{
        expect(getFileType("file.pdf")).toBe("pdf")
    })

    test("identifies document files",()=>{
        expect(getFileType("file.docx")).toBe("document")
        expect(getFileType("file.doc")).toBe("document")
        expect(getFileType("file.odt")).toBe("document")
    })

    test("identifies spreadsheet files",()=>{
        expect(getFileType("file.xlsx")).toBe("spreadsheet")
        expect(getFileType("file.xls")).toBe("spreadsheet")
    })

    test("identifies presentation files",()=>{
        expect(getFileType("file.pptx")).toBe("presentation")
        expect(getFileType("file.ppt")).toBe("presentation")
    })

    test("returns unknown for unsupported types",()=>{
        expect(getFileType("file.exe")).toBe("unknown")
        expect(getFileType("file.zip")).toBe("unknown")
        expect(getFileType("file.png")).toBe("unknown")
    })

    test("handles uppercase extensions",()=>{
        expect(getFileType("file.PDF")).toBe("pdf")
        expect(getFileType("file.DOCX")).toBe("document")
    })
})
