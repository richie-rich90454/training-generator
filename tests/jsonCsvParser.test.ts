import{describe, test, expect}from "vitest"
import{inferSchema, flattenObject, parseJson, parseNdjson, parseCsv, renderMarkdownTable, detectFormat, parseAuto, JsonCsvParser, SchemaField, ParseResult}from "../src/core/jsonCsvParser.js"
describe("JsonCsvParser", ()=>{
    describe("inferSchema", ()=>{
        test("inferSchema on flat object", ()=>{
            let schema: SchemaField[]=inferSchema({a: 1, b: "x", c: true})
            expect(schema).toHaveLength(3)
            let a: SchemaField|undefined=schema.find(f=>f.path==="a")
            let b: SchemaField|undefined=schema.find(f=>f.path==="b")
            let c: SchemaField|undefined=schema.find(f=>f.path==="c")
            expect(a?.type).toBe("number")
            expect(a?.sampleValue).toBe(1)
            expect(a?.nullable).toBe(false)
            expect(b?.type).toBe("string")
            expect(b?.sampleValue).toBe("x")
            expect(c?.type).toBe("boolean")
            expect(c?.sampleValue).toBe(true)
        })
        test("inferSchema on nested object (dot notation)", ()=>{
            let schema: SchemaField[]=inferSchema({user: {name: "x", age: 10}})
            expect(schema).toHaveLength(3)
            let user: SchemaField|undefined=schema.find(f=>f.path==="user")
            let userName: SchemaField|undefined=schema.find(f=>f.path==="user.name")
            let userAge: SchemaField|undefined=schema.find(f=>f.path==="user.age")
            expect(user?.type).toBe("object")
            expect(userName?.type).toBe("string")
            expect(userName?.sampleValue).toBe("x")
            expect(userAge?.type).toBe("number")
            expect(userAge?.sampleValue).toBe(10)
        })
        test("inferSchema on array", ()=>{
            let schema: SchemaField[]=inferSchema([{a: 1, b: "x"}, {a: 2, b: "y"}])
            expect(schema).toHaveLength(2)
            let a: SchemaField|undefined=schema.find(f=>f.path==="a")
            let b: SchemaField|undefined=schema.find(f=>f.path==="b")
            expect(a?.type).toBe("number")
            expect(a?.sampleValue).toBe(1)
            expect(b?.type).toBe("string")
            expect(b?.sampleValue).toBe("x")
        })
        test("inferSchema marks nullable fields", ()=>{
            let schema: SchemaField[]=inferSchema([{a: 1}, {a: null}])
            let a: SchemaField|undefined=schema.find(f=>f.path==="a")
            expect(a?.nullable).toBe(true)
            expect(a?.type).toBe("number")
            expect(a?.sampleValue).toBe(1)
        })
        test("inferSchema marks nullable when first value is null", ()=>{
            let schema: SchemaField[]=inferSchema([{a: null}, {a: 1}])
            let a: SchemaField|undefined=schema.find(f=>f.path==="a")
            expect(a?.nullable).toBe(true)
            expect(a?.type).toBe("number")
            expect(a?.sampleValue).toBe(1)
        })
        test("inferSchema returns sorted by path", ()=>{
            let schema: SchemaField[]=inferSchema({z: 1, a: 2, m: 3})
            expect(schema[0].path).toBe("a")
            expect(schema[1].path).toBe("m")
            expect(schema[2].path).toBe("z")
        })
        test("inferSchema records array type without recursing", ()=>{
            let schema: SchemaField[]=inferSchema({tags: [1, 2, 3]})
            let tags: SchemaField|undefined=schema.find(f=>f.path==="tags")
            expect(tags?.type).toBe("array")
            expect(schema.find(f=>f.path.startsWith("tags."))).toBeUndefined()
        })
    })
    describe("flattenObject", ()=>{
        test("flattenObject flattens nested", ()=>{
            let flat: Record<string, unknown>=flattenObject({a: {b: 1, c: {d: 2}}})
            expect(flat["a.b"]).toBe(1)
            expect(flat["a.c.d"]).toBe(2)
        })
        test("flattenObject preserves arrays", ()=>{
            let flat: Record<string, unknown>=flattenObject({a: [1, 2, 3]})
            expect(flat["a"]).toEqual([1, 2, 3])
        })
        test("flattenObject with prefix", ()=>{
            let flat: Record<string, unknown>=flattenObject({b: 1}, "a")
            expect(flat["a.b"]).toBe(1)
        })
        test("flattenObject handles null values", ()=>{
            let flat: Record<string, unknown>=flattenObject({a: null, b: {c: null}})
            expect(flat["a"]).toBeNull()
            expect(flat["b.c"]).toBeNull()
        })
    })
    describe("parseJson", ()=>{
        test("parseJson object renders as key/value markdown", ()=>{
            let result: ParseResult=parseJson('{"a":1,"b":"x"}')
            expect(result.format).toBe("json")
            expect(result.rowCount).toBe(1)
            expect(result.text).toContain("| key | value |")
            expect(result.text).toContain("| a | 1 |")
            expect(result.text).toContain("| b | x |")
        })
        test("parseJson array renders as table", ()=>{
            let result: ParseResult=parseJson('[{"a":1,"b":"x"},{"a":2,"b":"y"}]')
            expect(result.format).toBe("json")
            expect(result.rowCount).toBe(2)
            expect(result.text).toContain("| a | b |")
            expect(result.text).toContain("| --- | --- |")
            expect(result.text).toContain("| 1 | x |")
            expect(result.text).toContain("| 2 | y |")
        })
        test("parseJson nested array flattens to dot columns", ()=>{
            let result: ParseResult=parseJson('[{"user":{"name":"x"}},{"user":{"name":"y"}}]')
            expect(result.text).toContain("user.name")
            expect(result.text).toContain("x")
            expect(result.text).toContain("y")
        })
        test("parseJson throws on invalid JSON", ()=>{
            expect(()=>parseJson("{invalid}")).toThrow()
        })
        test("parseJson includes schema", ()=>{
            let result: ParseResult=parseJson('{"a":1,"b":"x"}')
            expect(result.schema).toHaveLength(2)
            expect(result.schema.find(f=>f.path==="a")?.type).toBe("number")
            expect(result.schema.find(f=>f.path==="b")?.type).toBe("string")
        })
        test("parseJson array of primitives wraps in value column", ()=>{
            let result: ParseResult=parseJson('[1,2,3]')
            expect(result.format).toBe("json")
            expect(result.rowCount).toBe(3)
            expect(result.text).toContain("| value |")
            expect(result.text).toContain("| 1 |")
            expect(result.text).toContain("| 2 |")
            expect(result.text).toContain("| 3 |")
        })
        test("parseJson array of mixed primitives and objects", ()=>{
            let result: ParseResult=parseJson('[{"a":1},2,{"b":3}]')
            expect(result.rowCount).toBe(3)
            expect(result.text).toContain("a")
            expect(result.text).toContain("b")
            expect(result.text).toContain("value")
        })
        test("parseJson array of strings wraps in value column", ()=>{
            let result: ParseResult=parseJson('["hello","world"]')
            expect(result.rowCount).toBe(2)
            expect(result.text).toContain("| value |")
            expect(result.text).toContain("hello")
            expect(result.text).toContain("world")
        })
        test("parseJson array of nulls wraps in value column", ()=>{
            let result: ParseResult=parseJson('[null,null]')
            expect(result.rowCount).toBe(2)
            expect(result.text).toContain("| value |")
            expect(result.text).toContain("null")
        })
    })
    describe("parseNdjson", ()=>{
        test("parseNdjson parses multiple lines", ()=>{
            let result: ParseResult=parseNdjson('{"a":1}\n{"a":2}')
            expect(result.format).toBe("ndjson")
            expect(result.rowCount).toBe(2)
            expect(result.text).toContain("| a |")
            expect(result.text).toContain("1")
            expect(result.text).toContain("2")
        })
        test("parseNdjson skips invalid lines with warning", ()=>{
            let result: ParseResult=parseNdjson('{"a":1}\ninvalid\n{"a":2}')
            expect(result.rowCount).toBe(2)
            expect(result.warnings).toHaveLength(1)
        })
        test("parseNdjson empty input", ()=>{
            let result: ParseResult=parseNdjson("")
            expect(result.rowCount).toBe(0)
            expect(result.warnings).toHaveLength(0)
        })
        test("parseNdjson handles nested objects", ()=>{
            let result: ParseResult=parseNdjson('{"user":{"name":"x"}}\n{"user":{"name":"y"}}')
            expect(result.rowCount).toBe(2)
            expect(result.text).toContain("user.name")
        })
    })
    describe("parseCsv", ()=>{
        test("parseCsv basic", ()=>{
            let result: ParseResult=parseCsv("a,b,c\n1,2,3\n4,5,6")
            expect(result.format).toBe("csv")
            expect(result.rowCount).toBe(2)
            expect(result.text).toContain("| a | b | c |")
            expect(result.text).toContain("| 1 | 2 | 3 |")
            expect(result.text).toContain("| 4 | 5 | 6 |")
        })
        test("parseCsv with quoted fields", ()=>{
            let result: ParseResult=parseCsv('a,b\n"hello","world"')
            expect(result.rowCount).toBe(1)
            expect(result.text).toContain("hello")
            expect(result.text).toContain("world")
        })
        test("parseCsv with embedded newline in quotes", ()=>{
            let result: ParseResult=parseCsv('a,b\n"line1\nline2","x"')
            expect(result.rowCount).toBe(1)
            expect(result.text).toContain("line1")
            expect(result.text).toContain("line2")
        })
        test("parseCsv with escaped quotes", ()=>{
            let result: ParseResult=parseCsv('a\n"hello ""world"""')
            expect(result.rowCount).toBe(1)
            expect(result.text).toContain('hello "world"')
        })
        test("parseCsv custom delimiter (semicolon)", ()=>{
            let result: ParseResult=parseCsv("a;b;c\n1;2;3", {delimiter: ";"})
            expect(result.rowCount).toBe(1)
            expect(result.text).toContain("| a | b | c |")
            expect(result.text).toContain("| 1 | 2 | 3 |")
        })
        test("parseCsv infers numeric column", ()=>{
            let result: ParseResult=parseCsv("a\n1\n2\n3")
            expect(result.schema[0].type).toBe("number")
        })
        test("parseCsv infers boolean column", ()=>{
            let result: ParseResult=parseCsv("a\ntrue\nfalse\ntrue")
            expect(result.schema[0].type).toBe("boolean")
        })
        test("parseCsv infers string column for mixed values", ()=>{
            let result: ParseResult=parseCsv("a\nhello\nworld")
            expect(result.schema[0].type).toBe("string")
        })
        test("parseCsv handles empty input", ()=>{
            let result: ParseResult=parseCsv("")
            expect(result.rowCount).toBe(0)
        })
    })
    describe("renderMarkdownTable", ()=>{
        test("renderMarkdownTable basic", ()=>{
            let result: string=renderMarkdownTable(["a", "b"], [[1, "x"], [2, "y"]])
            expect(result).toBe("| a | b |\n| --- | --- |\n| 1 | x |\n| 2 | y |")
        })
        test("renderMarkdownTable escapes pipe characters", ()=>{
            let result: string=renderMarkdownTable(["a"], [["x|y"]])
            expect(result).toContain("x\\|y")
        })
        test("renderMarkdownTable empty rows", ()=>{
            let result: string=renderMarkdownTable(["a", "b"], [])
            expect(result).toBe("| a | b |\n| --- | --- |")
        })
        test("renderMarkdownTable handles null values", ()=>{
            let result: string=renderMarkdownTable(["a"], [[null]])
            expect(result).toContain("null")
        })
        test("renderMarkdownTable empty headers returns empty string", ()=>{
            let result: string=renderMarkdownTable([], [])
            expect(result).toBe("")
        })
    })
    describe("detectFormat", ()=>{
        test("detectFormat detects JSON object", ()=>{
            expect(detectFormat('{"a":1}')).toBe("json")
        })
        test("detectFormat detects JSON array", ()=>{
            expect(detectFormat('[{"a":1}]')).toBe("json")
        })
        test("detectFormat detects NDJSON", ()=>{
            expect(detectFormat('{"a":1}\n{"a":2}')).toBe("ndjson")
        })
        test("detectFormat detects CSV", ()=>{
            expect(detectFormat("a,b,c\n1,2,3")).toBe("csv")
        })
    })
    describe("parseAuto", ()=>{
        test("parseAuto dispatches correctly for JSON", ()=>{
            let result: ParseResult=parseAuto('{"a":1}')
            expect(result.format).toBe("json")
        })
        test("parseAuto dispatches correctly for NDJSON", ()=>{
            let result: ParseResult=parseAuto('{"a":1}\n{"a":2}')
            expect(result.format).toBe("ndjson")
        })
        test("parseAuto dispatches correctly for CSV", ()=>{
            let result: ParseResult=parseAuto("a,b\n1,2")
            expect(result.format).toBe("csv")
        })
    })
    describe("JsonCsvParser class", ()=>{
        test("JsonCsvParser class methods delegate correctly", ()=>{
            expect(JsonCsvParser.detectFormat('{"a":1}')).toBe("json")
            let result: ParseResult=JsonCsvParser.parseJson('{"a":1}')
            expect(result.format).toBe("json")
            expect(JsonCsvParser.inferSchema({a: 1})[0].path).toBe("a")
        })
    })
})
