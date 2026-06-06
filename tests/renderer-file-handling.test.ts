// @vitest-environment happy-dom
import{describe,test,expect}from "vitest"

function isValidFileSize(size:number,maxSizeMB:number=100):boolean{
    return size>=0&&size<=maxSizeMB*1024*1024
}

function getFileTypeFromName(filename:string):string{
    let ext=filename.split(".").pop()?.toLowerCase()||""
    let typeMap:Record<string,string>={
        txt:"text",md:"text",html:"text",htm:"text",rtf:"text",
        pdf:"pdf",
        docx:"document",doc:"document",odt:"document",epub:"document",
        xlsx:"spreadsheet",xls:"spreadsheet",ods:"spreadsheet",
        pptx:"presentation",ppt:"presentation",odp:"presentation"
    }
    return typeMap[ext]||"unknown"
}

function isSupportedFileType(filename:string):boolean{
    return getFileTypeFromName(filename)!=="unknown"
}

function sanitizeFilename(filename:string):string{
    return filename.replace(/[<>:"/\\|?*]/g,"_").replace(/\s+/g," ").trim()
}

describe("File validation",()=>{
    test("accepts files within size limit",()=>{
        expect(isValidFileSize(0)).toBe(true)
        expect(isValidFileSize(1024)).toBe(true)
        expect(isValidFileSize(100*1024*1024)).toBe(true)
    })

    test("rejects files exceeding size limit",()=>{
        expect(isValidFileSize(101*1024*1024)).toBe(false)
        expect(isValidFileSize(-1)).toBe(false)
    })

    test("respects custom max size",()=>{
        expect(isValidFileSize(50*1024*1024,50)).toBe(true)
        expect(isValidFileSize(51*1024*1024,50)).toBe(false)
    })

    test("zero byte files are valid size but may be empty",()=>{
        expect(isValidFileSize(0)).toBe(true)
    })
})

describe("File type detection",()=>{
    test("detects text file types",()=>{
        expect(getFileTypeFromName("file.txt")).toBe("text")
        expect(getFileTypeFromName("file.md")).toBe("text")
        expect(getFileTypeFromName("file.html")).toBe("text")
        expect(getFileTypeFromName("file.htm")).toBe("text")
    })

    test("detects document file types",()=>{
        expect(getFileTypeFromName("file.docx")).toBe("document")
        expect(getFileTypeFromName("file.doc")).toBe("document")
        expect(getFileTypeFromName("file.odt")).toBe("document")
    })

    test("detects PDF files",()=>{
        expect(getFileTypeFromName("file.pdf")).toBe("pdf")
    })

    test("detects spreadsheet files",()=>{
        expect(getFileTypeFromName("file.xlsx")).toBe("spreadsheet")
        expect(getFileTypeFromName("file.xls")).toBe("spreadsheet")
    })

    test("detects presentation files",()=>{
        expect(getFileTypeFromName("file.pptx")).toBe("presentation")
        expect(getFileTypeFromName("file.ppt")).toBe("presentation")
    })

    test("returns unknown for unsupported types",()=>{
        expect(getFileTypeFromName("file.exe")).toBe("unknown")
        expect(getFileTypeFromName("file.zip")).toBe("unknown")
        expect(getFileTypeFromName("file.png")).toBe("unknown")
    })

    test("handles files without extension",()=>{
        expect(getFileTypeFromName("README")).toBe("unknown")
    })

    test("handles uppercase extensions",()=>{
        expect(getFileTypeFromName("file.PDF")).toBe("pdf")
        expect(getFileTypeFromName("file.DOCX")).toBe("document")
    })
})

describe("Supported file type check",()=>{
    test("accepts supported file types",()=>{
        expect(isSupportedFileType("document.pdf")).toBe(true)
        expect(isSupportedFileType("notes.txt")).toBe(true)
        expect(isSupportedFileType("report.docx")).toBe(true)
    })

    test("rejects unsupported file types",()=>{
        expect(isSupportedFileType("image.png")).toBe(false)
        expect(isSupportedFileType("archive.zip")).toBe(false)
        expect(isSupportedFileType("program.exe")).toBe(false)
    })
})

describe("Filename sanitization",()=>{
    test("removes invalid characters",()=>{
        expect(sanitizeFilename('file<name>.txt')).toBe("file_name_.txt")
        expect(sanitizeFilename('path/to\\file.txt')).toBe("path_to_file.txt")
    })

    test("replaces colons and pipes",()=>{
        expect(sanitizeFilename("file:name|test.txt")).toBe("file_name_test.txt")
    })

    test("replaces question marks and asterisks",()=>{
        expect(sanitizeFilename("what?.txt")).toBe("what_.txt")
        expect(sanitizeFilename("*.txt")).toBe("_.txt")
    })

    test("collapses multiple spaces",()=>{
        expect(sanitizeFilename("hello    world.txt")).toBe("hello world.txt")
    })

    test("trims whitespace",()=>{
        expect(sanitizeFilename("  filename.txt  ")).toBe("filename.txt")
    })

    test("preserves valid filenames",()=>{
        expect(sanitizeFilename("normal-file_name.txt")).toBe("normal-file_name.txt")
    })

    test("handles empty string",()=>{
        expect(sanitizeFilename("")).toBe("")
    })

    test("handles quotes in filename",()=>{
        expect(sanitizeFilename('file"name.txt')).toBe("file_name.txt")
    })
})
