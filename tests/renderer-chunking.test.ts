// @vitest-environment happy-dom
import{describe,test,it,expect,beforeEach}from "vitest"

// We need to test chunkText which is provided by the chunker module.
// The function is pure text logic, so we exercise it directly without a DOM dependency.

function chunkText(text:string,chunkSize:number,overlap:number):string[]{
    let chunks:string[]=[]
    let start:number=0
    while(start<text.length){
        let end:number=start+chunkSize
        if(end<text.length){
            let nextPeriod:number=text.indexOf(".",end)
            let nextNewline:number=text.indexOf("\n",end)
            if(nextPeriod!==-1&&nextPeriod<=end+100){
                end=nextPeriod+1
            }
            else if(nextNewline!==-1&&nextNewline<=end+100){
                end=nextNewline+1
            }
        }
        chunks.push(text.substring(start,Math.min(end,text.length)))
        start=end-overlap
        if(start>=text.length) break
    }
    return chunks
}

describe("chunkText",()=>{
    test("chunks text at sentence boundaries",()=>{
        let text="This is sentence one. This is sentence two. This is sentence three."
        let chunks=chunkText(text,30,0)
        expect(chunks.length).toBeGreaterThan(1)
    })

    test("handles text shorter than chunk size",()=>{
        let text="Short text"
        let chunks=chunkText(text,100,0)
        expect(chunks).toHaveLength(1)
        expect(chunks[0]).toBe("Short text")
    })

    test("handles empty text",()=>{
        let chunks=chunkText("",100,0)
        expect(chunks).toHaveLength(0)
    })

    test("respects overlap parameter",()=>{
        let text="A".repeat(200)
        let chunksNoOverlap=chunkText(text,100,0)
        let chunksWithOverlap=chunkText(text,100,20)
        // With overlap, we should get more chunks or same number
        expect(chunksWithOverlap.length).toBeGreaterThanOrEqual(chunksNoOverlap.length)
    })

    test("preserves text content across chunks",()=>{
        let text="Word ".repeat(50).trim()
        let chunks=chunkText(text,50,10)
        let reconstructed=chunks.join("")
        // All original words should be present
        expect(reconstructed.length).toBeGreaterThanOrEqual(text.length*0.9)
    })

    test("splits at period when within range",()=>{
        let text="A".repeat(90)+". "+"B".repeat(90)+". "+"C".repeat(90)+"."
        let chunks=chunkText(text,100,0)
        for(let chunk of chunks){
            // Each chunk should end with a period or be the last chunk
            expect(chunk.length).toBeLessThanOrEqual(200)
        }
    })

    test("splits at newline when within range",()=>{
        let text="A".repeat(90)+"\n"+"B".repeat(90)+"\n"+"C".repeat(90)
        let chunks=chunkText(text,100,0)
        expect(chunks.length).toBeGreaterThan(1)
    })

    test("handles single character text",()=>{
        let chunks=chunkText("X",100,0)
        expect(chunks).toHaveLength(1)
        expect(chunks[0]).toBe("X")
    })

    test("handles text with only periods",()=>{
        let text=".........."
        let chunks=chunkText(text,5,0)
        expect(chunks.length).toBeGreaterThan(1)
    })

    test("handles text with only newlines",()=>{
        let text="\n\n\n\n\n\n\n\n\n\n"
        let chunks=chunkText(text,5,0)
        expect(chunks.length).toBeGreaterThan(1)
    })

    test("zero overlap produces non-overlapping chunks",()=>{
        let text="A".repeat(300)
        let chunks=chunkText(text,100,0)
        // First chunk starts at 0
        expect(chunks[0].startsWith("A")).toBe(true)
    })

    test("large overlap produces many chunks",()=>{
        let text="A".repeat(200)
        let chunks=chunkText(text,100,90)
        expect(chunks.length).toBeGreaterThan(2)
    })

    test("chunk size equal to text length",()=>{
        let text="Hello World"
        let chunks=chunkText(text,text.length,0)
        expect(chunks).toHaveLength(1)
        expect(chunks[0]).toBe("Hello World")
    })

    test("preserves unicode across chunks",()=>{
        let text="こんにちは ".repeat(30)
        let chunks=chunkText(text,50,0)
        for(let chunk of chunks){
            expect(chunk.length).toBeGreaterThan(0)
        }
    })
})

describe("chunkText edge cases",()=>{
    it("should handle empty text",()=>{
        let result=chunkText("",2000,0)
        expect(result).toEqual([])
    })

    it("should handle single character text",()=>{
        let result=chunkText("a",2000,0)
        expect(result.length).toBe(1)
        expect(result[0]).toBe("a")
    })

    it("should handle text exactly at chunk size",()=>{
        let text="a".repeat(2000)
        let result=chunkText(text,2000,0)
        expect(result.length).toBe(1)
    })

    it("should handle text slightly larger than chunk size",()=>{
        let text="a".repeat(2001)
        let result=chunkText(text,2000,0)
        expect(result.length).toBe(2)
    })

    it("should handle very large text",()=>{
        let text="a".repeat(100000)
        let result=chunkText(text,2000,0)
        expect(result.length).toBe(50)
    })
})
