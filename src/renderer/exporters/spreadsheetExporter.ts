import type { TrainingItem } from "../../types/index.js"
import { Exporter, ExportOptions, csvEscape } from "../exportFormats.js"
import { t } from "../i18n.js"
export interface SpreadsheetRow{
    [key: string]: string
}
export interface SpreadsheetOptions extends ExportOptions{
    columns?: string[]
    sheets?: { name?: string, columns?: string[] }[]
}
function inferColumns(items: TrainingItem[]): string[]{
    for(let item of items){
        if(item.messages!=null&&item.messages.length>0){
            return ["messages"]
        }
    }
    return ["instruction","input","output"]
}
export function determineColumns(items: TrainingItem[], options?: SpreadsheetOptions): string[]{
    if(options?.columns!=null&&options.columns.length>0){
        return options.columns
    }
    return inferColumns(items)
}
export function flattenItem(item: TrainingItem, columns: string[]): SpreadsheetRow{
    let row: SpreadsheetRow={}
    let record=(item as unknown) as Record<string, unknown>
    for(let col of columns){
        let value=record[col]
        if(value===null||value===undefined){
            row[col]=""
        }
        else if(typeof value==="object"){
            row[col]=JSON.stringify(value)
        }
        else{
            row[col]=String(value)
        }
    }
    return row
}
export function itemsToRows(items: TrainingItem[], columns?: string[]): SpreadsheetRow[]{
    let cols=columns
    if(cols==null||cols.length===0){
        cols=determineColumns(items)
    }
    return items.map(item=>flattenItem(item, cols!))
}
function rowsToCsv(rows: SpreadsheetRow[], columns: string[]): string{
    let lines: string[]=[]
    lines.push(columns.map(col=>csvEscape(col)).join(","))
    for(let row of rows){
        lines.push(columns.map(col=>csvEscape(row[col]!=null?String(row[col]):"")).join(","))
    }
    return "\uFEFF"+lines.join("\n")+"\n"
}
function tsvEscape(value: string): string{
    let escaped=value.replace(/"/g,'""')
    if(/^[=\+\-\@\t\r]/.test(escaped)){
        escaped="'"+escaped
    }
    if(escaped.includes("\t")||escaped.includes("\n")||escaped.includes("\r")||escaped.includes('"')){
        return `"${escaped}"`
    }
    return escaped
}
function rowsToTsv(rows: SpreadsheetRow[], columns: string[]): string{
    let lines: string[]=[]
    lines.push(columns.map(col=>tsvEscape(col)).join("\t"))
    for(let row of rows){
        lines.push(columns.map(col=>tsvEscape(row[col]!=null?String(row[col]):"")).join("\t"))
    }
    return lines.join("\n")+"\n"
}
export class CsvExporter implements Exporter{
    name="csv"
    mimeType="text/csv"
    extension=".csv"
    export(items: TrainingItem[], options?: SpreadsheetOptions): string{
        let columns=determineColumns(items, options)
        let rows=itemsToRows(items, columns)
        return rowsToCsv(rows, columns)
    }
}
export class TsvExporter implements Exporter{
    name="tsv"
    mimeType="text/tab-separated-values"
    extension=".tsv"
    export(items: TrainingItem[], options?: SpreadsheetOptions): string{
        let columns=determineColumns(items, options)
        let rows=itemsToRows(items, columns)
        return rowsToTsv(rows, columns)
    }
}
export class XlsxExporter implements Exporter{
    name="xlsx"
    mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    extension=".xlsx"
    async export(items: TrainingItem[], options?: SpreadsheetOptions): Promise<Buffer>{
        let mod: any
        try{
            let specifier: string="xlsx"
            mod=await import(specifier)
        }
        catch{
            throw new Error(t("error.xlsxNotInstalled"))
        }
        if(mod==null){
            throw new Error(t("error.xlsxNotInstalled"))
        }
        let utils=mod.utils
        let write=mod.write
        if(utils==null||write==null){
            throw new Error(t("error.xlsxNotInstalled"))
        }
        let wb=utils.book_new()
        let sheets=options?.sheets
        if(sheets!=null&&sheets.length>0){
            for(let sheet of sheets){
                let cols=sheet.columns!=null&&sheet.columns.length>0?sheet.columns:determineColumns(items, { columns: options?.columns })
                let rows=itemsToRows(items, cols)
                let aoa=[cols, ...rows.map(row=>cols.map(col=>row[col]!=null?String(row[col]):""))]
                let ws=utils.aoa_to_sheet(aoa)
                utils.book_append_sheet(wb, ws, sheet.name??"Sheet1")
            }
        }
        else{
            let cols=determineColumns(items, options)
            let rows=itemsToRows(items, cols)
            let aoa=[cols, ...rows.map(row=>cols.map(col=>row[col]!=null?String(row[col]):""))]
            let ws=utils.aoa_to_sheet(aoa)
            utils.book_append_sheet(wb, ws, "Sheet1")
        }
        return write(wb, { bookType: "xlsx", type: "buffer" })
    }
}
