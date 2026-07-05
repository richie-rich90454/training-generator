import fs from "fs"
interface MmapReaderOptions{
    filePath: string
    thresholdBytes?: number
}
interface ReadFileSmartResult{
    content: Buffer|string
    usedMmap: boolean
}
class MmapReader{
    filePath: string
    thresholdBytes: number
    constructor(options: MmapReaderOptions){
        this.filePath=options.filePath;
        this.thresholdBytes=options.thresholdBytes??100*1024*1024;
    }
    shouldUseMmap(size: number): boolean{
        return size>=this.thresholdBytes;
    }
    async getSize(): Promise<number>{
        let stats=await fs.promises.stat(this.filePath);
        return stats.size;
    }
    async read(): Promise<Buffer|string>{
        let size=await this.getSize();
        if (this.shouldUseMmap(size)){
            try{
                let mmapIo=await import("mmap-io") as any;
                let fd=fs.openSync(this.filePath, "r");
                try{
                    let mappedBuffer=mmapIo.map(size, mmapIo.PROT_READ, mmapIo.MAP_SHARED, fd) as Buffer;
                    return mappedBuffer;
                }
                finally{
                    fs.closeSync(fd);
                }
            }
            catch (error){
                console.warn("mmap-io not available or failed, falling back to fs.readFile:", error);
                return await fs.promises.readFile(this.filePath);
            }
        }
        return await fs.promises.readFile(this.filePath);
    }
}
async function readFileSmart(filePath: string, thresholdBytes?: number): Promise<ReadFileSmartResult>{
    let reader=new MmapReader({ filePath, thresholdBytes });
    let size=await reader.getSize();
    let usedMmap=reader.shouldUseMmap(size);
    let content=await reader.read();
    return { content, usedMmap };
}
function chunkMmapBuffer(buffer: Buffer, chunkSize: number): Buffer[]{
    let chunks: Buffer[]=[];
    if (chunkSize<=0){
        return chunks;
    }
    for (let i=0; i<buffer.length; i+=chunkSize){
        let end=Math.min(i+chunkSize, buffer.length);
        chunks.push(buffer.subarray(i, end));
    }
    return chunks;
}
export{MmapReader, readFileSmart, chunkMmapBuffer};
