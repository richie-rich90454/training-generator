import type { TrainingItem } from "../types/index.ts";
export interface CliOptions{
    stdin?: boolean;
    stdout?: boolean;
    dryRun?: boolean;
    profile?: string;
    override?: Record<string, string>;
    configPath?: string;
    input?: string[];
    output?: string;
    format?: string;
    [key: string]: unknown;
}
export const CliExitCode={
    SUCCESS: 0,
    PARTIAL_FAILURE: 1,
    CONFIG_ERROR: 2,
    NETWORK_ERROR: 3,
    ABORT: 4
} as const;
interface CliRunnerDeps{
    stdin?: NodeJS.ReadableStream;
    stdout?: NodeJS.WritableStream;
    readFile?: (path: string)=>string;
    writeFile?: (path: string, content: string)=>void;
    processFn?: (args: CliOptions)=>Promise<{items: TrainingItem[], errors: string[]}>;
    exportFn?: (format: string, items: TrainingItem[])=>string;
}
export function readStdin(stream: NodeJS.ReadableStream): Promise<string>{
    return new Promise((resolve, reject)=>{
        let chunks: Buffer[]=[];
        stream.on("data", (chunk: Buffer|string)=>{
            chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
        });
        stream.on("end", ()=>{
            resolve(Buffer.concat(chunks).toString("utf-8"));
        });
        stream.on("error", (error: Error)=>{
            reject(error);
        });
    });
}
export function formatPlan(options: CliOptions): string{
    let parts: string[]=[];
    parts.push("Plan:");
    if (options.dryRun){
        parts.push("  mode: dry-run");
    }
    if (options.stdin){
        parts.push("  input: stdin");
    }
    else if (options.input&&options.input.length>0){
        parts.push("  input: "+options.input.join(", "));
    }
    if (options.stdout){
        parts.push("  output: stdout");
    }
    else if (options.output){
        parts.push("  output: "+options.output);
    }
    if (options.profile){
        parts.push("  profile: "+options.profile);
    }
    if (options.format){
        parts.push("  format: "+options.format);
    }
    if (options.override&&Object.keys(options.override).length>0){
        parts.push("  overrides:");
        for (let key of Object.keys(options.override)){
            parts.push("    "+key+"="+options.override[key]);
        }
    }
    return parts.join("\n");
}
function isNetworkError(message: string): boolean{
    let lower=message.toLowerCase();
    if (lower.startsWith("[network]"))return true;
    if (lower.includes("network error"))return true;
    if (lower.includes("econnrefused"))return true;
    if (lower.includes("etimedout"))return true;
    if (lower.includes("enotfound"))return true;
    if (lower.includes("socket hang up"))return true;
    if (lower.includes("fetch failed"))return true;
    return false;
}
function isAbortError(error: unknown): boolean{
    if (error&&typeof error==="object"){
        let err=error as {name?: string; message?: string};
        if (err.name==="AbortError")return true;
        if (err.message&&err.message.toLowerCase().includes("abort"))return true;
    }
    return false;
}
export class CliRunner{
    private stdin: NodeJS.ReadableStream;
    private stdout: NodeJS.WritableStream;
    private readFile: (path: string)=>string;
    private writeFile: (path: string, content: string)=>void;
    private processFn: (args: CliOptions)=>Promise<{items: TrainingItem[], errors: string[]}>;
    private exportFn: (format: string, items: TrainingItem[])=>string;
    constructor(deps: CliRunnerDeps={}){
        this.stdin=deps.stdin??process.stdin;
        this.stdout=deps.stdout??process.stdout;
        this.readFile=deps.readFile??((path: string)=>{
            throw new Error("readFile not implemented");
        });
        this.writeFile=deps.writeFile??((path: string, content: string)=>{
            throw new Error("writeFile not implemented");
        });
        this.processFn=deps.processFn??(async (args: CliOptions)=>{
            return {items: [], errors: []};
        });
        this.exportFn=deps.exportFn??((format: string, items: TrainingItem[])=>{
            return items.map(item=>JSON.stringify(item)).join("\n");
        });
    }
    parseArgs(argv: string[]): CliOptions{
        let options: CliOptions={};
        let i=0;
        while (i<argv.length){
            let arg=argv[i];
            let next=argv[i+1];
            if (arg==="--stdin"){
                options.stdin=true;
            }
            else if (arg==="--stdout"){
                options.stdout=true;
            }
            else if (arg==="--dry-run"){
                options.dryRun=true;
            }
            else if (arg==="--profile"){
                if (next){
                    options.profile=next;
                    i++;
                }
            }
            else if (arg==="--override"){
                if (next){
                    let eq=next.indexOf("=");
                    if (eq>=0){
                        let key=next.slice(0, eq);
                        let value=next.slice(eq+1);
                        if (!options.override){
                            options.override={};
                        }
                        options.override[key]=value;
                    }
                    i++;
                }
            }
            else if (arg==="--config"){
                if (next){
                    options.configPath=next;
                    i++;
                }
            }
            else if (arg==="--input"){
                if (next){
                    if (!options.input){
                        options.input=[];
                    }
                    options.input.push(next);
                    i++;
                }
            }
            else if (arg==="--output"){
                if (next){
                    options.output=next;
                    i++;
                }
            }
            else if (arg==="--format"){
                if (next){
                    options.format=next;
                    i++;
                }
            }
            i++;
        }
        return options;
    }
    loadProfile(name: string, configPath?: string): Partial<CliOptions>{
        if (!configPath){
            return {};
        }
        let content=this.readFile(configPath);
        let config: Record<string, unknown>;
        try{
            config=JSON.parse(content) as Record<string, unknown>;
        }
        catch{
            return {};
        }
        let profiles=config.profiles as Record<string, Partial<CliOptions>>|undefined;
        if (profiles&&profiles[name]){
            return profiles[name];
        }
        return {};
    }
    applyOverrides(options: CliOptions): CliOptions{
        let result: CliOptions={...options};
        if (!options.override){
            return result;
        }
        for (let key of Object.keys(options.override)){
            let value=options.override[key];
            let parts=key.split(".");
            let target: Record<string, unknown>=result;
            for (let j=0; j<parts.length-1; j++){
                let part=parts[j];
                if (!target[part]||typeof target[part]!=="object"){
                    target[part]={};
                }
                target=target[part] as Record<string, unknown>;
            }
            target[parts[parts.length-1]]=value;
        }
        return result;
    }
    async run(argv: string[]): Promise<number>{
        try {
            let options=this.parseArgs(argv);
            if (options.profile){
                let profileOptions=this.loadProfile(options.profile, options.configPath);
                options={...profileOptions, ...options};
            }
            options=this.applyOverrides(options);
            if (options.dryRun){
                this.stdout.write(formatPlan(options)+"\n");
                return CliExitCode.SUCCESS;
            }
            if (options.stdin){
                let content=await readStdin(this.stdin);
                let lines=content.split("\n").map(line=>line.trim()).filter(line=>line.length>0);
                if (lines.length>0){
                    if (!options.input){
                        options.input=[];
                    }
                    for (let line of lines){
                        options.input.push(line);
                    }
                }
            }
            let result=await this.processFn(options);
            if (result.items.length>0){
                if (options.stdout){
                    let jsonl=this.exportFn(options.format??"jsonl", result.items);
                    this.stdout.write(jsonl);
                    if (!jsonl.endsWith("\n")){
                        this.stdout.write("\n");
                    }
                }
                else if (options.output){
                    let content=this.exportFn(options.format??"jsonl", result.items);
                    this.writeFile(options.output, content);
                }
            }
            else if (options.stdout){
                this.stdout.write("\n");
            }
            if (result.errors.length>0){
                let networkCount=0;
                for (let error of result.errors){
                    if (isNetworkError(error)){
                        networkCount++;
                    }
                }
                if (networkCount>0&&networkCount===result.errors.length){
                    return CliExitCode.NETWORK_ERROR;
                }
                return CliExitCode.PARTIAL_FAILURE;
            }
            return CliExitCode.SUCCESS;
        }
        catch (error){
            if (isAbortError(error)){
                return CliExitCode.ABORT;
            }
            let msg=error&&typeof error==="object"&&(error as Error).message?(error as Error).message:"";
            if (isNetworkError(msg)){
                return CliExitCode.NETWORK_ERROR;
            }
            let code=(error&&typeof error==="object"&&(error as {code?: string}).code)?(error as {code?: string}).code:"";
            if (code==="ENOENT"||error instanceof SyntaxError||msg.includes("Unexpected token")||msg.includes("JSON parse")||msg.toLowerCase().includes("config")){
                return CliExitCode.CONFIG_ERROR;
            }
            return CliExitCode.ABORT;
        }
    }
}
