import fs from "fs"
import path from "path"
import { createGzip } from "zlib"
export interface GdprExportItem{
    path: string
    size: number
}
export interface GdprExport{
    archivePath: string
    manifest: {
        exportedAt: number
        items: GdprExportItem[]
    }
}
export interface GdprManagerOptions{
    userDataPath: string
    pathsToInclude?: string[]
    secureDelete?: (filePath: string)=>Promise<void>
}
interface TarModule{
    create(options: {gzip: boolean}, files: string[]): NodeJS.ReadableStream
}
export class GdprManager{
    private userDataPath: string
    private pathsToInclude: string[]
    private secureDelete: (filePath: string)=>Promise<void>
    constructor(options: GdprManagerOptions){
        this.userDataPath=options.userDataPath
        this.pathsToInclude=options.pathsToInclude??[]
        this.secureDelete=options.secureDelete??secureDeleteFile
    }
    async listUserDataFiles(): Promise<string[]>{
        let result: string[]=[]
        let paths=[this.userDataPath, ...this.pathsToInclude]
        for (let basePath of paths){
            let files=await this.collectFiles(basePath)
            result.push(...files)
        }
        return result
    }
    private async collectFiles(basePath: string): Promise<string[]>{
        let result: string[]=[]
        try{
            let entries=await fs.promises.readdir(basePath, {withFileTypes: true})
            for (let entry of entries){
                let fullPath=path.join(basePath, entry.name)
                if (entry.isDirectory()){
                    let subFiles=await this.collectFiles(fullPath)
                    result.push(...subFiles)
                }
                else if (entry.isFile()){
                    result.push(fullPath)
                }
            }
        }
        catch (err){
            let code=(err as NodeJS.ErrnoException).code
            if (code!=="ENOENT"){
                throw err
            }
        }
        return result
    }
    async exportAllUserData(outputPath?: string): Promise<GdprExport>{
        let files=await this.listUserDataFiles()
        let resolvedOutput=outputPath??path.join(this.userDataPath, `gdpr-export-${Date.now()}.tgz`)
        await createTarGz(files, resolvedOutput)
        let items=await Promise.all(files.map(async (filePath) => {
            let stat=await fs.promises.stat(filePath)
            return {
                path: filePath,
                size: stat.size
            }
        }))
        return {
            archivePath: resolvedOutput,
            manifest: {
                exportedAt: Date.now(),
                items: items
            }
        }
    }
    async purgeAllUserData(): Promise<{deleted: string[], failed: string[]}>{
        let files=await this.listUserDataFiles()
        let deleted: string[]=[]
        let failed: string[]=[]
        for (let filePath of files){
            try{
                await this.secureDelete(filePath)
                deleted.push(filePath)
            }
            catch (_err){
                failed.push(filePath)
            }
        }
        await this.removeEmptyDirectories([this.userDataPath, ...this.pathsToInclude])
        return {deleted: deleted, failed: failed}
    }
    private async removeEmptyDirectories(paths: string[]): Promise<void>{
        for (let dirPath of paths){
            try{
                let entries=await fs.promises.readdir(dirPath, {withFileTypes: true})
                for (let entry of entries){
                    let fullPath=path.join(dirPath, entry.name)
                    if (entry.isDirectory()){
                        await this.removeEmptyDirectories([fullPath])
                    }
                }
                let remaining=await fs.promises.readdir(dirPath)
                if (remaining.length===0){
                    await fs.promises.rmdir(dirPath)
                }
            }
            catch (err){
                let code=(err as NodeJS.ErrnoException).code
                if (code!=="ENOENT"){
                    throw err
                }
            }
        }
    }
}
export async function createTarGz(files: string[], outputPath: string): Promise<void>{
    let tarModule: TarModule|undefined
    try{
        tarModule=await import("tar") as unknown as TarModule
    }
    catch (_err){
        throw new Error("tar module is not installed")
    }
    if (!tarModule || typeof tarModule.create!=="function"){
        throw new Error("tar module is not installed")
    }
    let output=fs.createWriteStream(outputPath)
    let gzip=createGzip()
    let pack=tarModule.create({gzip: false}, files)
    pack.pipe(gzip).pipe(output)
    await new Promise<void>((resolve, reject) => {
        let settled=false
        let onDone=() => {
            if (!settled){
                settled=true
                resolve()
            }
        }
        let onError=(err: Error) => {
            if (!settled){
                settled=true
                pack.destroy()
                gzip.destroy()
                output.destroy()
                reject(err)
            }
        }
        output.on("finish", onDone)
        output.on("error", onError)
        gzip.on("error", onError)
        pack.on("error", onError)
    })
}
export async function secureDeleteFile(filePath: string): Promise<void>{
    let stat=await fs.promises.stat(filePath)
    let size=stat.size
    let fileHandle=await fs.promises.open(filePath, "r+")
    try{
        let buffer=Buffer.alloc(4096)
        buffer.fill(0)
        let written=0
        while (written<size){
            let chunkSize=Math.min(buffer.length, size-written)
            await fileHandle.write(buffer, 0, chunkSize, written)
            written+=chunkSize
        }
        await fileHandle.sync()
    }
    finally{
        await fileHandle.close()
    }
    await fs.promises.unlink(filePath)
}