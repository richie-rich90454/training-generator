import{describe, test, expect}from "vitest";
import zlib from "zlib";
import{parseEpub, extractZipEntries, parseContainerXml, parseOpfMetadata, parseOpfSpine, xhtmlToText, extractChapterTitle, EpubMetadata, EpubResult}from "../src/core/epubParser.js";
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
function makeEpub(files: {path: string, content: Buffer}[]): Buffer{
    let dataParts: Buffer[]=[];
    let centralParts: Buffer[]=[];
    let offset: number=0;
    for(let file of files){
        let filenameBuf: Buffer=Buffer.from(file.path, "utf8");
        let isMimetype: boolean=file.path==="mimetype";
        let method: number=isMimetype?0:8;
        let compressedData: Buffer;
        if(method===0){
            compressedData=file.content;
        }
        else{
            compressedData=zlib.deflateRawSync(file.content);
        }
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
function makeTestEpub(): Buffer{
    let containerXml: string='<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
    let opf: string='<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Book</dc:title><dc:creator>Test Author</dc:creator><dc:language>en</dc:language><dc:identifier id="BookId" opf:scheme="ISBN">978-0000000000</dc:identifier></metadata><manifest><item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/><itemref idref="ch2"/></spine></package>';
    let chapter1: string='<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter One</title></head><body><h1>Chapter One</h1><p>This is the first chapter with some words.</p><p>It has two paragraphs.</p></body></html>';
    let chapter2: string='<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter Two</title></head><body><h2>Chapter Two</h2><p>Second chapter content here.</p></body></html>';
    return makeEpub([
        {path: "mimetype", content: Buffer.from("application/epub+zip", "utf8")},
        {path: "META-INF/container.xml", content: Buffer.from(containerXml, "utf8")},
        {path: "content.opf", content: Buffer.from(opf, "utf8")},
        {path: "chapter1.xhtml", content: Buffer.from(chapter1, "utf8")},
        {path: "chapter2.xhtml", content: Buffer.from(chapter2, "utf8")}
    ]);
}
describe("parseContainerXml", ()=>{
    test("parseContainerXml extracts OPF path", ()=>{
        let xml: string='<?xml version="1.0"?><container><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
        expect(parseContainerXml(xml)).toBe("content.opf");
    });
    test("parseContainerXml returns null for missing rootfile", ()=>{
        let xml: string='<?xml version="1.0"?><container><rootfiles></rootfiles></container>';
        expect(parseContainerXml(xml)).toBeNull();
    });
});
describe("parseOpfMetadata", ()=>{
    test("parseOpfMetadata extracts title, author, language", ()=>{
        let opf: string='<?xml version="1.0"?><package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>My Book</dc:title><dc:creator>Jane Doe</dc:creator><dc:language>en</dc:language></metadata></package>';
        let meta: EpubMetadata=parseOpfMetadata(opf);
        expect(meta.title).toBe("My Book");
        expect(meta.author).toBe("Jane Doe");
        expect(meta.language).toBe("en");
    });
    test("parseOpfMetadata handles missing fields gracefully", ()=>{
        let opf: string='<?xml version="1.0"?><package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Only Title</dc:title></metadata></package>';
        let meta: EpubMetadata=parseOpfMetadata(opf);
        expect(meta.title).toBe("Only Title");
        expect(meta.author).toBeUndefined();
        expect(meta.language).toBeUndefined();
    });
    test("parseOpfMetadata decodes HTML entities", ()=>{
        let opf: string='<?xml version="1.0"?><package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Tom &amp; Jerry</dc:title><dc:creator>A &lt;B&gt; C</dc:creator></metadata></package>';
        let meta: EpubMetadata=parseOpfMetadata(opf);
        expect(meta.title).toBe("Tom & Jerry");
        expect(meta.author).toBe("A <B> C");
    });
    test("parseOpfMetadata extracts ISBN from identifier", ()=>{
        let opf: string='<?xml version="1.0"?><package><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="BookId" opf:scheme="ISBN">978-0000000000</dc:identifier></metadata></package>';
        let meta: EpubMetadata=parseOpfMetadata(opf);
        expect(meta.isbn).toBe("978-0000000000");
    });
});
describe("parseOpfSpine", ()=>{
    test("parseOpfSpine returns idrefs in order", ()=>{
        let opf: string='<?xml version="1.0"?><package><manifest><item id="ch1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="ch2" href="c2.xhtml" media-type="application/xhtml+xml"/><item id="ch3" href="c3.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch3"/><itemref idref="ch1"/><itemref idref="ch2"/></spine></package>';
        let spine=parseOpfSpine(opf);
        expect(spine.idrefs).toEqual(["ch3", "ch1", "ch2"]);
    });
    test("parseOpfSpine builds manifest map", ()=>{
        let opf: string='<?xml version="1.0"?><package><manifest><item id="ch1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx"><itemref idref="ch1"/></spine></package>';
        let spine=parseOpfSpine(opf);
        expect(spine.manifest.size).toBe(2);
        expect(spine.manifest.get("ch1")?.href).toBe("c1.xhtml");
        expect(spine.manifest.get("ch1")?.mediaType).toBe("application/xhtml+xml");
        expect(spine.manifest.get("ncx")?.href).toBe("toc.ncx");
    });
});
describe("xhtmlToText", ()=>{
    test("xhtmlToText removes head and styles", ()=>{
        let xhtml: string="<html><head><title>T</title><style>body{color:red}</style></head><body><p>hello</p></body></html>";
        let result: string=xhtmlToText(xhtml);
        expect(result).toBe("hello");
        expect(result).not.toContain("color");
        expect(result).not.toContain("red");
    });
    test("xhtmlToText converts p tags to newlines", ()=>{
        let result: string=xhtmlToText("<p>one</p><p>two</p>");
        expect(result).toBe("one\ntwo");
    });
    test("xhtmlToText converts headings to newlines", ()=>{
        let result: string=xhtmlToText("<h1>Title</h1><p>Body</p>");
        expect(result).toBe("Title\nBody");
    });
    test("xhtmlToText decodes HTML entities", ()=>{
        let result: string=xhtmlToText("<p>Tom &amp; Jerry &lt;tag&gt;</p>");
        expect(result).toBe("Tom & Jerry <tag>");
    });
    test("xhtmlToText decodes &apos; entity", ()=>{
        let result: string=xhtmlToText("<p>It&apos;s &lt;tag&gt;</p>");
        expect(result).toBe("It's <tag>");
    });
    test("xhtmlToText collapses multiple newlines", ()=>{
        let result: string=xhtmlToText("<p>one</p><br><br><br><p>two</p>");
        expect(result).toBe("one\ntwo");
    });
    test("xhtmlToText strips remaining tags", ()=>{
        let result: string=xhtmlToText("<p><b>bold</b> <i>italic</i></p>");
        expect(result).toBe("bold italic");
        expect(result).not.toContain("<");
        expect(result).not.toContain(">");
    });
});
describe("extractChapterTitle", ()=>{
    test("extractChapterTitle from h1", ()=>{
        let xhtml: string="<html><body><h1>My Heading</h1><p>text</p></body></html>";
        expect(extractChapterTitle(xhtml, 0)).toBe("My Heading");
    });
    test("extractChapterTitle falls back to Chapter N", ()=>{
        let xhtml: string="<html><body><p>No heading here</p></body></html>";
        expect(extractChapterTitle(xhtml, 2)).toBe("Chapter 3");
    });
});
describe("extractZipEntries", ()=>{
    test("extractZipEntries handles stored entries", ()=>{
        let zip: Buffer=makeEpub([{path: "mimetype", content: Buffer.from("application/epub+zip", "utf8")}]);
        let entries: Map<string, Buffer>=extractZipEntries(zip);
        expect(entries.get("mimetype")?.toString("utf8")).toBe("application/epub+zip");
    });
    test("extractZipEntries handles deflated entries", ()=>{
        let zip: Buffer=makeEpub([{path: "data.txt", content: Buffer.from("compressed content here", "utf8")}]);
        let entries: Map<string, Buffer>=extractZipEntries(zip);
        expect(entries.get("data.txt")?.toString("utf8")).toBe("compressed content here");
    });
    test("rejects archive claiming too many entries", ()=>{
        let zip: Buffer=makeEpub([{path: "data.txt", content: Buffer.from("x", "utf8")}]);
        let eocdOffset: number=zip.length-22;
        zip.writeUInt16LE(65535, eocdOffset+10);
        expect(()=>extractZipEntries(zip)).toThrow(/too many entries/);
    });
    test("rejects entry with oversized compressedSize", ()=>{
        let zip: Buffer=makeEpub([{path: "data.txt", content: Buffer.from("x", "utf8")}]);
        let eocdOffset: number=zip.length-22;
        let cdOffset: number=zip.readUInt32LE(eocdOffset+16);
        zip.writeUInt32LE(0xffffffff, cdOffset+20);
        let entries: Map<string, Buffer>=extractZipEntries(zip);
        expect(entries.has("data.txt")).toBe(false);
    });
});
describe("parseEpub", ()=>{
    test("parseEpub returns metadata and chapters", async ()=>{
        let result: EpubResult=await parseEpub(makeTestEpub());
        expect(result.metadata.title).toBe("Test Book");
        expect(result.metadata.author).toBe("Test Author");
        expect(result.metadata.language).toBe("en");
        expect(result.metadata.isbn).toBe("978-0000000000");
        expect(result.chapters).toHaveLength(2);
        expect(result.totalChapters).toBe(2);
    });
    test("parseEpub preserves spine order", async ()=>{
        let result: EpubResult=await parseEpub(makeTestEpub());
        expect(result.chapters[0].id).toBe("ch1");
        expect(result.chapters[1].id).toBe("ch2");
        expect(result.chapters[0].title).toBe("Chapter One");
        expect(result.chapters[1].title).toBe("Chapter Two");
        expect(result.chapters[0].index).toBe(0);
        expect(result.chapters[1].index).toBe(1);
    });
    test("parseEpub computes totalWords", async ()=>{
        let result: EpubResult=await parseEpub(makeTestEpub());
        expect(result.totalWords).toBe(20);
    });
    test("parseEpub throws on non-EPUB buffer", async ()=>{
        await expect(parseEpub(Buffer.from("not an epub", "utf8"))).rejects.toThrow();
    });
});
