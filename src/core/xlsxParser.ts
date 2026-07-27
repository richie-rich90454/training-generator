import{extractZipEntries}from "./epubParser.js";
export interface XlsxCell{
    value: string|number|boolean|null;
    type: "string"|"number"|"boolean"|"date"|"formula"|"empty";
}
export interface XlsxSheet{
    name: string;
    rows: XlsxCell[][];
    maxCols: number;
}
export interface XlsxResult{
    sheets: XlsxSheet[];
    totalSheets: number;
    totalRows: number;
    parsedAt: number;
    markdownTables: string[];
}
export function columnToIndex(colRef: string): number{
    if(!/^[A-Za-z]+$/.test(colRef)){
        return -1;
    }
    let upper: string=colRef.toUpperCase();
    let index: number=0;
    for(let i: number=0;i<upper.length;i++){
        index=index*26+(upper.charCodeAt(i)-64);
    }
    return index-1;
}
export function parseSharedStrings(xml: string): string[]{
    let strings: string[]=[];
    let siBlocks: string[]=Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/gi)).map((m: RegExpMatchArray)=>m[0]);
    for(let siBlock of siBlocks){
        let tMatches: string[]=Array.from(siBlock.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)).map((m: RegExpMatchArray)=>m[1]);
        let text: string=tMatches.join("");
        strings.push(decodeXmlEntities(text));
    }
    return strings;
}
export function parseWorkbook(xml: string): {name: string, sheetId: string, rId: string}[]{
    let sheets: {name: string, sheetId: string, rId: string}[]=[];
    let sheetTags: string[]=Array.from(xml.matchAll(/<sheet\b[^>]*>/gi)).map((m: RegExpMatchArray)=>m[0]);
    for(let sheetTag of sheetTags){
        let nameMatch: RegExpMatchArray|null=sheetTag.match(/name="([^"]*)"/);
        let sheetIdMatch: RegExpMatchArray|null=sheetTag.match(/sheetId="([^"]*)"/);
        let rIdMatch: RegExpMatchArray|null=sheetTag.match(/r:id="([^"]*)"/);
        let name: string=nameMatch?nameMatch[1]:"";
        let sheetId: string=sheetIdMatch?sheetIdMatch[1]:"";
        let rId: string=rIdMatch?rIdMatch[1]:"";
        sheets.push({name: name, sheetId: sheetId, rId: rId});
    }
    return sheets;
}
export function parseWorkbookRels(xml: string): Map<string, string>{
    let rels: Map<string, string>=new Map();
    let relTags: string[]=Array.from(xml.matchAll(/<Relationship\b[^>]*>/gi)).map((m: RegExpMatchArray)=>m[0]);
    for(let relTag of relTags){
        let idMatch: RegExpMatchArray|null=relTag.match(/\bId="([^"]*)"/);
        let targetMatch: RegExpMatchArray|null=relTag.match(/\bTarget="([^"]*)"/);
        if(idMatch&&targetMatch){
            rels.set(idMatch[1], targetMatch[1]);
        }
    }
    return rels;
}
export function parseWorksheet(xml: string, sharedStrings: string[]): XlsxCell[][]{
    let rows: XlsxCell[][]=[];
    let rowBlocks: string[]=Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)).map((m: RegExpMatchArray)=>m[1]);
    for(let rowBlock of rowBlocks){
        let cells: XlsxCell[]=parseRowCells(rowBlock, sharedStrings);
        rows.push(cells);
    }
    return rows;
}
function parseRowCells(rowBlock: string, sharedStrings: string[]): XlsxCell[]{
    let cellsByCol: Map<number, XlsxCell>=new Map();
    let maxCol: number=-1;
    let cellRegex: RegExp=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
    let cellMatch: RegExpExecArray|null;
    while((cellMatch=cellRegex.exec(rowBlock))!==null){
        let attrs: string=cellMatch[1]||"";
        let content: string=cellMatch[2]||"";
        let rMatch: RegExpMatchArray|null=attrs.match(/\br="([^"]*)"/);
        if(!rMatch){
            continue;
        }
        let cellRef: string=rMatch[1];
        let colPart: string=cellRef.replace(/[0-9].*/, "");
        let colIndex: number=columnToIndex(colPart);
        if(colIndex<0){
            continue;
        }
        let tMatch: RegExpMatchArray|null=attrs.match(/\bt="([^"]*)"/);
        let cellType: string=tMatch?tMatch[1]:"n";
        let cell: XlsxCell=parseCell(cellType, content, sharedStrings);
        cellsByCol.set(colIndex, cell);
        if(colIndex>maxCol){
            maxCol=colIndex;
        }
    }
    let rowCells: XlsxCell[]=[];
    for(let i: number=0;i<=maxCol;i++){
        let cell: XlsxCell|undefined=cellsByCol.get(i);
        if(cell){
            rowCells.push(cell);
        }
        else{
            rowCells.push({value: null, type: "empty"});
        }
    }
    return rowCells;
}
function parseCell(cellType: string, content: string, sharedStrings: string[]): XlsxCell{
    let emptyCell: XlsxCell={value: null, type: "empty"};
    let vMatch: RegExpMatchArray|null=content.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i);
    let v: string=vMatch?vMatch[1]:"";
    if(cellType==="s"){
        if(!vMatch){
            return emptyCell;
        }
        let idx: number=parseInt(v, 10);
        if(isNaN(idx)||idx<0||idx>=sharedStrings.length){
            return emptyCell;
        }
        return {value: sharedStrings[idx], type: "string"};
    }
    else if(cellType==="b"){
        if(!vMatch){
            return emptyCell;
        }
        return {value: v==="1", type: "boolean"};
    }
    else if(cellType==="n"){
        if(!vMatch){
            return emptyCell;
        }
        let num: number=parseFloat(v);
        if(isNaN(num)){
            return {value: v, type: "string"};
        }
        return {value: num, type: "number"};
    }
    else if(cellType==="str"){
        if(!vMatch){
            return emptyCell;
        }
        return {value: v, type: "formula"};
    }
    else if(cellType==="d"){
        if(!vMatch){
            return emptyCell;
        }
        return {value: v, type: "date"};
    }
    else if(cellType==="inlineStr"){
        let isMatch: RegExpMatchArray|null=content.match(/<is\b[^>]*>([\s\S]*?)<\/is>/i);
        if(!isMatch){
            return emptyCell;
        }
        let tMatches: string[]=Array.from(isMatch[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)).map((m: RegExpMatchArray)=>m[1]);
        let text: string=tMatches.join("");
        return {value: decodeXmlEntities(text), type: "string"};
    }
    else if(cellType==="e"){
        return emptyCell;
    }
    else{
        if(!vMatch){
            return emptyCell;
        }
        let num: number=parseFloat(v);
        if(isNaN(num)){
            return {value: v, type: "string"};
        }
        return {value: num, type: "number"};
    }
}
export function sheetToMarkdownTable(sheet: XlsxSheet): string{
    if(sheet.rows.length===0){
        return "";
    }
    let maxCols: number=sheet.maxCols;
    if(maxCols===0){
        return "";
    }
    let lines: string[]=[];
    lines.push("| "+renderRow(sheet.rows[0], maxCols)+" |");
    let separator: string="";
    for(let i: number=0;i<maxCols;i++){
        separator+=" --- |";
    }
    lines.push("|"+separator);
    for(let i: number=1;i<sheet.rows.length;i++){
        lines.push("| "+renderRow(sheet.rows[i], maxCols)+" |");
    }
    return lines.join("\n");
}
function renderRow(cells: XlsxCell[], maxCols: number): string{
    let parts: string[]=[];
    for(let i: number=0;i<maxCols;i++){
        let cell: XlsxCell|undefined=cells[i];
        let text: string=cell?cellToText(cell):"";
        text=text.replace(/\|/g, "\\|");
        parts.push(text);
    }
    return parts.join(" | ");
}
function cellToText(cell: XlsxCell): string{
    if(cell.type==="empty"||cell.value===null){
        return "";
    }
    if(cell.type==="boolean"){
        return cell.value?"true":"false";
    }
    return String(cell.value);
}
export async function parseXlsx(buffer: Buffer): Promise<XlsxResult>{
    if(buffer.length<4||buffer[0]!==0x50||buffer[1]!==0x4b){
        throw new Error("Invalid XLSX: not a valid ZIP archive");
    }
    let entries: Map<string, Buffer>=extractZipEntries(buffer);
    let sharedStrings: string[]=[];
    let sharedStringsBuffer: Buffer|undefined=entries.get("xl/sharedStrings.xml");
    if(sharedStringsBuffer){
        sharedStrings=parseSharedStrings(sharedStringsBuffer.toString("utf8"));
    }
    let workbookBuffer: Buffer|undefined=entries.get("xl/workbook.xml");
    if(!workbookBuffer){
        throw new Error("Invalid XLSX: workbook.xml not found");
    }
    let workbookSheets: {name: string, sheetId: string, rId: string}[]=parseWorkbook(workbookBuffer.toString("utf8"));
    let relsBuffer: Buffer|undefined=entries.get("xl/_rels/workbook.xml.rels");
    let rels: Map<string, string>=new Map();
    if(relsBuffer){
        rels=parseWorkbookRels(relsBuffer.toString("utf8"));
    }
    let sheets: XlsxSheet[]=[];
    let totalRows: number=0;
    let markdownTables: string[]=[];
    for(let sheetInfo of workbookSheets){
        let target: string|undefined=rels.get(sheetInfo.rId);
        if(!target){
            continue;
        }
        let sheetPath: string="xl/"+target;
        let sheetBuffer: Buffer|undefined=entries.get(sheetPath);
        if(!sheetBuffer){
            continue;
        }
        let rows: XlsxCell[][]=parseWorksheet(sheetBuffer.toString("utf8"), sharedStrings);
        let maxCols: number=0;
        for(let row of rows){
            if(row.length>maxCols){
                maxCols=row.length;
            }
        }
        let sheet: XlsxSheet={name: sheetInfo.name, rows: rows, maxCols: maxCols};
        sheets.push(sheet);
        totalRows+=rows.length;
        markdownTables.push(sheetToMarkdownTable(sheet));
    }
    return {
        sheets: sheets,
        totalSheets: sheets.length,
        totalRows: totalRows,
        parsedAt: Date.now(),
        markdownTables: markdownTables
    };
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
