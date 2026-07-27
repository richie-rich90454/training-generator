import {spawn, execFile} from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import {TranscriptionOptions, TranscriptionResult, transcribe} from "./audioTranscriber.js";
export const SUPPORTED_VIDEO_TYPES: string[]=[".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv"];
export interface VideoTranscriptionOptions extends TranscriptionOptions{
    ffmpegPath?: string
    keepAudioFile?: boolean
    audioOutputPath?: string
    startTime?: string
    endTime?: string
}
export interface VideoTranscriptionResult{
    videoPath: string
    audioPath?: string
    transcript: TranscriptionResult
    durationSec?: number
    extractedAt: number
}
export function isVideoFile(filename: string): boolean{
    let ext=path.extname(filename).toLowerCase();
    return SUPPORTED_VIDEO_TYPES.includes(ext);
}
export function extractAudio(videoPath: string, options?: VideoTranscriptionOptions): Promise<{audioPath: string, durationSec?: number}>{
    return new Promise((resolve, reject)=>{
        let ffmpegPath=options?.ffmpegPath??process.env.FFMPEG_PATH??"ffmpeg";
        let audioPath=options?.audioOutputPath??path.join(os.tmpdir(), path.basename(videoPath)+"-"+Date.now()+".wav");
        let args: string[]=["-y"];
        if(options?.startTime){
            args.push("-ss", options.startTime);
        }
        if(options?.endTime){
            args.push("-to", options.endTime);
        }
        args.push("-i", videoPath, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", audioPath);
        let stderr="";
        let proc=spawn(ffmpegPath, args);
        proc.stderr.on("data", (data: Buffer)=>{
            stderr+=data.toString();
        });
        proc.on("close", (code: number|null)=>{
            if(code===0){
                resolve({audioPath: audioPath});
            }
            else{
                reject(new Error("ffmpeg failed with code "+String(code)+": "+stderr));
            }
        });
        proc.on("error", (err: Error)=>{
            reject(new Error("ffmpeg spawn error: "+err.message));
        });
    });
}
export function getVideoDuration(videoPath: string, ffmpegPath?: string): Promise<number|undefined>{
    return new Promise((resolve)=>{
        let ffprobePath="ffprobe";
        if(ffmpegPath){
            ffprobePath=path.join(path.dirname(ffmpegPath), path.basename(ffmpegPath).replace(/ffmpeg/i, "ffprobe"));
        }
        let args=["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", videoPath];
        execFile(ffprobePath, args, (error, stdout, stderr)=>{
            if(error){
                resolve(undefined);
                return;
            }
            let duration=parseFloat(stdout.trim());
            if(isNaN(duration)){
                resolve(undefined);
                return;
            }
            resolve(duration);
        });
    });
}
export async function transcribeVideo(videoPath: string, options?: VideoTranscriptionOptions): Promise<VideoTranscriptionResult>{
    if(!isVideoFile(videoPath)){
        throw new Error("File is not a supported video format: "+videoPath);
    }
    let {audioPath}=await extractAudio(videoPath, options);
    try{
        let buffer=fs.readFileSync(audioPath);
        let transcript=await transcribe(buffer, audioPath, options);
        let durationSec=await getVideoDuration(videoPath, options?.ffmpegPath);
        return{
            videoPath: videoPath,
            audioPath: options?.keepAudioFile?audioPath:undefined,
            transcript: transcript,
            durationSec: durationSec,
            extractedAt: Date.now()
        };
    }
    finally{
        if(!options?.keepAudioFile){
            try{
                fs.unlinkSync(audioPath);
            }
            catch{
                // intentional: best-effort cleanup of temp file; ignore errors if file was already removed
            }
        }
    }
}
