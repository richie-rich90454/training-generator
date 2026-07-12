import { extractZipEntries } from "./epubParser.js";
export interface ParsedTextResult{
    title?: string;
    text: string;
    format: string;
    metadata: Record<string, unknown>;
    sections?: {title: string, text: string}[];
    warnings: string[];
}
function decodeXmlEntities(text: string): string{
    let result: string=text;
    result=result.replace(/&lt;/g, "<");
    result=result.replace(/&gt;/g, ">");
    result=result.replace(/&quot;/g, '"');
    result=result.replace(/&#39;/g, "'");
    result=result.replace(/&nbsp;/g, " ");
    result=result.replace(/&amp;/g, "&");
    return result;
}
function stripTags(text: string): string{
    return text.replace(/<[^>]+>/g, "");
}
function extractBracedContent(text: string, command: string): string|undefined{
    let needle: string="\\"+command+"{";
    let startIdx: number=text.indexOf(needle);
    if(startIdx===-1){
        return undefined;
    }
    let braceStart: number=startIdx+needle.length-1;
    let depth: number=0;
    for(let i: number=braceStart;i<text.length;i++){
        if(text[i]==="{"){
            depth++;
        }
        else if(text[i]==="}"){
            depth--;
            if(depth===0){
                return text.substring(braceStart+1, i);
            }
        }
    }
    return undefined;
}
function extractAllBracedContent(text: string, command: string): {content: string, index: number, length: number}[]{
    let results: {content: string, index: number, length: number}[]=[];
    let needle: string="\\"+command+"{";
    let searchFrom: number=0;
    while(searchFrom<text.length){
        let startIdx: number=text.indexOf(needle, searchFrom);
        if(startIdx===-1){
            break;
        }
        let braceStart: number=startIdx+needle.length-1;
        let depth: number=0;
        let endIdx: number=-1;
        for(let i: number=braceStart;i<text.length;i++){
            if(text[i]==="{"){
                depth++;
            }
            else if(text[i]==="}"){
                depth--;
                if(depth===0){
                    endIdx=i;
                    break;
                }
            }
        }
        if(endIdx===-1){
            break;
        }
        results.push({content: text.substring(braceStart+1, endIdx), index: startIdx, length: endIdx-startIdx+1});
        searchFrom=endIdx+1;
    }
    return results;
}
function cleanLatexText(text: string): string{
    let t: string=text;
    t=t.replace(/\$\$[\s\S]*?\$\$/g, " [MATH] ");
    t=t.replace(/\\\[[\s\S]*?\\\]/g, " [MATH] ");
    t=t.replace(/\\\([\s\S]*?\\\)/g, " [MATH] ");
    t=t.replace(/\$[^$]*?\$/g, " [MATH] ");
    t=t.replace(/\\(textbf|textit|emph|underline|texttt)\{([^{}]*)\}/g, "$2");
    t=t.replace(/\\[a-zA-Z]+(\{[^{}]*\})?/g, " ");
    t=t.replace(/[{}]/g, "");
    t=t.replace(/[ \t]+/g, " ");
    return t.trim();
}
export function parseLatex(latex: string): ParsedTextResult{
    let metadata: Record<string, unknown>={};
    let title: string|undefined=undefined;
    let titleContent: string|undefined=extractBracedContent(latex, "title");
    if(titleContent!==undefined){
        title=titleContent;
        metadata.title=title;
    }
    let authorContent: string|undefined=extractBracedContent(latex, "author");
    if(authorContent!==undefined){
        metadata.author=authorContent;
    }
    let dateContent: string|undefined=extractBracedContent(latex, "date");
    if(dateContent!==undefined){
        metadata.date=dateContent;
    }
    let body: string=latex;
    let docBeginMatch: RegExpMatchArray|null=latex.match(/\\begin\{document\}/);
    if(docBeginMatch){
        body=latex.substring(docBeginMatch.index!+docBeginMatch[0].length);
    }
    let docEndMatch: RegExpMatchArray|null=body.match(/\\end\{document\}/);
    if(docEndMatch){
        body=body.substring(0, docEndMatch.index);
    }
    body=body.replace(/%.*$/gm, "");
    let sections: {title: string, text: string}[]=[];
    let introText: string="";
    let sectionMatches: {content: string, index: number, length: number}[]=extractAllBracedContent(body, "section");
    let lastIndex: number=0;
    let currentSection: {title: string, text: string}|null=null;
    for(let sm of sectionMatches){
        let chunk: string=body.substring(lastIndex, sm.index);
        if(currentSection===null){
            introText=cleanLatexText(chunk);
        }
        else{
            currentSection.text=cleanLatexText(chunk);
            sections.push(currentSection);
        }
        currentSection={title: sm.content, text: ""};
        lastIndex=sm.index+sm.length;
    }
    let tail: string=body.substring(lastIndex);
    if(currentSection===null){
        introText=cleanLatexText(tail);
    }
    else{
        currentSection.text=cleanLatexText(tail);
        sections.push(currentSection);
    }
    let textParts: string[]=[];
    if(introText){
        textParts.push(introText);
    }
    for(let section of sections){
        textParts.push(section.title+"\n"+section.text);
    }
    let result: ParsedTextResult={
        title: title,
        text: textParts.join("\n\n"),
        format: "latex",
        metadata: metadata,
        warnings: []
    };
    if(sections.length>0){
        result.sections=sections;
    }
    return result;
}
export function parseOdt(buffer: Buffer): ParsedTextResult{
    let warnings: string[]=[];
    let entries: Map<string, Buffer>;
    try{
        entries=extractZipEntries(buffer);
    }
    catch(e){
        warnings.push("Failed to extract ZIP: "+(e as Error).message);
        return {text: "", format: "odt", metadata: {}, warnings: warnings};
    }
    let contentBuffer: Buffer|undefined=entries.get("content.xml");
    if(!contentBuffer){
        warnings.push("content.xml not found");
        return {text: "", format: "odt", metadata: {}, warnings: warnings};
    }
    let content: string=contentBuffer.toString("utf8");
    let lines: string[]=[];
    let headingRegex: RegExp=/<text:h\b[^>]*>([\s\S]*?)<\/text:h>/gi;
    let paraRegex: RegExp=/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/gi;
    let hMatch: RegExpExecArray|null;
    while((hMatch=headingRegex.exec(content))!==null){
        lines.push("# "+decodeXmlEntities(stripTags(hMatch[1])).trim());
    }
    let pMatch: RegExpExecArray|null;
    while((pMatch=paraRegex.exec(content))!==null){
        lines.push(decodeXmlEntities(stripTags(pMatch[1])).trim());
    }
    return {text: lines.join("\n"), format: "odt", metadata: {}, warnings: warnings};
}
export function parseOds(buffer: Buffer): ParsedTextResult{
    let warnings: string[]=[];
    let entries: Map<string, Buffer>;
    try{
        entries=extractZipEntries(buffer);
    }
    catch(e){
        warnings.push("Failed to extract ZIP: "+(e as Error).message);
        return {text: "", format: "ods", metadata: {}, warnings: warnings};
    }
    let contentBuffer: Buffer|undefined=entries.get("content.xml");
    if(!contentBuffer){
        warnings.push("content.xml not found");
        return {text: "", format: "ods", metadata: {}, warnings: warnings};
    }
    let content: string=contentBuffer.toString("utf8");
    let tableRegex: RegExp=/<table:table\b[^>]*>([\s\S]*?)<\/table:table>/gi;
    let rowRegex: RegExp=/<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/gi;
    let sheets: string[]=[];
    let tableMatch: RegExpExecArray|null;
    while((tableMatch=tableRegex.exec(content))!==null){
        let table: string=tableMatch[1];
        let rows: string[][]=[];
        let rowMatch: RegExpExecArray|null;
        while((rowMatch=rowRegex.exec(table))!==null){
            let row: string=rowMatch[1];
            let cells: string[]=[];
            let cellRegex: RegExp=/<table:table-cell\b[^>]*>([\s\S]*?)<\/table:table-cell>/gi;
            let cellMatch: RegExpExecArray|null;
            while((cellMatch=cellRegex.exec(row))!==null){
                let cell: string=cellMatch[1];
                let paras: string[]=[];
                let paraRegex: RegExp=/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/gi;
                let paraMatch: RegExpExecArray|null;
                while((paraMatch=paraRegex.exec(cell))!==null){
                    paras.push(decodeXmlEntities(stripTags(paraMatch[1])).trim());
                }
                cells.push(paras.join(" "));
            }
            if(cells.length>0){
                rows.push(cells);
            }
        }
        if(rows.length>0){
            let colCount: number=Math.max(...rows.map(r=>r.length));
            for(let i: number=0;i<rows.length;i++){
                while(rows[i].length<colCount){
                    rows[i].push("");
                }
            }
            let mdRows: string[]=rows.map(r=>"| "+r.join(" | ")+" |");
            let sep: string="| "+Array(colCount).fill("---").join(" | ")+" |";
            mdRows.splice(1, 0, sep);
            sheets.push(mdRows.join("\n"));
        }
    }
    return {text: sheets.join("\n\n"), format: "ods", metadata: {}, warnings: warnings};
}
export function parseOdp(buffer: Buffer): ParsedTextResult{
    let warnings: string[]=[];
    let entries: Map<string, Buffer>;
    try{
        entries=extractZipEntries(buffer);
    }
    catch(e){
        warnings.push("Failed to extract ZIP: "+(e as Error).message);
        return {text: "", format: "odp", metadata: {}, warnings: warnings};
    }
    let contentBuffer: Buffer|undefined=entries.get("content.xml");
    if(!contentBuffer){
        warnings.push("content.xml not found");
        return {text: "", format: "odp", metadata: {}, warnings: warnings};
    }
    let content: string=contentBuffer.toString("utf8");
    let pageRegex: RegExp=/<draw:page\b[^>]*>([\s\S]*?)<\/draw:page>/gi;
    let slides: string[]=[];
    let pageMatch: RegExpExecArray|null;
    while((pageMatch=pageRegex.exec(content))!==null){
        let page: string=pageMatch[1];
        let lines: string[]=[];
        let paraRegex: RegExp=/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/gi;
        let pMatch: RegExpExecArray|null;
        while((pMatch=paraRegex.exec(page))!==null){
            let line: string=decodeXmlEntities(stripTags(pMatch[1])).trim();
            if(line){
                lines.push(line);
            }
        }
        if(lines.length>0){
            slides.push(lines.join("\n"));
        }
    }
    return {text: slides.join("\n---\n"), format: "odp", metadata: {}, warnings: warnings};
}
function extractVisioText(xml: string): string[]{
    let regex: RegExp=/<a:t>([^<]*)<\/a:t>/gi;
    let texts: string[]=[];
    let match: RegExpExecArray|null;
    while((match=regex.exec(xml))!==null){
        texts.push(match[1]);
    }
    return texts;
}
export function parseVisio(buffer: Buffer): ParsedTextResult{
    let warnings: string[]=["Visio parsing is best-effort; complex diagrams may not preserve structure"];
    let entries: Map<string, Buffer>;
    try{
        entries=extractZipEntries(buffer);
    }
    catch(e){
        warnings.push("Failed to extract ZIP: "+(e as Error).message);
        return {text: "", format: "visio", metadata: {}, warnings: warnings};
    }
    let texts: string[]=[];
    let documentBuffer: Buffer|undefined=entries.get("document.xml");
    if(documentBuffer){
        texts.push(...extractVisioText(documentBuffer.toString("utf8")));
    }
    for(let [name, data] of entries){
        if(name.startsWith("visio/pages/page")&&name.endsWith(".xml")){
            texts.push(...extractVisioText(data.toString("utf8")));
        }
    }
    return {text: texts.join("\n"), format: "visio", metadata: {}, warnings: warnings};
}
interface MindNode{
    text: string;
    children: MindNode[];
}
function findMatchingClose(xml: string, start: number, tagName: string): number{
    let openTag: string="<"+tagName;
    let closeTag: string="</"+tagName+">";
    let depth: number=1;
    let pos: number=start;
    while(pos<xml.length&&depth>0){
        let nextOpen: number=xml.indexOf(openTag, pos);
        let nextClose: number=xml.indexOf(closeTag, pos);
        if(nextClose===-1){
            return -1;
        }
        if(nextOpen!==-1&&nextOpen<nextClose){
            let tagEnd: number=xml.indexOf(">", nextOpen);
            if(tagEnd!==-1&&xml.substring(tagEnd-1, tagEnd+1)==="/>"){
                pos=tagEnd+1;
                continue;
            }
            depth++;
            pos=nextOpen+openTag.length;
        }
        else{
            depth--;
            if(depth===0){
                return nextClose;
            }
            pos=nextClose+closeTag.length;
        }
    }
    return -1;
}
function parseFreemindNodes(xml: string): MindNode[]{
    let nodes: MindNode[]=[];
    let index: number=0;
    while(true){
        let openRegex: RegExp=/<node\b/g;
        openRegex.lastIndex=index;
        let openMatch: RegExpExecArray|null=openRegex.exec(xml);
        if(!openMatch){
            break;
        }
        let tagStart: number=openMatch.index;
        let tagEnd: number=xml.indexOf(">", tagStart);
        if(tagEnd===-1){
            break;
        }
        let tag: string=xml.substring(tagStart, tagEnd+1);
        let textMatch: RegExpMatchArray|null=tag.match(/\bTEXT="([^"]*)"/i);
        let text: string=textMatch?decodeXmlEntities(textMatch[1]):"";
        if(tag.endsWith("/>")){
            nodes.push({text: text, children: []});
            index=tagEnd+1;
            continue;
        }
        let contentEnd: number=findMatchingClose(xml, tagEnd+1, "node");
        if(contentEnd===-1){
            nodes.push({text: text, children: []});
            index=tagEnd+1;
            continue;
        }
        let content: string=xml.substring(tagEnd+1, contentEnd);
        let children: MindNode[]=parseFreemindNodes(content);
        nodes.push({text: text, children: children});
        index=contentEnd+("</node>").length;
    }
    return nodes;
}
function parseXmindTopic(xml: string, startAt: number): {node: MindNode, end: number}|null{
    let openRegex: RegExp=/<topic\b/g;
    openRegex.lastIndex=startAt;
    let openMatch: RegExpExecArray|null=openRegex.exec(xml);
    if(!openMatch){
        return null;
    }
    let tagStart: number=openMatch.index;
    let tagEnd: number=xml.indexOf(">", tagStart);
    if(tagEnd===-1){
        return null;
    }
    let tag: string=xml.substring(tagStart, tagEnd+1);
    let title: string="";
    let titleMatch: RegExpMatchArray|null=tag.match(/\btitle="([^"]*)"/i);
    if(titleMatch){
        title=decodeXmlEntities(titleMatch[1]);
    }
    if(tag.endsWith("/>")){
        return {node: {text: title, children: []}, end: tagEnd+1};
    }
    let contentEnd: number=findMatchingClose(xml, tagEnd+1, "topic");
    if(contentEnd===-1){
        return {node: {text: title, children: []}, end: tagEnd+1};
    }
    let content: string=xml.substring(tagEnd+1, contentEnd);
    if(!title){
        let titleTagMatch: RegExpMatchArray|null=content.match(/<title>([\s\S]*?)<\/title>/i);
        if(titleTagMatch){
            title=decodeXmlEntities(stripTags(titleTagMatch[1])).trim();
        }
    }
    let children: MindNode[]=parseXmindTopics(content);
    return {node: {text: title, children: children}, end: contentEnd+("</topic>").length};
}
function parseXmindTopics(xml: string): MindNode[]{
    let nodes: MindNode[]=[];
    let index: number=0;
    while(true){
        let res: {node: MindNode, end: number}|null=parseXmindTopic(xml, index);
        if(!res){
            break;
        }
        nodes.push(res.node);
        index=res.end;
    }
    return nodes;
}
function buildOutline(nodes: MindNode[], depth: number=0): string{
    let lines: string[]=[];
    let indent: string="    ".repeat(depth);
    for(let node of nodes){
        lines.push(indent+node.text);
        if(node.children.length>0){
            lines.push(buildOutline(node.children, depth+1));
        }
    }
    return lines.join("\n");
}
export function parseMindMap(buffer: Buffer): ParsedTextResult{
    let warnings: string[]=[];
    let text: string="";
    if(buffer.length>=4&&buffer[0]===0x50&&buffer[1]===0x4b){
        let entries: Map<string, Buffer>;
        try{
            entries=extractZipEntries(buffer);
        }
        catch(e){
            warnings.push("Failed to extract ZIP: "+(e as Error).message);
            return {text: "", format: "mindmap", metadata: {}, warnings: warnings};
        }
        let contentBuffer: Buffer|undefined=entries.get("content.xml");
        if(!contentBuffer){
            warnings.push("content.xml not found in XMind archive");
        }
        else{
            let content: string=contentBuffer.toString("utf8");
            let nodes: MindNode[]=parseXmindTopics(content);
            text=buildOutline(nodes);
        }
    }
    else{
        let xml: string=buffer.toString("utf8").trim();
        if(xml.startsWith("<map")){
            let nodes: MindNode[]=parseFreemindNodes(xml);
            text=buildOutline(nodes);
        }
        else{
            warnings.push("Unrecognized mind map format");
            text=xml;
        }
    }
    return {text: text, format: "mindmap", metadata: {}, warnings: warnings};
}
export function parseEmail(buffer: Buffer): ParsedTextResult{
    let raw: string=buffer.toString("utf8");
    let headerEndMatch: RegExpMatchArray|null=raw.match(/\r?\n\r?\n/);
    let headerPart: string;
    let bodyPart: string;
    if(!headerEndMatch){
        headerPart=raw;
        bodyPart="";
    }
    else{
        headerPart=raw.substring(0, headerEndMatch.index);
        bodyPart=raw.substring(headerEndMatch.index!+headerEndMatch[0].length);
    }
    let headers: Record<string, string>={};
    let headerLines: string[]=headerPart.split(/\r?\n/);
    for(let line of headerLines){
        let m: RegExpMatchArray|null=line.match(/^([A-Za-z-]+):\s*(.*)$/);
        if(m){
            headers[m[1].toLowerCase()]=m[2].trim();
        }
    }
    let metadata: Record<string, unknown>={
        from: headers.from,
        to: headers.to,
        subject: headers.subject,
        date: headers.date,
        headers: headers
    };
    let text: string=bodyPart;
    if(/Content-Type:\s*multipart\/alternative/i.test(headerPart)){
        let boundaryMatch: RegExpMatchArray|null=headerPart.match(/boundary="([^"]+)"/i);
        if(!boundaryMatch){
            boundaryMatch=headerPart.match(/boundary=([^;\s]+)/i);
        }
        if(boundaryMatch){
            let boundary: string="--"+boundaryMatch[1].replace(/^"|"$/g, "");
            let parts: string[]=bodyPart.split(boundary);
            for(let part of parts){
                if(/Content-Type:\s*text\/plain/i.test(part)){
                    let partHeaderEndMatch: RegExpMatchArray|null=part.match(/\r?\n\r?\n/);
                    if(partHeaderEndMatch){
                        let partBody: string=part.substring(partHeaderEndMatch.index!+partHeaderEndMatch[0].length);
                        let cteMatch: RegExpMatchArray|null=part.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
                        if(cteMatch&&cteMatch[1].trim().toLowerCase()==="base64"){
                            partBody=Buffer.from(partBody.replace(/\s+/g, ""), "base64").toString("utf8");
                        }
                        text=partBody;
                    }
                    break;
                }
            }
        }
    }
    return {text: text.trim(), format: "email", metadata: metadata, warnings: []};
}
function extractTagContent(xml: string, tag: string): string{
    let regex: RegExp=new RegExp("<"+tag+"\\b[^>]*>([\\s\\S]*?)<\\/"+tag+">", "i");
    let m: RegExpMatchArray|null=xml.match(regex);
    if(!m){
        return "";
    }
    return decodeXmlEntities(stripTags(m[1])).trim();
}
export function parseRss(xml: string): ParsedTextResult[]{
    let results: ParsedTextResult[]=[];
    let itemRegex: RegExp=/<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let entryRegex: RegExp=/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    let items: {type: string, content: string}[]=[];
    let match: RegExpExecArray|null;
    while((match=itemRegex.exec(xml))!==null){
        items.push({type: "rss", content: match[1]});
    }
    while((match=entryRegex.exec(xml))!==null){
        items.push({type: "atom", content: match[1]});
    }
    for(let item of items){
        let title: string=extractTagContent(item.content, "title");
        let description: string=extractTagContent(item.content, "description");
        if(!description){
            description=extractTagContent(item.content, "summary");
        }
        if(!description){
            description=extractTagContent(item.content, "content");
        }
        let link: string="";
        if(item.type==="atom"){
            let linkMatch: RegExpMatchArray|null=item.content.match(/<link\b[^>]*href="([^"]*)"[^>]*>/i);
            if(linkMatch){
                link=linkMatch[1];
            }
        }
        else{
            link=extractTagContent(item.content, "link");
        }
        let pubDate: string=extractTagContent(item.content, "pubDate");
        if(!pubDate){
            pubDate=extractTagContent(item.content, "published");
        }
        if(!pubDate){
            pubDate=extractTagContent(item.content, "updated");
        }
        results.push({
            title: title,
            text: description,
            format: item.type,
            metadata: {link: link, pubDate: pubDate},
            warnings: []
        });
    }
    return results;
}
export function parseSrt(srt: string): ParsedTextResult{
    let blocks: string[]=srt.trim().split(/\n\s*\n/);
    let segments: string[]=[];
    for(let block of blocks){
        let lines: string[]=block.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
        if(lines.length===0){
            continue;
        }
        if(/^\d+$/.test(lines[0])){
            lines.shift();
        }
        if(lines.length>0&&/\d{2}:\d{2}:\d{2},\d{3}/.test(lines[0])){
            lines.shift();
        }
        if(lines.length>0){
            segments.push(lines.join(" "));
        }
    }
    return {text: segments.join(" "), format: "srt", metadata: {segmentCount: segments.length}, warnings: []};
}
export function parseVtt(vtt: string): ParsedTextResult{
    let lines: string[]=vtt.split(/\r?\n/);
    let segments: string[]=[];
    let i: number=0;
    while(i<lines.length&&lines[i].trim()!==""){
        i++;
    }
    i++;
    while(i<lines.length){
        while(i<lines.length&&(lines[i].trim()===""||/^NOTE\b/i.test(lines[i].trim())||/^STYLE\b/i.test(lines[i].trim()))){
            i++;
        }
        if(i>=lines.length){
            break;
        }
        if(i+1<lines.length&&/^\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(lines[i+1].trim())){
            i++;
        }
        else if(!/^\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(lines[i].trim())){
            i++;
            continue;
        }
        i++;
        let textLines: string[]=[];
        while(i<lines.length&&lines[i].trim()!==""){
            textLines.push(lines[i].trim());
            i++;
        }
        if(textLines.length>0){
            segments.push(textLines.join(" "));
        }
        i++;
    }
    return {text: segments.join(" "), format: "vtt", metadata: {segmentCount: segments.length}, warnings: []};
}
export function detectAndParse(buffer: Buffer, filename: string): ParsedTextResult|ParsedTextResult[]{
    let lower: string=filename.toLowerCase();
    if(lower.endsWith(".tex")){
        return parseLatex(buffer.toString("utf8"));
    }
    else if(lower.endsWith(".odt")){
        return parseOdt(buffer);
    }
    else if(lower.endsWith(".ods")){
        return parseOds(buffer);
    }
    else if(lower.endsWith(".odp")){
        return parseOdp(buffer);
    }
    else if(lower.endsWith(".vsdx")){
        return parseVisio(buffer);
    }
    else if(lower.endsWith(".mm")||lower.endsWith(".xmind")){
        return parseMindMap(buffer);
    }
    else if(lower.endsWith(".eml")||lower.endsWith(".mbox")){
        return parseEmail(buffer);
    }
    else if(lower.endsWith(".rss")||lower.endsWith(".xml")){
        return parseRss(buffer.toString("utf8"));
    }
    else if(lower.endsWith(".srt")){
        return parseSrt(buffer.toString("utf8"));
    }
    else if(lower.endsWith(".vtt")){
        return parseVtt(buffer.toString("utf8"));
    }
    throw new Error("Unsupported misc format: "+filename);
}
