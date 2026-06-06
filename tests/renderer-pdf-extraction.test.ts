// @vitest-environment happy-dom
import{describe,test,expect}from "vitest"

// Extract the PDF text extraction logic for testing
function extractTextFromPdfDataFixed(textContent:string):string{
    let extractedText:string=""
    let btEtRegex=/BT\s*([\s\S]*?)\s*ET/g
    let btEtMatch:RegExpExecArray|null
    while((btEtMatch=btEtRegex.exec(textContent))!==null){
        let block:string=btEtMatch[1]
        let textMatches:string[]=block.match(/\(([^)]*)\)/g)||[]
        for(let match of textMatches){
            let text:string=match.slice(1,-1)
            extractedText+=text+" "
        }
    }
    extractedText=extractedText.trim()

    if(extractedText.length<100){
        let textSequenceRegex=/\(([^)]+)\)/g
        let sequences:string[]=[]
        let seqMatch:RegExpExecArray|null
        while((seqMatch=textSequenceRegex.exec(textContent))!==null){
            if(seqMatch[1].length>2){
                sequences.push(seqMatch[1])
            }
        }
        if(sequences.length>0){
            extractedText=sequences.join(" ")
        }
    }

    if(extractedText.length<50){
        let streamRegex=/stream\s*([\s\S]*?)\s*endstream/g
        let streamMatch:RegExpExecArray|null
        while((streamMatch=streamRegex.exec(textContent))!==null){
            let streamContent:string=streamMatch[1]
            let cleaned:string=streamContent.replace(/[^\x20-\x7E\n\r\t]/g," ").replace(/\s+/g," ").trim()
            if(cleaned.length>100){
                extractedText=cleaned
                break
            }
        }
    }

    return extractedText.trim()
}

describe("PDF text extraction from raw data",()=>{
    test("extracts text from BT/ET blocks",()=>{
        let pdfData="BT /F1 12 Tf (Hello World) Tj ET"
        let result=extractTextFromPdfDataFixed(pdfData)
        expect(result).toContain("Hello World")
    })

    test("extracts text from multiple BT/ET blocks",()=>{
        let pdfData="BT (First) Tj ET some stuff BT (Second) Tj ET"
        let result=extractTextFromPdfDataFixed(pdfData)
        expect(result).toContain("First")
        expect(result).toContain("Second")
    })

    test("falls back to text sequences when BT/ET insufficient",()=>{
        let pdfData="(This is a longer text sequence that should be captured) some binary data"
        let result=extractTextFromPdfDataFixed(pdfData)
        expect(result.length).toBeGreaterThan(0)
    })

    test("returns empty string for no extractable text",()=>{
        let pdfData="binary data without text content"
        let result=extractTextFromPdfDataFixed(pdfData)
        expect(result).toBe("")
    })

    test("handles empty input",()=>{
        let result=extractTextFromPdfDataFixed("")
        expect(result).toBe("")
    })

    test("extracts text from parentheses in PDF format",()=>{
        let pdfData="(Hello) (World)"
        let result=extractTextFromPdfDataFixed(pdfData)
        expect(result).toContain("Hello")
        expect(result).toContain("World")
    })

    test("filters short text sequences in method 2",()=>{
        let pdfData="(Hi) (This is a longer text that passes the filter)"
        let result=extractTextFromPdfDataFixed(pdfData)
        // "Hi" is only 2 chars, should be filtered by the length>2 check
        expect(result).toContain("longer text")
    })

    test("handles stream content",()=>{
        let pdfData="stream\nThis is stream content that is long enough to be considered valid text content for extraction purposes\nendstream"
        let result=extractTextFromPdfDataFixed(pdfData)
        expect(result.length).toBeGreaterThan(0)
    })
})
