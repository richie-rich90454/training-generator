import{defineConfig}from "vite"
import path from "path"
import fs from "fs"
import{globSync}from "glob"
import{fileURLToPath}from "url"
import type{Plugin}from "vite"

const __dirname=path.dirname(fileURLToPath(import.meta.url))

function copyPromptsPlugin():Plugin{
    return{
        name:"copy-prompts",
        writeBundle(){
            const srcDir=path.resolve(__dirname,"src/prompts")
            const destDir=path.resolve(__dirname,"dist/prompts")
            if(!fs.existsSync(srcDir)){
                console.warn(`Source directory ${srcDir} does not exist`)
                return
            }
            if(!fs.existsSync(destDir)){
                fs.mkdirSync(destDir,{recursive:true})
            }
            const files=globSync("**/*",{cwd:srcDir,nodir:true})
            let copiedCount=0
            for(const file of files){
                const srcFile=path.join(srcDir,file)
                const destFile=path.join(destDir,file)
                const destDirName=path.dirname(destFile)
                if(!fs.existsSync(destDirName)){
                    fs.mkdirSync(destDirName,{recursive:true})
                }
                fs.copyFileSync(srcFile,destFile)
                copiedCount++
            }
            console.log(`Copied ${copiedCount} prompt files to dist/prompts`)
        }
    }
}
export default defineConfig({
    base:"./",
    server:{
        port:5173,
        strictPort:true,
    },
    build:{
        outDir:"dist",
        emptyOutDir:true,
        target:"esnext",
        minify:"terser",
        terserOptions:{
            compress:{
                drop_console:true,
                drop_debugger:true,
            },
        },
        cssMinify:true,
        sourcemap:false,
        rollupOptions:{
            external:["electron"],
            input:{
                main:"./index.html",
            },
            output:{
                manualChunks(id:string):string|undefined{
                    if (id.includes("node_modules")){
                        if (id.includes("axios")){
                            return "vendor-axios"
                        }
                        if (id.includes("pdf-parse")||id.includes("mammoth")||id.includes("officeparser")){
                            return "vendor-parsers"
                        }
                        if (id.includes("html-to-text")||id.includes("rtf-parser-fixes")){
                            return "vendor-text"
                        }
                        return "vendor"
                    }
                    if (id.includes("src/renderer")){
                        return "renderer"
                    }
                    if (id.includes("src/core")){
                        return "core"
                    }
                    if (id.includes("src/workers")){
                        return "workers"
                    }
                },
                entryFileNames:"assets/[name]-[hash].js",
                chunkFileNames:"assets/[name]-[hash].js",
                assetFileNames:"assets/[name]-[hash].[ext]",
            },
        },
        assetsDir:"assets",
        chunkSizeWarningLimit:1000,
        commonjsOptions:{
            transformMixedEsModules:true,
        },
    },
    optimizeDeps:{
        exclude:["electron"],
    },
    resolve:{
        alias:{
            "@":path.resolve(__dirname,"./src"),
        },
    },
    clearScreen:false,
    plugins:[
        copyPromptsPlugin()
    ]
})
