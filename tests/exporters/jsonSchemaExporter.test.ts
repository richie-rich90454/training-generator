// @vitest-environment node
import { describe, test, expect } from "vitest"
import type { TrainingItem } from "../../src/types/index.js"
import { Exporter } from "../../src/renderer/exportFormats.js"
import { JsonSchemaExporter, mulberry32, shuffleArray, splitItems, generateJsonSchema } from "../../src/renderer/exporters/jsonSchemaExporter.js"
import type { SplitConfig } from "../../src/renderer/exporters/jsonSchemaExporter.js"
describe("JsonSchemaExporter", ()=>{
    test("name mimeType extension correct", ()=>{
        let exporter: Exporter=new JsonSchemaExporter()
        expect(exporter.name).toBe("json-schema")
        expect(exporter.mimeType).toBe("application/json")
        expect(exporter.extension).toBe(".json")
        expect(typeof exporter.export).toBe("function")
    })
    test("includes schema", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", output: "a" }]
        let result=JSON.parse(exporter.export(items))
        expect(result.schema).toEqual({
            type: "object",
            properties: {
                instruction: { type: "string" },
                input: { type: "string" },
                output: { type: "string" }
            }
        })
    })
    test("includes data when no split", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", output: "a" }]
        let result=JSON.parse(exporter.export(items))
        expect(result.data).toEqual(items)
        expect(result.splits).toBeUndefined()
    })
    test("splits by ratios", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "1", output: "a" },
            { format: "instruction", instruction: "2", output: "b" },
            { format: "instruction", instruction: "3", output: "c" },
            { format: "instruction", instruction: "4", output: "d" },
            { format: "instruction", instruction: "5", output: "e" },
            { format: "instruction", instruction: "6", output: "f" },
            { format: "instruction", instruction: "7", output: "g" },
            { format: "instruction", instruction: "8", output: "h" },
            { format: "instruction", instruction: "9", output: "i" },
            { format: "instruction", instruction: "10", output: "j" }
        ]
        let splitConfig: SplitConfig={ trainRatio: 0.6, valRatio: 0.2, testRatio: 0.2 }
        let result=JSON.parse(exporter.export(items, { splitConfig: splitConfig }))
        expect(result.splits.train.length).toBe(6)
        expect(result.splits.validation.length).toBe(2)
        expect(result.splits.test.length).toBe(2)
    })
    test("ratios must sum to 1", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", output: "a" }]
        let splitConfig: SplitConfig={ trainRatio: 0.5, valRatio: 0.2, testRatio: 0.2 }
        expect(()=>exporter.export(items, { splitConfig: splitConfig })).toThrow("Split ratios must sum to 1")
    })
    test("deterministic with seed", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "1", output: "a" },
            { format: "instruction", instruction: "2", output: "b" },
            { format: "instruction", instruction: "3", output: "c" },
            { format: "instruction", instruction: "4", output: "d" },
            { format: "instruction", instruction: "5", output: "e" }
        ]
        let splitConfig: SplitConfig={ trainRatio: 0.6, valRatio: 0.2, testRatio: 0.2, seed: 123 }
        let result1=JSON.parse(exporter.export(items, { splitConfig: splitConfig }))
        let result2=JSON.parse(exporter.export(items, { splitConfig: splitConfig }))
        expect(result1.splits.train).toEqual(result2.splits.train)
        expect(result1.splits.validation).toEqual(result2.splits.validation)
        expect(result1.splits.test).toEqual(result2.splits.test)
    })
    test("pretty output option", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", output: "a" }]
        let compact=exporter.export(items)
        let pretty=exporter.export(items, { pretty: true })
        expect(pretty.length).toBeGreaterThan(compact.length)
        expect(pretty).toContain("\n")
    })
    test("metadata totalCount correct", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "1", output: "a" },
            { format: "instruction", instruction: "2", output: "b" }
        ]
        let result=JSON.parse(exporter.export(items))
        expect(result.metadata.totalCount).toBe(2)
    })
    test("splitCounts sum to total", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "1", output: "a" },
            { format: "instruction", instruction: "2", output: "b" },
            { format: "instruction", instruction: "3", output: "c" },
            { format: "instruction", instruction: "4", output: "d" },
            { format: "instruction", instruction: "5", output: "e" }
        ]
        let splitConfig: SplitConfig={ trainRatio: 0.6, valRatio: 0.2, testRatio: 0.2 }
        let result=JSON.parse(exporter.export(items, { splitConfig: splitConfig }))
        let counts=result.metadata.splitCounts
        let total=counts.train+counts.validation+counts.test
        expect(total).toBe(items.length)
    })
    test("custom schema override", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", output: "a" }]
        let customSchema={ type: "object", properties: { custom: { type: "string" } } }
        let result=JSON.parse(exporter.export(items, { schema: customSchema }))
        expect(result.schema).toEqual(customSchema)
    })
    test("empty items generates empty schema", ()=>{
        let exporter=new JsonSchemaExporter()
        let result=JSON.parse(exporter.export([]))
        expect(result.schema).toEqual({ type: "object", properties: {} })
        expect(result.data).toEqual([])
        expect(result.metadata.totalCount).toBe(0)
    })
    test("split with remainder assigned to train", ()=>{
        let exporter=new JsonSchemaExporter()
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "1", output: "a" },
            { format: "instruction", instruction: "2", output: "b" },
            { format: "instruction", instruction: "3", output: "c" },
            { format: "instruction", instruction: "4", output: "d" },
            { format: "instruction", instruction: "5", output: "e" }
        ]
        let splitConfig: SplitConfig={ trainRatio: 0.7, valRatio: 0.2, testRatio: 0.1 }
        let result=JSON.parse(exporter.export(items, { splitConfig: splitConfig }))
        expect(result.splits.train.length).toBe(4)
        expect(result.splits.validation.length).toBe(1)
        expect(result.splits.test.length).toBe(0)
    })
})
describe("splitItems", ()=>{
    test("returns correct counts", ()=>{
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "1", output: "a" },
            { format: "instruction", instruction: "2", output: "b" },
            { format: "instruction", instruction: "3", output: "c" },
            { format: "instruction", instruction: "4", output: "d" },
            { format: "instruction", instruction: "5", output: "e" },
            { format: "instruction", instruction: "6", output: "f" },
            { format: "instruction", instruction: "7", output: "g" },
            { format: "instruction", instruction: "8", output: "h" },
            { format: "instruction", instruction: "9", output: "i" },
            { format: "instruction", instruction: "10", output: "j" }
        ]
        let config: SplitConfig={ trainRatio: 0.7, valRatio: 0.2, testRatio: 0.1 }
        let result=splitItems(items, config)
        expect(result.train.length).toBe(7)
        expect(result.validation.length).toBe(2)
        expect(result.test.length).toBe(1)
    })
    test("deterministic with same seed", ()=>{
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "1", output: "a" },
            { format: "instruction", instruction: "2", output: "b" },
            { format: "instruction", instruction: "3", output: "c" },
            { format: "instruction", instruction: "4", output: "d" },
            { format: "instruction", instruction: "5", output: "e" }
        ]
        let config: SplitConfig={ trainRatio: 0.6, valRatio: 0.2, testRatio: 0.2, seed: 999 }
        let result1=splitItems(items, config)
        let result2=splitItems(items, config)
        expect(result1.train).toEqual(result2.train)
        expect(result1.validation).toEqual(result2.validation)
        expect(result1.test).toEqual(result2.test)
    })
    test("different seed produces different order", ()=>{
        let items: TrainingItem[]=[
            { format: "instruction", instruction: "1", output: "a" },
            { format: "instruction", instruction: "2", output: "b" },
            { format: "instruction", instruction: "3", output: "c" },
            { format: "instruction", instruction: "4", output: "d" },
            { format: "instruction", instruction: "5", output: "e" },
            { format: "instruction", instruction: "6", output: "f" },
            { format: "instruction", instruction: "7", output: "g" },
            { format: "instruction", instruction: "8", output: "h" },
            { format: "instruction", instruction: "9", output: "i" },
            { format: "instruction", instruction: "10", output: "j" }
        ]
        let config1: SplitConfig={ trainRatio: 0.8, valRatio: 0.1, testRatio: 0.1, seed: 1 }
        let config2: SplitConfig={ trainRatio: 0.8, valRatio: 0.1, testRatio: 0.1, seed: 2 }
        let result1=splitItems(items, config1)
        let result2=splitItems(items, config2)
        expect(result1.train[0]).not.toEqual(result2.train[0])
    })
    test("throws when ratios exceed 1", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", output: "a" }]
        let config: SplitConfig={ trainRatio: 0.6, valRatio: 0.3, testRatio: 0.2 }
        expect(()=>splitItems(items, config)).toThrow("Split ratios must sum to 1")
    })
    test("throws when ratios less than 1", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", output: "a" }]
        let config: SplitConfig={ trainRatio: 0.5, valRatio: 0.2, testRatio: 0.2 }
        expect(()=>splitItems(items, config)).toThrow("Split ratios must sum to 1")
    })
})
describe("generateJsonSchema", ()=>{
    test("generateJsonSchema for instruction", ()=>{
        let items: TrainingItem[]=[{ format: "instruction", instruction: "q", input: "i", output: "a" }]
        let result=generateJsonSchema(items)
        expect(result).toEqual({
            type: "object",
            properties: {
                instruction: { type: "string" },
                input: { type: "string" },
                output: { type: "string" }
            }
        })
    })
    test("generateJsonSchema for messages", ()=>{
        let items: TrainingItem[]=[{ format: "chatml", messages: [{ role: "user", content: "hi" }] }]
        let result=generateJsonSchema(items)
        expect(result).toEqual({
            type: "object",
            properties: {
                messages: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            role: { type: "string" },
                            content: { type: "string" }
                        }
                    }
                }
            }
        })
    })
    test("generateJsonSchema for text", ()=>{
        let items: TrainingItem[]=[{ format: "text", text: "hello" }]
        let result=generateJsonSchema(items)
        expect(result).toEqual({
            type: "object",
            properties: {
                text: { type: "string" }
            }
        })
    })
    test("defaults to instruction when format missing", ()=>{
        let items: TrainingItem[]=[{ instruction: "q", output: "a" } as TrainingItem]
        let result=generateJsonSchema(items)
        expect(result).toEqual({
            type: "object",
            properties: {
                instruction: { type: "string" },
                input: { type: "string" },
                output: { type: "string" }
            }
        })
    })
})
describe("mulberry32", ()=>{
    test("seeded RNG repeatable", ()=>{
        let rng1=mulberry32(123)
        let rng2=mulberry32(123)
        for(let i=0; i<10; i++){
            expect(rng1()).toBe(rng2())
        }
    })
    test("different seeds produce different values", ()=>{
        let rng1=mulberry32(123)
        let rng2=mulberry32(456)
        let values1=[]
        let values2=[]
        for(let i=0; i<5; i++){
            values1.push(rng1())
            values2.push(rng2())
        }
        expect(values1).not.toEqual(values2)
    })
    test("returns values in range zero to one", ()=>{
        let rng=mulberry32(42)
        for(let i=0; i<20; i++){
            let value=rng()
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThan(1)
        }
    })
})
describe("shuffleArray", ()=>{
    test("shuffles deterministically", ()=>{
        let array=[1, 2, 3, 4, 5]
        let rng1=mulberry32(7)
        let rng2=mulberry32(7)
        let result1=shuffleArray(array, rng1)
        let result2=shuffleArray(array, rng2)
        expect(result1).toEqual(result2)
        expect(result1).not.toEqual(array)
    })
    test("returns new array leaving original intact", ()=>{
        let array=[1, 2, 3, 4, 5]
        let rng=mulberry32(7)
        let result=shuffleArray(array, rng)
        expect(result).not.toBe(array)
        expect(array).toEqual([1, 2, 3, 4, 5])
    })
    test("handles empty array", ()=>{
        let array: number[]=[]
        let rng=mulberry32(7)
        let result=shuffleArray(array, rng)
        expect(result).toEqual([])
    })
})
