import type{Citation}from"../types/interfaces.js"
export const CITATION_PROMPT_INSTRUCTION=`When generating answers, cite sources using bracketed references. Use [page N] for page numbers (e.g. [page 12], [p.7]), [line N] for line numbers (e.g. [line 45], [L 23], [L23]), [url URL] for web sources (e.g. [url https://example.com]), [doi DOI] for DOIs (e.g. [doi 10.1234/example]), and [isbn ISBN] for books (e.g. [isbn 978-3-16-148410-0]). Place citations immediately after the cited claim.`
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
    static parseUrl(text:string):ParsedCitation[]{
        let results:ParsedCitation[]=[]
        let regex=/\[(?:url|URL)\s+(https?:\/\/[^\s\]]+)\]/g
        let match:RegExpExecArray|null
        while((match=regex.exec(text))!==null){
            results.push({
                citation:{url:match[1], text:match[0]},
                start:match.index,
                end:match.index+match[0].length
            })
        }
        return results
    }
    static parseDOI(text:string):ParsedCitation[]{
        let results:ParsedCitation[]=[]
        let regex=/\[(?:doi|DOI)\s+(10\.\d{4,}\/[^\s\]]+)\]/g
        let match:RegExpExecArray|null
        while((match=regex.exec(text))!==null){
            results.push({
                citation:{doi:match[1], text:match[0]},
                start:match.index,
                end:match.index+match[0].length
            })
        }
        return results
    }
    static parseISBN(text:string):ParsedCitation[]{
        let results:ParsedCitation[]=[]
        let regex=/\[(?:isbn|ISBN)\s+([\d-]{10,17})\]/g
        let match:RegExpExecArray|null
        while((match=regex.exec(text))!==null){
            results.push({
                citation:{isbn:match[1], text:match[0]},
                start:match.index,
                end:match.index+match[0].length
            })
        }
        return results
    }
    static parseAll(text:string):Citation[]{
        let pageResults=CitationParser.parsePage(text)
        let lineResults=CitationParser.parseLine(text)
        let urlResults=CitationParser.parseUrl(text)
        let doiResults=CitationParser.parseDOI(text)
        let isbnResults=CitationParser.parseISBN(text)
        let all:{citation:Citation, start:number}[]=[]
        for(let p of pageResults){
            all.push({citation:p.citation, start:p.start})
        }
        for(let l of lineResults){
            all.push({citation:l.citation, start:l.start})
        }
        for(let u of urlResults){
            all.push({citation:u.citation, start:u.start})
        }
        for(let d of doiResults){
            all.push({citation:d.citation, start:d.start})
        }
        for(let i of isbnResults){
            all.push({citation:i.citation, start:i.start})
        }
        all.sort((a, b)=>a.start-b.start)
        let seen=new Set<string>()
        let result:Citation[]=[]
        for(let item of all){
            let key=`${item.citation.page??""}|${item.citation.line??""}|${item.citation.url??""}|${item.citation.doi??""}|${item.citation.isbn??""}|${item.citation.text}`
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
    let urlResults=CitationParser.parseUrl(text)
    let doiResults=CitationParser.parseDOI(text)
    let isbnResults=CitationParser.parseISBN(text)
    let spans:{start:number, end:number}[]=[]
    for(let p of pageResults){
        spans.push({start:p.start, end:p.end})
    }
    for(let l of lineResults){
        spans.push({start:l.start, end:l.end})
    }
    for(let u of urlResults){
        spans.push({start:u.start, end:u.end})
    }
    for(let d of doiResults){
        spans.push({start:d.start, end:d.end})
    }
    for(let i of isbnResults){
        spans.push({start:i.start, end:i.end})
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
export function validateCitations(citations:Citation[], sourceSpans:{page?:number, line?:number, url?:string, doi?:string, isbn?:string}[]):{valid:Citation[], invalid:Citation[]}{
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
            else if(c.url!==undefined){
                if(s.url===c.url){
                    matched=true
                    break
                }
            }
            else if(c.doi!==undefined){
                if(s.doi===c.doi){
                    matched=true
                    break
                }
            }
            else if(c.isbn!==undefined){
                if(s.isbn===c.isbn){
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
        else if(c.url!==undefined){
            parts.push(`[url ${c.url}]`)
        }
        else if(c.doi!==undefined){
            parts.push(`[doi ${c.doi}]`)
        }
        else if(c.isbn!==undefined){
            parts.push(`[isbn ${c.isbn}]`)
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
