import{describe, test, expect}from "vitest";
import zlib from "zlib";
import{parseXlsx, parseSharedStrings, parseWorkbook, parseWorkbookRels, parseWorksheet, columnToIndex, sheetToMarkdownTable, XlsxCell, XlsxSheet, XlsxResult}from "../src/core/xlsxParser.js";
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
function makeXlsx(files: {path: string, content: string}[]): Buffer{
    let dataParts: Buffer[]=[];
    let centralParts: Buffer[]=[];
    let offset: number=0;
    for(let file of files){
        let fileContent: Buffer=Buffer.from(file.content, "utf8");
        let filenameBuf: Buffer=Buffer.from(file.path, "utf8");
        let method: number=8;
        let compressedData: Buffer=zlib.deflateRawSync(fileContent);
        let crc: number=crc32(fileContent);
        let localHeader: Buffer=Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0, 6);
        localHeader.writeUInt16LE(method, 8);
        localHeader.writeUInt16LE(0, 10);
        localHeader.writeUInt16LE(0, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(compressedData.length, 18);
        localHeader.writeUInt32LE(fileContent.length, 22);
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
        centralHeader.writeUInt32LE(fileContent.length, 24);
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
function makeWorkbookXml(sheetNames: {name: string, sheetId: string, rId: string}[]): string{
    let sheetsXml: string="";
    for(let s of sheetNames){
        sheetsXml+='<sheet name="'+s.name+'" sheetId="'+s.sheetId+'" r:id="'+s.rId+'"/>';
    }
    return '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheetsXml+'</sheets></workbook>';
}
function makeRelsXml(rels: {id: string, target: string}[]): string{
    let relXml: string="";
    for(let r of rels){
        relXml+='<Relationship Id="'+r.id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="'+r.target+'"/>';
    }
    return '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+relXml+'</Relationships>';
}
function makeSheetXml(rowsXml: string): string{
    return '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rowsXml+'</sheetData></worksheet>';
}
describe("columnToIndex", ()=>{
    test("columnToIndex A -> 0", ()=>{
        expect(columnToIndex("A")).toBe(0);
    });
    test("columnToIndex Z -> 25", ()=>{
        expect(columnToIndex("Z")).toBe(25);
    });
    test("columnToIndex AA -> 26", ()=>{
        expect(columnToIndex("AA")).toBe(26);
    });
    test("columnToIndex AB -> 27", ()=>{
        expect(columnToIndex("AB")).toBe(27);
    });
    test("columnToIndex invalid returns -1", ()=>{
        expect(columnToIndex("A1")).toBe(-1);
        expect(columnToIndex("")).toBe(-1);
        expect(columnToIndex("123")).toBe(-1);
    });
});
describe("parseSharedStrings", ()=>{
    test("parseSharedStrings extracts strings", ()=>{
        let xml: string='<sst><si><t>Hello</t></si><si><t>World</t></si></sst>';
        expect(parseSharedStrings(xml)).toEqual(["Hello", "World"]);
    });
    test("parseSharedStrings decodes HTML entities", ()=>{
        let xml: string='<sst><si><t>Tom &amp; Jerry &lt;tag&gt;</t></si></sst>';
        expect(parseSharedStrings(xml)).toEqual(["Tom & Jerry <tag>"]);
    });
    test("parseSharedStrings preserves spaces with xml:space=preserve", ()=>{
        let xml: string='<sst><si><t xml:space="preserve"> spaced </t></si></sst>';
        expect(parseSharedStrings(xml)).toEqual([" spaced "]);
    });
    test("parseSharedStrings returns empty for no strings", ()=>{
        let xml: string='<sst></sst>';
        expect(parseSharedStrings(xml)).toEqual([]);
    });
});
describe("parseWorkbook", ()=>{
    test("parseWorkbook extracts sheets in order", ()=>{
        let xml: string='<?xml version="1.0"?><workbook><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/><sheet name="Sheet2" sheetId="2" r:id="rId2"/></sheets></workbook>';
        let sheets: {name: string, sheetId: string, rId: string}[]=parseWorkbook(xml);
        expect(sheets).toHaveLength(2);
        expect(sheets[0]).toEqual({name: "Sheet1", sheetId: "1", rId: "rId1"});
        expect(sheets[1]).toEqual({name: "Sheet2", sheetId: "2", rId: "rId2"});
    });
});
describe("parseWorkbookRels", ()=>{
    test("parseWorkbookRels maps rId to target", ()=>{
        let xml: string='<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="x" Target="worksheets/sheet2.xml"/></Relationships>';
        let rels: Map<string, string>=parseWorkbookRels(xml);
        expect(rels.get("rId1")).toBe("worksheets/sheet1.xml");
        expect(rels.get("rId2")).toBe("worksheets/sheet2.xml");
        expect(rels.size).toBe(2);
    });
});
describe("parseWorksheet", ()=>{
    test("parseWorksheet parses numeric cells", ()=>{
        let xml: string=makeSheetXml('<row r="1"><c r="A1"><v>42</v></c></row>');
        let rows: XlsxCell[][]=parseWorksheet(xml, []);
        expect(rows).toEqual([[{value: 42, type: "number"}]]);
    });
    test("parseWorksheet parses shared string cells", ()=>{
        let xml: string=makeSheetXml('<row r="1"><c r="A1" t="s"><v>0</v></c></row>');
        let rows: XlsxCell[][]=parseWorksheet(xml, ["Hello"]);
        expect(rows).toEqual([[{value: "Hello", type: "string"}]]);
    });
    test("parseWorksheet parses boolean cells", ()=>{
        let xml: string=makeSheetXml('<row r="1"><c r="A1" t="b"><v>1</v></c><c r="B1" t="b"><v>0</v></c></row>');
        let rows: XlsxCell[][]=parseWorksheet(xml, []);
        expect(rows).toEqual([[{value: true, type: "boolean"}, {value: false, type: "boolean"}]]);
    });
    test("parseWorksheet parses inlineStr cells", ()=>{
        let xml: string=makeSheetXml('<row r="1"><c r="A1" t="inlineStr"><is><t>World</t></is></c></row>');
        let rows: XlsxCell[][]=parseWorksheet(xml, []);
        expect(rows).toEqual([[{value: "World", type: "string"}]]);
    });
    test("parseWorksheet pads missing cells", ()=>{
        let xml: string=makeSheetXml('<row r="1"><c r="A1"><v>1</v></c><c r="C1"><v>3</v></c></row>');
        let rows: XlsxCell[][]=parseWorksheet(xml, []);
        expect(rows).toEqual([[{value: 1, type: "number"}, {value: null, type: "empty"}, {value: 3, type: "number"}]]);
    });
    test("parseWorksheet returns empty for empty sheet", ()=>{
        let xml: string=makeSheetXml("");
        let rows: XlsxCell[][]=parseWorksheet(xml, []);
        expect(rows).toEqual([]);
    });
});
describe("sheetToMarkdownTable", ()=>{
    test("sheetToMarkdownTable basic", ()=>{
        let sheet: XlsxSheet={
            name: "S1",
            rows: [
                [{value: "Name", type: "string"}, {value: "Age", type: "string"}],
                [{value: "Alice", type: "string"}, {value: 30, type: "number"}]
            ],
            maxCols: 2
        };
        expect(sheetToMarkdownTable(sheet)).toBe("| Name | Age |\n| --- | --- |\n| Alice | 30 |");
    });
    test("sheetToMarkdownTable escapes pipe", ()=>{
        let sheet: XlsxSheet={
            name: "S1",
            rows: [
                [{value: "A|B", type: "string"}],
                [{value: "C", type: "string"}]
            ],
            maxCols: 1
        };
        expect(sheetToMarkdownTable(sheet)).toBe("| A\\|B |\n| --- |\n| C |");
    });
    test("sheetToMarkdownTable pads ragged rows", ()=>{
        let sheet: XlsxSheet={
            name: "S1",
            rows: [
                [{value: "H1", type: "string"}, {value: "H2", type: "string"}],
                [{value: "D1", type: "string"}]
            ],
            maxCols: 2
        };
        expect(sheetToMarkdownTable(sheet)).toBe("| H1 | H2 |\n| --- | --- |\n| D1 |  |");
    });
});
describe("parseXlsx", ()=>{
    test("parseXlsx throws on non-XLSX buffer", async ()=>{
        await expect(parseXlsx(Buffer.from("not an xlsx", "utf8"))).rejects.toThrow();
    });
    test("parseXlsx parses single sheet (synthetic)", async ()=>{
        let workbook: string=makeWorkbookXml([{name: "Sheet1", sheetId: "1", rId: "rId1"}]);
        let rels: string=makeRelsXml([{id: "rId1", target: "worksheets/sheet1.xml"}]);
        let sheet1: string=makeSheetXml('<row r="1"><c r="A1"><v>1</v></c><c r="B1"><v>2</v></c></row><row r="2"><c r="A2"><v>3</v></c><c r="B2"><v>4</v></c></row>');
        let xlsx: Buffer=makeXlsx([
            {path: "xl/workbook.xml", content: workbook},
            {path: "xl/_rels/workbook.xml.rels", content: rels},
            {path: "xl/worksheets/sheet1.xml", content: sheet1}
        ]);
        let result: XlsxResult=await parseXlsx(xlsx);
        expect(result.totalSheets).toBe(1);
        expect(result.sheets[0].name).toBe("Sheet1");
        expect(result.sheets[0].rows).toHaveLength(2);
        expect(result.sheets[0].maxCols).toBe(2);
        expect(result.sheets[0].rows[0][0].value).toBe(1);
        expect(result.sheets[0].rows[0][1].value).toBe(2);
        expect(result.sheets[0].rows[1][0].value).toBe(3);
        expect(result.sheets[0].rows[1][1].value).toBe(4);
        expect(result.markdownTables).toHaveLength(1);
    });
    test("parseXlsx parses multiple sheets in order", async ()=>{
        let workbook: string=makeWorkbookXml([{name: "Sheet1", sheetId: "1", rId: "rId1"}, {name: "Sheet2", sheetId: "2", rId: "rId2"}]);
        let rels: string=makeRelsXml([{id: "rId1", target: "worksheets/sheet1.xml"}, {id: "rId2", target: "worksheets/sheet2.xml"}]);
        let sheet1: string=makeSheetXml('<row r="1"><c r="A1"><v>1</v></c></row>');
        let sheet2: string=makeSheetXml('<row r="1"><c r="A1"><v>2</v></c></row>');
        let xlsx: Buffer=makeXlsx([
            {path: "xl/workbook.xml", content: workbook},
            {path: "xl/_rels/workbook.xml.rels", content: rels},
            {path: "xl/worksheets/sheet1.xml", content: sheet1},
            {path: "xl/worksheets/sheet2.xml", content: sheet2}
        ]);
        let result: XlsxResult=await parseXlsx(xlsx);
        expect(result.totalSheets).toBe(2);
        expect(result.sheets[0].name).toBe("Sheet1");
        expect(result.sheets[1].name).toBe("Sheet2");
        expect(result.sheets[0].rows[0][0].value).toBe(1);
        expect(result.sheets[1].rows[0][0].value).toBe(2);
    });
    test("parseXlsx computes totalRows", async ()=>{
        let workbook: string=makeWorkbookXml([{name: "Sheet1", sheetId: "1", rId: "rId1"}, {name: "Sheet2", sheetId: "2", rId: "rId2"}]);
        let rels: string=makeRelsXml([{id: "rId1", target: "worksheets/sheet1.xml"}, {id: "rId2", target: "worksheets/sheet2.xml"}]);
        let sheet1: string=makeSheetXml('<row r="1"><c r="A1"><v>1</v></c></row><row r="2"><c r="A1"><v>2</v></c></row>');
        let sheet2: string=makeSheetXml('<row r="1"><c r="A1"><v>3</v></c></row>');
        let xlsx: Buffer=makeXlsx([
            {path: "xl/workbook.xml", content: workbook},
            {path: "xl/_rels/workbook.xml.rels", content: rels},
            {path: "xl/worksheets/sheet1.xml", content: sheet1},
            {path: "xl/worksheets/sheet2.xml", content: sheet2}
        ]);
        let result: XlsxResult=await parseXlsx(xlsx);
        expect(result.totalRows).toBe(3);
    });
});
