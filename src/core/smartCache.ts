export interface CacheEntry{
    key: string;
    value: unknown;
    size: number;
    createdAt: number;
    lastAccessed: number;
    accessCount: number;
}
interface StoredEntry extends CacheEntry{
    buffer: Buffer;
    compressed: boolean;
}
export interface SmartCacheOptions{
    maxEntries?: number;
    maxSizeBytes?: number;
    maxAgeMs?: number;
    compress?: boolean;
}
const ZSTD_MAGIC=Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
export function computeEvictionScore(entry: CacheEntry, now: number): number{
    let age=now-entry.createdAt;
    let idle=now-entry.lastAccessed;
    return age+entry.size+idle;
}
export async function compressData(data: unknown): Promise<{buffer: Buffer; compressed: boolean}>{
    let json=JSON.stringify(data);
    let raw=Buffer.from(json, "utf-8");
    try{
        let zstd=await import("@mongodb-js/zstd");
        let compressed=await zstd.compress(raw, 3);
        return {buffer: compressed, compressed: true};
    }
    catch{
        return {buffer: raw, compressed: false};
    }
}
export async function decompressData(buffer: Buffer): Promise<unknown>{
    if(buffer.length>=4&&buffer[0]===0x28&&buffer[1]===0xb5&&buffer[2]===0x2f&&buffer[3]===0xfd){
        try{
            let zstd=await import("@mongodb-js/zstd");
            let decompressed=await zstd.decompress(buffer);
            return JSON.parse(decompressed.toString("utf-8"));
        }
        catch{
            return JSON.parse(buffer.toString("utf-8"));
        }
    }
    return JSON.parse(buffer.toString("utf-8"));
}
export class SmartCache{
    private entries: Map<string, StoredEntry>;
    private maxEntries: number;
    private maxSizeBytes: number;
    private maxAgeMs: number;
    private compress: boolean;
    private totalSize: number;
    private hitCount: number;
    private missCount: number;
    private evictionCount: number;
    constructor(options: SmartCacheOptions={}){
        this.entries=new Map();
        this.maxEntries=options.maxEntries??0;
        this.maxSizeBytes=options.maxSizeBytes??0;
        this.maxAgeMs=options.maxAgeMs??0;
        this.compress=options.compress??false;
        this.totalSize=0;
        this.hitCount=0;
        this.missCount=0;
        this.evictionCount=0;
    }
    async get(key: string): Promise<unknown|undefined>{
        let entry=this.entries.get(key);
        if(!entry){
            this.missCount++;
            return undefined;
        }
        let now=Date.now();
        if(this.maxAgeMs>0&&now-entry.createdAt>this.maxAgeMs){
            this.entries.delete(key);
            this.totalSize-=entry.size;
            this.evictionCount++;
            this.missCount++;
            return undefined;
        }
        let value=await decompressData(entry.buffer);
        entry.lastAccessed=now;
        entry.accessCount++;
        this.hitCount++;
        return value;
    }
    async set(key: string, value: unknown): Promise<void>{
        let {buffer, compressed}=this.compress?await compressData(value):{buffer: Buffer.from(JSON.stringify(value)), compressed: false};
        let size=buffer.length;
        let existing=this.entries.get(key);
        if(existing){
            this.totalSize-=existing.size;
        }
        let entry: StoredEntry={
            key: key,
            value: undefined,
            size: size,
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 0,
            buffer: buffer,
            compressed: compressed
        };
        this.entries.set(key, entry);
        this.totalSize+=size;
        await this.compact();
    }
    async delete(key: string): Promise<boolean>{
        let existing=this.entries.get(key);
        if(!existing){
            return false;
        }
        this.entries.delete(key);
        this.totalSize-=existing.size;
        return true;
    }
    async clear(): Promise<void>{
        this.entries.clear();
        this.totalSize=0;
        this.hitCount=0;
        this.missCount=0;
        this.evictionCount=0;
    }
    async compact(): Promise<void>{
        let now=Date.now();
        if(this.maxAgeMs>0){
            for(let [key, entry] of this.entries){
                if(now-entry.createdAt>this.maxAgeMs){
                    this.entries.delete(key);
                    this.totalSize-=entry.size;
                    this.evictionCount++;
                }
            }
        }
        while((this.maxEntries>0&&this.entries.size>this.maxEntries)||
              (this.maxSizeBytes>0&&this.totalSize>this.maxSizeBytes)){
            let target: StoredEntry|null=null;
            let targetScore=-1;
            for(let entry of this.entries.values()){
                let score=computeEvictionScore(entry, now);
                if(score>targetScore){
                    targetScore=score;
                    target=entry;
                }
            }
            if(!target){
                break;
            }
            this.entries.delete(target.key);
            this.totalSize-=target.size;
            this.evictionCount++;
        }
    }
    getStats(): {entries: number; totalSize: number; hitCount: number; missCount: number; evictionCount: number}{
        return{
            entries: this.entries.size,
            totalSize: this.totalSize,
            hitCount: this.hitCount,
            missCount: this.missCount,
            evictionCount: this.evictionCount
        };
    }
}
