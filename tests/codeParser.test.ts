import { describe, test, expect } from "vitest";
import { detectLanguage, isCodeFile, extractImports, extractTypeDeclarations, chunkCode, parseCode } from "../src/core/codeParser.js";
describe("codeParser", ()=>{
    describe("detectLanguage", ()=>{
        test("detectLanguage for .ts", ()=>{
            expect(detectLanguage("foo.ts")).toBe("typescript");
        });
        test("detectLanguage for .py", ()=>{
            expect(detectLanguage("foo.py")).toBe("python");
        });
        test("detectLanguage for .rs", ()=>{
            expect(detectLanguage("foo.rs")).toBe("rust");
        });
        test("detectLanguage for .go", ()=>{
            expect(detectLanguage("foo.go")).toBe("go");
        });
        test("detectLanguage for .java", ()=>{
            expect(detectLanguage("foo.java")).toBe("java");
        });
        test("detectLanguage returns undefined for .txt", ()=>{
            expect(detectLanguage("foo.txt")).toBeUndefined();
        });
    });
    describe("isCodeFile", ()=>{
        test("isCodeFile true for .ts", ()=>{
            expect(isCodeFile("foo.ts")).toBe(true);
        });
        test("isCodeFile false for .txt", ()=>{
            expect(isCodeFile("foo.txt")).toBe(false);
        });
    });
    describe("extractImports", ()=>{
        test("extractImports for TypeScript", ()=>{
            let text='import { foo } from "bar";\nimport "baz";\nconst x=require("y");\nfunction a(){}';
            let result=extractImports(text, "typescript");
            expect(result).toContain('import { foo } from "bar"');
            expect(result).toContain('import "baz"');
            expect(result).toContain('const x=require("y")');
            expect(result).not.toContain("function a(){}");
        });
        test("extractImports for Python", ()=>{
            let text="import os\nfrom sys import path\ndef foo():\n    pass";
            let result=extractImports(text, "python");
            expect(result).toContain("import os");
            expect(result).toContain("from sys import path");
            expect(result).not.toContain("def foo():");
        });
        test("extractImports for Rust", ()=>{
            let text="use std::io;\nmod helper;\nextern crate foo;\nfn main(){}";
            let result=extractImports(text, "rust");
            expect(result).toContain("use std::io;");
            expect(result).toContain("mod helper;");
            expect(result).toContain("extern crate foo;");
            expect(result).not.toContain("fn main(){}");
        });
        test("extractImports for Go", ()=>{
            let text='import "fmt"\nimport (\n    "os"\n    "strings"\n)\nfunc main(){}';
            let result=extractImports(text, "go");
            expect(result).toContain('import "fmt"');
            expect(result).toContain("import (");
            expect(result).toContain('"os"');
            expect(result).toContain('"strings"');
            expect(result).toContain(")");
            expect(result).not.toContain("func main(){}");
        });
    });
    describe("extractTypeDeclarations", ()=>{
        test("extractTypeDeclarations for TypeScript interface", ()=>{
            let text="interface User {\n    name: string;\n}\nfunction a(){}";
            let result=extractTypeDeclarations(text, "typescript");
            expect(result).toContain("interface User {");
            expect(result).not.toContain("function a(){}");
        });
        test("extractTypeDeclarations for Rust struct", ()=>{
            let text="struct Point {\n    x: i32,\n    y: i32,\n}\nfn main(){}";
            let result=extractTypeDeclarations(text, "rust");
            expect(result).toContain("struct Point {");
            expect(result).toContain("x: i32,");
            expect(result).not.toContain("fn main(){}");
        });
        test("extractTypeDeclarations for Python class", ()=>{
            let text="class Foo:\n    def __init__(self):\n        pass\ndef bar():\n    pass";
            let result=extractTypeDeclarations(text, "python");
            expect(result).toContain("class Foo:");
            expect(result).toContain("def __init__(self):");
            expect(result).not.toContain("def bar():");
        });
    });
    describe("chunkCode", ()=>{
        test("chunkCode splits JS function", ()=>{
            let text="function foo() {\n    return 1;\n}\nfunction bar() {\n    return 2;\n}";
            let chunks=chunkCode(text, "javascript");
            let names=chunks.map(c=>c.name);
            expect(names).toContain("foo");
            expect(names).toContain("bar");
            let fooChunk=chunks.find(c=>c.name==="foo");
            expect(fooChunk?.type).toBe("function");
            expect(fooChunk?.text).toContain("function foo() {");
            expect(fooChunk?.text).toContain("return 1;");
        });
        test("chunkCode splits JS class", ()=>{
            let text="class Foo {\n    constructor() {\n        this.x=1;\n    }\n}\nclass Bar {}";
            let chunks=chunkCode(text, "javascript");
            let names=chunks.map(c=>c.name);
            expect(names).toContain("Foo");
            expect(names).toContain("Bar");
            let fooChunk=chunks.find(c=>c.name==="Foo");
            expect(fooChunk?.type).toBe("class");
            expect(fooChunk?.text).toContain("class Foo {");
        });
        test("chunkCode splits Python function", ()=>{
            let text="def foo():\n    return 1\n\ndef bar():\n    return 2";
            let chunks=chunkCode(text, "python");
            let names=chunks.map(c=>c.name);
            expect(names).toContain("foo");
            expect(names).toContain("bar");
            let fooChunk=chunks.find(c=>c.name==="foo");
            expect(fooChunk?.type).toBe("function");
            expect(fooChunk?.text).toContain("def foo():");
            expect(fooChunk?.text).toContain("return 1");
        });
        test("chunkCode splits Rust function", ()=>{
            let text="fn foo() {\n    let x=1;\n}\nfn bar() {\n    let y=2;\n}";
            let chunks=chunkCode(text, "rust");
            let names=chunks.map(c=>c.name);
            expect(names).toContain("foo");
            expect(names).toContain("bar");
            let fooChunk=chunks.find(c=>c.name==="foo");
            expect(fooChunk?.type).toBe("function");
            expect(fooChunk?.text).toContain("fn foo() {");
        });
        test("chunkCode splits Go function", ()=>{
            let text="func foo() {\n    x:=1\n}\nfunc bar() {\n    y:=2\n}";
            let chunks=chunkCode(text, "go");
            let names=chunks.map(c=>c.name);
            expect(names).toContain("foo");
            expect(names).toContain("bar");
            let fooChunk=chunks.find(c=>c.name==="foo");
            expect(fooChunk?.type).toBe("function");
            expect(fooChunk?.text).toContain("func foo() {");
        });
        test("chunkCode splits Java class", ()=>{
            let text="public class Foo {\n    public Foo() {\n        this.x=1;\n    }\n}\nclass Bar {}";
            let chunks=chunkCode(text, "java");
            let names=chunks.map(c=>c.name);
            expect(names).toContain("Foo");
            expect(names).toContain("Bar");
            let fooChunk=chunks.find(c=>c.name==="Foo");
            expect(fooChunk?.type).toBe("class");
            expect(fooChunk?.text).toContain("public class Foo {");
        });
    });
    describe("parseCode", ()=>{
        test("parseCode returns full result for TypeScript", ()=>{
            let text='import { foo } from "bar";\ninterface User {\n    name: string;\n}\nfunction greet() {\n    return "hi";\n}';
            let result=parseCode(text, "test.ts");
            expect(result.language).toBe("typescript");
            expect(result.imports).toContain('import { foo } from "bar"');
            expect(result.typeDeclarations).toContain("interface User {");
            expect(result.chunks.length).toBeGreaterThan(0);
            let names=result.chunks.map(c=>c.name);
            expect(names).toContain("greet");
            expect(result.chunks[0].startLine).toBeGreaterThan(0);
        });
        test("parseCode throws for unsupported file", ()=>{
            expect(()=>parseCode("hello", "foo.txt")).toThrow("Unsupported code file: foo.txt");
        });
    });
});