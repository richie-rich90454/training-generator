// Vite configuration for the SolidJS renderer.
// vite-plugin-solid compiles JSX and enables HMR. CSS Modules are configured with
// global-scope behavior so existing class names are preserved in the rendered DOM.
import{defineConfig}from "vite"
import path from "path"
import fs from "fs"
import{globSync}from "glob"
import type{Plugin}from "vite"
import solid from "vite-plugin-solid"

const __dirname=import.meta.dirname

function electronProductionHtmlPlugin():Plugin{
    return{
        name:"electron-production-html",
        // Electron's file:// origin cannot answer CORS preflights, so Vite's
        // injected crossorigin attributes on stylesheets and module preloads
        // prevent the CSS from loading in packaged builds. Strip them all.
        transformIndexHtml(html:string):string{
            return html.replace(/ crossorigin(="")?/g,"")
        }
    }
}
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
function copyStaticAssetsPlugin():Plugin{
    return{
        name:"copy-static-assets",
        writeBundle(){
            const assetsDir=path.resolve(__dirname,"assets")
            const destDir=path.resolve(__dirname,"dist/assets")
            if(!fs.existsSync(assetsDir)){
                console.warn(`Source directory ${assetsDir} does not exist`)
                return
            }
            if(!fs.existsSync(destDir)){
                fs.mkdirSync(destDir,{recursive:true})
            }
            const files=["icon.svg","tray-icon.svg"]
            let copiedCount=0
            for(const file of files){
                const srcFile=path.join(assetsDir,file)
                const destFile=path.join(destDir,file)
                if(fs.existsSync(srcFile)){
                    fs.copyFileSync(srcFile,destFile)
                    copiedCount++
                }
            }
            console.log(`Copied ${copiedCount} static asset files to dist/assets`)
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
    css:{
        modules:{
            // Keep original class names in the DOM and in the emitted CSS so
            // the existing component markup matches the styles exactly. Using
            // generateScopedName "[local]" still exports a usable styles object
            // (unlike scopeBehaviour "global", which yields empty objects).
            generateScopedName:"[local]"
        }
    },
    worker:{
        // Workers under src/renderer/workers are constructed with
        // `new Worker(new URL("./x.worker.js", import.meta.url), { type: "module" })`.
        // Output ES module worker bundles so the build format matches the
        // runtime `type: "module"` option used by workerPool.ts.
        format:"es"
    },
    clearScreen:false,
    plugins:[
        solid(),
        electronProductionHtmlPlugin(),
        copyPromptsPlugin(),
        copyStaticAssetsPlugin()
    ]
})
