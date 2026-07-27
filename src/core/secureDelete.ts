import fs from "fs"
import path from "path"
import crypto from "node:crypto"
export class SecureDelete{
    passes: number
    constructor(options?: {passes?: number}){
        this.passes=options?.passes??3
    }
    generateRandomBuffer(size: number): Buffer{
        return crypto.randomBytes(size)
    }
    async deleteFile(filePath: string): Promise<void>{
        let stat=await fs.promises.stat(filePath)
        let size=stat.size
        let fileHandle=await fs.promises.open(filePath, "r+")
        try{
            for(let pass=0; pass<this.passes; pass++){
                let written=0
                while(written<size){
                    let chunkSize=Math.min(4096, size-written)
                    let buffer=this.generateRandomBuffer(chunkSize)
                    await fileHandle.write(buffer, 0, chunkSize, written)
                    written+=chunkSize
                }
                await fileHandle.sync()
            }
        }
        finally{
            await fileHandle.close()
        }
        await fs.promises.unlink(filePath)
    }
    async deleteDirectory(dirPath: string): Promise<void>{
        let entries=await fs.promises.readdir(dirPath, {withFileTypes: true})
        for(let entry of entries){
            let fullPath=path.join(dirPath, entry.name)
            if(entry.isDirectory()){
                await this.deleteDirectory(fullPath)
            }
            else{
                await this.deleteFile(fullPath)
            }
        }
        await fs.promises.rmdir(dirPath)
    }
}
