import fs from "fs";
import path from "path";
import readline from "readline";
import { HealthChecker } from "./healthChecker.js";
import { TrainingItem } from "../types/interfaces.js";
export interface DiagnosticsReport{
    generatedAt: number;
    appVersion: string;
    platform: string;
    health: object;
    logs: string[];
    settings: Record<string, unknown>;
    providerStatuses: object;
    itemSummary: object;
}
export interface DiagnosticsGeneratorOptions{
    appVersion: string;
    logPath?: string;
    userDataPath?: string;
    settingsProvider?: ()=>Record<string, unknown>;
    healthChecker?: HealthChecker;
    providerRegistry?: object;
}
export class DiagnosticsGenerator{
    private appVersion: string;
    private logPath?: string;
    private userDataPath?: string;
    private settingsProvider?: ()=>Record<string, unknown>;
    private healthChecker?: HealthChecker;
    private providerRegistry?: object;
    constructor(options: DiagnosticsGeneratorOptions){
        this.appVersion=options.appVersion;
        this.logPath=options.logPath;
        this.userDataPath=options.userDataPath;
        this.settingsProvider=options.settingsProvider;
        this.healthChecker=options.healthChecker;
        this.providerRegistry=options.providerRegistry;
    }
    async generate(sampleItems?: TrainingItem[]): Promise<DiagnosticsReport>{
        let settings: Record<string, unknown>={};
        if (this.settingsProvider){
            try{
                settings=this.settingsProvider();
            }
            catch{
                settings={error: "settings collection failed"};
            }
        }
        let health: object={};
        if (this.healthChecker){
            try{
                health=await this.healthChecker.getStatus();
            }
            catch{
                health={error: "health check failed"};
            }
        }
        let providerStatuses: object={};
        if (this.providerRegistry){
            providerStatuses=this.scrubSecrets(this.providerRegistry) as object;
        }
        let logs: string[]=[];
        if (this.logPath){
            logs=await collectLogs(this.logPath, 500);
        }
        let itemSummary: object={};
        if (sampleItems){
            itemSummary=summarizeItems(sampleItems);
        }
        let report: DiagnosticsReport={
            generatedAt: Date.now(),
            appVersion: this.appVersion,
            platform: process.platform,
            health: this.scrubSecrets(health) as object,
            logs: logs,
            settings: this.scrubSecrets(settings) as Record<string, unknown>,
            providerStatuses: providerStatuses,
            itemSummary: itemSummary
        };
        return report;
    }
    async exportZip(outputPath: string): Promise<string>{
        let report=await this.generate();
        let json=JSON.stringify(report, null, 2);
        try{
            let admZipModule=await import("adm-zip");
            let AdmZip=(admZipModule as {default?: new()=>AdmZipLike}).default || (admZipModule as unknown as new()=>AdmZipLike);
            let zip=new AdmZip();
            zip.addFile("diagnostics/report.json", Buffer.from(json, "utf8"));
            let dir=path.dirname(outputPath);
            if (!fs.existsSync(dir)){
                fs.mkdirSync(dir, {recursive: true});
            }
            await new Promise<void>((resolve, reject)=>{
                zip.writeZip(outputPath, (err: Error|null)=>{
                    if (err){
                        reject(err);
                    }
                    else{
                        resolve();
                    }
                });
            });
            return outputPath;
        }
        catch{
            try{
                let archiverModule=await import("archiver");
                let archiverFn=(archiverModule as {default?: ArchiverFactory}).default || (archiverModule as unknown as ArchiverFactory);
                let dir=path.dirname(outputPath);
                if (!fs.existsSync(dir)){
                    fs.mkdirSync(dir, {recursive: true});
                }
                let archive=archiverFn("zip", {zlib: {level: 9}});
                await new Promise<void>((resolve, reject)=>{
                    let output=fs.createWriteStream(outputPath);
                    output.on("close", ()=>resolve());
                    output.on("error", (err: Error)=>reject(err));
                    archive.on("error", (err: Error)=>reject(err));
                    archive.pipe(output);
                    archive.append(Buffer.from(json, "utf8"), {name: "diagnostics/report.json"});
                    archive.finalize();
                });
                return outputPath;
            }
            catch{
                let fallback=outputPath.replace(/\.zip$/i, ".json");
                if (fallback===outputPath){
                    fallback=outputPath+".json";
                }
                let dir=path.dirname(fallback);
                if (!fs.existsSync(dir)){
                    fs.mkdirSync(dir, {recursive: true});
                }
                fs.writeFileSync(fallback, json, "utf8");
                return fallback;
            }
        }
    }
    scrubSecrets(obj: unknown): unknown{
        if (obj===null || obj===undefined){
            return obj;
        }
        if (typeof obj==="string" || typeof obj==="number" || typeof obj==="boolean"){
            return obj;
        }
        if (Array.isArray(obj)){
            return obj.map(item=>this.scrubSecrets(item));
        }
        if (typeof obj==="object"){
            let result: Record<string, unknown>={};
            for (let key of Object.keys(obj as Record<string, unknown>)){
                let value=(obj as Record<string, unknown>)[key];
                if (isSecretKey(key)){
                    result[key]="***SCRUBBED***";
                }
                else{
                    result[key]=this.scrubSecrets(value);
                }
            }
            return result;
        }
        return obj;
    }
}
function isSecretKey(key: string): boolean{
    let lower=key.toLowerCase();
    let patterns=["apikey", "api_key", "api-key", "secret", "token", "password", "auth", "privatekey", "private_key", "private-key", "credential", "credentials", "passphrase", "passwd", "pwd", "accesskey", "access_key", "access-key", "sessionid", "session_id", "session-id", "bearer"];
    for (let pattern of patterns){
        if (lower.includes(pattern)){
            return true;
        }
    }
    return false;
}
export async function collectLogs(logPath: string, maxLines: number): Promise<string[]>{
    try{
        if (typeof fs.createReadStream==="function"){
            return await new Promise<string[]>((resolve)=>{
                let lines: string[]=[];
                let stream=fs.createReadStream(logPath, {encoding: "utf8"});
                let rl=readline.createInterface({input: stream, crlfDelay: Infinity});
                rl.on("line", (line: string)=>{
                    lines.push(line);
                    if (lines.length>maxLines){
                        lines.shift();
                    }
                });
                rl.on("close", ()=>{
                    resolve(lines);
                });
                rl.on("error", ()=>{
                    resolve([]);
                });
                stream.on("error", ()=>{
                    resolve([]);
                });
            });
        }
        let content=await fs.promises.readFile(logPath, "utf8");
        let lines=content.split("\n");
        if (lines.length>0 && lines[lines.length-1]===""){
            lines.pop();
        }
        if (lines.length<=maxLines){
            return lines;
        }
        return lines.slice(lines.length-maxLines);
    }
    catch{
        return [];
    }
}
export function summarizeItems(items: TrainingItem[]): object{
    let total=items.length;
    let counts: Record<string, number>={};
    let lengthSum=0;
    let formatLengthSums: Record<string, number>={};
    let formatCounts: Record<string, number>={};
    for (let item of items){
        let format=item.format || "unknown";
        counts[format]=(counts[format] || 0)+1;
        formatCounts[format]=(formatCounts[format] || 0)+1;
        let len=computeItemLength(item);
        lengthSum+=len;
        formatLengthSums[format]=(formatLengthSums[format] || 0)+len;
    }
    let avgLength=total>0?lengthSum/total:0;
    let byFormat: Record<string, {count: number, avgLength: number}>={};
    for (let format of Object.keys(formatLengthSums)){
        let count=formatCounts[format] || 0;
        byFormat[format]={
            count: count,
            avgLength: count>0?formatLengthSums[format]/count:0
        };
    }
    return {
        total: total,
        byFormat: counts,
        avgLength: avgLength,
        formatDetails: byFormat
    };
}
function computeItemLength(item: TrainingItem): number{
    let parts: string[]=[];
    if (item.instruction){
        parts.push(item.instruction);
    }
    if (item.input){
        parts.push(item.input);
    }
    if (item.output){
        parts.push(item.output);
    }
    if (item.text){
        parts.push(item.text);
    }
    if (item.messages){
        for (let msg of item.messages){
            parts.push(msg.role);
            parts.push(msg.content);
        }
    }
    return parts.join("").length;
}
interface AdmZipLike{
    addFile(entryName: string, data: Buffer, comment?: string): void;
    writeZip(targetFileName: string, callback?: (err: Error|null)=>void): void;
}
interface Archiver{
    on(event: string, listener: (err: Error)=>void): Archiver;
    pipe(destination: NodeJS.WritableStream): void;
    append(source: Buffer, options: {name: string}): void;
    finalize(): void;
}
interface ArchiverFactory{
    (format: string, options?: Record<string, unknown>): Archiver;
}
