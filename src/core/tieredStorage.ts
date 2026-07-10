import {readFile, writeFile, unlink, mkdir} from "fs/promises";
import path from "path";
import {gzip as zlibGzip, gunzip as zlibGunzip} from "zlib";
export interface TieredStorageOptions{
    hotCapacity?: number;
    warmCapacity?: number;
    coldDir?: string;
    serializer?: (value: unknown)=>Buffer;
    deserializer?: (buffer: Buffer)=>unknown;
}
export interface TieredStorageStats{
    hot: number;
    warm: number;
    cold: number;
    promotions: number;
    demotions: number;
}
export class TieredStorage{
    private hotCapacity: number;
    private warmCapacity: number;
    private coldDir: string;
    private serializer: (value: unknown)=>Buffer;
    private deserializer: (buffer: Buffer)=>unknown;
    private hot: Map<string, unknown>;
    private warm: Map<string, unknown>;
    private coldKeys: Set<string>;
    private stats: TieredStorageStats;
    constructor(options: TieredStorageOptions={}){
        this.hotCapacity=options.hotCapacity??10;
        this.warmCapacity=options.warmCapacity??100;
        this.coldDir=options.coldDir??"cold-storage";
        this.serializer=options.serializer??defaultSerialize;
        this.deserializer=options.deserializer??defaultDeserialize;
        this.hot=new Map();
        this.warm=new Map();
        this.coldKeys=new Set();
        this.stats={
            hot: 0,
            warm: 0,
            cold: 0,
            promotions: 0,
            demotions: 0
        };
    }
    async get(key: string): Promise<unknown|undefined>{
        if (this.hot.has(key)){
            let value=this.hot.get(key);
            this._touchHot(key, value);
            return value;
        }
        if (this.warm.has(key)){
            let value=this.warm.get(key);
            this.warm.delete(key);
            this._touchHot(key, value);
            await this._enforceHotCapacity();
            this.stats.promotions++;
            this._updateCounts();
            return value;
        }
        if (this.coldKeys.has(key)){
            let filePath=this._coldPath(key);
            let compressed=await readFile(filePath);
            let buffer=await gunzipBuffer(compressed);
            let value=this.deserializer(buffer);
            await unlink(filePath);
            this.coldKeys.delete(key);
            this._touchHot(key, value);
            await this._enforceHotCapacity();
            this.stats.promotions++;
            this._updateCounts();
            return value;
        }
        return undefined;
    }
    async set(key: string, value: unknown): Promise<void>{
        if (this.hot.has(key)){
            this._touchHot(key, value);
            this._updateCounts();
            return;
        }
        if (this.warm.has(key)){
            this.warm.delete(key);
        }
        else if (this.coldKeys.has(key)){
            let filePath=this._coldPath(key);
            await unlink(filePath);
            this.coldKeys.delete(key);
        }
        this._touchHot(key, value);
        await this._enforceHotCapacity();
        this._updateCounts();
    }
    async delete(key: string): Promise<boolean>{
        let deleted=false;
        if (this.hot.has(key)){
            this.hot.delete(key);
            deleted=true;
        }
        if (this.warm.has(key)){
            this.warm.delete(key);
            deleted=true;
        }
        if (this.coldKeys.has(key)){
            let filePath=this._coldPath(key);
            await unlink(filePath);
            this.coldKeys.delete(key);
            deleted=true;
        }
        this._updateCounts();
        return deleted;
    }
    async clear(): Promise<void>{
        this.hot.clear();
        this.warm.clear();
        for (let key of this.coldKeys){
            let filePath=this._coldPath(key);
            await unlink(filePath);
        }
        this.coldKeys.clear();
        this.stats.hot=0;
        this.stats.warm=0;
        this.stats.cold=0;
        this.stats.promotions=0;
        this.stats.demotions=0;
    }
    getStats(): TieredStorageStats{
        return {
            hot: this.stats.hot,
            warm: this.stats.warm,
            cold: this.stats.cold,
            promotions: this.stats.promotions,
            demotions: this.stats.demotions
        };
    }
    private _touchHot(key: string, value: unknown): void{
        this.hot.delete(key);
        this.hot.set(key, value);
    }
    private async _enforceHotCapacity(): Promise<void>{
        while (this.hot.size>this.hotCapacity){
            await this._demoteHot();
        }
    }
    private async _demoteHot(): Promise<void>{
        let first=this.hot.keys().next().value;
        if (first===undefined){
            return;
        }
        let value=this.hot.get(first);
        this.hot.delete(first);
        this.warm.set(first, value);
        this.stats.demotions++;
        while (this.warm.size>this.warmCapacity){
            await this._demoteWarm();
        }
    }
    private async _demoteWarm(): Promise<void>{
        let first=this.warm.keys().next().value;
        if (first===undefined){
            return;
        }
        let value=this.warm.get(first);
        this.warm.delete(first);
        await this._ensureColdDir();
        let filePath=this._coldPath(first);
        let buffer=this.serializer(value);
        let compressed=await gzipBuffer(buffer);
        await writeFile(filePath, compressed);
        this.coldKeys.add(first);
        this.stats.demotions++;
    }
    private async _ensureColdDir(): Promise<void>{
        await mkdir(this.coldDir, {recursive: true});
    }
    private _coldPath(key: string): string{
        return path.join(this.coldDir, key+".gz");
    }
    private _updateCounts(): void{
        this.stats.hot=this.hot.size;
        this.stats.warm=this.warm.size;
        this.stats.cold=this.coldKeys.size;
    }
}
function defaultSerialize(value: unknown): Buffer{
    return Buffer.from(JSON.stringify(value), "utf-8");
}
function defaultDeserialize(buffer: Buffer): unknown{
    try{
        return JSON.parse(buffer.toString("utf-8"));
    }
    catch{
        return null;
    }
}
function gzipBuffer(buffer: Buffer): Promise<Buffer>{
    return new Promise((resolve, reject)=>{
        zlibGzip(buffer, (err, result)=>{
            if (err){
                reject(err);
            }
            else{
                resolve(result);
            }
        });
    });
}
function gunzipBuffer(buffer: Buffer): Promise<Buffer>{
    return new Promise((resolve, reject)=>{
        zlibGunzip(buffer, (err, result)=>{
            if (err){
                reject(err);
            }
            else{
                resolve(result);
            }
        });
    });
}
