import type { TrainingItem } from "../types/index.js"
import { validateItems, type QualityReport, type QualityFlag } from "./qualityValidator.js"
export interface ValidationResult{
    score: number
    passed: boolean
    details: string[]
    flags: string[]
}
export interface Validator{
    name: string
    enabled: boolean
    threshold: number
    validate(item: TrainingItem): Promise<ValidationResult>|ValidationResult
}
export abstract class BaseValidator implements Validator{
    name: string
    enabled: boolean=true
    threshold: number=0.5
    constructor(name: string, options?: {enabled?: boolean; threshold?: number}){
        this.name=name
        this.enabled=options?.enabled??true
        this.threshold=options?.threshold??0.5
    }
    abstract validate(item: TrainingItem): Promise<ValidationResult>|ValidationResult
    buildResult(score: number, passed: boolean, details?: string[], flags?: string[]): ValidationResult{
        return {
            score,
            passed,
            details: details??[],
            flags: flags??[]
        }
    }
}
export class ValidatorChain{
    validators: Validator[]
    threshold: number=0.5
    constructor(validators: Validator[], threshold?: number){
        this.validators=validators
        this.threshold=threshold??0.5
    }
    add(validator: Validator): void{
        this.validators.push(validator)
    }
    remove(name: string): void{
        this.validators=this.validators.filter(v => v.name!==name)
    }
    setEnabled(name: string, enabled: boolean): void{
        let validator=this.validators.find(v => v.name===name)
        if (validator){
            validator.enabled=enabled
        }
    }
    async validate(item: TrainingItem): Promise<{results: Record<string, ValidationResult>; overallScore: number; passed: boolean; flags: string[]}>{
        let results: Record<string, ValidationResult>={}
        let flags: string[]=[]
        let totalScore=0
        let count=0
        for (let validator of this.validators){
            if (!validator.enabled){
                continue
            }
            let result=await Promise.resolve(validator.validate(item))
            results[validator.name]=result
            totalScore+=result.score
            count++
            for (let flag of result.flags){
                if (!flags.includes(flag)){
                    flags.push(flag)
                }
            }
        }
        let overallScore=count>0 ? totalScore/count : 0
        let passed=overallScore>=this.threshold
        return {results, overallScore, passed, flags}
    }
    async validateBatch(items: TrainingItem[]): Promise<{itemIndex: number; results: Record<string, ValidationResult>; overallScore: number; passed: boolean; flags: string[]}[]>{
        let promises=items.map((item, index) => this.validate(item).then(result => ({itemIndex: index, ...result})))
        return Promise.all(promises)
    }
}
export abstract class MutatingValidator extends BaseValidator{
    abstract mutate(item: TrainingItem): Promise<TrainingItem>|TrainingItem
    async validateAndMutate(item: TrainingItem): Promise<{result: ValidationResult; item: TrainingItem}>{
        let mutated=await Promise.resolve(this.mutate(item))
        let result=await Promise.resolve(this.validate(mutated))
        return {result, item: mutated}
    }
}
export class CompositeValidator extends BaseValidator{
    inner: ValidatorChain
    constructor(name: string, validators: Validator[]){
        super(name)
        this.inner=new ValidatorChain(validators)
    }
    async validate(item: TrainingItem): Promise<ValidationResult>{
        let {overallScore, passed, flags}=await this.inner.validate(item)
        return this.buildResult(overallScore, passed, [], flags)
    }
}
class LegacyValidator extends BaseValidator{
    constructor(){
        super("legacy")
    }
    validate(item: TrainingItem): ValidationResult{
        let report=validateItems([item])
        if (report.flaggedItems>0){
            let reasons=report.flags[0].reasons
            return this.buildResult(0, false, reasons, reasons)
        }
        return this.buildResult(1, true, [], [])
    }
}
export function createLegacyValidator(): Validator{
    return new LegacyValidator()
}
export function createDefaultValidatorChain(): ValidatorChain{
    return new ValidatorChain([createLegacyValidator()])
}
export async function validateItemsV2(items: TrainingItem[], chain?: ValidatorChain): Promise<QualityReport>{
    let actualChain=chain??createDefaultValidatorChain()
    let batch=await actualChain.validateBatch(items)
    let flags: QualityFlag[]=[]
    let breakdown: Record<string, number>={}
    for (let i=0; i<batch.length; i++){
        let entry=batch[i]
        if (!entry.passed){
            let reasons=entry.flags.length>0 ? entry.flags : ["failed_validation"]
            flags.push({itemIndex: entry.itemIndex, item: items[entry.itemIndex], reasons})
            for (let reason of reasons){
                breakdown[reason]=(breakdown[reason]??0)+1
            }
        }
    }
    let flaggedItems=flags.length
    let passRate=items.length>0 ? Math.round(((items.length-flaggedItems)/items.length)*100) : 100
    return {totalItems: items.length, flaggedItems, passRate, flags, breakdown}
}
