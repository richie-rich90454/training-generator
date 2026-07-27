import fs from "fs/promises";
import path from "path";
export interface ProxyConfig{
    protocol: "http"|"https"|"socks5"|"socks5h"
    host: string
    port: number
    username?: string
    password?: string
    noProxy?: string[]
}
export class ProxyManager{
    proxy: ProxyConfig|undefined;
    caCertDir: string|undefined;
    constructor(options: {proxy?: ProxyConfig; caCertDir?: string}){
        this.proxy=options.proxy;
        this.caCertDir=options.caCertDir;
    }
    async getAxiosProxyAgent(): Promise<any>{
        if(!this.proxy){
            return undefined;
        }
        let proxyUrl=formatProxyUrl(this.proxy);
        switch(this.proxy.protocol){
            case "http":{
                let moduleName="http-proxy-agent";
                let mod: any=await import(moduleName);
                let Agent=mod.HttpProxyAgent;
                if(!Agent){
                    throw new Error("http-proxy-agent is not installed");
                }
                return new Agent(proxyUrl);
            }
            case "https":{
                let moduleName="https-proxy-agent";
                let mod: any=await import(moduleName);
                let Agent=mod.HttpsProxyAgent;
                if(!Agent){
                    throw new Error("https-proxy-agent is not installed");
                }
                return new Agent(proxyUrl);
            }
            case "socks5":
            case "socks5h":{
                let moduleName="socks-proxy-agent";
                let mod: any=await import(moduleName);
                let Agent=mod.SocksProxyAgent;
                if(!Agent){
                    throw new Error("socks-proxy-agent is not installed");
                }
                return new Agent(proxyUrl);
            }
            default:
                throw new Error("Unsupported proxy protocol: "+this.proxy.protocol);
        }
    }
    async loadCustomCaCerts(): Promise<string[]>{
        if(!this.caCertDir){
            return [];
        }
        let entries: string[];
        try{
            entries=await fs.readdir(this.caCertDir);
        }
        catch{
            return [];
        }
        let certs: string[]=[];
        for(let entry of entries){
            let ext=path.extname(entry).toLowerCase();
            if(ext===".pem"||ext===".crt"){
                let filePath=path.join(this.caCertDir, entry);
                let content=await fs.readFile(filePath, "utf-8");
                certs.push(content);
            }
        }
        return certs;
    }
    async buildRequestConfig(): Promise<{proxy?: false; httpAgent?: any; httpsAgent?: any; ca?: string[]}>{
        if(!this.proxy){
            return {};
        }
        let agent=await this.getAxiosProxyAgent();
        let ca=await this.loadCustomCaCerts();
        let config: {proxy?: false; httpAgent?: any; httpsAgent?: any; ca?: string[]}={proxy: false};
        if(this.proxy.protocol==="http"){
            config.httpAgent=agent;
        }
        else if(this.proxy.protocol==="https"){
            config.httpsAgent=agent;
        }
        else{
            config.httpAgent=agent;
            config.httpsAgent=agent;
        }
        if(ca.length>0){
            config.ca=ca;
        }
        return config;
    }
    isNoProxy(host: string): boolean{
        if(!this.proxy||!this.proxy.noProxy||this.proxy.noProxy.length===0){
            return false;
        }
        let target=host.toLowerCase().trim();
        for(let pattern of this.proxy.noProxy){
            let p=pattern.toLowerCase().trim();
            if(p==="*"||p===target){
                return true;
            }
            if(p.startsWith(".")){
                let domain=p.slice(1);
                if(target===domain||target.endsWith(p)){
                    return true;
                }
            }
            else{
                if(target===p||target.endsWith("."+p)){
                    return true;
                }
            }
        }
        return false;
    }
}
export function parseProxyUrl(url: string): ProxyConfig{
    let parsed: URL;
    try{
        parsed=new URL(url);
    }
    catch{
        throw new Error("Invalid proxy URL: "+url);
    }
    let protocol=parsed.protocol.replace(":", "") as "http"|"https"|"socks5"|"socks5h";
    if(protocol!=="http"&&protocol!=="https"&&protocol!=="socks5"&&protocol!=="socks5h"){
        throw new Error("Unsupported proxy protocol: "+protocol);
    }
    let host=parsed.hostname;
    if(!host){
        throw new Error("Proxy URL missing host: "+url);
    }
    let port=parsed.port?parseInt(parsed.port, 10):(protocol==="https"?443:(protocol==="http"?80:1080));
    let config: ProxyConfig={
        protocol: protocol,
        host: host,
        port: port
    };
    if(parsed.username){
        try{
            config.username=decodeURIComponent(parsed.username);
            config.password=parsed.password?decodeURIComponent(parsed.password):undefined;
        }
        catch{
            throw new Error("Invalid URL-encoded credentials in proxy URL: "+url);
        }
    }
    return config;
}
export function formatProxyUrl(config: ProxyConfig): string{
    if(!config.host){
        throw new Error("Proxy config missing host");
    }
    let auth="";
    if(config.username){
        if(config.password){
            auth=encodeURIComponent(config.username)+":"+encodeURIComponent(config.password)+"@";
        }
        else{
            auth=encodeURIComponent(config.username)+"@";
        }
    }
    return config.protocol+"://"+auth+config.host+":"+config.port;
}
