export interface UpdateInfo{
    version: string;
    releaseDate: string;
    downloadUrl?: string;
    releaseNotes?: string;
    mandatory?: boolean;
}
export interface UpdateNotifierStorage{
    getItem(key: string): string|null;
    setItem(key: string, value: string): void;
}
export interface UpdateNotifierOptions{
    currentVersion: string;
    updateUrl: string;
    checkIntervalMs?: number;
    storage?: UpdateNotifierStorage;
    fetch?: typeof fetch;
}
const DEFAULT_CHECK_INTERVAL_MS=24*60*60*1000;
const SKIP_VERSION_KEY="updateNotifier_skipVersion";
const SNOOZE_UNTIL_KEY="updateNotifier_snoozeUntil";
const LAST_CHECK_KEY="updateNotifier_lastCheck";
export function compareSemver(a: string, b: string): number{
    let partsA=a.replace(/^v/, "").split(".").map(Number);
    let partsB=b.replace(/^v/, "").split(".").map(Number);
    let len=Math.max(partsA.length, partsB.length);
    for(let i=0;i<len;i++){
        let numA=partsA[i]??0;
        let numB=partsB[i]??0;
        if(numA>numB){
            return 1;
        }
        if(numA<numB){
            return -1;
        }
    }
    return 0;
}
export function parseReleaseJson(json: unknown): UpdateInfo{
    if(typeof json!=="object"||json===null){
        throw new Error("Invalid release JSON");
    }
    let obj=json as Record<string, unknown>;
    let version: string|undefined;
    if(typeof obj.version==="string"&&obj.version!==""){
        version=obj.version;
    }
    else if(typeof obj.tag_name==="string"&&obj.tag_name!==""){
        version=obj.tag_name;
    }
    if(version===undefined){
        throw new Error("Missing or invalid version");
    }
    let releaseDate: string|undefined;
    if(typeof obj.releaseDate==="string"&&obj.releaseDate!==""){
        releaseDate=obj.releaseDate;
    }
    else if(typeof obj.published_at==="string"&&obj.published_at!==""){
        releaseDate=obj.published_at;
    }
    if(releaseDate===undefined){
        throw new Error("Missing or invalid releaseDate");
    }
    let info: UpdateInfo={
        version: version,
        releaseDate: releaseDate
    };
    if(obj.downloadUrl!==undefined){
        if(typeof obj.downloadUrl!=="string"){
            throw new Error("Invalid downloadUrl");
        }
        info.downloadUrl=obj.downloadUrl;
    }
    if(obj.releaseNotes!==undefined){
        if(typeof obj.releaseNotes!=="string"){
            throw new Error("Invalid releaseNotes");
        }
        info.releaseNotes=obj.releaseNotes;
    }
    else if(typeof obj.body==="string"){
        info.releaseNotes=obj.body;
    }
    if(obj.mandatory!==undefined){
        if(typeof obj.mandatory!=="boolean"){
            throw new Error("Invalid mandatory");
        }
        info.mandatory=obj.mandatory;
    }
    if(!info.downloadUrl&&Array.isArray(obj.assets)){
        for(let asset of obj.assets){
            if(typeof asset==="object"&&asset!==null){
                let record=asset as Record<string, unknown>;
                if(typeof record.browser_download_url==="string"){
                    info.downloadUrl=record.browser_download_url;
                    break;
                }
            }
        }
    }
    return info;
}
export class UpdateNotifier{
    private currentVersion: string;
    private updateUrl: string;
    private checkIntervalMs: number;
    private storage: UpdateNotifierStorage;
    private fetchFn: typeof fetch;
    private lastCheck: number;
    constructor(options: UpdateNotifierOptions){
        this.currentVersion=options.currentVersion;
        this.updateUrl=options.updateUrl;
        this.checkIntervalMs=options.checkIntervalMs??DEFAULT_CHECK_INTERVAL_MS;
        this.storage=options.storage??{
            getItem: ()=>null,
            setItem: ()=>{}
        };
        this.fetchFn=options.fetch??fetch;
        let stored=this.storage.getItem(LAST_CHECK_KEY);
        let parsed=stored!==null?Number(stored):0;
        this.lastCheck=!isNaN(parsed)&&parsed>0?parsed:0;
    }
    async check(): Promise<UpdateInfo|undefined>{
        if (this.lastCheck>0 && Date.now()-this.lastCheck<this.checkIntervalMs){
            return undefined;
        }
        let response: Response;
        try{
            response=await this.fetchFn(this.updateUrl, {
                headers: {"Accept": "application/json"}
            });
        }
        catch(error){
            return undefined;
        }
        if(!response.ok){
            return undefined;
        }
        let json: unknown;
        let info: UpdateInfo;
        try{
            json=await response.json();
            info=parseReleaseJson(json);
        }
        catch(error){
            return undefined;
        }
        this.lastCheck=Date.now();
        this.storage.setItem(LAST_CHECK_KEY, String(this.lastCheck));
        if(this.isNewer(info.version)){
            return info;
        }
        return undefined;
    }
    isNewer(latest: string): boolean{
        return compareSemver(latest, this.currentVersion)>0;
    }
    shouldNotify(info: UpdateInfo): boolean{
        if(info.mandatory){
            return true;
        }
        let skipVersion=this.storage.getItem(SKIP_VERSION_KEY);
        if(skipVersion===info.version){
            return false;
        }
        let snoozeUntilStr=this.storage.getItem(SNOOZE_UNTIL_KEY);
        if(snoozeUntilStr){
            let snoozeUntil=Number(snoozeUntilStr);
            if(!isNaN(snoozeUntil)&&Date.now()<snoozeUntil){
                return false;
            }
        }
        return true;
    }
    skipVersion(version: string): void{
        this.storage.setItem(SKIP_VERSION_KEY, version);
    }
    snooze(until: number): void{
        this.storage.setItem(SNOOZE_UNTIL_KEY, String(until));
    }
    async downloadUpdate(info: UpdateInfo, progress?: (pct: number)=>void): Promise<Buffer>{
        if(!info.downloadUrl){
            throw new Error("No downloadUrl available");
        }
        let response=await this.fetchFn(info.downloadUrl);
        if(!response.ok){
            throw new Error("Download failed: "+response.status);
        }
        let contentLengthStr=response.headers.get("content-length");
        let total=contentLengthStr?Number(contentLengthStr):0;
        if(response.body&&progress&&total>0){
            let reader=response.body.getReader();
            let chunks: Uint8Array[]=[];
            let received=0;
            while(true){
                let {done, value}=await reader.read();
                if(done){
                    break;
                }
                if(!value){
                    continue;
                }
                chunks.push(value);
                received+=value.length;
                progress(Math.round((received/total)*100));
            }
            let all=new Uint8Array(received);
            let offset=0;
            for(let chunk of chunks){
                all.set(chunk, offset);
                offset+=chunk.length;
            }
            return Buffer.from(all.buffer);
        }
        let arrayBuffer=await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    getLastCheck(): number{
        return this.lastCheck;
    }
}
