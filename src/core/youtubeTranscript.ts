import axios from"axios";
export interface TranscriptSegment{
    startMs: number
    durationMs: number
    text: string
}
export interface YouTubeTranscript{
    videoId: string
    language: string
    segments: TranscriptSegment[]
    fetchedAt: number
}
export function extractVideoId(url: string): string|null{
    if(!url||typeof url!=="string"){
        return null;
    }
    let parsed: URL;
    try{
        if(!/^https?:\/\//i.test(url)){
            parsed=new URL("https://"+url);
        }
        else{
            parsed=new URL(url);
        }
    }
    catch{
        return null;
    }
    let host=parsed.hostname.toLowerCase();
    let idRegex=/^[A-Za-z0-9_-]{11}$/;
    if(host==="youtube.com"||host==="www.youtube.com"||host==="m.youtube.com"){
        if(parsed.pathname==="/watch"){
            let v=parsed.searchParams.get("v");
            if(v&&idRegex.test(v)){
                return v;
            }
        }
        else if(parsed.pathname.startsWith("/embed/")){
            let id=parsed.pathname.slice("/embed/".length).split("/")[0];
            if(idRegex.test(id)){
                return id;
            }
        }
        else if(parsed.pathname.startsWith("/shorts/")){
            let id=parsed.pathname.slice("/shorts/".length).split("/")[0];
            if(idRegex.test(id)){
                return id;
            }
        }
    }
    else if(host==="youtu.be"){
        let id=parsed.pathname.slice(1).split("/")[0];
        if(idRegex.test(id)){
            return id;
        }
    }
    return null;
}
export function decodeHtmlEntities(text: string): string{
    let result=text;
    result=result.replace(/&lt;/g, "<");
    result=result.replace(/&gt;/g, ">");
    result=result.replace(/&quot;/g, '"');
    result=result.replace(/&#39;/g, "'");
    result=result.replace(/&apos;/g, "'");
    result=result.replace(/&#(\d+);/g, (_, code)=>String.fromCharCode(parseInt(code, 10)));
    result=result.replace(/&amp;/g, "&");
    return result;
}
export function parseTranscriptXml(xml: string): TranscriptSegment[]{
    let segments: TranscriptSegment[]=[];
    let regex=/<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
    let match: RegExpExecArray|null;
    while((match=regex.exec(xml))!==null){
        let startStr=match[1];
        let durStr=match[2];
        let rawText=match[3];
        let text=decodeHtmlEntities(rawText).trim();
        if(text===""){
            continue;
        }
        let startMs=Math.round(parseFloat(startStr)*1000);
        let durationMs=Math.round(parseFloat(durStr)*1000);
        segments.push({startMs: startMs, durationMs: durationMs, text: text});
    }
    return segments;
}
function extractPlayerResponse(html: string): any|null{
    let marker="ytInitialPlayerResponse";
    let idx=html.indexOf(marker);
    if(idx===-1){
        return null;
    }
    let rest=html.slice(idx+marker.length);
    let eqIdx=rest.indexOf("=");
    if(eqIdx===-1){
        return null;
    }
    rest=rest.slice(eqIdx+1);
    let i=0;
    while(i<rest.length&&/\s/.test(rest[i])){
        i++;
    }
    if(i>=rest.length||rest[i]!=="{"){
        return null;
    }
    let depth=0;
    let start=i;
    let inString=false;
    let escape=false;
    while(i<rest.length){
        let ch=rest[i];
        if(escape){
            escape=false;
            i++;
            continue;
        }
        if(ch==="\\"){
            escape=true;
            i++;
            continue;
        }
        if(ch==='"'){
            inString=!inString;
            i++;
            continue;
        }
        if(!inString){
            if(ch==="{"){
                depth++;
            }
            else if(ch==="}"){
                depth--;
                if(depth===0){
                    let jsonStr=rest.slice(start, i+1);
                    try{
                        return JSON.parse(jsonStr);
                    }
                    catch{
                        return null;
                    }
                }
            }
        }
        i++;
    }
    return null;
}
export async function listAvailableLanguages(videoId: string): Promise<string[]>{
    let url="https://www.youtube.com/watch?v="+videoId;
    let response: any;
    try{
        response=await axios.get(url, {
            headers: {"User-Agent": "Mozilla/5.0"},
            responseType: "text"
        });
    }
    catch(error){
        throw new Error("Failed to fetch YouTube page for "+videoId+": "+(error instanceof Error?error.message:String(error)));
    }
    let html=response.data;
    let playerResponse=extractPlayerResponse(html);
    if(!playerResponse){
        return [];
    }
    let tracks=playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if(!tracks||!Array.isArray(tracks)){
        return [];
    }
    let languages: string[]=[];
    for(let track of tracks){
        if(track.languageCode){
            languages.push(track.languageCode);
        }
    }
    return languages;
}
export async function fetchTranscript(videoId: string, options?: {language?: string, format?: "json"|"xml"}): Promise<YouTubeTranscript>{
    let language=options?.language??"en";
    let url="https://www.youtube.com/watch?v="+videoId;
    let response: any;
    try{
        response=await axios.get(url, {
            headers: {"User-Agent": "Mozilla/5.0"},
            responseType: "text"
        });
    }
    catch(error){
        throw new Error("Failed to fetch YouTube page for "+videoId+": "+(error instanceof Error?error.message:String(error)));
    }
    let html=response.data;
    let playerResponse=extractPlayerResponse(html);
    if(!playerResponse){
        throw new Error("No captions available for video");
    }
    let tracks=playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if(!tracks||!Array.isArray(tracks)||tracks.length===0){
        throw new Error("No captions available for video");
    }
    let selectedTrack: any=null;
    for(let track of tracks){
        if(track.languageCode===language){
            selectedTrack=track;
            break;
        }
    }
    if(!selectedTrack){
        selectedTrack=tracks[0];
    }
    let finalLanguage=selectedTrack.languageCode||language;
    let baseUrl=selectedTrack.baseUrl;
    if(!baseUrl){
        throw new Error("No captions available for video");
    }
    let captionResponse: any;
    try{
        captionResponse=await axios.get(baseUrl, {
            headers: {"User-Agent": "Mozilla/5.0"},
            responseType: "text"
        });
    }
    catch(error){
        throw new Error("Failed to fetch YouTube captions for "+videoId+": "+(error instanceof Error?error.message:String(error)));
    }
    let xml=captionResponse.data;
    let segments=parseTranscriptXml(xml);
    return{
        videoId: videoId,
        language: finalLanguage,
        segments: segments,
        fetchedAt: Date.now()
    };
}
export function formatTranscript(transcript: YouTubeTranscript, options?: {includeTimestamps?: boolean, separator?: string}): string{
    let includeTimestamps=options?.includeTimestamps??false;
    let separator=options?.separator??" ";
    let parts: string[]=[];
    for(let segment of transcript.segments){
        if(includeTimestamps){
            let totalSeconds=Math.floor(segment.startMs/1000);
            let minutes=Math.floor(totalSeconds/60);
            let seconds=totalSeconds%60;
            let timestamp="["+String(minutes).padStart(2, "0")+":"+String(seconds).padStart(2, "0")+"]";
            parts.push(timestamp+" "+segment.text);
        }
        else{
            parts.push(segment.text);
        }
    }
    return parts.join(separator);
}
