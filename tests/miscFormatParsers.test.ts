import { describe, test, expect } from "vitest";
import zlib from "zlib";
import {
    parseLatex,
    parseOdt,
    parseOds,
    parseOdp,
    parseVisio,
    parseMindMap,
    parseEmail,
    parseRss,
    parseSrt,
    parseVtt,
    detectAndParse,
    ParsedTextResult
} from "../src/core/miscFormatParsers.js";
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
function makeZip(files: {path: string, content: string}[]): Buffer{
    let dataParts: Buffer[]=[];
    let centralParts: Buffer[]=[];
    let offset: number=0;
    for(let file of files){
        let filenameBuf: Buffer=Buffer.from(file.path, "utf8");
        let contentBuf: Buffer=Buffer.from(file.content, "utf8");
        let compressedData: Buffer=zlib.deflateRawSync(contentBuf);
        let crc: number=crc32(contentBuf);
        let localHeader: Buffer=Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0, 6);
        localHeader.writeUInt16LE(8, 8);
        localHeader.writeUInt16LE(0, 10);
        localHeader.writeUInt16LE(0, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(compressedData.length, 18);
        localHeader.writeUInt32LE(contentBuf.length, 22);
        localHeader.writeUInt16LE(filenameBuf.length, 26);
        localHeader.writeUInt16LE(0, 28);
        dataParts.push(Buffer.concat([localHeader, filenameBuf, compressedData]));
        let centralHeader: Buffer=Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0, 8);
        centralHeader.writeUInt16LE(8, 10);
        centralHeader.writeUInt16LE(0, 12);
        centralHeader.writeUInt16LE(0, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(compressedData.length, 20);
        centralHeader.writeUInt32LE(contentBuf.length, 24);
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
describe("parseLatex", ()=>{
    test("extracts title and author", ()=>{
        let latex: string="\\title{My Title}\\author{John Doe}\\date{2024}\\begin{document}Hello\\end{document}";
        let result: ParsedTextResult=parseLatex(latex);
        expect(result.title).toBe("My Title");
        expect(result.metadata.author).toBe("John Doe");
        expect(result.metadata.date).toBe("2024");
    });
    test("strips comments", ()=>{
        let latex: string="\\begin{document}Hello % comment\nWorld.\\end{document}";
        let result: ParsedTextResult=parseLatex(latex);
        expect(result.text).toContain("Hello");
        expect(result.text).toContain("World");
        expect(result.text).not.toContain("comment");
    });
    test("replaces math with [MATH]", ()=>{
        let latex: string="\\begin{document}$x+y$ and $$a=b$$ and \\[c=d\\] and \\(e=f\\)\\end{document}";
        let result: ParsedTextResult=parseLatex(latex);
        expect(result.text).toContain("[MATH]");
        expect(result.text).not.toContain("$x+y$");
        expect(result.text).not.toContain("$$a=b$$");
    });
    test("extracts sections", ()=>{
        let latex: string="\\begin{document}\\section{One}Text one.\\section{Two}Text two.\\end{document}";
        let result: ParsedTextResult=parseLatex(latex);
        expect(result.sections).toHaveLength(2);
        expect(result.sections?.[0].title).toBe("One");
        expect(result.sections?.[1].text).toContain("Text two.");
    });
});
describe("parseOdt", ()=>{
    test("extracts paragraphs", ()=>{
        let zip: Buffer=makeZip([{path: "content.xml", content: '<office:document-content><text:p>Hello world.</text:p><text:p>Second paragraph.</text:p></office:document-content>'}]);
        let result: ParsedTextResult=parseOdt(zip);
        expect(result.text).toContain("Hello world.");
        expect(result.text).toContain("Second paragraph.");
    });
    test("extracts headings", ()=>{
        let zip: Buffer=makeZip([{path: "content.xml", content: '<office:document-content><text:h>Heading</text:h><text:p>Body</text:p></office:document-content>'}]);
        let result: ParsedTextResult=parseOdt(zip);
        expect(result.text).toContain("# Heading");
        expect(result.text).toContain("Body");
    });
});
describe("parseOds", ()=>{
    test("extracts table cells", ()=>{
        let content: string='<table:table><table:table-row><table:table-cell><text:p>A</text:p></table:table-cell><table:table-cell><text:p>B</text:p></table:table-cell></table:table-row><table:table-row><table:table-cell><text:p>C</text:p></table:table-cell><table:table-cell><text:p>D</text:p></table:table-cell></table:table-row></table:table>';
        let zip: Buffer=makeZip([{path: "content.xml", content: content}]);
        let result: ParsedTextResult=parseOds(zip);
        expect(result.text).toContain("| A | B |");
        expect(result.text).toContain("| C | D |");
        expect(result.text).toContain("| --- |");
    });
});
describe("parseOdp", ()=>{
    test("extracts slide text", ()=>{
        let content: string='<draw:page><text:p>Slide 1</text:p></draw:page><draw:page><text:p>Slide 2</text:p></draw:page>';
        let zip: Buffer=makeZip([{path: "content.xml", content: content}]);
        let result: ParsedTextResult=parseOdp(zip);
        expect(result.text).toBe("Slide 1\n---\nSlide 2");
    });
});
describe("parseVisio", ()=>{
    test("extracts text", ()=>{
        let zip: Buffer=makeZip([
            {path: "document.xml", content: '<a:t>Doc text</a:t>'},
            {path: "visio/pages/page1.xml", content: '<a:t>Page text</a:t>'}
        ]);
        let result: ParsedTextResult=parseVisio(zip);
        expect(result.text).toContain("Doc text");
        expect(result.text).toContain("Page text");
    });
    test("adds warning", ()=>{
        let zip: Buffer=makeZip([{path: "document.xml", content: '<a:t>x</a:t>'}]);
        let result: ParsedTextResult=parseVisio(zip);
        expect(result.warnings.length).toBe(1);
        expect(result.warnings[0]).toContain("best-effort");
    });
});
describe("parseMindMap", ()=>{
    test("parses .mm outline", ()=>{
        let xml: string='<map><node TEXT="Root"><node TEXT="Child1"/><node TEXT="Child2"/></node></map>';
        let result: ParsedTextResult=parseMindMap(Buffer.from(xml));
        expect(result.text).toContain("Root");
        expect(result.text).toContain("    Child1");
        expect(result.text).toContain("    Child2");
    });
    test("parses .mm nested nodes", ()=>{
        let xml: string='<map><node TEXT="Root"><node TEXT="Child"><node TEXT="Grandchild"/></node></node></map>';
        let result: ParsedTextResult=parseMindMap(Buffer.from(xml));
        expect(result.text).toContain("    Child");
        expect(result.text).toContain("        Grandchild");
    });
    test("handles xmind ZIP", ()=>{
        let content: string='<?xml version="1.0"?><xmap-content><sheet><topic title="Root"><topic title="Child"/></topic></sheet></xmap-content>';
        let zip: Buffer=makeZip([{path: "content.xml", content: content}]);
        let result: ParsedTextResult=parseMindMap(zip);
        expect(result.text).toContain("Root");
        expect(result.text).toContain("    Child");
    });
    test("adds warning for unknown", ()=>{
        let result: ParsedTextResult=parseMindMap(Buffer.from("not a map"));
        expect(result.warnings.length).toBe(1);
        expect(result.warnings[0]).toBe("Unrecognized mind map format");
    });
});
describe("parseEmail", ()=>{
    test("extracts headers and body", ()=>{
        let raw: string="From: a@b.com\nTo: c@d.com\nSubject: Hi\nDate: Mon, 1 Jan 2024 00:00:00 GMT\n\nHello world.";
        let result: ParsedTextResult=parseEmail(Buffer.from(raw));
        expect(result.metadata.from).toBe("a@b.com");
        expect(result.metadata.to).toBe("c@d.com");
        expect(result.metadata.subject).toBe("Hi");
        expect(result.text).toBe("Hello world.");
    });
    test("parses multipart alternative", ()=>{
        let raw: string='Content-Type: multipart/alternative; boundary="boundary"\n\n--boundary\nContent-Type: text/plain\n\nHello plain\n--boundary\nContent-Type: text/html\n\n<html>Hi</html>\n--boundary--';
        let result: ParsedTextResult=parseEmail(Buffer.from(raw));
        expect(result.text).toBe("Hello plain");
    });
    test("decodes base64 body", ()=>{
        let encoded: string=Buffer.from("Hello base64").toString("base64");
        let raw: string='Content-Type: multipart/alternative; boundary="boundary"\n\n--boundary\nContent-Type: text/plain\nContent-Transfer-Encoding: base64\n\n'+encoded+'\n--boundary--';
        let result: ParsedTextResult=parseEmail(Buffer.from(raw));
        expect(result.text).toBe("Hello base64");
    });
    test("handles folded headers (RFC 5322)", ()=>{
        let raw: string="From: a@b.com\nSubject: This is a long\n subject that continues\n here\nTo: c@d.com\n\nHello world.";
        let result: ParsedTextResult=parseEmail(Buffer.from(raw));
        expect(result.metadata.subject).toBe("This is a long subject that continues here");
        expect(result.metadata.from).toBe("a@b.com");
        expect(result.metadata.to).toBe("c@d.com");
        expect(result.text).toBe("Hello world.");
    });
    test("ignores continuation without active header", ()=>{
        let raw: string=" orphan continuation\nFrom: a@b.com\n\nBody text";
        let result: ParsedTextResult=parseEmail(Buffer.from(raw));
        expect(result.metadata.from).toBe("a@b.com");
        expect(result.text).toBe("Body text");
    });
});
describe("parseRss", ()=>{
    test("extracts items", ()=>{
        let xml: string='<rss><channel><item><title>Item 1</title><link>http://a</link><description>Desc 1</description><pubDate>Mon</pubDate></item></channel></rss>';
        let results: ParsedTextResult[]=parseRss(xml);
        expect(results.length).toBe(1);
        expect(results[0].title).toBe("Item 1");
        expect(results[0].metadata.link).toBe("http://a");
        expect(results[0].metadata.pubDate).toBe("Mon");
    });
    test("handles Atom entries", ()=>{
        let xml: string='<feed><entry><title>Atom 1</title><link href="http://b"/><summary>Summary</summary><published>2024</published></entry></feed>';
        let results: ParsedTextResult[]=parseRss(xml);
        expect(results.length).toBe(1);
        expect(results[0].title).toBe("Atom 1");
        expect(results[0].metadata.link).toBe("http://b");
        expect(results[0].text).toBe("Summary");
    });
});
describe("parseSrt", ()=>{
    test("strips timecodes", ()=>{
        let srt: string="1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:00:05,000 --> 00:00:06,000\nSecond line";
        let result: ParsedTextResult=parseSrt(srt);
        expect(result.text).toBe("Hello world Second line");
    });
    test("counts segments", ()=>{
        let srt: string="1\n00:00:01,000 --> 00:00:02,000\nA\n\n2\n00:00:03,000 --> 00:00:04,000\nB";
        let result: ParsedTextResult=parseSrt(srt);
        expect(result.metadata.segmentCount).toBe(2);
    });
});
describe("parseVtt", ()=>{
    test("strips timecodes", ()=>{
        let vtt: string="WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello world\n\n00:00:05.000 --> 00:00:06.000\nSecond";
        let result: ParsedTextResult=parseVtt(vtt);
        expect(result.text).toBe("Hello world Second");
    });
    test("handles cue IDs", ()=>{
        let vtt: string="WEBVTT\n\ncue-1\n00:00:01.000 --> 00:00:02.000\nHello\n";
        let result: ParsedTextResult=parseVtt(vtt);
        expect(result.text).toContain("Hello");
        expect(result.text).not.toContain("cue-1");
    });
});
describe("detectAndParse", ()=>{
    test("dispatches latex", ()=>{
        let result: ParsedTextResult|ParsedTextResult[]=detectAndParse(Buffer.from("\\title{T}"), "doc.tex");
        expect(Array.isArray(result)).toBe(false);
        expect((result as ParsedTextResult).format).toBe("latex");
    });
    test("dispatches odt", ()=>{
        let zip: Buffer=makeZip([{path: "content.xml", content: "<text:p>Hi</text:p>"}]);
        let result: ParsedTextResult|ParsedTextResult[]=detectAndParse(zip, "doc.odt");
        expect((result as ParsedTextResult).format).toBe("odt");
    });
    test("dispatches srt", ()=>{
        let result: ParsedTextResult|ParsedTextResult[]=detectAndParse(Buffer.from("1\n00:00:00,000 --> 00:00:01,000\nHi"), "sub.srt");
        expect((result as ParsedTextResult).format).toBe("srt");
    });
    test("throws for unsupported", ()=>{
        expect(()=>detectAndParse(Buffer.from("x"), "doc.foo")).toThrow("Unsupported misc format: doc.foo");
    });
});
