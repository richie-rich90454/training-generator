import fs from "fs"
import path from "path"
import os from "os"
import crypto from "crypto"
import type { TrainingItem } from "../types/index.js"
export type ClassificationType="pii"|"secret"|"financial"|"health"|"none"
export interface ClassificationResult{
    type: ClassificationType
    matches: string[]
    riskScore: number
    policy: string
}
export interface ClassificationPolicy{
    maxRiskScore: number
    retentionDays: number
}
export interface DataClassifierOptions{
    patterns?: Record<string, RegExp>
    policies?: Partial<Record<ClassificationType, ClassificationPolicy>>
}
export interface QuarantinedItem{
    id: string
    item: TrainingItem
    reason: string
    quarantinedAt: number
}
export interface QuarantineManagerOptions{
    quarantineDir?: string
    maxRetentionDays?: number
}
const DEFAULT_POLICIES: Record<ClassificationType, ClassificationPolicy>={
    pii: {maxRiskScore: 0.8, retentionDays: 30},
    secret: {maxRiskScore: 1, retentionDays: 90},
    financial: {maxRiskScore: 0.9, retentionDays: 60},
    health: {maxRiskScore: 0.7, retentionDays: 30},
    none: {maxRiskScore: 0, retentionDays: 0}
}
const TYPE_ORDER: ClassificationType[]=["pii", "health", "financial", "secret"]
const TYPE_PRIORITY: Record<ClassificationType, number>={
    pii: 1,
    health: 2,
    financial: 3,
    secret: 4,
    none: 0
}
function builtInPatterns(): Record<string, {type: ClassificationType, regex: RegExp}>{
    return {
        email: {type: "pii", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g},
        phone: {type: "pii", regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){1,2}\d{4}\b/g},
        ssn: {type: "pii", regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g},
        credit_card: {type: "financial", regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g},
        api_key: {type: "secret", regex: /\b(?:api[_-]?key|apikey)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}['"]?/gi},
        password: {type: "secret", regex: /\b(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi},
        passport: {type: "pii", regex: /\b[A-Za-z]\d{7,}\b/g}
    }
}
function inferTypeFromName(name: string): ClassificationType{
    let lower=name.toLowerCase()
    if (lower.includes("ssn")||lower.includes("email")||lower.includes("phone")||lower.includes("passport")){
        return "pii"
    }
    if (lower.includes("credit")||lower.includes("card")||lower.includes("bank")||lower.includes("iban")){
        return "financial"
    }
    if (lower.includes("api")||lower.includes("key")||lower.includes("password")||lower.includes("secret")||lower.includes("token")){
        return "secret"
    }
    if (lower.includes("health")||lower.includes("medical")||lower.includes("patient")||lower.includes("diagnosis")){
        return "health"
    }
    return "pii"
}
function uniqueMatches(regex: RegExp, text: string): string[]{
    let seen: Set<string>=new Set()
    let results: string[]=[]
    let match: RegExpExecArray|null
    let safeRegex: RegExp
    try{
        let flags=regex.flags.includes("g")?regex.flags:regex.flags+"g"
        safeRegex=new RegExp(regex.source, flags)
    }
    catch (_err){
        return results
    }
    try{
        while ((match=safeRegex.exec(text))!==null){
            if (match[0].length===0){
                safeRegex.lastIndex++
                continue
            }
            if (!seen.has(match[0])){
                seen.add(match[0])
                results.push(match[0])
            }
        }
    }
    catch (_err){
        return results
    }
    return results
}
export class DataClassifier{
    private patterns: Record<string, {type: ClassificationType, regex: RegExp}>
    private policies: Record<ClassificationType, ClassificationPolicy>
    constructor(options?: DataClassifierOptions){
        this.policies={...DEFAULT_POLICIES, ...options?.policies}
        this.patterns=builtInPatterns()
        if (options?.patterns){
            for (let name in options.patterns){
                let regex=options.patterns[name]
                this.patterns[name]={type: inferTypeFromName(name), regex}
            }
        }
    }
    classify(text: string): ClassificationResult[]{
        let grouped: Record<ClassificationType, string[]>={
            pii: [],
            secret: [],
            financial: [],
            health: [],
            none: []
        }
        for (let name in this.patterns){
            let entry=this.patterns[name]
            if (!entry){
                continue
            }
            let matches=uniqueMatches(entry.regex, text)
            if (matches.length>0){
                grouped[entry.type].push(...matches)
            }
        }
        let results: ClassificationResult[]=[]
        for (let type of TYPE_ORDER){
            let matches=grouped[type]
            if (matches.length===0){
                continue
            }
            let policy=this.policies[type]??DEFAULT_POLICIES[type]
            let baseScore=Math.min(1, matches.length*0.25)
            let riskScore=Math.min(policy.maxRiskScore, baseScore)
            results.push({
                type,
                matches,
                riskScore,
                policy: `retain-${policy.retentionDays}-days`
            })
        }
        return results
    }
    getHighestRisk(results: ClassificationResult[]): ClassificationType{
        if (results.length===0){
            return "none"
        }
        let best=results.reduce((max, current)=>{
            if (current.riskScore>max.riskScore){
                return current
            }
            if (current.riskScore===max.riskScore && TYPE_PRIORITY[current.type]>TYPE_PRIORITY[max.type]){
                return current
            }
            return max
        })
        return best.type
    }
}
export class QuarantineManager{
    private quarantineDir: string
    private maxRetentionDays: number
    constructor(options?: QuarantineManagerOptions){
        this.quarantineDir=options?.quarantineDir??path.join(os.tmpdir(), "training-generator-quarantine")
        this.maxRetentionDays=options?.maxRetentionDays??30
    }
    private async ensureDir(): Promise<void>{
        await fs.promises.mkdir(this.quarantineDir, {recursive: true})
    }
    private itemPath(id: string): string{
        return path.join(this.quarantineDir, `${id}.json`)
    }
    async quarantine(item: TrainingItem, reason: string): Promise<QuarantinedItem>{
        await this.ensureDir()
        let quarantinedItem: QuarantinedItem={
            id: crypto.randomUUID(),
            item,
            reason,
            quarantinedAt: Date.now()
        }
        await fs.promises.writeFile(this.itemPath(quarantinedItem.id), JSON.stringify(quarantinedItem), "utf8")
        return quarantinedItem
    }
    async listQuarantined(): Promise<QuarantinedItem[]>{
        await this.ensureDir()
        let entries: string[]=[]
        try{
            entries=await fs.promises.readdir(this.quarantineDir)
        }
        catch (err){
            let code=(err as NodeJS.ErrnoException).code
            if (code!=="ENOENT"){
                throw err
            }
        }
        let items: QuarantinedItem[]=[]
        for (let entry of entries){
            if (!entry.endsWith(".json")){
                continue
            }
            let filePath=path.join(this.quarantineDir, entry)
            try{
                let raw=await fs.promises.readFile(filePath, "utf8")
                let parsed=JSON.parse(raw) as QuarantinedItem
                items.push(parsed)
            }
            catch (_err){
                continue
            }
        }
        items.sort((a, b)=>b.quarantinedAt-a.quarantinedAt)
        return items
    }
    async release(id: string): Promise<boolean>{
        let filePath=this.itemPath(id)
        try{
            await fs.promises.unlink(filePath)
            return true
        }
        catch (err){
            let code=(err as NodeJS.ErrnoException).code
            if (code==="ENOENT"){
                return false
            }
            throw err
        }
    }
    async purgeExpired(): Promise<string[]>{
        let items=await this.listQuarantined()
        let deleted: string[]=[]
        let cutoff=Date.now()-this.maxRetentionDays*24*60*60*1000
        for (let item of items){
            if (item.quarantinedAt<cutoff){
                if (await this.release(item.id)){
                    deleted.push(item.id)
                }
            }
        }
        return deleted
    }
}
export function applyRetentionPolicy(items: TrainingItem[], maxAgeDays: number): TrainingItem[]{
    let cutoff=Date.now()-maxAgeDays*24*60*60*1000
    return items.filter((item)=>{
        let deletedAt=item.metadata?.deletedAt
        if (deletedAt===null || deletedAt===undefined){
            return true
        }
        return deletedAt>=cutoff
    })
}
