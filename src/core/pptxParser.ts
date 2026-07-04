import{extractZipEntries}from "./epubParser.js";
export interface PptxShape{
    type: "text"|"table"|"image";
    text?: string;
    rows?: string[][];
}
export interface PptxSlide{
    slideNumber: number;
    title: string|undefined;
    bodyText: string;
    notes: string|undefined;
    shapes: PptxShape[];
}
export interface PptxResult{
    slides: PptxSlide[];
    totalSlides: number;
    totalWords: number;
    parsedAt: number;
}
export function parseSlideNumber(filename: string): number|undefined{
    let match: RegExpMatchArray|null=filename.match(/slide(\d+)\.xml$/);
    if(!match){
        return undefined;
    }
    return parseInt(match[1], 10);
}
export function countWords(text: string): number{
    return text.split(/\s+/).filter((s: string)=>s.length>0).length;
}
export function extractTables(slideXml: string): PptxShape[]{
    let tables: PptxShape[]=[];
    let tableBlocks: string[]=Array.from(slideXml.matchAll(/<a:tbl\b[\s\S]*?<\/a:tbl>/gi)).map((m: RegExpMatchArray)=>m[0]);
    for(let tableBlock of tableBlocks){
        let rows: string[][]=[];
        let rowBlocks: string[]=Array.from(tableBlock.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/gi)).map((m: RegExpMatchArray)=>m[0]);
        for(let rowBlock of rowBlocks){
            let cellBlocks: string[]=Array.from(rowBlock.matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/gi)).map((m: RegExpMatchArray)=>m[0]);
            let rowData: string[]=[];
            for(let cellBlock of cellBlocks){
                rowData.push(extractTextRuns(cellBlock).join(""));
            }
            rows.push(rowData);
        }
        tables.push({type: "table", rows: rows});
    }
    return tables;
}
export function extractNotes(notesXml: string|undefined): string|undefined{
    if(!notesXml){
        return undefined;
    }
    let text: string=extractTextRuns(notesXml).filter((s: string)=>s.length>0).join(" ");
    if(text.length===0){
        return undefined;
    }
    return text;
}
export function extractSlideText(slideXml: string): {title: string|undefined, bodyText: string, shapes: PptxShape[]}{
    let title: string|undefined=undefined;
    let bodyParts: string[]=[];
    let shapes: PptxShape[]=[];
    let shapeBlocks: string[]=Array.from(slideXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/gi)).map((m: RegExpMatchArray)=>m[0]);
    for(let shapeBlock of shapeBlocks){
        let text: string=extractTextRuns(shapeBlock).join("");
        let isTitle: boolean=/<p:ph\b[^>]*\btype=["']title["']/i.test(shapeBlock);
        shapes.push({type: "text", text: text});
        if(isTitle){
            title=text;
        }
        else{
            bodyParts.push(text);
        }
    }
    let tableShapes: PptxShape[]=extractTables(slideXml);
    for(let tableShape of tableShapes){
        shapes.push(tableShape);
        if(tableShape.rows){
            for(let row of tableShape.rows){
                bodyParts.push(row.join(" "));
            }
        }
    }
    let bodyText: string=bodyParts.filter((s: string)=>s.length>0).join("\n");
    return {title: title, bodyText: bodyText, shapes: shapes};
}
export async function parsePptx(buffer: Buffer): Promise<PptxResult>{
    if(buffer.length<4||buffer[0]!==0x50||buffer[1]!==0x4b){
        throw new Error("Invalid PPTX: not a valid ZIP archive");
    }
    let entries: Map<string, Buffer>=extractZipEntries(buffer);
    let slideFiles: string[]=[];
    for(let filename of entries.keys()){
        if(filename.startsWith("ppt/slides/slide")&&filename.endsWith(".xml")){
            slideFiles.push(filename);
        }
    }
    slideFiles.sort((a: string, b: string)=>{
        let na: number|undefined=parseSlideNumber(a);
        let nb: number|undefined=parseSlideNumber(b);
        let va: number=na===undefined?Infinity:na;
        let vb: number=nb===undefined?Infinity:nb;
        return va-vb;
    });
    let slides: PptxSlide[]=[];
    let totalWords: number=0;
    for(let slideFile of slideFiles){
        let slideNumber: number|undefined=parseSlideNumber(slideFile);
        if(slideNumber===undefined){
            continue;
        }
        let slideBuffer: Buffer|undefined=entries.get(slideFile);
        if(!slideBuffer){
            continue;
        }
        let slideXml: string=slideBuffer.toString("utf8");
        let extracted: {title: string|undefined, bodyText: string, shapes: PptxShape[]}=extractSlideText(slideXml);
        let notesFile: string="ppt/notesSlides/notesSlide"+slideNumber+".xml";
        let notesBuffer: Buffer|undefined=entries.get(notesFile);
        let notes: string|undefined=undefined;
        if(notesBuffer){
            notes=extractNotes(notesBuffer.toString("utf8"));
        }
        let slide: PptxSlide={
            slideNumber: slideNumber,
            title: extracted.title,
            bodyText: extracted.bodyText,
            notes: notes,
            shapes: extracted.shapes
        };
        slides.push(slide);
        totalWords+=countWords(extracted.bodyText);
    }
    return {
        slides: slides,
        totalSlides: slides.length,
        totalWords: totalWords,
        parsedAt: Date.now()
    };
}
function extractTextRuns(xml: string): string[]{
    let matches: RegExpMatchArray[]=Array.from(xml.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi));
    return matches.map((m: RegExpMatchArray)=>decodeXmlEntities(m[1]));
}
function decodeXmlEntities(text: string): string{
    let result: string=text;
    result=result.replace(/&lt;/g, "<");
    result=result.replace(/&gt;/g, ">");
    result=result.replace(/&quot;/g, '"');
    result=result.replace(/&#39;/g, "'");
    result=result.replace(/&apos;/g, "'");
    result=result.replace(/&nbsp;/g, " ");
    result=result.replace(/&amp;/g, "&");
    return result;
}
