export class RateLimiter{
    private tokens:number
    private lastRefill:number
    private tokensPerMinute:number
    private burstSize:number
    private _isActive:boolean
    private pausedUntil:number

    constructor(tokensPerMinute:number=60,burstSize:number=10){
        this.tokensPerMinute=tokensPerMinute
        this.burstSize=burstSize
        this.tokens=burstSize
        this.lastRefill=Date.now()
        this._isActive=true
        this.pausedUntil=0
    }

    get isActive():boolean{
        return this._isActive
    }

    async acquire():Promise<void>{
        if(!this._isActive)return
        return this._acquireInternal()
    }

    private async _acquireInternal():Promise<void>{
        let now=Date.now()
        if(now<this.pausedUntil){
            await new Promise(resolve=>setTimeout(resolve,this.pausedUntil-now))
            now=Date.now()
        }
        let elapsed=now-this.lastRefill
        if(elapsed>0){
            this.tokens=Math.min(this.burstSize,this.tokens+elapsed*(this.tokensPerMinute/60000))
            this.lastRefill=now
        }
        if(this.tokens>=1){
            this.tokens-=1
            return
        }
        let refillRate=this.tokensPerMinute/60000
        let waitMs=Math.ceil((1-this.tokens)/refillRate)
        await new Promise(resolve=>setTimeout(resolve,waitMs))
        return this._acquireInternal()
    }

    setRate(tokensPerMinute:number):void{
        this.tokensPerMinute=tokensPerMinute
    }

    handleRateLimitResponse(retryAfterSeconds?:number):void{
        this.tokens=0
        this.pausedUntil=Date.now()+(retryAfterSeconds??5)*1000
        this.lastRefill=this.pausedUntil
    }

    disable():void{
        this._isActive=false
    }

    enable():void{
        this._isActive=true
    }

    reset():void{
        this.tokens=this.burstSize
        this.lastRefill=Date.now()
        this.pausedUntil=0
    }
}