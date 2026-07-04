import{describe, test, expect, vi, beforeEach}from"vitest";
const cpState=vi.hoisted(()=>({
    spawnCode: 0,
    spawnError: null as Error|null,
    spawnStderr: "",
    spawnCalls: [] as {cmd: string, args: string[], proc: any}[],
    execError: null as Error|null,
    execStdout: ""
}));
vi.mock("child_process", ()=>{
    let cp={
        spawn: vi.fn((cmd: string, args: string[])=>{
            let handlers: Record<string, Function[]>={};
            let stderrHandlers: Record<string, Function[]>={};
            let proc={
                stderr: {
                    on: vi.fn((event: string, cb: Function)=>{
                        stderrHandlers[event]=stderrHandlers[event]||[];
                        stderrHandlers[event].push(cb);
                    })
                },
                on: vi.fn((event: string, cb: Function)=>{
                    handlers[event]=handlers[event]||[];
                    handlers[event].push(cb);
                }),
                _emit: (event: string, ...args: any[])=>{
                    let list=handlers[event]||[];
                    for(let cb of list){
                        cb(...args);
                    }
                },
                _emitStderr: (event: string, ...args: any[])=>{
                    let list=stderrHandlers[event]||[];
                    for(let cb of list){
                        cb(...args);
                    }
                }
            };
            cpState.spawnCalls.push({cmd, args, proc});
            process.nextTick(()=>{
                if(cpState.spawnStderr){
                    proc._emitStderr("data", Buffer.from(cpState.spawnStderr));
                }
                if(cpState.spawnError){
                    proc._emit("error", cpState.spawnError);
                }
                else{
                    proc._emit("close", cpState.spawnCode);
                }
            });
            return proc;
        }),
        exec: vi.fn((cmd: string, cb: Function)=>{
            process.nextTick(()=>{
                if(cpState.execError){
                    cb(cpState.execError, "", "");
                }
                else{
                    cb(null, cpState.execStdout, "");
                }
            });
        })
    };
    return{
        ...cp,
        default: cp
    };
});
vi.mock("fs", ()=>{
    return{
        default:{
            readFileSync: vi.fn(()=>Buffer.from("audio")),
            unlinkSync: vi.fn(),
            existsSync: vi.fn(()=>true)
        }
    };
});
vi.mock("path", ()=>{
    return{
        default:{
            join: vi.fn((...parts: string[])=>parts.join("/")),
            basename: vi.fn((p: string)=>p.split("/").pop()||""),
            dirname: vi.fn((p: string)=>p.split("/").slice(0, -1).join("/")||"/"),
            extname: vi.fn((p: string)=>{
                let idx=p.lastIndexOf(".");
                return idx===-1?"":p.slice(idx);
            })
        }
    };
});
vi.mock("os", ()=>{
    return{
        default:{
            tmpdir: vi.fn(()=>"/tmp")
        }
    };
});
vi.mock("../src/core/audioTranscriber.js", ()=>{
    return{
        transcribe: vi.fn(async()=>({
            text: "transcribed text",
            language: "en",
            provider: "local",
            model: "base",
            processingTimeMs: 100
        }))
    };
});
import child_process from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import {transcribe} from "../src/core/audioTranscriber.js";
import{
    SUPPORTED_VIDEO_TYPES,
    isVideoFile,
    extractAudio,
    getVideoDuration,
    transcribeVideo
}from"../src/core/videoTranscriber.js";
beforeEach(()=>{
    vi.clearAllMocks();
    cpState.spawnCode=0;
    cpState.spawnError=null;
    cpState.spawnStderr="";
    cpState.spawnCalls=[];
    cpState.execError=null;
    cpState.execStdout="";
});
describe("SUPPORTED_VIDEO_TYPES", ()=>{
    test("includes mp4", ()=>{
        expect(SUPPORTED_VIDEO_TYPES).toContain(".mp4");
    });
});
describe("isVideoFile", ()=>{
    test("returns true for mp4", ()=>{
        expect(isVideoFile("test.mp4")).toBe(true);
    });
    test("returns true for mkv", ()=>{
        expect(isVideoFile("test.mkv")).toBe(true);
    });
    test("returns false for txt", ()=>{
        expect(isVideoFile("test.txt")).toBe(false);
    });
});
describe("extractAudio", ()=>{
    test("uses provided ffmpegPath", async()=>{
        await extractAudio("/path/to/video.mp4", {ffmpegPath: "/custom/ffmpeg", whisperModel: "base", provider: "local"});
        expect(cpState.spawnCalls.length).toBe(1);
        expect(cpState.spawnCalls[0].cmd).toBe("/custom/ffmpeg");
    });
    test("generates temp path when none provided", async()=>{
        let result=await extractAudio("/path/to/video.mp4", {whisperModel: "base", provider: "local"});
        expect(result.audioPath).toContain("/tmp/");
        expect(result.audioPath).toContain("video.mp4-");
        expect(result.audioPath).toContain(".wav");
    });
    test("passes default ffmpeg command", async()=>{
        await extractAudio("/path/to/video.mp4", {whisperModel: "base", provider: "local"});
        expect(cpState.spawnCalls[0].cmd).toBe("ffmpeg");
        expect(cpState.spawnCalls[0].args).toContain("-y");
        expect(cpState.spawnCalls[0].args).toContain("-i");
        expect(cpState.spawnCalls[0].args).toContain("/path/to/video.mp4");
        expect(cpState.spawnCalls[0].args).toContain("-vn");
        expect(cpState.spawnCalls[0].args).toContain("-acodec");
        expect(cpState.spawnCalls[0].args).toContain("pcm_s16le");
        expect(cpState.spawnCalls[0].args).toContain("-ar");
        expect(cpState.spawnCalls[0].args).toContain("16000");
        expect(cpState.spawnCalls[0].args).toContain("-ac");
        expect(cpState.spawnCalls[0].args).toContain("1");
    });
    test("includes startTime and endTime args", async()=>{
        await extractAudio("/path/to/video.mp4", {startTime: "00:00:10", endTime: "00:00:20", whisperModel: "base", provider: "local"});
        let args=cpState.spawnCalls[0].args;
        let ssIdx=args.indexOf("-ss");
        let toIdx=args.indexOf("-to");
        expect(ssIdx).toBeGreaterThan(-1);
        expect(args[ssIdx+1]).toBe("00:00:10");
        expect(toIdx).toBeGreaterThan(-1);
        expect(args[toIdx+1]).toBe("00:00:20");
    });
    test("rejects on ffmpeg error", async()=>{
        cpState.spawnCode=1;
        cpState.spawnStderr="conversion failed";
        await expect(extractAudio("/path/to/video.mp4", {whisperModel: "base", provider: "local"})).rejects.toThrow("ffmpeg failed");
    });
});
describe("getVideoDuration", ()=>{
    test("parses float from ffprobe", async()=>{
        cpState.execStdout="45.5\n";
        let duration=await getVideoDuration("/path/to/video.mp4");
        expect(duration).toBe(45.5);
    });
    test("returns undefined on failure", async()=>{
        cpState.execError=new Error("ffprobe failed");
        let duration=await getVideoDuration("/path/to/video.mp4");
        expect(duration).toBeUndefined();
    });
});
describe("transcribeVideo", ()=>{
    test("validates video file", async()=>{
        await expect(transcribeVideo("test.txt", {whisperModel: "base", provider: "local"})).rejects.toThrow("not a supported video format");
    });
    test("extracts audio and transcribes", async()=>{
        let result=await transcribeVideo("/path/to/video.mp4", {whisperModel: "base", provider: "local"});
        expect(result.videoPath).toBe("/path/to/video.mp4");
        expect(result.transcript.text).toBe("transcribed text");
        expect(transcribe).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), expect.any(Object));
    });
    test("returns duration when available", async()=>{
        cpState.execStdout="45.5\n";
        let result=await transcribeVideo("/path/to/video.mp4", {whisperModel: "base", provider: "local"});
        expect(result.durationSec).toBe(45.5);
    });
    test("cleans up temp audio when keepAudioFile=false", async()=>{
        await transcribeVideo("/path/to/video.mp4", {whisperModel: "base", provider: "local"});
        expect(fs.unlinkSync).toHaveBeenCalled();
    });
    test("keeps audio when keepAudioFile=true", async()=>{
        await transcribeVideo("/path/to/video.mp4", {keepAudioFile: true, whisperModel: "base", provider: "local"});
        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
    test("uses provided audioOutputPath", async()=>{
        let result=await transcribeVideo("/path/to/video.mp4", {audioOutputPath: "/custom/output.wav", keepAudioFile: true, whisperModel: "base", provider: "local"});
        expect(result.audioPath).toBe("/custom/output.wav");
        expect(cpState.spawnCalls[0].args).toContain("/custom/output.wav");
    });
    test("passes through options", async()=>{
        let options={whisperModel: "tiny", language: "es", provider: "openai" as const, openaiApiKey: "key", temperature: 0.5};
        await transcribeVideo("/path/to/video.mp4", options);
        expect(transcribe).toHaveBeenCalledWith(expect.any(Buffer), expect.any(String), expect.objectContaining({
            whisperModel: "tiny",
            language: "es",
            provider: "openai",
            openaiApiKey: "key",
            temperature: 0.5
        }));
    });
});
