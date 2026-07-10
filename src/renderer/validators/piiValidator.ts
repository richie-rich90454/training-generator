import crypto from "crypto"
import type { TrainingItem } from "../../types/index.js"
import { MutatingValidator, type ValidationResult } from "../validatorFramework.js"
export type PiiType="email"|"phone"|"ssn"|"credit_card"|"address"|"ip_address"|"url"|"date_of_birth"
export interface PiiMatch{
    type: PiiType
    start: number
    end: number
    value: string
    replacement: string
}
export interface RedactionLog{
    timestamp: number
    type: PiiType
    original: string
    itemHash: string
}
export interface PatternEntry{
    pattern: RegExp
    replacement: string
}
export const DEFAULT_PII_PATTERNS: Record<PiiType, PatternEntry>={
    email: {pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: "[EMAIL_REDACTED]"},
    phone: {pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){1,2}\d{4}\b/g, replacement: "[PHONE_REDACTED]"},
    ssn: {pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, replacement: "[SSN_REDACTED]"},
    credit_card: {pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: "[CREDIT_CARD_REDACTED]"},
    address: {pattern: /\b\d+\s+(?:[A-Za-z0-9.-]+\s+)*(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct|Plaza|Plz|Suite|Ste|Apartment|Apt)\b/gi, replacement: "[ADDRESS_REDACTED]"},
    ip_address: {pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: "[IP_ADDRESS_REDACTED]"},
    url: {pattern: /\bhttps?:\/\/[^\s]+\b/g, replacement: "[URL_REDACTED]"},
    date_of_birth: {pattern: /\b(?:0[1-9]|1[0-2])[\/-](?:0[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/g, replacement: "[DATE_OF_BIRTH_REDACTED]"}
}
export function hashItem(item: TrainingItem): string{
    let json=JSON.stringify(item)
    return crypto.createHash("sha256").update(json).digest("hex")
}
export function encryptRedactionLog(log: RedactionLog[], key: string): string{
    let iv=crypto.randomBytes(16)
    let cipher=crypto.createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv)
    let plaintext=JSON.stringify(log)
    let encrypted=Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    let authTag=cipher.getAuthTag()
    return iv.toString("hex")+":"+authTag.toString("hex")+":"+encrypted.toString("hex")
}
export function decryptRedactionLog(encrypted: string, key: string): RedactionLog[]{
    let [ivHex, authTagHex, encryptedHex]=encrypted.split(":")
    let iv=Buffer.from(ivHex, "hex")
    let authTag=Buffer.from(authTagHex, "hex")
    let decipher=crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv)
    decipher.setAuthTag(authTag)
    let decrypted=Buffer.concat([decipher.update(encryptedHex, "hex"), decipher.final()])
    try{
        return JSON.parse(decrypted.toString("utf8")) as RedactionLog[]
    }
    catch{
        return []
    }
}
export class PiiValidator extends MutatingValidator{
    patterns: Record<PiiType, PatternEntry>
    enableRedaction: boolean
    redactionLog: RedactionLog[]
    currentItemHash: string
    constructor(options?: {patterns?: Partial<Record<PiiType, PatternEntry>>, enableRedaction?: boolean, redactionLog?: RedactionLog[]}){
        super("pii")
        this.threshold=0.5
        this.patterns={...DEFAULT_PII_PATTERNS, ...options?.patterns}
        this.enableRedaction=options?.enableRedaction??false
        this.redactionLog=options?.redactionLog??[]
        this.currentItemHash=""
    }
    detect(text: string): PiiMatch[]{
        let allMatches: PiiMatch[]=[]
        for (let type in this.patterns){
            let entry=this.patterns[type as PiiType]
            if (!entry){
                continue
            }
            let flags=entry.pattern.flags.includes("g")?entry.pattern.flags:entry.pattern.flags+"g"
            let regex=new RegExp(entry.pattern.source, flags)
            let match: RegExpExecArray|null
            while ((match=regex.exec(text))!==null){
                allMatches.push({
                    type: type as PiiType,
                    start: match.index,
                    end: match.index+match[0].length,
                    value: match[0],
                    replacement: entry.replacement
                })
            }
        }
        allMatches.sort((a, b) => a.start===b.start?b.end-a.end:a.start-b.start)
        let result: PiiMatch[]=[]
        let lastEnd=-1
        for (let match of allMatches){
            if (match.start>=lastEnd){
                result.push(match)
                lastEnd=match.end
            }
            else if (match.end>lastEnd){
                result[result.length-1]=match
                lastEnd=match.end
            }
        }
        return result
    }
    redact(text: string, matches?: PiiMatch[]): {redactedText: string, matches: PiiMatch[]}{
        let resolvedMatches=matches??this.detect(text)
        let sorted=[...resolvedMatches].sort((a, b) => b.start-a.start)
        let redactedText=text
        let applied: PiiMatch[]=[]
        for (let match of sorted){
            if (match.start<0 || match.end>text.length){
                continue
            }
            redactedText=redactedText.slice(0, match.start)+match.replacement+redactedText.slice(match.end)
            applied.push(match)
            if (this.enableRedaction && this.currentItemHash){
                this.redactionLog.push({
                    timestamp: Date.now(),
                    type: match.type,
                    original: match.value,
                    itemHash: this.currentItemHash
                })
            }
        }
        return {redactedText, matches: applied.reverse()}
    }
    private extractAllText(item: TrainingItem): string{
        let parts: string[]=[]
        let fields: ("instruction"|"input"|"output"|"text")[]=["instruction", "input", "output", "text"]
        for (let field of fields){
            let value=item[field]
            if (typeof value==="string"){
                parts.push(value)
            }
        }
        if (item.messages && Array.isArray(item.messages)){
            for (let message of item.messages){
                if (message && typeof message.content==="string"){
                    parts.push(message.content)
                }
            }
        }
        return parts.join(" ")
    }
    mutate(item: TrainingItem): TrainingItem{
        this.currentItemHash=hashItem(item)
        let fields: ("instruction"|"input"|"output"|"text")[]=["instruction", "input", "output", "text"]
        for (let field of fields){
            let value=item[field]
            if (typeof value==="string"){
                let result=this.redact(value)
                ;(item as unknown as Record<string, unknown>)[field]=result.redactedText
            }
        }
        if (item.messages && Array.isArray(item.messages)){
            for (let message of item.messages){
                if (message && typeof message.content==="string"){
                    let result=this.redact(message.content)
                    message.content=result.redactedText
                }
            }
        }
        this.currentItemHash=""
        return item
    }
    validate(item: TrainingItem): ValidationResult{
        let text=this.extractAllText(item)
        let matches=this.detect(text)
        let score=Math.max(0, 1-matches.length*0.1)
        let passed=matches.length===0
        let details: string[]=[]
        let flags: string[]=[]
        for (let match of matches){
            let description=match.type+": "+match.value
            details.push(description)
            flags.push(description)
        }
        return this.buildResult(score, passed, details, flags)
    }
}
