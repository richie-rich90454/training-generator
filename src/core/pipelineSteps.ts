import { PipelineStep, PipelineContext } from "./pipelineOrchestrator.js"
import { TrainingItem, TrainingItemMetadata } from "../types/interfaces.js"
import { Validator, ValidationResult } from "../renderer/validatorFramework.js"
import { Exporter, ExportOptions } from "../renderer/exportFormats.js"
export interface PipelineMiddleware{
    before?: (context: PipelineContext)=>Promise<PipelineContext>|PipelineContext
    after?: (context: PipelineContext, result: PipelineContext)=>Promise<PipelineContext>|PipelineContext
}
export abstract class PipelineStepBase implements PipelineStep{
    name: string
    constructor(name: string){
        this.name=name
    }
    async run(context: PipelineContext): Promise<PipelineContext>{
        let beforeResult=await Promise.resolve(this.before(context))
        let executeResult=await Promise.resolve(this.execute(beforeResult))
        return await Promise.resolve(this.after(beforeResult, executeResult))
    }
    before(context: PipelineContext): Promise<PipelineContext>|PipelineContext{
        return context
    }
    abstract execute(context: PipelineContext): Promise<PipelineContext>|PipelineContext
    after(context: PipelineContext, result: PipelineContext): Promise<PipelineContext>|PipelineContext{
        return result
    }
}
export class MiddlewareStep extends PipelineStepBase{
    inner: PipelineStep
    middlewares: PipelineMiddleware[]
    constructor(inner: PipelineStep, middlewares: PipelineMiddleware[]=[]){
        super(inner.name)
        this.inner=inner
        this.middlewares=middlewares
    }
    async execute(context: PipelineContext): Promise<PipelineContext>{
        let currentContext=context
        for (let middleware of this.middlewares){
            if (middleware.before){
                currentContext=await Promise.resolve(middleware.before(currentContext))
            }
        }
        let result=await this.inner.run(currentContext)
        for (let i=this.middlewares.length-1; i>=0; i--){
            let middleware=this.middlewares[i]
            if (middleware.after){
                result=await Promise.resolve(middleware.after(currentContext, result))
            }
        }
        return result
    }
}
export class FilterStep extends PipelineStepBase{
    predicate: (item: TrainingItem)=>boolean
    constructor(options: {predicate: (item: TrainingItem)=>boolean}){
        super("filter")
        this.predicate=options.predicate
    }
    execute(context: PipelineContext): PipelineContext{
        return {...context, items: context.items.filter(this.predicate)}
    }
}
export class MapStep extends PipelineStepBase{
    transform: (item: TrainingItem)=>TrainingItem
    constructor(options: {transform: (item: TrainingItem)=>TrainingItem}){
        super("map")
        this.transform=options.transform
    }
    execute(context: PipelineContext): PipelineContext{
        return {...context, items: context.items.map(this.transform)}
    }
}
export class BatchStep extends PipelineStepBase{
    processor: (items: TrainingItem[])=>Promise<TrainingItem[]>|TrainingItem[]
    batchSize: number
    constructor(options: {processor: (items: TrainingItem[])=>Promise<TrainingItem[]>|TrainingItem[], batchSize?: number}){
        super("batch")
        this.processor=options.processor
        this.batchSize=options.batchSize ?? 10
    }
    async execute(context: PipelineContext): Promise<PipelineContext>{
        let items=context.items
        let results: TrainingItem[]=[]
        for (let i=0; i<items.length; i+=this.batchSize){
            let batch=items.slice(i, i+this.batchSize)
            let processed=await Promise.resolve(this.processor(batch))
            results=results.concat(processed)
        }
        return {...context, items: results}
    }
}
export class ValidationStep extends PipelineStepBase{
    validator: Validator
    removeFailed: boolean
    constructor(options: {validator: Validator, removeFailed?: boolean}){
        super("validation")
        this.validator=options.validator
        this.removeFailed=options.removeFailed ?? false
    }
    async execute(context: PipelineContext): Promise<PipelineContext>{
        let results: ValidationResult[]=[]
        let keptItems: TrainingItem[]=[]
        for (let item of context.items){
            let result=await Promise.resolve(this.validator.validate(item))
            results.push(result)
            if (this.removeFailed && !result.passed){
                continue
            }
            if (!result.passed){
                let tags=[...(item.metadata?.tags ?? []), "validation_failed", ...result.flags]
                let metadata: TrainingItemMetadata={...(item.metadata ?? {}), tags}
                item={...item, metadata}
            }
            keptItems.push(item)
        }
        return {...context, items: keptItems, metadata: {...context.metadata, validationResults: results}}
    }
}
export class ExportStep extends PipelineStepBase{
    exporter: Exporter
    options: ExportOptions
    constructor(options: {exporter: Exporter, options?: ExportOptions}){
        super("export")
        this.exporter=options.exporter
        this.options=options.options ?? {}
    }
    async execute(context: PipelineContext): Promise<PipelineContext>{
        let exportResult=await Promise.resolve(this.exporter.export(context.items, this.options))
        return {...context, variables: {...context.variables, exportResult}}
    }
}
export function withMiddleware(step: PipelineStep, middlewares: PipelineMiddleware[]): MiddlewareStep{
    return new MiddlewareStep(step, middlewares)
}
