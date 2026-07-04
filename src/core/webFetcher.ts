import {convert}from"html-to-text";
import axios from"axios";
export interface FetchOptions{
    url: string
    timeoutMs?: number
    userAgent?: string
    maxRedirects?: number
    sanitizeHtml?: boolean
}
export interface FetchResult{
    url: string
    finalUrl: string
    content: string
    title?: string
    contentType: string
    status: number
    bytes: number
    fetchedAt: number
}
export const DEFAULT_FETCH_OPTIONS={
    timeoutMs: 30000,
    userAgent: "TrainingGenerator/2.0",
    maxRedirects: 5,
    sanitizeHtml: true
};
export function sanitizeHtml(html: string): string{
    let result=html;
    let tags: string[]=["script", "style", "noscript", "iframe", "nav", "footer", "header", "aside"];
    for(let tag of tags){
        let regex=new RegExp("<"+tag+"\\b[^>]*>[\\s\\S]*?</"+tag+"\\s*>", "gi");
        result=result.replace(regex, "");
    }
    result=result.replace(/<!--[\s\S]*?-->/g, "");
    result=result.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");
    result=result.replace(/javascript:[^\s"'<>]*/gi, "");
    return result;
}
export function extractTitle(html: string): string|undefined{
    let match=html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
    if(!match){
        return undefined;
    }
    let title=match[1].trim();
    if(title===""){
        return undefined;
    }
    return title;
}
export function extractMainContent(html: string): string{
    let mainMatch=html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i);
    if(mainMatch){
        return convertToText(mainMatch[1]);
    }
    let articleMatch=html.match(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i);
    if(articleMatch){
        return convertToText(articleMatch[1]);
    }
    let roleMainMatch=html.match(/<div\b[^>]*role\s*=\s*("|')main\1[^>]*>([\s\S]*?)<\/div\s*>/i);
    if(roleMainMatch){
        return convertToText(roleMainMatch[2]);
    }
    let contentDivMatch=html.match(/<div\b[^>]*class\s*=\s*("|')[^"']*\bcontent\b[^"']*\1[^>]*>([\s\S]*?)<\/div\s*>/i);
    if(contentDivMatch){
        return convertToText(contentDivMatch[2]);
    }
    let bodyMatch=html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
    if(bodyMatch){
        return convertToText(bodyMatch[1]);
    }
    return convertToText(html);
}
function convertToText(html: string): string{
    return convert(html, {
        wordwrap: false,
        selectors: [
            {selector: "a", options: {ignoreHref: true}},
            {selector: "img", format: "skip"}
        ]
    });
}
export function isValidUrl(url: string): boolean{
    try{
        let parsed=new URL(url);
        return parsed.protocol==="http:"||parsed.protocol==="https:";
    }
    catch{
        return false;
    }
}
export async function fetchUrl(options: FetchOptions): Promise<FetchResult>{
    if(!isValidUrl(options.url)){
        throw new Error("Invalid URL: "+options.url);
    }
    let timeoutMs=options.timeoutMs??DEFAULT_FETCH_OPTIONS.timeoutMs;
    let userAgent=options.userAgent??DEFAULT_FETCH_OPTIONS.userAgent;
    let maxRedirects=options.maxRedirects??DEFAULT_FETCH_OPTIONS.maxRedirects;
    let sanitize=options.sanitizeHtml??DEFAULT_FETCH_OPTIONS.sanitizeHtml;
    let response: any;
    try{
        response=await axios.get(options.url, {
            timeout: timeoutMs,
            maxRedirects: maxRedirects,
            headers: {"User-Agent": userAgent},
            responseType: "text"
        });
    }
    catch(error){
        let errAny=error as any;
        if(errAny&&errAny.response&&errAny.response.status){
            throw new Error("HTTP error "+errAny.response.status+" for "+options.url);
        }
        let message=error instanceof Error?error.message:String(error);
        throw new Error("Network error fetching "+options.url+": "+message);
    }
    let status=response.status;
    if(status<200||status>=300){
        throw new Error("HTTP error "+status+" for "+options.url);
    }
    let contentType=response.headers?.["content-type"]||response.headers?.["Content-Type"]||"";
    if(!contentType.startsWith("text/html")&&!contentType.startsWith("text/plain")){
        throw new Error("Unsupported content type: "+contentType);
    }
    let rawData=response.data;
    let rawHtml=typeof rawData==="string"?rawData:String(rawData);
    let html=sanitize?sanitizeHtml(rawHtml):rawHtml;
    let title=extractTitle(html);
    let content=extractMainContent(html);
    let finalUrl: string=response.request?.res?.responseUrl||options.url;
    let bytes=typeof rawData==="string"?rawData.length:0;
    return{
        url: options.url,
        finalUrl: finalUrl,
        content: content,
        title: title,
        contentType: contentType,
        status: status,
        bytes: bytes,
        fetchedAt: Date.now()
    };
}
