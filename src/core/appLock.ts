import crypto from "node:crypto"
const BASE32_ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
let otpauthModule: typeof import("otpauth")|null=null
try{
    otpauthModule=await import("otpauth")
}
catch(_err){
    otpauthModule=null
}
export interface AppLockStorage{
    getItem(key: string): string|null
    setItem(key: string, value: string): void
    removeItem(key: string): void
}
function createMemoryStorage(): AppLockStorage{
    let data: Record<string, string>={}
    return{
        getItem(key: string): string|null{
            return data[key]??null
        },
        setItem(key: string, value: string): void{
            data[key]=value
        },
        removeItem(key: string): void{
            delete data[key]
        }
    }
}
export function generateTotpSecret(): string{
    let bytes=crypto.randomBytes(20)
    let result=""
    let bits=0
    let value=0
    for(let i=0; i<bytes.length; i++){
        value=(value<<8)|bytes[i]
        bits+=8
        while(bits>=5){
            result+=BASE32_ALPHABET[(value>>>(bits-5))&31]
            bits-=5
        }
    }
    if(bits>0){
        result+=BASE32_ALPHABET[(value<<(5-bits))&31]
    }
    return result
}
function base32Decode(input: string): Buffer{
    let cleaned=input.toUpperCase().replace(/=/g, "")
    let bytes: number[]=[]
    let bits=0
    let value=0
    for(let i=0; i<cleaned.length; i++){
        let index=BASE32_ALPHABET.indexOf(cleaned[i])
        if(index===-1){
            continue
        }
        value=(value<<5)|index
        bits+=5
        if(bits>=8){
            bytes.push((value>>>(bits-8))&255)
            bits-=8
        }
    }
    return Buffer.from(bytes)
}
export function generateTotpToken(secret: string, timestamp?: number): string{
    if(otpauthModule){
        let secretObj=otpauthModule.Secret.fromBase32(secret)
        let totp=new otpauthModule.TOTP({secret: secretObj, algorithm: "SHA1", digits: 6, period: 30})
        return totp.generate({timestamp: timestamp??Date.now()})
    }
    let secretBytes=base32Decode(secret)
    let time=Math.floor((timestamp??Date.now())/1000/30)
    let counter=Buffer.alloc(8)
    counter.writeBigUInt64BE(BigInt(time), 0)
    let hmac=crypto.createHmac("sha1", secretBytes).update(counter).digest()
    let offset=hmac[hmac.length-1]&0x0f
    let code=((hmac[offset]&0x7f)<<24|(hmac[offset+1]&0xff)<<16|(hmac[offset+2]&0xff)<<8|(hmac[offset+3]&0xff))%1000000
    return String(code).padStart(6, "0")
}
function validateTotpToken(token: string, secret: string): boolean{
    if(otpauthModule){
        let secretObj=otpauthModule.Secret.fromBase32(secret)
        let totp=new otpauthModule.TOTP({secret: secretObj, algorithm: "SHA1", digits: 6, period: 30})
        return totp.validate({token: token, window: 1})!==null
    }
    let timestamp=Date.now()
    for(let window=-1; window<=1; window++){
        if(generateTotpToken(secret, timestamp+window*30*1000)===token){
            return true
        }
    }
    return false
}
export function buildOtpAuthUri(secret: string, account: string): string{
    if(otpauthModule){
        let secretObj=otpauthModule.Secret.fromBase32(secret)
        let totp=new otpauthModule.TOTP({secret: secretObj, algorithm: "SHA1", digits: 6, period: 30, issuer: "Training Generator", label: account})
        return totp.toString()
    }
    return "otpauth://totp/" + encodeURIComponent(account) + "?secret=" + secret + "&issuer=" + encodeURIComponent("Training Generator")
}
export class AppLock{
    private storage: AppLockStorage
    constructor(options?: {storage?: AppLockStorage}){
        this.storage=options?.storage??createMemoryStorage()
    }
    setup(secret: string): {uri: string}{
        this.storage.setItem("appLockSecret", secret)
        this.storage.setItem("appLockEnabled", "true")
        return {uri: buildOtpAuthUri(secret, "Training Generator")}
    }
    verify(token: string): boolean{
        if(!this.isEnabled()){
            return false
        }
        let secret=this.storage.getItem("appLockSecret")
        if(!secret){
            return false
        }
        return validateTotpToken(token, secret)
    }
    isEnabled(): boolean{
        return this.storage.getItem("appLockEnabled")==="true"
    }
    disable(token: string): boolean{
        if(!this.verify(token)){
            return false
        }
        this.storage.removeItem("appLockEnabled")
        this.storage.removeItem("appLockSecret")
        this.storage.removeItem("appLockLocked")
        return true
    }
    lock(): void{
        if(!this.isEnabled()){
            return
        }
        this.storage.setItem("appLockLocked", "true")
    }
    unlock(token: string): boolean{
        if(!this.verify(token)){
            return false
        }
        this.storage.removeItem("appLockLocked")
        return true
    }
    isLocked(): boolean{
        return this.isEnabled() && this.storage.getItem("appLockLocked")==="true"
    }
}
