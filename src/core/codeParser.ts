export const SUPPORTED_LANGUAGES: Record<string, string>={
    ".js": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".ts": "typescript",
    ".mts": "typescript",
    ".cts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".pyi": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java"
};
export interface CodeChunk{
    type: "import"|"type"|"function"|"class"|"comment"|"block";
    name: string|undefined;
    text: string;
    language: string;
    startLine: number;
    endLine: number;
}
export interface CodeParseResult{
    language: string;
    chunks: CodeChunk[];
    imports: string;
    typeDeclarations: string;
}
export function detectLanguage(filename: string): string|undefined{
    let dotIndex: number=filename.lastIndexOf(".");
    if (dotIndex===-1||dotIndex===filename.length-1){
        return undefined;
    }
    let ext: string=filename.slice(dotIndex).toLowerCase();
    return SUPPORTED_LANGUAGES[ext];
}
export function isCodeFile(filename: string): boolean{
    return detectLanguage(filename)!==undefined;
}
function getImportRegex(language: string): RegExp|undefined{
    if (language==="javascript"||language==="typescript"){
        return /^\s*(import\s+|(const|let|var)\s+.*=\s*require\()/;
    }
    else if (language==="python"){
        return /^\s*(import\s+|from\s+\S+\s+import)/;
    }
    else if (language==="rust"){
        return /^\s*(use\s+|mod\s+|extern\s+crate)/;
    }
    else if (language==="go"){
        return /^\s*import\s*\(|^\s*import\s+"/;
    }
    else if (language==="java"){
        return /^\s*import\s+/;
    }
    return undefined;
}
export function extractImports(text: string, language: string): string{
    let regex: RegExp|undefined=getImportRegex(language);
    if (!regex){
        return "";
    }
    let lines: string[]=text.split(/\r?\n/);
    let result: string[]=[];
    if (language==="go"){
        let i: number=0;
        while(i<lines.length){
            let line: string=lines[i];
            if (/^\s*import\s*\(/.test(line)){
                while(i<lines.length){
                    result.push(lines[i]);
                    if (/^\s*\)/.test(lines[i])){
                        break;
                    }
                    i++;
                }
            }
            else if (/^\s*import\s+"/.test(line)){
                result.push(line);
            }
            i++;
        }
    }
    else{
        for (let line of lines){
            if (regex.test(line)){
                result.push(line);
            }
        }
    }
    return result.join("\n");
}
function getTypeRegex(language: string): RegExp|undefined{
    if (language==="typescript"){
        return /^\s*(interface|type|enum)\s+\w+/;
    }
    else if (language==="rust"){
        return /^\s*(struct|enum|trait|type)\s+\w+/;
    }
    else if (language==="go"){
        return /^\s*type\s+\w+/;
    }
    else if (language==="java"){
        return /^\s*(class|interface|enum)\s+\w+.*\{/;
    }
    else if (language==="python"){
        return /^\s*class\s+\w+/;
    }
    return undefined;
}
function measureIndent(line: string): number{
    let count: number=0;
    for (let ch of line){
        if (ch===" "){
            count++;
        }
        else if (ch==="\t"){
            count+=4;
        }
        else{
            break;
        }
    }
    return count;
}
function findMatchingBrace(text: string, startIdx: number): number{
    let depth: number=0;
    let inString: boolean=false;
    let quote: string="";
    let escaped: boolean=false;
    let inLineComment: boolean=false;
    let inBlockComment: boolean=false;
    for (let i: number=startIdx;i<text.length;i++){
        let ch: string=text[i];
        let next: string=text[i+1]||"";
        if (inLineComment){
            if (ch==="\n"){
                inLineComment=false;
            }
            continue;
        }
        if (inBlockComment){
            if (ch==="*"&&next==="/"){
                inBlockComment=false;
                i++;
            }
            continue;
        }
        if (inString){
            if (escaped){
                escaped=false;
            }
            else if (ch==="\\"){
                escaped=true;
            }
            else if (ch===quote){
                inString=false;
            }
            continue;
        }
        if (ch==="/"&&next==="/"){
            inLineComment=true;
            i++;
            continue;
        }
        if (ch==="/"&&next==="*"){
            inBlockComment=true;
            i++;
            continue;
        }
        if (ch==="\""||ch==="'"||ch==="`"){
            inString=true;
            quote=ch;
            continue;
        }
        if (ch==="{"){
            depth++;
        }
        else if (ch==="}"){
            depth--;
            if (depth===0){
                return i;
            }
        }
    }
    return text.length-1;
}
function extractIndentBlock(lines: string[], startIdx: number): number{
    let baseIndent: number=measureIndent(lines[startIdx]);
    let i: number=startIdx+1;
    while(i<lines.length){
        let line: string=lines[i];
        if (line.trim()===""){
            i++;
            continue;
        }
        if (measureIndent(line)<=baseIndent){
            break;
        }
        i++;
    }
    return i-1;
}
export function extractTypeDeclarations(text: string, language: string): string{
    let regex: RegExp|undefined=getTypeRegex(language);
    if (!regex){
        return "";
    }
    let lines: string[]=text.split(/\r?\n/);
    let result: string[]=[];
    let i: number=0;
    while(i<lines.length){
        let line: string=lines[i];
        if (!regex.test(line)){
            i++;
            continue;
        }
        if (language==="typescript"){
            result.push(line);
            i++;
        }
        else if (language==="python"){
            let endIdx: number=extractIndentBlock(lines, i);
            result.push(lines.slice(i, endIdx+1).join("\n"));
            i=endIdx+1;
        }
        else if (language==="java"||line.includes("{")){
            let braceIdx: number=line.indexOf("{");
            let lineStart: number=0;
            for (let j: number=0;j<i;j++){
                lineStart+=lines[j].length+1;
            }
            let absoluteBrace: number=lineStart+braceIdx;
            let absoluteEnd: number=findMatchingBrace(text, absoluteBrace);
            let charCount: number=0;
            let endLine: number=i;
            for (let j: number=0;j<lines.length;j++){
                let nextChar: number=charCount+lines[j].length+1;
                if (nextChar>absoluteEnd){
                    endLine=j;
                    break;
                }
                charCount=nextChar;
            }
            result.push(lines.slice(i, endLine+1).join("\n"));
            i=endLine+1;
        }
        else{
            result.push(line);
            i++;
        }
    }
    return result.join("\n");
}
function isCommentLine(line: string, language: string): boolean{
    if (language==="python"){
        return /^\s*#/.test(line);
    }
    return /^\s*(\/\/|\/\*|\*)/.test(line);
}
interface DefinitionMatch{
    type: "function"|"class";
    name: string;
}
function matchDefinition(line: string, language: string): DefinitionMatch|undefined{
    let patterns: {regex: RegExp; type: "function"|"class"}[]=[];
    if (language==="javascript"||language==="typescript"){
        patterns=[
            {regex: /^(export\s+)?(async\s+)?function\s+(\w+)/, type: "function"},
            {regex: /^(export\s+)?class\s+(\w+)/, type: "class"},
            {regex: /^(export\s+)?(const|let|var)\s+(\w+)\s*=.*=>/, type: "function"},
            {regex: /(?!(?:if|for|while|switch|catch)\b)(\w+)\(.*\)\s*\{/, type: "function"}
        ];
    }
    else if (language==="python"){
        patterns=[
            {regex: /^\s*(def|class)\s+(\w+)/, type: "class"}
        ];
        let m: RegExpMatchArray|null=line.match(/^\s*def\s+(\w+)/);
        if (m){
            return {type: "function", name: m[1]};
        }
        let cm: RegExpMatchArray|null=line.match(/^\s*class\s+(\w+)/);
        if (cm){
            return {type: "class", name: cm[1]};
        }
        return undefined;
    }
    else if (language==="rust"){
        patterns=[
            {regex: /^\s*(fn|impl|pub\s+fn|pub\s+impl)\s+(\w+)/, type: "function"},
            {regex: /^\s*(struct|enum|trait)\s+(\w+)/, type: "class"}
        ];
    }
    else if (language==="go"){
        patterns=[
            {regex: /^\s*func\s+(?:\([^)]*\)\s+)?(\w+)/, type: "function"},
            {regex: /^\s*type\s+(\w+)/, type: "class"}
        ];
    }
    else if (language==="java"){
        patterns=[
            {regex: /^\s*(public|private|protected|static|\s)*(?!(?:if|for|while|switch|catch|synchronized|return|new|throw)\s)(class|interface|enum|void|[A-Za-z0-9_<>]+)\s+(\w+)\s*\(/, type: "function"},
            {regex: /^\s*(public|private|protected)?\s*class\s+(\w+)/, type: "class"}
        ];
    }
    for (let p of patterns){
        let m: RegExpMatchArray|null=line.match(p.regex);
        if (m){
            let name: string=m[m.length-1];
            if (p.type==="function"&&(name==="if"||name==="for"||name==="while"||name==="switch"||name==="catch")){
                continue;
            }
            return {type: p.type, name: name};
        }
    }
    return undefined;
}
function extractBraceBlock(lines: string[], startIdx: number): number{
    let text: string=lines.join("\n");
    let charOffset: number=0;
    for (let i: number=0;i<startIdx;i++){
        charOffset+=lines[i].length+1;
    }
    let braceIdx: number=-1;
    for (let i: number=startIdx;i<lines.length;i++){
        let idx: number=lines[i].indexOf("{");
        if (idx!==-1){
            braceIdx=charOffset+idx;
            break;
        }
        charOffset+=lines[i].length+1;
    }
    if (braceIdx===-1){
        return startIdx;
    }
    let absoluteEnd: number=findMatchingBrace(text, braceIdx);
    let endLine: number=lines.length-1;
    let count: number=0;
    for (let i: number=0;i<lines.length;i++){
        let nextCount: number=count+lines[i].length+1;
        if (nextCount>absoluteEnd){
            endLine=i;
            break;
        }
        count=nextCount;
    }
    return endLine;
}
function extractDefinition(lines: string[], startIdx: number, language: string, def: DefinitionMatch): {endIdx: number; name: string; type: "function"|"class"}{
    if (language==="python"){
        let endIdx: number=extractIndentBlock(lines, startIdx);
        return {endIdx: endIdx, name: def.name, type: def.type};
    }
    let endIdx: number=extractBraceBlock(lines, startIdx);
    return {endIdx: endIdx, name: def.name, type: def.type};
}
export function chunkCode(text: string, language: string): CodeChunk[]{
    let lines: string[]=text.split(/\r?\n/);
    let chunks: CodeChunk[]=[];
    let importRegex: RegExp|undefined=getImportRegex(language);
    let importLines: Set<number>=new Set();
    let importTexts: string[]=[];
    if (importRegex){
        if (language==="go"){
            let i: number=0;
            while(i<lines.length){
                let line: string=lines[i];
                if (/^\s*import\s*\(/.test(line)){
                    while(i<lines.length){
                        importLines.add(i);
                        importTexts.push(lines[i]);
                        if (/^\s*\)/.test(lines[i])){
                            i++;
                            break;
                        }
                        i++;
                    }
                }
                else if (/^\s*import\s+"/.test(line)){
                    importLines.add(i);
                    importTexts.push(line);
                    i++;
                }
                else{
                    i++;
                }
            }
        }
        else{
            for (let i: number=0;i<lines.length;i++){
                if (importRegex.test(lines[i])){
                    importLines.add(i);
                    importTexts.push(lines[i]);
                }
            }
        }
    }
    if (importTexts.length>0){
        let first: number=Math.min(...importLines);
        let last: number=Math.max(...importLines);
        chunks.push({
            type: "import",
            name: undefined,
            text: importTexts.join("\n"),
            language: language,
            startLine: first+1,
            endLine: last+1
        });
    }
    let i: number=0;
    while(i<lines.length){
        if (importLines.has(i)){
            i++;
            continue;
        }
        let line: string=lines[i];
        if (line.trim()===""||isCommentLine(line, language)){
            i++;
            continue;
        }
        let def: DefinitionMatch|undefined=matchDefinition(line, language);
        if (def){
            let extracted: {endIdx: number; name: string; type: "function"|"class"}=extractDefinition(lines, i, language, def);
            chunks.push({
                type: extracted.type,
                name: extracted.name,
                text: lines.slice(i, extracted.endIdx+1).join("\n"),
                language: language,
                startLine: i+1,
                endLine: extracted.endIdx+1
            });
            i=extracted.endIdx+1;
        }
        else{
            let start: number=i;
            while(i<lines.length&&!importLines.has(i)&&lines[i].trim()!==""&&!isCommentLine(lines[i], language)&&!matchDefinition(lines[i], language)){
                i++;
            }
            if (i>start){
                chunks.push({
                    type: "block",
                    name: undefined,
                    text: lines.slice(start, i).join("\n"),
                    language: language,
                    startLine: start+1,
                    endLine: i
                });
            }
            else{
                i++;
            }
        }
    }
    return chunks;
}
export function parseCode(text: string, filename: string): CodeParseResult{
    let language: string|undefined=detectLanguage(filename);
    if (language===undefined){
        throw new Error("Unsupported code file: "+filename);
    }
    let imports: string=extractImports(text, language);
    let typeDeclarations: string=extractTypeDeclarations(text, language);
    let chunks: CodeChunk[]=chunkCode(text, language);
    return {
        language: language,
        chunks: chunks,
        imports: imports,
        typeDeclarations: typeDeclarations
    };
}