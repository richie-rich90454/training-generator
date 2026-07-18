import zlib from "zlib";
const MAX_ZIP_ENTRIES: number=10000;
const MAX_ENTRY_DECOMPRESSED_SIZE: number=50*1024*1024;
const MAX_TOTAL_DECOMPRESSED_SIZE: number=200*1024*1024;
export interface EpubChapter{
    id: string;
    title: string;
    href: string;
    text: string;
    index: number;
}
export interface EpubMetadata{
    title?: string;
    author?: string;
    language?: string;
    publisher?: string;
    description?: string;
    isbn?: string;
}
export interface EpubResult{
    metadata: EpubMetadata;
    chapters: EpubChapter[];
    totalChapters: number;
    totalWords: number;
    parsedAt: number;
}
export function extractZipEntries(buffer: Buffer): Map<string, Buffer>{
    let entries: Map<string, Buffer>=new Map();
    if(buffer.length<22){
        throw new Error("Buffer too small to be a valid ZIP archive");
    }
    let eocdOffset: number=-1;
    let minOffset: number=Math.max(0, buffer.length-65557);
    for(let i: number=buffer.length-22;i>=minOffset;i--){
        if(buffer[i]===0x50&&buffer[i+1]===0x4b&&buffer[i+2]===0x05&&buffer[i+3]===0x06){
            eocdOffset=i;
            break;
        }
    }
    if(eocdOffset===-1){
        throw new Error("End of Central Directory record not found");
    }
    let cdCount: number=buffer.readUInt16LE(eocdOffset+10);
    if(cdCount>MAX_ZIP_ENTRIES){
        throw new Error("ZIP archive has too many entries: "+cdCount+" (max "+MAX_ZIP_ENTRIES+")");
    }
    let cdOffset: number=buffer.readUInt32LE(eocdOffset+16);
    let pos: number=cdOffset;
    let totalDecompressedSize: number=0;
    for(let i: number=0;i<cdCount;i++){
        if(pos+46>buffer.length){
            break;
        }
        if(buffer[pos]!==0x50||buffer[pos+1]!==0x4b||buffer[pos+2]!==0x01||buffer[pos+3]!==0x02){
            break;
        }
        let method: number=buffer.readUInt16LE(pos+10);
        let compressedSize: number=buffer.readUInt32LE(pos+20);
        let filenameLen: number=buffer.readUInt16LE(pos+28);
        let extraLen: number=buffer.readUInt16LE(pos+30);
        let commentLen: number=buffer.readUInt16LE(pos+32);
        let localOffset: number=buffer.readUInt32LE(pos+42);
        let filename: string=buffer.toString("utf8", pos+46, pos+46+filenameLen);
        pos+=46+filenameLen+extraLen+commentLen;
        if(filename.endsWith("/")){
            continue;
        }
        if(localOffset+30>buffer.length){
            continue;
        }
        let localFilenameLen: number=buffer.readUInt16LE(localOffset+26);
        let localExtraLen: number=buffer.readUInt16LE(localOffset+28);
        let dataOffset: number=localOffset+30+localFilenameLen+localExtraLen;
        if(compressedSize>buffer.length-dataOffset){
            continue;
        }
        let compressedData: Buffer=buffer.subarray(dataOffset, dataOffset+compressedSize);
        let content: Buffer;
        if(method===0){
            content=compressedData;
        }
        else if(method===8){
            content=zlib.inflateRawSync(compressedData);
        }
        else{
            throw new Error("Unsupported compression method: "+method);
        }
        if(content.length>MAX_ENTRY_DECOMPRESSED_SIZE){
            throw new Error("ZIP entry too large after decompression: "+filename+" ("+content.length+" bytes, max "+MAX_ENTRY_DECOMPRESSED_SIZE+")");
        }
        totalDecompressedSize+=content.length;
        if(totalDecompressedSize>MAX_TOTAL_DECOMPRESSED_SIZE){
            throw new Error("ZIP archive exceeds total decompressed size limit ("+MAX_TOTAL_DECOMPRESSED_SIZE+" bytes)");
        }
        entries.set(filename, content);
    }
    return entries;
}
export function parseContainerXml(xml: string): string|null{
    let rootfileMatch: RegExpMatchArray|null=xml.match(/<rootfile\b[^>]*>/i);
    if(!rootfileMatch){
        return null;
    }
    let pathMatch: RegExpMatchArray|null=rootfileMatch[0].match(/full-path="([^"]*)"/);
    if(!pathMatch){
        pathMatch=rootfileMatch[0].match(/full-path='([^']*)'/);
    }
    if(!pathMatch){
        return null;
    }
    return pathMatch[1];
}
export function parseOpfMetadata(opf: string): EpubMetadata{
    let metadata: EpubMetadata={};
    let titleMatch: RegExpMatchArray|null=opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i);
    if(titleMatch){
        metadata.title=decodeEntities(titleMatch[1]).trim();
    }
    let creatorMatch: RegExpMatchArray|null=opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
    if(creatorMatch){
        metadata.author=decodeEntities(creatorMatch[1]).trim();
    }
    let langMatch: RegExpMatchArray|null=opf.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i);
    if(langMatch){
        metadata.language=decodeEntities(langMatch[1]).trim();
    }
    let pubMatch: RegExpMatchArray|null=opf.match(/<dc:publisher[^>]*>([\s\S]*?)<\/dc:publisher>/i);
    if(pubMatch){
        metadata.publisher=decodeEntities(pubMatch[1]).trim();
    }
    let descMatch: RegExpMatchArray|null=opf.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
    if(descMatch){
        metadata.description=decodeEntities(descMatch[1]).trim();
    }
    let idTags: string[]=Array.from(opf.matchAll(/<dc:identifier[^>]*>[\s\S]*?<\/dc:identifier>/gi)).map(m=>m[0]);
    for(let idTag of idTags){
        let schemeMatch: RegExpMatchArray|null=idTag.match(/scheme="ISBN"/i);
        let contentMatch: RegExpMatchArray|null=idTag.match(/>([\s\S]*?)</);
        if(!contentMatch){
            continue;
        }
        let value: string=contentMatch[1].trim();
        if(schemeMatch){
            metadata.isbn=decodeEntities(value).trim();
            break;
        }
        let lowerValue: string=value.toLowerCase();
        if(lowerValue.startsWith("urn:isbn:")){
            metadata.isbn=decodeEntities(value.substring("urn:isbn:".length)).trim();
            break;
        }
    }
    return metadata;
}
export function parseOpfSpine(opf: string): {idrefs: string[], manifest: Map<string, {href: string, mediaType: string}>}{
    let manifest: Map<string, {href: string, mediaType: string}>=new Map();
    let manifestSection: string="";
    let manifestMatch: RegExpMatchArray|null=opf.match(/<manifest\b[^>]*>([\s\S]*?)<\/manifest>/i);
    if(manifestMatch){
        manifestSection=manifestMatch[1];
    }
    let itemTags: string[]=Array.from(manifestSection.matchAll(/<item\b[^>]*>/gi)).map(m=>m[0]);
    for(let itemTag of itemTags){
        let idMatch: RegExpMatchArray|null=itemTag.match(/\bid="([^"]*)"/);
        let hrefMatch: RegExpMatchArray|null=itemTag.match(/\bhref="([^"]*)"/);
        let mediaMatch: RegExpMatchArray|null=itemTag.match(/\bmedia-type="([^"]*)"/);
        if(idMatch&&hrefMatch&&mediaMatch){
            manifest.set(idMatch[1], {href: hrefMatch[1], mediaType: mediaMatch[1]});
        }
    }
    let idrefs: string[]=[];
    let spineMatch: RegExpMatchArray|null=opf.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i);
    if(spineMatch){
        let spineContent: string=spineMatch[1];
        let itemrefTags: string[]=Array.from(spineContent.matchAll(/<itemref\b[^>]*\/?>/gi)).map(m=>m[0]);
        for(let itemrefTag of itemrefTags){
            let idrefMatch: RegExpMatchArray|null=itemrefTag.match(/\bidref="([^"]*)"/);
            if(idrefMatch){
                idrefs.push(idrefMatch[1]);
            }
        }
    }
    return {idrefs: idrefs, manifest: manifest};
}
export function xhtmlToText(xhtml: string): string{
    let text: string=xhtml;
    text=text.replace(/<\?xml[^>]*\?>/gi, "");
    text=text.replace(/<!DOCTYPE[^>]*>/gi, "");
    text=text.replace(/<head\b[\s\S]*?<\/head>/gi, "");
    text=text.replace(/<style\b[\s\S]*?<\/style>/gi, "");
    text=text.replace(/<script\b[\s\S]*?<\/script>/gi, "");
    text=text.replace(/<\/?(p|div|h[1-6]|li)\b[^>]*>/gi, "\n");
    text=text.replace(/<br\b[^>]*\/?>/gi, "\n");
    text=text.replace(/<[^>]+>/g, "");
    text=decodeEntities(text);
    text=text.replace(/[ \t]+/g, " ");
    text=text.replace(/ *\n */g, "\n");
    text=text.replace(/\n{2,}/g, "\n");
    text=text.trim();
    return text;
}
export function extractChapterTitle(xhtml: string, index: number): string{
    let h1Match: RegExpMatchArray|null=xhtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    if(h1Match){
        return cleanTitle(h1Match[1]);
    }
    let h2Match: RegExpMatchArray|null=xhtml.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    if(h2Match){
        return cleanTitle(h2Match[1]);
    }
    let h3Match: RegExpMatchArray|null=xhtml.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    if(h3Match){
        return cleanTitle(h3Match[1]);
    }
    return "Chapter "+(index+1);
}
export async function parseEpub(buffer: Buffer): Promise<EpubResult>{
    if(buffer.length<4||buffer[0]!==0x50||buffer[1]!==0x4b){
        throw new Error("Invalid EPUB: not a valid ZIP archive");
    }
    let entries: Map<string, Buffer>=extractZipEntries(buffer);
    let containerBuffer: Buffer|undefined=entries.get("META-INF/container.xml");
    if(!containerBuffer){
        throw new Error("Invalid EPUB: META-INF/container.xml not found");
    }
    let opfPath: string|null=parseContainerXml(containerBuffer.toString("utf8"));
    if(!opfPath){
        throw new Error("Invalid EPUB: OPF path not found in container.xml");
    }
    let opfBuffer: Buffer|undefined=entries.get(opfPath);
    if(!opfBuffer){
        throw new Error("Invalid EPUB: OPF file not found: "+opfPath);
    }
    let opf: string=opfBuffer.toString("utf8");
    let metadata: EpubMetadata=parseOpfMetadata(opf);
    let spine: {idrefs: string[], manifest: Map<string, {href: string, mediaType: string}>}=parseOpfSpine(opf);
    let basePath: string="";
    if(opfPath.includes("/")){
        basePath=opfPath.substring(0, opfPath.lastIndexOf("/")+1);
    }
    let chapters: EpubChapter[]=[];
    let totalWords: number=0;
    for(let i: number=0;i<spine.idrefs.length;i++){
        let idref: string=spine.idrefs[i];
        let manifestItem: {href: string, mediaType: string}|undefined=spine.manifest.get(idref);
        if(!manifestItem){
            continue;
        }
        if(!manifestItem.mediaType.includes("xhtml")&&!manifestItem.mediaType.includes("html")){
            continue;
        }
        let xhtmlBuffer: Buffer|undefined=entries.get(basePath+manifestItem.href);
        if(!xhtmlBuffer){
            xhtmlBuffer=entries.get(manifestItem.href);
        }
        if(!xhtmlBuffer){
            continue;
        }
        let xhtml: string=xhtmlBuffer.toString("utf8");
        let text: string=xhtmlToText(xhtml);
        let title: string=extractChapterTitle(xhtml, i);
        let chapter: EpubChapter={
            id: idref,
            title: title,
            href: manifestItem.href,
            text: text,
            index: i
        };
        chapters.push(chapter);
        totalWords+=countWords(text);
    }
    return {
        metadata: metadata,
        chapters: chapters,
        totalChapters: chapters.length,
        totalWords: totalWords,
        parsedAt: Date.now()
    };
}
function decodeEntities(text: string): string{
    let result: string=text;
    result=result.replace(/&lt;/g, "<");
    result=result.replace(/&gt;/g, ">");
    result=result.replace(/&quot;/g, '"');
    result=result.replace(/&#39;/g, "'");
    result=result.replace(/&nbsp;/g, " ");
    result=result.replace(/&amp;/g, "&");
    return result;
}
function cleanTitle(text: string): string{
    let cleaned: string=text.replace(/<[^>]+>/g, "");
    cleaned=decodeEntities(cleaned);
    cleaned=cleaned.replace(/\s+/g, " ");
    return cleaned.trim();
}
function countWords(text: string): number{
    let trimmed: string=text.trim();
    if(trimmed===""){
        return 0;
    }
    return trimmed.split(/\s+/).length;
}
