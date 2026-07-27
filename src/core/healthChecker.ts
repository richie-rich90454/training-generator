import fs from "fs";
export interface HealthCheck{
    name: string;
    status: "healthy"|"warning"|"critical";
    message: string;
    durationMs: number;
    metadata?: Record<string, unknown>;
}
export type HealthCheckFunction=()=>Promise<HealthCheck>|HealthCheck;
export interface HealthCheckerOptions{
    checks?: Record<string, HealthCheckFunction>;
}
export interface ProviderPing{
    name: string;
    url: string;
    options?: RequestInit;
}
function defaultGetFreeSpaceBytes(): number{
    let path=process.platform==="win32"?"C:\\":"/";
    let stats=(fs as unknown as {statfsSync: (path: string)=>{bavail: number, bsize: number}}).statfsSync(path);
    return stats.bavail*stats.bsize;
}
export class HealthChecker{
    private checks: Record<string, HealthCheckFunction>;
    constructor(options: HealthCheckerOptions={}){
        this.checks={...options.checks};
    }
    register(name: string, fn: HealthCheckFunction): void{
        this.checks[name]=fn;
    }
    async runAll(): Promise<HealthCheck[]>{
        let entries=Object.entries(this.checks);
        let results=await Promise.all(entries.map(async([name, fn])=>{
            let start=Date.now();
            try{
                let result=await fn();
                result.name=result.name||name;
                result.durationMs=Date.now()-start;
                return result;
            }
            catch(error){
                return {
                    name,
                    status: "critical",
                    message: `Check failed: ${(error as Error).message}`,
                    durationMs: Date.now()-start
                } as HealthCheck;
            }
        }));
        return results;
    }
    async getStatus(): Promise<{overall: "healthy"|"warning"|"critical", checks: HealthCheck[]}>{
        let checks=await this.runAll();
        let overall: "healthy"|"warning"|"critical"="healthy";
        for (let check of checks){
            if (check.status==="critical"){
                overall="critical";
                break;
            }
            if (check.status==="warning" && overall==="healthy"){
                overall="warning";
            }
        }
        return {overall, checks};
    }
    static async diskSpace(getFreeSpaceBytes?: ()=>Promise<number>|number): Promise<HealthCheck>{
        let start=Date.now();
        try{
            let freeBytes=await Promise.resolve(getFreeSpaceBytes?getFreeSpaceBytes():defaultGetFreeSpaceBytes());
            let oneGB=1024*1024*1024;
            let fiveHundredMB=512*1024*1024;
            let status: "healthy"|"warning"|"critical"="healthy";
            let message="Disk space OK";
            if (freeBytes<=fiveHundredMB){
                status="critical";
                message="Disk space critical";
            }
            else if (freeBytes<=oneGB){
                status="warning";
                message="Disk space low";
            }
            return {
                name: "diskSpace",
                status,
                message,
                durationMs: Date.now()-start,
                metadata: {freeBytes}
            };
        }
        catch(error){
            return {
                name: "diskSpace",
                status: "critical",
                message: `Disk check failed: ${(error as Error).message}`,
                durationMs: Date.now()-start
            };
        }
    }
    static async memory(getMemoryUsage?: ()=>{rss: number}): Promise<HealthCheck>{
        let start=Date.now();
        try{
            let usage=getMemoryUsage?getMemoryUsage():process.memoryUsage();
            let rss=usage.rss;
            let twoGB=2*1024*1024*1024;
            let status: "healthy"|"warning"|"critical"=rss<twoGB?"healthy":"warning";
            let message=rss<twoGB?"Memory usage OK":"Memory usage high";
            return {
                name: "memory",
                status,
                message,
                durationMs: Date.now()-start,
                metadata: {rss}
            };
        }
        catch(error){
            return {
                name: "memory",
                status: "critical",
                message: `Memory check failed: ${(error as Error).message}`,
                durationMs: Date.now()-start
            };
        }
    }
    static async providerConnectivity(options?: {providers?: ProviderPing[], fetch?: typeof fetch, timeoutMs?: number}): Promise<HealthCheck>{
        let start=Date.now();
        let providers=options?.providers??[];
        let fetchImpl=options?.fetch??fetch;
        let timeoutMs=options?.timeoutMs??5000;
        if (providers.length===0){
            return {
                name: "providerConnectivity",
                status: "healthy",
                message: "No providers configured",
                durationMs: Date.now()-start,
                metadata: {providersChecked: 0}
            };
        }
        let results=await Promise.allSettled(providers.map(async(ping)=>{
            let pingStart=Date.now();
            let controller=new AbortController();
            let timer=setTimeout(()=>controller.abort(), timeoutMs);
            try{
                let response=await fetchImpl(ping.url, {
                    ...ping.options,
                    signal: controller.signal,
                    method: ping.options?.method??"HEAD"
                });
                clearTimeout(timer);
                return {
                    name: ping.name,
                    ok: response.ok,
                    latencyMs: Date.now()-pingStart,
                    status: response.ok?"healthy":"warning"
                };
            }
            catch(error){
                clearTimeout(timer);
                return {
                    name: ping.name,
                    ok: false,
                    latencyMs: Date.now()-pingStart,
                    status: "critical",
                    error: (error as Error).message
                };
            }
        }));
        let summary=results.map(r=>r.status==="fulfilled"?r.value:{name: "unknown", ok: false, latencyMs: 0, status: "critical", error: "Ping promise rejected"});
        let okCount=summary.filter(r=>r.ok).length;
        let status: "healthy"|"warning"|"critical";
        if (okCount===summary.length){
            status="healthy";
        }
        else if (okCount===0){
            status="critical";
        }
        else{
            status="warning";
        }
        let message=status==="healthy"?"All providers reachable":status==="warning"?`${summary.length-okCount} of ${summary.length} providers unreachable`:"All providers unreachable";
        return {
            name: "providerConnectivity",
            status,
            message,
            durationMs: Date.now()-start,
            metadata: {providersChecked: summary.length, reachable: okCount, details: summary}
        };
    }
}
export function formatHealthReport(report: {overall: "healthy"|"warning"|"critical", checks: HealthCheck[]}): string{
    let lines: string[]=[];
    lines.push(`Overall: ${report.overall}`);
    for (let check of report.checks){
        lines.push(`- ${check.name}: ${check.status} (${check.durationMs}ms) ${check.message}`);
    }
    return lines.join("\n");
}
