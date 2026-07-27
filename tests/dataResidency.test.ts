// @vitest-environment node
import { describe, test, expect, vi } from "vitest"
import tls from "tls"
import { DataResidencyEnforcer, CertPinningManager, TlsVerifier, hashCertificate } from "../src/core/dataResidency.js"
function makeCert(startOffset: number, endOffset: number): tls.PeerCertificate{
    return {
        subject: { CN: "test" },
        issuer: { CN: "ca" },
        valid_from: new Date(Date.now()+startOffset).toUTCString(),
        valid_to: new Date(Date.now()+endOffset).toUTCString(),
        raw: Buffer.from("fake-cert-der-bytes")
    } as tls.PeerCertificate
}
describe("DataResidencyEnforcer", ()=>{
    test("constructor stores options", ()=>{
        let enforcer=new DataResidencyEnforcer({allowedRegions: ["global"]})
        expect(enforcer).toBeDefined()
    })
    test("allows eligible provider", ()=>{
        let enforcer=new DataResidencyEnforcer({allowedRegions: ["eu"]})
        expect(enforcer.canUseProvider("azure")).toBe(true)
    })
    test("rejects ineligible provider", ()=>{
        let enforcer=new DataResidencyEnforcer({allowedRegions: ["asia"]})
        expect(enforcer.canUseProvider("openai")).toBe(false)
    })
    test("getEligibleProviders filters list", ()=>{
        let enforcer=new DataResidencyEnforcer({allowedRegions: ["us"]})
        expect(enforcer.getEligibleProviders(["openai", "azure", "ollama"])).toEqual(["openai", "azure"])
    })
    test("validateRequest throws for ineligible provider", ()=>{
        let enforcer=new DataResidencyEnforcer({allowedRegions: ["eu"]})
        expect(()=>enforcer.validateRequest("openai")).toThrow()
    })
    test("validateRequest does not throw for eligible provider", ()=>{
        let enforcer=new DataResidencyEnforcer({allowedRegions: ["eu"]})
        expect(()=>enforcer.validateRequest("azure")).not.toThrow()
    })
    test("rejects unknown provider", ()=>{
        let enforcer=new DataResidencyEnforcer({allowedRegions: ["global"]})
        expect(enforcer.canUseProvider("unknown")).toBe(false)
    })
    test("returns empty eligible providers when none match", ()=>{
        let enforcer=new DataResidencyEnforcer({allowedRegions: ["asia"]})
        expect(enforcer.getEligibleProviders(["openai", "ollama"])).toEqual([])
    })
    test("uses custom provider region map", ()=>{
        let enforcer=new DataResidencyEnforcer({allowedRegions: ["eu"], providerRegions: { custom: ["eu"] }})
        expect(enforcer.canUseProvider("custom")).toBe(true)
    })
})
describe("CertPinningManager", ()=>{
    test("constructor stores pins", ()=>{
        let manager=new CertPinningManager({pins: { "api.example.com": ["sha256/abc"] }})
        expect(manager.getPinForHost("api.example.com")).toEqual(["sha256/abc"])
    })
    test("accepts pinned cert", ()=>{
        let manager=new CertPinningManager({pins: { "api.example.com": ["sha256/abc"] }})
        expect(manager.verifyCertificate("api.example.com", "sha256/abc")).toBe(true)
    })
    test("rejects unknown cert", ()=>{
        let manager=new CertPinningManager({pins: { "api.example.com": ["sha256/abc"] }})
        expect(manager.verifyCertificate("api.example.com", "sha256/xyz")).toBe(false)
    })
    test("pinHost adds pins", ()=>{
        let manager=new CertPinningManager({})
        manager.pinHost("api.example.com", "sha256/abc", "sha256/def")
        expect(manager.getPinForHost("api.example.com")).toEqual(["sha256/abc", "sha256/def"])
    })
    test("returns undefined for unpinned host", ()=>{
        let manager=new CertPinningManager({})
        expect(manager.getPinForHost("api.example.com")).toBeUndefined()
    })
    test("rejects certificate for unpinned host", ()=>{
        let manager=new CertPinningManager({})
        expect(manager.verifyCertificate("api.example.com", "sha256/abc")).toBe(false)
    })
    test("multiple pins per host accepts any", ()=>{
        let manager=new CertPinningManager({pins: { "api.example.com": ["sha256/abc", "sha256/def"] }})
        expect(manager.verifyCertificate("api.example.com", "sha256/def")).toBe(true)
    })
    test("pinHost overrides existing pins", ()=>{
        let manager=new CertPinningManager({pins: { "api.example.com": ["sha256/abc"] }})
        manager.pinHost("api.example.com", "sha256/def")
        expect(manager.getPinForHost("api.example.com")).toEqual(["sha256/def"])
    })
})
describe("TlsVerifier", ()=>{
    test("returns valid for current cert", ()=>{
        let cert=makeCert(-86400000, 86400000)
        let verifier=new TlsVerifier({})
        let result=verifier.verifyTlsChain("test.example.com", cert)
        expect(result.valid).toBe(true)
        expect(result.fingerprint).toBe(hashCertificate(cert))
    })
    test("rejects expired cert", ()=>{
        let cert=makeCert(-200000000, -100000000)
        let verifier=new TlsVerifier({})
        let result=verifier.verifyTlsChain("test.example.com", cert)
        expect(result.valid).toBe(false)
        expect(result.error).toContain("expired")
    })
    test("rejects not yet valid cert", ()=>{
        let cert=makeCert(100000000, 200000000)
        let verifier=new TlsVerifier({})
        let result=verifier.verifyTlsChain("test.example.com", cert)
        expect(result.valid).toBe(false)
        expect(result.error).toContain("not yet valid")
    })
    test("uses checkServerIdentity", ()=>{
        let cert=makeCert(-86400000, 86400000)
        let check=vi.fn((_host: string, _cert: tls.PeerCertificate)=>new Error("hostname mismatch"))
        let verifier=new TlsVerifier({checkServerIdentity: check as unknown as typeof tls.checkServerIdentity})
        let result=verifier.verifyTlsChain("wrong.example.com", cert)
        expect(result.valid).toBe(false)
        expect(result.error).toBe("hostname mismatch")
        expect(check).toHaveBeenCalled()
    })
})
describe("hashCertificate", ()=>{
    test("stable for same input", ()=>{
        let cert=makeCert(0, 0)
        expect(hashCertificate(cert)).toBe(hashCertificate(cert))
    })
    test("returns formatted fingerprint", ()=>{
        let cert={ raw: Buffer.from("a") } as tls.PeerCertificate
        let fp=hashCertificate(cert)
        expect(fp).toMatch(/^([0-9A-F]{2}:)+[0-9A-F]{2}$/)
    })
    test("returns empty string when raw missing", ()=>{
        let cert={} as tls.PeerCertificate
        expect(hashCertificate(cert)).toBe("")
    })
})
