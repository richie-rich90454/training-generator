import{describe, test, expect}from "vitest";
import zlib from "zlib";
import{parsePptx, extractSlideText, extractNotes, extractTables, parseSlideNumber, countWords, PptxResult, PptxShape}from "../src/core/pptxParser.js";
let crcTable: number[]|null=null;
function crc32Table(): number[]{
    if(crcTable){
        return crcTable;
    }
    let table: number[]=[];
    for(let n: number=0;n<256;n++){
        let c: number=n;
        for(let k: number=0;k<8;k++){
            if(c&1){
                c=0xedb88320^(c>>>1);
            }
            else{
                c=c>>>1;
            }
        }
        table[n]=c>>>0;
    }
    crcTable=table;
    return table;
}
function crc32(buf: Buffer): number{
    let table: number[]=crc32Table();
    let crc: number=0xffffffff;
    for(let i: number=0;i<buf.length;i++){
        crc=table[(crc^buf[i])&0xff]^(crc>>>8);
    }
    return (crc^0xffffffff)>>>0;
}
function makePptx(files: {path: string, content: Buffer}[]): Buffer{
    let dataParts: Buffer[]=[];
    let centralParts: Buffer[]=[];
    let offset: number=0;
    for(let file of files){
        let filenameBuf: Buffer=Buffer.from(file.path, "utf8");
        let method: number=8;
        let compressedData: Buffer=zlib.deflateRawSync(file.content);
        let crc: number=crc32(file.content);
        let localHeader: Buffer=Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0, 6);
        localHeader.writeUInt16LE(method, 8);
        localHeader.writeUInt16LE(0, 10);
        localHeader.writeUInt16LE(0, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(compressedData.length, 18);
        localHeader.writeUInt32LE(file.content.length, 22);
        localHeader.writeUInt16LE(filenameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);
        dataParts.push(Buffer.concat([localHeader, filenameBuf, compressedData]));
        let centralHeader: Buffer=Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0, 8);
        centralHeader.writeUInt16LE(method, 10);
        centralHeader.writeUInt16LE(0, 12);
        centralHeader.writeUInt16LE(0, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(compressedData.length, 20);
        centralHeader.writeUInt32LE(file.content.length, 24);
        centralHeader.writeUInt16LE(filenameBuf.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);
        centralParts.push(Buffer.concat([centralHeader, filenameBuf]));
        offset+=30+filenameBuf.length+compressedData.length;
    }
    let cdBuffer: Buffer=Buffer.concat(centralParts);
    let eocd: Buffer=Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(cdBuffer.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...dataParts, cdBuffer, eocd]);
}
function makeSlideXml(title: string, body: string): string{
    return '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>'+title+'</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody><a:p><a:r><a:t>'+body+'</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>';
}
function makeNotesXml(notes: string): string{
    return '<p:notes xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>'+notes+'</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>';
}
describe("parseSlideNumber", ()=>{
    test("parseSlideNumber extracts from ppt/slides/slide1.xml", ()=>{
        expect(parseSlideNumber("ppt/slides/slide1.xml")).toBe(1);
    });
    test("parseSlideNumber returns undefined for slideX.xml", ()=>{
        expect(parseSlideNumber("ppt/slides/slideX.xml")).toBeUndefined();
    });
    test("parseSlideNumber returns undefined for non-slide file", ()=>{
        expect(parseSlideNumber("foo.xml")).toBeUndefined();
    });
});
describe("countWords", ()=>{
    test("countWords counts basic words", ()=>{
        expect(countWords("hello world foo")).toBe(3);
    });
    test("countWords returns 0 for empty string", ()=>{
        expect(countWords("")).toBe(0);
    });
    test("countWords handles multiple spaces", ()=>{
        expect(countWords("   a   b   ")).toBe(2);
    });
});
describe("extractSlideText", ()=>{
    test("extractSlideText extracts title", ()=>{
        let xml: string='<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>My Title</a:t></a:r></a:p></p:txBody></p:sp>';
        let result: {title: string|undefined, bodyText: string, shapes: PptxShape[]}=extractSlideText(xml);
        expect(result.title).toBe("My Title");
    });
    test("extractSlideText extracts body from multiple shapes", ()=>{
        let xml: string='<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody><a:p><a:r><a:t>First body</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody><a:p><a:r><a:t>Second body</a:t></a:r></a:p></p:txBody></p:sp>';
        let result: {title: string|undefined, bodyText: string, shapes: PptxShape[]}=extractSlideText(xml);
        expect(result.bodyText).toContain("First body");
        expect(result.bodyText).toContain("Second body");
    });
    test("extractSlideText returns undefined title when no title placeholder", ()=>{
        let xml: string='<p:sp><p:txBody><a:p><a:r><a:t>Just body</a:t></a:r></a:p></p:txBody></p:sp>';
        let result: {title: string|undefined, bodyText: string, shapes: PptxShape[]}=extractSlideText(xml);
        expect(result.title).toBeUndefined();
    });
    test("extractSlideText returns empty body for empty slide", ()=>{
        let xml: string='<p:sld><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>';
        let result: {title: string|undefined, bodyText: string, shapes: PptxShape[]}=extractSlideText(xml);
        expect(result.bodyText).toBe("");
        expect(result.title).toBeUndefined();
    });
});
describe("extractNotes", ()=>{
    test("extractNotes extracts text", ()=>{
        let xml: string='<p:notes><p:sp><p:txBody><a:p><a:r><a:t>Speaker notes text</a:t></a:r></a:p></p:txBody></p:sp></p:notes>';
        expect(extractNotes(xml)).toBe("Speaker notes text");
    });
    test("extractNotes returns undefined for undefined input", ()=>{
        expect(extractNotes(undefined)).toBeUndefined();
    });
    test("extractNotes returns undefined for empty input", ()=>{
        expect(extractNotes("")).toBeUndefined();
    });
});
describe("extractTables", ()=>{
    test("extractTables extracts simple table", ()=>{
        let xml: string='<a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>A1</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>B1</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl>';
        let tables: PptxShape[]=extractTables(xml);
        expect(tables).toHaveLength(1);
        expect(tables[0].rows).toEqual([["A1", "B1"]]);
    });
    test("extractTables returns empty for no tables", ()=>{
        let xml: string='<p:sld><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>';
        let tables: PptxShape[]=extractTables(xml);
        expect(tables).toHaveLength(0);
    });
    test("extractTables handles multi-row multi-col table", ()=>{
        let xml: string='<a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>A1</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>B1</a:t></a:r></a:p></a:txBody></a:tc></a:tr><a:tr><a:tc><a:txBody><a:p><a:r><a:t>A2</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>B2</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl>';
        let tables: PptxShape[]=extractTables(xml);
        expect(tables[0].rows).toEqual([["A1", "B1"], ["A2", "B2"]]);
    });
});
describe("parsePptx", ()=>{
    test("parsePptx throws on non-PPTX buffer", async ()=>{
        await expect(parsePptx(Buffer.from("not a pptx", "utf8"))).rejects.toThrow();
    });
    test("parsePptx parses single slide", async ()=>{
        let pptx: Buffer=makePptx([{path: "ppt/slides/slide1.xml", content: Buffer.from(makeSlideXml("Slide Title", "hello world foo"), "utf8")}]);
        let result: PptxResult=await parsePptx(pptx);
        expect(result.totalSlides).toBe(1);
        expect(result.slides[0].slideNumber).toBe(1);
        expect(result.slides[0].title).toBe("Slide Title");
        expect(result.slides[0].bodyText).toBe("hello world foo");
    });
    test("parsePptx parses multiple slides in order", async ()=>{
        let pptx: Buffer=makePptx([
            {path: "ppt/slides/slide2.xml", content: Buffer.from(makeSlideXml("Second", "second body"), "utf8")},
            {path: "ppt/slides/slide1.xml", content: Buffer.from(makeSlideXml("First", "first body"), "utf8")}
        ]);
        let result: PptxResult=await parsePptx(pptx);
        expect(result.slides).toHaveLength(2);
        expect(result.slides[0].slideNumber).toBe(1);
        expect(result.slides[1].slideNumber).toBe(2);
        expect(result.slides[0].title).toBe("First");
        expect(result.slides[1].title).toBe("Second");
    });
    test("parsePptx computes totalWords", async ()=>{
        let pptx: Buffer=makePptx([
            {path: "ppt/slides/slide1.xml", content: Buffer.from(makeSlideXml("T1", "one two three"), "utf8")},
            {path: "ppt/slides/slide2.xml", content: Buffer.from(makeSlideXml("T2", "four five"), "utf8")}
        ]);
        let result: PptxResult=await parsePptx(pptx);
        expect(result.totalWords).toBe(5);
    });
    test("parsePptx extracts notes when present", async ()=>{
        let pptx: Buffer=makePptx([
            {path: "ppt/slides/slide1.xml", content: Buffer.from(makeSlideXml("Title", "body text"), "utf8")},
            {path: "ppt/notesSlides/notesSlide1.xml", content: Buffer.from(makeNotesXml("Important note"), "utf8")}
        ]);
        let result: PptxResult=await parsePptx(pptx);
        expect(result.slides[0].notes).toBe("Important note");
    });
});
