import{describe, test, expect, vi, beforeEach}from"vitest";
vi.mock("axios", ()=>{
    return{
        default:{
            get: vi.fn()
        }
    };
});
import axios from"axios";
import{extractVideoId, decodeHtmlEntities, parseTranscriptXml, listAvailableLanguages, fetchTranscript, formatTranscript}from"../src/core/youtubeTranscript.js";
beforeEach(()=>{
    vi.clearAllMocks();
});
function makeHtml(captionTracks: any[]|undefined): string{
    let playerResponse: any={};
    if(captionTracks!==undefined){
        playerResponse.captions={playerCaptionsTracklistRenderer: {captionTracks: captionTracks}};
    }
    return '<script>var ytInitialPlayerResponse ='+JSON.stringify(playerResponse)+';</script>';
}
let sampleXml='<?xml version="1.0"?><transcript><text start="1.5" dur="2.0">Hello world</text><text start="3.7" dur="2.3">Foo bar</text></transcript>';
describe("extractVideoId", ()=>{
    test("extracts from watch URL", ()=>{
        expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
    test("extracts from youtu.be short URL", ()=>{
        expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
    test("extracts from embed URL", ()=>{
        expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
    test("extracts from shorts URL", ()=>{
        expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
    test("returns null for non-YouTube URL", ()=>{
        expect(extractVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBe(null);
    });
    test("returns null for invalid ID", ()=>{
        expect(extractVideoId("https://www.youtube.com/watch?v=short")).toBe(null);
    });
});
describe("parseTranscriptXml", ()=>{
    test("parses single segment", ()=>{
        let xml='<transcript><text start="1.5" dur="2.0">Hello world</text></transcript>';
        let segments=parseTranscriptXml(xml);
        expect(segments).toHaveLength(1);
        expect(segments[0].text).toBe("Hello world");
        expect(segments[0].startMs).toBe(1500);
        expect(segments[0].durationMs).toBe(2000);
    });
    test("parses multiple segments", ()=>{
        let xml='<transcript><text start="1.5" dur="2.0">Hello</text><text start="3.5" dur="1.0">World</text></transcript>';
        let segments=parseTranscriptXml(xml);
        expect(segments).toHaveLength(2);
        expect(segments[0].text).toBe("Hello");
        expect(segments[1].text).toBe("World");
    });
    test("handles empty transcript", ()=>{
        let xml='<transcript></transcript>';
        let segments=parseTranscriptXml(xml);
        expect(segments).toHaveLength(0);
    });
    test("skips empty text entries", ()=>{
        let xml='<transcript><text start="1.5" dur="2.0">   </text><text start="3.5" dur="1.0">World</text></transcript>';
        let segments=parseTranscriptXml(xml);
        expect(segments).toHaveLength(1);
        expect(segments[0].text).toBe("World");
    });
    test("decodes HTML entities", ()=>{
        let xml='<transcript><text start="1.5" dur="2.0">&amp;&lt;&gt;&quot;&#39;</text></transcript>';
        let segments=parseTranscriptXml(xml);
        expect(segments[0].text).toBe('&<>"\'');
    });
    test("converts seconds to milliseconds", ()=>{
        let xml='<transcript><text start="12.345" dur="6.789">Test</text></transcript>';
        let segments=parseTranscriptXml(xml);
        expect(segments[0].startMs).toBe(12345);
        expect(segments[0].durationMs).toBe(6789);
    });
});
describe("decodeHtmlEntities", ()=>{
    test("replaces common entities", ()=>{
        expect(decodeHtmlEntities("&amp;&lt;&gt;&quot;&#39;&apos;")).toBe('&<>"\'\'');
    });
    test("replaces numeric entities", ()=>{
        expect(decodeHtmlEntities("&#65;&#66;&#67;")).toBe("ABC");
    });
});
describe("formatTranscript", ()=>{
    let transcript={
        videoId: "test",
        language: "en",
        segments: [
            {startMs: 1500, durationMs: 2000, text: "Hello"},
            {startMs: 3700, durationMs: 2300, text: "World"}
        ],
        fetchedAt: 1000
    };
    test("joins text only by default", ()=>{
        expect(formatTranscript(transcript)).toBe("Hello World");
    });
    test("includes timestamps when enabled", ()=>{
        let result=formatTranscript(transcript, {includeTimestamps: true});
        expect(result).toBe("[00:01] Hello [00:03] World");
    });
    test("uses custom separator", ()=>{
        expect(formatTranscript(transcript, {separator: " | "})).toBe("Hello | World");
    });
});
describe("listAvailableLanguages", ()=>{
    test("returns array", async()=>{
        let html=makeHtml([
            {languageCode: "en", baseUrl: "https://example.com/en"},
            {languageCode: "es", baseUrl: "https://example.com/es"}
        ]);
        (axios.get as any).mockResolvedValue({data: html});
        let langs=await listAvailableLanguages("dQw4w9WgXcQ");
        expect(langs).toEqual(["en", "es"]);
    });
    test("returns empty on parse failure", async()=>{
        (axios.get as any).mockResolvedValue({data: "<html>no player response</html>"});
        let langs=await listAvailableLanguages("dQw4w9WgXcQ");
        expect(langs).toEqual([]);
    });
});
describe("fetchTranscript", ()=>{
    test("returns transcript", async()=>{
        let html=makeHtml([
            {languageCode: "en", baseUrl: "https://example.com/caption.xml"},
            {languageCode: "es", baseUrl: "https://example.com/caption_es.xml"}
        ]);
        (axios.get as any).mockImplementation((url: string)=>{
            if(url.includes("youtube.com")){
                return Promise.resolve({data: html});
            }
            if(url.includes("example.com")){
                return Promise.resolve({data: sampleXml});
            }
            return Promise.reject(new Error("Unexpected URL"));
        });
        let result=await fetchTranscript("dQw4w9WgXcQ");
        expect(result.videoId).toBe("dQw4w9WgXcQ");
        expect(result.language).toBe("en");
        expect(result.segments).toHaveLength(2);
        expect(result.segments[0].text).toBe("Hello world");
        expect(result.fetchedAt).toBeGreaterThan(0);
    });
    test("throws when no captions available", async()=>{
        let html=makeHtml(undefined);
        (axios.get as any).mockResolvedValue({data: html});
        await expect(fetchTranscript("dQw4w9WgXcQ")).rejects.toThrow("No captions available for video");
    });
    test("falls back to first language if requested not available", async()=>{
        let html=makeHtml([
            {languageCode: "en", baseUrl: "https://example.com/en.xml"},
            {languageCode: "es", baseUrl: "https://example.com/es.xml"}
        ]);
        (axios.get as any).mockImplementation((url: string)=>{
            if(url.includes("youtube.com")){
                return Promise.resolve({data: html});
            }
            if(url.includes("example.com")){
                return Promise.resolve({data: sampleXml});
            }
            return Promise.reject(new Error("Unexpected URL"));
        });
        let result=await fetchTranscript("dQw4w9WgXcQ", {language: "fr"});
        expect(result.language).toBe("en");
    });
});
