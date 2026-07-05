import {spawn} from "child_process";
export interface VaultProvider{
    name: string
    get(secretPath: string): Promise<string>
}
function spawnForOutput(executable: string, args: string[]): Promise<string>{
    return new Promise((resolve, reject)=>{
        let stdout="";
        let stderr="";
        let proc=spawn(executable, args);
        proc.stdout.on("data", (data: Buffer)=>{
            stdout+=data.toString();
        });
        proc.stderr.on("data", (data: Buffer)=>{
            stderr+=data.toString();
        });
        proc.on("close", (code: number|null)=>{
            if(code===0){
                resolve(stdout.trim());
            }
            else{
                reject(new Error(executable + " exited with code " + String(code) + ": " + stderr.trim()));
            }
        });
        proc.on("error", (err: Error)=>{
            reject(new Error(executable + " CLI not installed"));
        });
    });
}
export class OnePasswordCliVault implements VaultProvider{
    name="1password";
    account: string|undefined;
    vault: string|undefined;
    executable: string;
    constructor(options: {account?: string; vault?: string; executable?: string}){
        this.account=options.account;
        this.vault=options.vault;
        this.executable=options.executable??"op";
    }
    async get(secretPath: string): Promise<string>{
        let uri=this.vault?this.vault + "/" + secretPath:secretPath;
        let args: string[]=["read", "op://" + uri];
        if(this.account){
            args.push("--account", this.account);
        }
        try{
            return await spawnForOutput(this.executable, args);
        }
        catch(err){
            let message=err instanceof Error?err.message:String(err);
            if(message.includes(this.executable + " CLI not installed")){
                throw new Error("1password CLI not installed");
            }
            throw err;
        }
    }
}
export class BitwardenCliVault implements VaultProvider{
    name="bitwarden";
    executable: string;
    constructor(options: {executable?: string}){
        this.executable=options.executable??"bw";
    }
    async get(secretPath: string): Promise<string>{
        let args: string[]=["get", "password", secretPath];
        try{
            return await spawnForOutput(this.executable, args);
        }
        catch(err){
            let message=err instanceof Error?err.message:String(err);
            if(message.includes(this.executable + " CLI not installed")){
                throw new Error("bitwarden CLI not installed");
            }
            throw err;
        }
    }
}
export function parseVaultRef(ref: string): {provider: string; path: string}{
    let match=ref.match(/^vault:\/\/([^/]+)\/(.*)$/);
    if(!match){
        throw new Error("invalid vault reference: " + ref);
    }
    return {provider: match[1], path: match[2]};
}
export class VaultResolver{
    providers: Record<string, VaultProvider>;
    constructor(options: {providers: Record<string, VaultProvider>}){
        this.providers=options.providers;
    }
    async resolveValue(value: string): Promise<string>{
        if(!value.startsWith("vault://")){
            return value;
        }
        let ref=parseVaultRef(value);
        let provider=this.providers[ref.provider];
        if(!provider){
            throw new Error("unknown vault provider: " + ref.provider);
        }
        return provider.get(ref.path);
    }
    async resolveObject(obj: Record<string, unknown>): Promise<Record<string, unknown>>{
        let result: Record<string, unknown>={};
        for(let key of Object.keys(obj)){
            let value=obj[key];
            if(typeof value==="string"){
                result[key]=await this.resolveValue(value);
            }
            else if(value!==null && typeof value==="object"){
                if(Array.isArray(value)){
                    result[key]=await this.resolveArray(value);
                }
                else{
                    result[key]=await this.resolveObject(value as Record<string, unknown>);
                }
            }
            else{
                result[key]=value;
            }
        }
        return result;
    }
    private async resolveArray(arr: unknown[]): Promise<unknown[]>{
        let result: unknown[]=[];
        for(let item of arr){
            if(typeof item==="string"){
                result.push(await this.resolveValue(item));
            }
            else if(item!==null && typeof item==="object"){
                if(Array.isArray(item)){
                    result.push(await this.resolveArray(item));
                }
                else{
                    result.push(await this.resolveObject(item as Record<string, unknown>));
                }
            }
            else{
                result.push(item);
            }
        }
        return result;
    }
}
