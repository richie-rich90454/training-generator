import type{Citation}from"../types/interfaces.js"
export const CITATION_PROMPT_INSTRUCTION=`When generating answers, cite sources using bracketed references. Use [page N] for page numbers (e.g. [page 12], [p.7]) and [line N] for line numbers (e.g. [line 45], [L 23], [L23]). Place citations immediately after the cited claim.`
export interface ParsedCitation{
    citation:Citation
    start:number
    end:number
}
export class CitationParser{
    static parsePage(text:string):ParsedCitation[]{
        let results:ParsedCitation[]=[]
        let regex=/\[(?:page|p\.)\s*(\d+)\]/g
        let match:RegExpExecArray|null
        while((match=regex.exec(text))!==null){
            let page=parseInt(match[1], 10)
            results.push({
                citation:{page, text:match[0]},
                start:match.index,
                end:match.index+match[0].length
            })
        }
        return results
    }
    static parseLine(text:string):ParsedCitation[]{
        let results:ParsedCitation[]=[]
        let regex=/\[(?:line|L)\s*(\d+)\]/g
        let match:RegExpExecArray|null
        while((match=regex.exec(text))!==null){
            let line=parseInt(match[1], 10)
            results.push({
                citation:{line, text:match[0]},
                start:match.index,
                end:match.index+match[0].length
            })
        }
        return results
    }
    static parseAll(text:string):Citation[]{
        let pageResults=CitationParser.parsePage(text)
        let lineResults=CitationParser.parseLine(text)
        let all:{citation:Citation, start:number}[]=[]
        for(let p of pageResults){
            all.push({citation:p.citation, start:p.start})
        }
        for(let l of lineResults){
            all.push({citation:l.citation, start:l.start})
        }
        all.sort((a, b)=>a.start-b.start)
        let seen=new Set<string>()
        let result:Citation[]=[]
        for(let item of all){
            let key=`${item.citation.page??""}|${item.citation.line??""}|${item.citation.text}`
            if(seen.has(key))continue
            seen.add(key)
            result.push(item.citation)
        }
        return result
    }
}
export function extractCitations(text:string):{cleanedText:string, citations:Citation[]}{
    let pageResults=CitationParser.parsePage(text)
    let lineResults=CitationParser.parseLine(text)
    let spans:{start:number, end:number}[]=[]
    for(let p of pageResults){
        spans.push({start:p.start, end:p.end})
    }
    for(let l of lineResults){
        spans.push({start:l.start, end:l.end})
    }
    spans.sort((a, b)=>a.start-b.start)
    let cleaned=text
    for(let i=spans.length-1;i>=0;i--){
        let span=spans[i]
        cleaned=cleaned.slice(0, span.start)+cleaned.slice(span.end)
    }
    cleaned=cleaned.replace(/  +/g, " ").trim()
    let citations=CitationParser.parseAll(text)
    return{cleanedText:cleaned, citations}
}
export function injectCitationPrompt(prompt:string):string{
    if(prompt.includes(CITATION_PROMPT_INSTRUCTION))return prompt
    return prompt+"\n"+CITATION_PROMPT_INSTRUCTION
}
export function validateCitations(citations:Citation[], sourceSpans:{page?:number, line?:number}[]):{valid:Citation[], invalid:Citation[]}{
    let valid:Citation[]=[]
    let invalid:Citation[]=[]
    for(let c of citations){
        let matched=false
        for(let s of sourceSpans){
            if(c.page!==undefined&&c.line!==undefined){
                if(s.page===c.page&&s.line===c.line){
                    matched=true
                    break
                }
            }
            else if(c.page!==undefined){
                if(s.page===c.page){
                    matched=true
                    break
                }
            }
            else if(c.line!==undefined){
                if(s.line===c.line){
                    matched=true
                    break
                }
            }
            else{
                matched=true
                break
            }
        }
        if(matched)valid.push(c)
        else invalid.push(c)
    }
    return{valid, invalid}
}
export function renderCitations(citations:Citation[]):string{
    if(citations.length===0)return""
    let parts:string[]=[]
    for(let c of citations){
        if(c.page!==undefined&&c.line!==undefined){
            parts.push(`[page ${c.page}, line ${c.line}]`)
        }
        else if(c.page!==undefined){
            parts.push(`[page ${c.page}]`)
        }
        else if(c.line!==undefined){
            parts.push(`[line ${c.line}]`)
        }
        else{
            parts.push(c.text)
        }
    }
    return parts.join(" ")
}
export function countCitations(citations:Citation[]):{byPage:Map<number, number>, byLine:Map<number, number>, total:number}{
    let byPage=new Map<number, number>()
    let byLine=new Map<number, number>()
    let total=0
    for(let c of citations){
        total++
        if(c.page!==undefined){
            byPage.set(c.page, (byPage.get(c.page)||0)+1)
        }
        if(c.line!==undefined){
            byLine.set(c.line, (byLine.get(c.line)||0)+1)
        }
    }
    return{byPage, byLine, total}
}
