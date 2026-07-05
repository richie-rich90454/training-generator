export interface RateLimitStatus{
    provider: string
    limit: number
    remaining: number
    resetAt: number
    retryAfter?: number
    usedPercent: number
}
interface InternalStatus{
    limit: number
    remaining: number
    resetAt: number
    retryAfter?: number
}
export interface RateLimitTrackerOptions{
    windowMs?: number
}
function normalizeHeaderName(name: string): string{
    return name.toLowerCase()
}
function getHeader(headers: Record<string, string|number>, names: string[]): string|number|undefined{
    let map: Record<string, string|number>={}
    for (let key in headers){
        if (Object.prototype.hasOwnProperty.call(headers, key)){
            map[normalizeHeaderName(key)]=headers[key]
        }
    }
    for (let name of names){
        let normalized=normalizeHeaderName(name)
        if (map[normalized]!==undefined){
            return map[normalized]
        }
    }
    return undefined
}
function parseNumber(value: string|number|undefined): number{
    if (value===undefined) return NaN
    let num=typeof value==="number"?value:Number(value)
    if (Number.isNaN(num)) return NaN
    return num
}
export function parseRateLimitHeaders(headers: Record<string, string|number>): {limit: number, remaining: number, resetAt: number, retryAfter?: number}{
    let limit=NaN
    let remaining=NaN
    let resetAt=0
    let retryAfter: number|undefined
    let limitVal=getHeader(headers, ["x-ratelimit-limit", "ratelimit-limit", "x-rate-limit-limit", "rate-limit-limit"])
    let remainingVal=getHeader(headers, ["x-ratelimit-remaining", "ratelimit-remaining", "x-rate-limit-remaining", "rate-limit-remaining"])
    let resetVal=getHeader(headers, ["x-ratelimit-reset", "ratelimit-reset", "x-rate-limit-reset", "rate-limit-reset"])
    let retryVal=getHeader(headers, ["retry-after", "x-retry-after"])
    let usedVal=getHeader(headers, ["x-ratelimit-used", "ratelimit-used", "x-rate-limit-used"])
    limit=parseNumber(limitVal)
    remaining=parseNumber(remainingVal)
    let used=parseNumber(usedVal)
    if (Number.isNaN(limit)||limit<0) limit=0
    if (Number.isNaN(remaining)||remaining<0){
        if (!Number.isNaN(used)&&limit>0){
            remaining=Math.max(0, limit-used)
        }
        else{
            remaining=0
        }
    }
    if (resetVal!==undefined){
        let resetNum=parseNumber(resetVal)
        if (!Number.isNaN(resetNum)){
            if (resetNum<=1e6){
                resetAt=Date.now()+resetNum*1000
            }
            else if (resetNum<1e10){
                resetAt=resetNum*1000
            }
            else{
                resetAt=resetNum
            }
        }
    }
    if (retryVal!==undefined){
        let retryNum=parseNumber(retryVal)
        if (!Number.isNaN(retryNum)){
            retryAfter=retryNum
            resetAt=Date.now()+retryNum*1000
        }
        else if (typeof retryVal==="string"){
            let date=new Date(retryVal)
            if (!Number.isNaN(date.getTime())){
                retryAfter=Math.max(0, Math.ceil((date.getTime()-Date.now())/1000))
                resetAt=date.getTime()
            }
        }
    }
    return {limit, remaining, resetAt, retryAfter}
}
export class RateLimitTracker{
    private providers: Record<string, InternalStatus>
    private windowMs: number
    constructor(options: RateLimitTrackerOptions={}){
        this.providers={}
        this.windowMs=options.windowMs??60000
    }
    recordResponse(provider: string, headers: Record<string, string|number>): void{
        let parsed=parseRateLimitHeaders(headers)
        let resetAt=parsed.resetAt
        if (resetAt<=0){
            resetAt=Date.now()+this.windowMs
        }
        this.providers[provider]={
            limit: parsed.limit,
            remaining: parsed.remaining,
            resetAt: resetAt,
            retryAfter: parsed.retryAfter
        }
    }
    getStatus(provider?: string): RateLimitStatus|RateLimitStatus[]{
        if (provider===undefined){
            return Object.keys(this.providers).map((p) => this.buildStatus(p))
        }
        if (this.providers[provider]===undefined){
            return this.buildDefault(provider)
        }
        return this.buildStatus(provider)
    }
    isRateLimited(provider: string): boolean{
        let status=this.getStatus(provider) as RateLimitStatus
        return status.remaining<=0
    }
    getTimeToReset(provider: string): number{
        let status=this.getStatus(provider) as RateLimitStatus
        if (status.resetAt<=0) return 0
        return Math.max(0, status.resetAt-Date.now())
    }
    getDashboardData(): RateLimitStatus[]{
        return this.getStatus() as RateLimitStatus[]
    }
    private buildStatus(provider: string): RateLimitStatus{
        let s=this.providers[provider]
        let limit=s.limit
        let remaining=s.remaining
        let used=0
        if (limit>0){
            used=Math.max(0, limit-remaining)
        }
        let usedPercent=limit>0?Math.round((used/limit)*100):0
        return {
            provider: provider,
            limit: limit,
            remaining: remaining,
            resetAt: s.resetAt,
            retryAfter: s.retryAfter,
            usedPercent: usedPercent
        }
    }
    private buildDefault(provider: string): RateLimitStatus{
        return {
            provider: provider,
            limit: 0,
            remaining: 0,
            resetAt: 0,
            retryAfter: undefined,
            usedPercent: 0
        }
    }
}
