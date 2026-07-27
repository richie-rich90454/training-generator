import tls from "tls"
import { createHash } from "crypto"
export type Region="global"|"eu"|"us"|"asia"
export const ProviderRegionMap: Record<string, Region[]>={
    openai: ["us", "global"],
    azure: ["us", "eu", "global"],
    gcp: ["us", "eu", "asia", "global"],
    aws: ["us", "eu", "asia", "global"],
    ollama: ["global"]
}
export class DataResidencyEnforcer{
    private allowedRegions: Region[]
    private providerRegions: Record<string, Region[]>
    constructor(options: {allowedRegions: Region[], providerRegions?: Record<string, Region[]>}){
        this.allowedRegions=options.allowedRegions
        this.providerRegions=options.providerRegions??ProviderRegionMap
    }
    canUseProvider(provider: string): boolean{
        let regions=this.providerRegions[provider]
        if (!regions){
            return false
        }
        for (let region of regions){
            if (this.allowedRegions.includes(region)){
                return true
            }
        }
        return false
    }
    getEligibleProviders(providers: string[]): string[]{
        let result: string[]=[]
        for (let provider of providers){
            if (this.canUseProvider(provider)){
                result.push(provider)
            }
        }
        return result
    }
    validateRequest(provider: string): void{
        if (!this.canUseProvider(provider)){
            throw new Error("Provider " + provider + " is not allowed for configured data residency")
        }
    }
}
export class CertPinningManager{
    private pins: Record<string, string[]>
    constructor(options: {pins?: Record<string, string[]>}){
        this.pins=options.pins??{}
    }
    pinHost(host: string, ...hashes: string[]): void{
        this.pins[host]=hashes
    }
    verifyCertificate(host: string, certFingerprint: string): boolean{
        let pins=this.pins[host]
        if (!pins){
            return false
        }
        return pins.includes(certFingerprint)
    }
    getPinForHost(host: string): string[]|undefined{
        return this.pins[host]
    }
}
export class TlsVerifier{
    private checkServerIdentity: typeof tls.checkServerIdentity|undefined
    constructor(options: {checkServerIdentity?: typeof tls.checkServerIdentity}){
        this.checkServerIdentity=options.checkServerIdentity
    }
    verifyTlsChain(host: string, cert: tls.PeerCertificate): {valid: boolean, fingerprint: string, error?: string}{
        let fingerprint=hashCertificate(cert)
        let now=Date.now()
        let validFrom=Date.parse(cert.valid_from)
        let validTo=Date.parse(cert.valid_to)
        if (Number.isNaN(validFrom) || Number.isNaN(validTo)){
            return {valid: false, fingerprint: fingerprint, error: "Certificate is missing validity dates"}
        }
        if (now<validFrom){
            return {valid: false, fingerprint: fingerprint, error: "Certificate is not yet valid"}
        }
        if (now>validTo){
            return {valid: false, fingerprint: fingerprint, error: "Certificate has expired"}
        }
        if (this.checkServerIdentity){
            let err=this.checkServerIdentity(host, cert)
            if (err){
                return {valid: false, fingerprint: fingerprint, error: err.message}
            }
        }
        return {valid: true, fingerprint: fingerprint}
    }
}
export function hashCertificate(cert: tls.PeerCertificate): string{
    let raw=cert.raw
    if (!raw){
        return ""
    }
    let hash=createHash("sha256").update(raw).digest("hex").toUpperCase()
    let parts: string[]=[]
    for (let i=0; i<hash.length; i+=2){
        parts.push(hash.slice(i, i+2))
    }
    return parts.join(":")
}
