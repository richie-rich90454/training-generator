import{describe, test, expect, vi, beforeEach}from"vitest";
const whisperState=vi.hoisted(()=>({
    shouldThrow: false,
    result: {content: "Hello from local whisper"},
    lastConfig: null as any
}));
vi.mock("node-whisper", ()=>{
    return{
        default: class{
            constructor(config: any){
                if(whisperState.shouldThrow){
                    throw new Error("Cannot initialize whisper");
                }
                whisperState.lastConfig=config;
            }
            async transcribe(){
                return whisperState.result;
            }
        }
    };
});
vi.mock("axios", ()=>{
    return{
        default:{
            post: vi.fn()
        }
    };
});
import axios from"axios";
import{
    SUPPORTED_AUDIO_TYPES,
    DEFAULT_TRANSCRIPTION_OPTIONS,
    isAudioFile,
    formatTimestamp,
    formatTranscriptWithTimestamps,
    transcribe,
    transcribeLocal,
    transcribeOpenAI
}from"../src/core/audioTranscriber.js";
beforeEach(()=>{
    vi.clearAllMocks();
    vi.resetModules();
    whisperState.shouldThrow=false;
    whisperState.result={content: "Hello from local whisper"};
    whisperState.lastConfig=null;
});
describe("SUPPORTED_AUDIO_TYPES", ()=>{
    test("includes mp3, wav, flac", ()=>{
        let extensions=SUPPORTED_AUDIO_TYPES.map(f=>f.extension);
        expect(extensions).toContain("mp3");
        expect(extensions).toContain("wav");
        expect(extensions).toContain("flac");
    });
});
describe("isAudioFile", ()=>{
    test("returns true for mp3", ()=>{
        expect(isAudioFile("test.mp3")).toBe(true);
    });
    test("returns false for txt", ()=>{
        expect(isAudioFile("test.txt")).toBe(false);
    });
    test("returns false for pdf", ()=>{
        expect(isAudioFile("test.pdf")).toBe(false);
    });
});
describe("DEFAULT_TRANSCRIPTION_OPTIONS", ()=>{
    test("has expected fields", ()=>{
        expect(DEFAULT_TRANSCRIPTION_OPTIONS.whisperModel).toBe("base");
        expect(DEFAULT_TRANSCRIPTION_OPTIONS.provider).toBe("local");
        expect(DEFAULT_TRANSCRIPTION_OPTIONS.timeoutMs).toBe(600000);
        expect(DEFAULT_TRANSCRIPTION_OPTIONS.temperature).toBe(0);
    });
});
describe("formatTimestamp", ()=>{
    test("formats correctly", ()=>{
        expect(formatTimestamp(3661500)).toBe("01:01:01.500");
    });
    test("handles 0", ()=>{
        expect(formatTimestamp(0)).toBe("00:00:00.000");
    });
    test("handles large values over 1 hour", ()=>{
        expect(formatTimestamp(3723000)).toBe("01:02:03.000");
    });
});
describe("formatTranscriptWithTimestamps", ()=>{
    test("returns text when no segments", ()=>{
        let result={text: "hello world", language: "en", provider: "local", model: "base", processingTimeMs: 0};
        expect(formatTranscriptWithTimestamps(result)).toBe("hello world");
    });
    test("formats segments with timestamps", ()=>{
        let result={
            text: "hello world",
            language: "en",
            provider: "local",
            model: "base",
            processingTimeMs: 0,
            segments: [
                {startMs: 1500, endMs: 2000, text: "Hello"},
                {startMs: 2000, endMs: 3500, text: "World"}
            ]
        };
        let formatted=formatTranscriptWithTimestamps(result);
        expect(formatted).toContain("[00:00:01.500 -> 00:00:02.000] Hello");
        expect(formatted).toContain("[00:00:02.000 -> 00:00:03.500] World");
        expect(formatted.split("\n")).toHaveLength(2);
    });
});
describe("transcribe", ()=>{
    test("throws for non-audio file", async()=>{
        await expect(transcribe(Buffer.from("data"), "test.txt", {provider: "local"})).rejects.toThrow("not a supported audio format");
    });
    test("throws for unsupported provider", async()=>{
        await expect(transcribe(Buffer.from("data"), "test.mp3", {provider: "unsupported" as any, whisperModel: "base"})).rejects.toThrow("Unsupported transcription provider");
    });
    test("merges with default options", async()=>{
        let result=await transcribe(Buffer.from("data"), "test.mp3", {provider: "local"});
        expect(result.model).toBe("base");
        expect(result.provider).toBe("local");
    });
    test("sets processingTimeMs", async()=>{
        let result=await transcribe(Buffer.from("data"), "test.mp3", {provider: "local"});
        expect(typeof result.processingTimeMs).toBe("number");
        expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
});
describe("transcribeLocal", ()=>{
    test("throws when local whisper not available", async()=>{
        whisperState.shouldThrow=true;
        await expect(transcribeLocal(Buffer.from("data"), "test.mp3", {whisperModel: "base", provider: "local"})).rejects.toThrow("Local Whisper not available");
    });
    test("returns result when available", async()=>{
        let result=await transcribeLocal(Buffer.from("data"), "test.mp3", {whisperModel: "base", provider: "local"});
        expect(result.provider).toBe("local");
        expect(result.text).toBe("Hello from local whisper");
        expect(result.model).toBe("base");
    });
    test("passes model option", async()=>{
        await transcribeLocal(Buffer.from("data"), "test.mp3", {whisperModel: "tiny", provider: "local"});
        expect(whisperState.lastConfig).toBeTruthy();
        expect(whisperState.lastConfig.modelPath).toBe("tiny");
    });
});
describe("transcribeOpenAI", ()=>{
    let defaultOptions={whisperModel: "base", provider: "openai" as const, openaiApiKey: "testkey"};
    test("posts to correct URL", async()=>{
        (axios.post as any).mockResolvedValue({status: 200, data: {text: "hello"}});
        await transcribeOpenAI(Buffer.from("audio"), "test.mp3", defaultOptions);
        let callArgs=(axios.post as any).mock.calls[0];
        expect(callArgs[0]).toBe("https://api.openai.com/v1/audio/transcriptions");
    });
    test("sets Authorization header", async()=>{
        (axios.post as any).mockResolvedValue({status: 200, data: {text: "hello"}});
        await transcribeOpenAI(Buffer.from("audio"), "test.mp3", {whisperModel: "base", provider: "openai", openaiApiKey: "mykey"});
        let callArgs=(axios.post as any).mock.calls[0];
        let config=callArgs[2];
        expect(config.headers.Authorization).toBe("Bearer mykey");
    });
    test("includes model in form data", async()=>{
        (axios.post as any).mockResolvedValue({status: 200, data: {text: "hello"}});
        await transcribeOpenAI(Buffer.from("audio"), "test.mp3", defaultOptions);
        let callArgs=(axios.post as any).mock.calls[0];
        let form=callArgs[1];
        expect(form.get("model")).toBe("whisper-1");
    });
    test("returns TranscriptionResult", async()=>{
        (axios.post as any).mockResolvedValue({status: 200, data: {text: "transcribed text", language: "en", duration: 5.5}});
        let result=await transcribeOpenAI(Buffer.from("audio"), "test.mp3", defaultOptions);
        expect(result.provider).toBe("openai");
        expect(result.model).toBe("whisper-1");
        expect(result.text).toBe("transcribed text");
        expect(result.language).toBe("en");
        expect(result.durationSec).toBe(5.5);
    });
    test("throws on non-2xx", async()=>{
        (axios.post as any).mockResolvedValue({status: 400, data: {error: "bad request"}});
        await expect(transcribeOpenAI(Buffer.from("audio"), "test.mp3", defaultOptions)).rejects.toThrow();
    });
    test("throws on network error", async()=>{
        (axios.post as any).mockRejectedValue(new Error("Network Error"));
        await expect(transcribeOpenAI(Buffer.from("audio"), "test.mp3", defaultOptions)).rejects.toThrow();
    });
    test("includes language option when provided", async()=>{
        (axios.post as any).mockResolvedValue({status: 200, data: {text: "hello"}});
        await transcribeOpenAI(Buffer.from("audio"), "test.mp3", {whisperModel: "base", provider: "openai", openaiApiKey: "key", language: "es"});
        let callArgs=(axios.post as any).mock.calls[0];
        let form=callArgs[1];
        expect(form.get("language")).toBe("es");
    });
});
