export interface SchemaField{
    path: string;
    type: "string"|"number"|"boolean"|"null"|"object"|"array";
    nullable: boolean;
    sampleValue: unknown;
}
export interface ParseResult{
    text: string;
    format: "json"|"csv"|"ndjson";
    schema: SchemaField[];
    rowCount: number;
    warnings: string[];
}
export function inferSchema(data: unknown): SchemaField[]{
    let fields: Map<string, SchemaField>=new Map();
    if(Array.isArray(data)){
        for(let item of data){
            if(item===null||item===undefined){
                continue;
            }
            if(typeof item==="object"&&!Array.isArray(item)){
                inferFromObject(item as Record<string, unknown>, "", fields);
            }
        }
    }
    else if(typeof data==="object"&&data!==null){
        inferFromObject(data as Record<string, unknown>, "", fields);
    }
    let arr: SchemaField[]=Array.from(fields.values());
    arr.sort((a, b)=>a.path.localeCompare(b.path));
    return arr;
}
function inferFromObject(obj: Record<string, unknown>, prefix: string, fields: Map<string, SchemaField>): void{
    for(let key of Object.keys(obj)){
        let value: unknown=obj[key];
        let path: string=prefix===""?key:prefix+"."+key;
        if(value===null){
            let existing: SchemaField|undefined=fields.get(path);
            if(existing){
                existing.nullable=true;
            }
            else{
                fields.set(path, {path: path, type: "null", nullable: true, sampleValue: null});
            }
        }
        else if(Array.isArray(value)){
            let existing: SchemaField|undefined=fields.get(path);
            if(!existing){
                fields.set(path, {path: path, type: "array", nullable: false, sampleValue: value});
            }
        }
        else if(typeof value==="object"){
            let existing: SchemaField|undefined=fields.get(path);
            if(!existing){
                fields.set(path, {path: path, type: "object", nullable: false, sampleValue: value});
            }
            inferFromObject(value as Record<string, unknown>, path, fields);
        }
        else if(typeof value==="string"){
            let existing: SchemaField|undefined=fields.get(path);
            if(!existing){
                fields.set(path, {path: path, type: "string", nullable: false, sampleValue: value});
            }
            else if(existing.type==="null"){
                existing.type="string";
                existing.sampleValue=value;
                existing.nullable=true;
            }
        }
        else if(typeof value==="number"){
            let existing: SchemaField|undefined=fields.get(path);
            if(!existing){
                fields.set(path, {path: path, type: "number", nullable: false, sampleValue: value});
            }
            else if(existing.type==="null"){
                existing.type="number";
                existing.sampleValue=value;
                existing.nullable=true;
            }
        }
        else if(typeof value==="boolean"){
            let existing: SchemaField|undefined=fields.get(path);
            if(!existing){
                fields.set(path, {path: path, type: "boolean", nullable: false, sampleValue: value});
            }
            else if(existing.type==="null"){
                existing.type="boolean";
                existing.sampleValue=value;
                existing.nullable=true;
            }
        }
    }
}
export function flattenObject(obj: Record<string, unknown>, prefix: string=""): Record<string, unknown>{
    let result: Record<string, unknown>={};
    for(let key of Object.keys(obj)){
        let value: unknown=obj[key];
        let newKey: string=prefix===""?key:prefix+"."+key;
        if(value!==null&&typeof value==="object"&&!Array.isArray(value)){
            let nested: Record<string, unknown>=flattenObject(value as Record<string, unknown>, newKey);
            for(let nestedKey of Object.keys(nested)){
                result[nestedKey]=nested[nestedKey];
            }
        }
        else{
            result[newKey]=value;
        }
    }
    return result;
}
function stripBom(text: string): string{
    if(text.charCodeAt(0)===0xFEFF){
        return text.slice(1);
    }
    return text;
}
export function parseJson(text: string): ParseResult{
    let data: unknown;
    try{
        data=JSON.parse(stripBom(text));
    }
    catch(e){
        throw new Error("Invalid JSON: "+(e as Error).message);
    }
    let schema: SchemaField[]=inferSchema(data);
    if(Array.isArray(data)){
        let flattenedRows: Record<string, unknown>[]=[];
        let keysSet: Set<string>=new Set();
        for(let item of data){
            if(item!==null&&typeof item==="object"&&!Array.isArray(item)){
                let flat: Record<string, unknown>=flattenObject(item as Record<string, unknown>);
                flattenedRows.push(flat);
                for(let k of Object.keys(flat)){
                    keysSet.add(k);
                }
            }
            else{
                flattenedRows.push({});
            }
        }
        let headers: string[]=Array.from(keysSet);
        let rows: (string|number|boolean|null)[][]=flattenedRows.map(r=>headers.map(h=>{
            let v: unknown=r[h];
            if(v===undefined){
                return "";
            }
            if(v===null){
                return null;
            }
            if(typeof v==="string"||typeof v==="number"||typeof v==="boolean"){
                return v;
            }
            return JSON.stringify(v);
        }));
        let md: string=renderMarkdownTable(headers, rows);
        return {text: md, format: "json", schema: schema, rowCount: data.length, warnings: []};
    }
    else if(typeof data==="object"&&data!==null){
        let flat: Record<string, unknown>=flattenObject(data as Record<string, unknown>);
        let headers: string[]=["key", "value"];
        let rows: (string|number|boolean|null)[][]=Object.keys(flat).map(k=>{
            let v: unknown=flat[k];
            let cell: string|number|boolean|null;
            if(v===null){
                cell=null;
            }
            else if(typeof v==="string"||typeof v==="number"||typeof v==="boolean"){
                cell=v;
            }
            else{
                cell=JSON.stringify(v);
            }
            return [k, cell];
        });
        let md: string=renderMarkdownTable(headers, rows);
        return {text: md, format: "json", schema: schema, rowCount: 1, warnings: []};
    }
    else{
        let md: string=String(data);
        return {text: md, format: "json", schema: schema, rowCount: 1, warnings: []};
    }
}
export function parseNdjson(text: string): ParseResult{
    let warnings: string[]=[];
    let lines: string[]=stripBom(text).split(/\r?\n/);
    let rows: Record<string, unknown>[]=[];
    let keysSet: Set<string>=new Set();
    let lineNum: number=0;
    for(let line of lines){
        lineNum++;
        let trimmed: string=line.trim();
        if(trimmed===""){
            continue;
        }
        try{
            let parsed: unknown=JSON.parse(trimmed);
            if(parsed!==null&&typeof parsed==="object"&&!Array.isArray(parsed)){
                let flat: Record<string, unknown>=flattenObject(parsed as Record<string, unknown>);
                rows.push(flat);
                for(let k of Object.keys(flat)){
                    keysSet.add(k);
                }
            }
            else{
                let wrapped: Record<string, unknown>={value: parsed};
                rows.push(wrapped);
                keysSet.add("value");
            }
        }
        catch(e){
            warnings.push(`Failed to parse line ${lineNum}: ${(e as Error).message}`);
        }
    }
    let headers: string[]=Array.from(keysSet);
    let schema: SchemaField[]=inferSchema(rows);
    let mdRows: (string|number|boolean|null)[][]=rows.map(r=>headers.map(h=>{
        let v: unknown=r[h];
        if(v===undefined){
            return "";
        }
        if(v===null){
            return null;
        }
        if(typeof v==="string"||typeof v==="number"||typeof v==="boolean"){
            return v;
        }
        return JSON.stringify(v);
    }));
    let md: string=renderMarkdownTable(headers, mdRows);
    return {text: md, format: "ndjson", schema: schema, rowCount: rows.length, warnings: warnings};
}
export function parseCsv(text: string, options?: {delimiter?: string, quote?: string}): ParseResult{
    let delimiter: string=options?.delimiter??",";
    let quote: string=options?.quote??'"';
    let rows: string[][]=parseCsvRows(stripBom(text), delimiter, quote);
    let headers: string[]=rows.length>0?rows[0]:[];
    let dataRows: string[][]=rows.slice(1);
    let schema: SchemaField[]=inferSchemaFromCsv(headers, dataRows);
    let mdRows: (string|number|boolean|null)[][]=dataRows.map(r=>{
        let result: (string|number|boolean|null)[]=[];
        for(let i=0;i<headers.length;i++){
            let v: string|undefined=r[i];
            if(v===undefined){
                result.push("");
            }
            else{
                result.push(v);
            }
        }
        return result;
    });
    let md: string=renderMarkdownTable(headers, mdRows);
    return {text: md, format: "csv", schema: schema, rowCount: dataRows.length, warnings: []};
}
function parseCsvRows(text: string, delimiter: string, quote: string): string[][]{
    let rows: string[][]=[];
    let currentRow: string[]=[];
    let currentField: string="";
    let inQuotes: boolean=false;
    let fieldStarted: boolean=false;
    let i: number=0;
    while(i<text.length){
        let ch: string=text[i];
        if(inQuotes){
            if(ch===quote){
                if(i+1<text.length&&text[i+1]===quote){
                    currentField+=quote;
                    i+=2;
                    continue;
                }
                else{
                    inQuotes=false;
                    i++;
                    continue;
                }
            }
            else{
                currentField+=ch;
                i++;
                continue;
            }
        }
        else{
            if(ch===quote&&!fieldStarted){
                inQuotes=true;
                fieldStarted=true;
                i++;
                continue;
            }
            else if(ch===delimiter){
                currentRow.push(currentField);
                currentField="";
                fieldStarted=false;
                i++;
                continue;
            }
            else if(ch==="\n"){
                currentRow.push(currentField);
                currentField="";
                fieldStarted=false;
                rows.push(currentRow);
                currentRow=[];
                i++;
                continue;
            }
            else if(ch==="\r"){
                if(i+1<text.length&&text[i+1]==="\n"){
                    currentRow.push(currentField);
                    currentField="";
                    fieldStarted=false;
                    rows.push(currentRow);
                    currentRow=[];
                    i+=2;
                    continue;
                }
                else{
                    currentRow.push(currentField);
                    currentField="";
                    fieldStarted=false;
                    rows.push(currentRow);
                    currentRow=[];
                    i++;
                    continue;
                }
            }
            else{
                currentField+=ch;
                fieldStarted=true;
                i++;
                continue;
            }
        }
    }
    if(fieldStarted||currentField!==""||currentRow.length>0){
        currentRow.push(currentField);
        rows.push(currentRow);
    }
    return rows;
}
function inferSchemaFromCsv(headers: string[], rows: string[][]): SchemaField[]{
    let fields: SchemaField[]=[];
    for(let i=0;i<headers.length;i++){
        let h: string=headers[i];
        let allNumber: boolean=true;
        let allBool: boolean=true;
        let nullable: boolean=false;
        let sample: unknown=null;
        let hasValue: boolean=false;
        for(let r of rows){
            let v: string|undefined=r[i];
            if(v===undefined||v===""){
                nullable=true;
                continue;
            }
            if(!hasValue){
                sample=v;
                hasValue=true;
            }
            if(!isNumeric(v)){
                allNumber=false;
            }
            if(v!=="true"&&v!=="false"){
                allBool=false;
            }
        }
        let type: SchemaField["type"];
        if(!hasValue){
            type="null";
            nullable=true;
        }
        else if(allNumber){
            type="number";
            sample=Number(sample);
        }
        else if(allBool){
            type="boolean";
            sample=sample==="true";
        }
        else{
            type="string";
        }
        fields.push({path: h, type: type, nullable: nullable, sampleValue: sample});
    }
    return fields;
}
function isNumeric(s: string): boolean{
    if(s.trim()===""){
        return false;
    }
    let n: number=Number(s);
    return !isNaN(n);
}
export function renderMarkdownTable(headers: string[], rows: (string|number|boolean|null)[][]): string{
    if(headers.length===0){
        return "";
    }
    let escapedHeaders: string[]=headers.map(h=>escapeCell(h));
    let lines: string[]=[];
    lines.push("| "+escapedHeaders.join(" | ")+" |");
    lines.push("| "+escapedHeaders.map(()=>"---").join(" | ")+" |");
    for(let row of rows){
        let escaped: string[]=row.map(c=>escapeCell(c));
        while(escaped.length<headers.length){
            escaped.push("");
        }
        lines.push("| "+escaped.join(" | ")+" |");
    }
    return lines.join("\n");
}
function escapeCell(v: string|number|boolean|null): string{
    let s: string;
    if(v===null){
        s="null";
    }
    else if(typeof v==="string"){
        s=v;
    }
    else{
        s=String(v);
    }
    return s.replace(/\|/g, "\\|");
}
export function detectFormat(text: string): "json"|"ndjson"|"csv"{
    let trimmed: string=text.trim();
    if(trimmed===""){
        return "csv";
    }
    let firstChar: string=trimmed[0];
    if(firstChar==="{"||firstChar==="["){
        return detectJsonVariant(trimmed);
    }
    return "csv";
}
function detectJsonVariant(text: string): "json"|"ndjson"{
    let lines: string[]=text.split(/\r?\n/);
    let nonEmptyLines: string[]=lines.map(l=>l.trim()).filter(l=>l!=="");
    if(nonEmptyLines.length<=1){
        return "json";
    }
    let jsonCount: number=0;
    for(let line of nonEmptyLines){
        try{
            JSON.parse(line);
            jsonCount++;
        }
        catch(e){
            // not JSON
        }
    }
    if(jsonCount>1){
        return "ndjson";
    }
    return "json";
}
export function parseAuto(text: string): ParseResult{
    let format: "json"|"ndjson"|"csv"=detectFormat(text);
    if(format==="json"){
        return parseJson(text);
    }
    else if(format==="ndjson"){
        return parseNdjson(text);
    }
    else{
        return parseCsv(text);
    }
}
export class JsonCsvParser{
    static inferSchema(data: unknown): SchemaField[]{
        return inferSchema(data);
    }
    static flattenObject(obj: Record<string, unknown>, prefix?: string): Record<string, unknown>{
        return flattenObject(obj, prefix??"");
    }
    static parseJson(text: string): ParseResult{
        return parseJson(text);
    }
    static parseNdjson(text: string): ParseResult{
        return parseNdjson(text);
    }
    static parseCsv(text: string, options?: {delimiter?: string, quote?: string}): ParseResult{
        return parseCsv(text, options);
    }
    static renderMarkdownTable(headers: string[], rows: (string|number|boolean|null)[][]): string{
        return renderMarkdownTable(headers, rows);
    }
    static detectFormat(text: string): "json"|"ndjson"|"csv"{
        return detectFormat(text);
    }
    static parseAuto(text: string): ParseResult{
        return parseAuto(text);
    }
}
export default JsonCsvParser;
