import{describe, test, expect, vi, beforeEach}from"vitest";
vi.mock("axios", ()=>{
    return{
        default:{
            get: vi.fn()
        }
    };
});
vi.mock("html-to-text", ()=>{
    return{
        convert: vi.fn((html: string)=>"CONVERTED:"+html),
        htmlToText: vi.fn((html: string)=>"CONVERTED:"+html)
    };
});
import axios from"axios";
import {convert}from"html-to-text";
import{DEFAULT_FETCH_OPTIONS, sanitizeHtml, extractTitle, extractMainContent, fetchUrl, isValidUrl}from"../src/core/webFetcher.js";
beforeEach(()=>{
    vi.clearAllMocks();
});
describe("DEFAULT_FETCH_OPTIONS", ()=>{
    test("has expected fields", ()=>{
        expect(DEFAULT_FETCH_OPTIONS.timeoutMs).toBe(30000);
        expect(DEFAULT_FETCH_OPTIONS.userAgent).toBe("TrainingGenerator/2.0");
        expect(DEFAULT_FETCH_OPTIONS.maxRedirects).toBe(5);
        expect(DEFAULT_FETCH_OPTIONS.sanitizeHtml).toBe(true);
    });
});
describe("sanitizeHtml", ()=>{
    test("strips script tags and content", ()=>{
        let input='<p>hello</p><script>alert(1)</script><p>world</p>';
        let result=sanitizeHtml(input);
        expect(result).not.toContain("script");
        expect(result).not.toContain("alert(1)");
        expect(result).toContain("hello");
        expect(result).toContain("world");
    });
    test("strips style tags", ()=>{
        let input='<style>.x{color:red}</style><p>hi</p>';
        let result=sanitizeHtml(input);
        expect(result).not.toContain("style");
        expect(result).not.toContain("color:red");
        expect(result).toContain("hi");
    });
    test("strips HTML comments", ()=>{
        let input='<p>a</p><!-- comment --><p>b</p>';
        let result=sanitizeHtml(input);
        expect(result).not.toContain("comment");
        expect(result).not.toContain("<!--");
        expect(result).toContain("a");
        expect(result).toContain("b");
    });
    test("strips on* event handlers", ()=>{
        let input='<div onclick="alert(1)" onload="foo()">text</div>';
        let result=sanitizeHtml(input);
        expect(result).not.toContain("onclick");
        expect(result).not.toContain("onload");
        expect(result).toContain("text");
    });
    test("strips javascript: URLs", ()=>{
        let input='<a href="javascript:alert(1)">click</a>';
        let result=sanitizeHtml(input);
        expect(result).not.toContain("javascript:");
        expect(result).toContain("click");
    });
    test("preserves regular content", ()=>{
        let input='<p>hello <a href="https://example.com">link</a></p>';
        let result=sanitizeHtml(input);
        expect(result).toContain("hello");
        expect(result).toContain("link");
        expect(result).toContain("https://example.com");
    });
});
describe("extractTitle", ()=>{
    test("returns title text", ()=>{
        let html='<html><head><title>My Page</title></head><body></body></html>';
        expect(extractTitle(html)).toBe("My Page");
    });
    test("returns undefined for missing title", ()=>{
        let html='<html><body>no title</body></html>';
        expect(extractTitle(html)).toBeUndefined();
    });
    test("is case-insensitive", ()=>{
        let html='<TITLE>Case Title</TITLE>';
        expect(extractTitle(html)).toBe("Case Title");
    });
});
describe("extractMainContent", ()=>{
    test("prefers <main>", ()=>{
        let html='<body><div>nav</div><main>main content</main><article>article content</article></body>';
        extractMainContent(html);
        expect(convert).toHaveBeenCalledWith("main content", expect.anything());
    });
    test("falls back to <article>", ()=>{
        let html='<body><div>nav</div><article>article content</article></body>';
        extractMainContent(html);
        expect(convert).toHaveBeenCalledWith("article content", expect.anything());
    });
    test("falls back to body", ()=>{
        let html='<body><p>body content</p></body>';
        extractMainContent(html);
        expect(convert).toHaveBeenCalledWith("<p>body content</p>", expect.anything());
    });
    test("returns text (mocked convert)", ()=>{
        let html='<main>hello</main>';
        let result=extractMainContent(html);
        expect(result).toBe("CONVERTED:hello");
    });
});
describe("isValidUrl", ()=>{
    test("accepts http URLs", ()=>{
        expect(isValidUrl("http://example.com")).toBe(true);
    });
    test("accepts https URLs", ()=>{
        expect(isValidUrl("https://example.com")).toBe(true);
    });
    test("rejects ftp", ()=>{
        expect(isValidUrl("ftp://example.com")).toBe(false);
    });
    test("rejects malformed", ()=>{
        expect(isValidUrl("not a url")).toBe(false);
        expect(isValidUrl("")).toBe(false);
    });
});
describe("fetchUrl", ()=>{
    test("returns FetchResult on success", async()=>{
        let mockResponse={
            status: 200,
            data: '<html><head><title>Test</title></head><body><main>content</main></body></html>',
            headers: {"content-type": "text/html; charset=utf-8"},
            request: {res: {responseUrl: "https://example.com/final"}}
        };
        (axios.get as any).mockResolvedValue(mockResponse);
        let result=await fetchUrl({url: "https://example.com"});
        expect(result.url).toBe("https://example.com");
        expect(result.finalUrl).toBe("https://example.com/final");
        expect(result.status).toBe(200);
        expect(result.contentType).toContain("text/html");
        expect(result.bytes).toBeGreaterThan(0);
        expect(result.fetchedAt).toBeGreaterThan(0);
    });
    test("extracts title from response", async()=>{
        let mockResponse={
            status: 200,
            data: '<html><head><title>My Title</title></head><body><main>x</main></body></html>',
            headers: {"content-type": "text/html"},
            request: {res: {responseUrl: "https://example.com"}}
        };
        (axios.get as any).mockResolvedValue(mockResponse);
        let result=await fetchUrl({url: "https://example.com"});
        expect(result.title).toBe("My Title");
    });
    test("throws on non-2xx", async()=>{
        let error={response: {status: 404, headers: {"content-type": "text/html"}}};
        (axios.get as any).mockRejectedValue(error);
        await expect(fetchUrl({url: "https://example.com"})).rejects.toThrow();
    });
    test("throws on non-html content type", async()=>{
        let mockResponse={
            status: 200,
            data: '{"key":"value"}',
            headers: {"content-type": "application/json"},
            request: {res: {responseUrl: "https://example.com"}}
        };
        (axios.get as any).mockResolvedValue(mockResponse);
        await expect(fetchUrl({url: "https://example.com"})).rejects.toThrow();
    });
    test("throws on network error", async()=>{
        (axios.get as any).mockRejectedValue(new Error("ECONNREFUSED"));
        await expect(fetchUrl({url: "https://example.com"})).rejects.toThrow();
    });
    test("respects timeout option", async()=>{
        let mockResponse={
            status: 200,
            data: '<html><body><main>x</main></body></html>',
            headers: {"content-type": "text/html"},
            request: {res: {responseUrl: "https://example.com"}}
        };
        (axios.get as any).mockResolvedValue(mockResponse);
        await fetchUrl({url: "https://example.com", timeoutMs: 5000});
        expect(axios.get).toHaveBeenCalledWith("https://example.com", expect.objectContaining({timeout: 5000}));
    });
});
