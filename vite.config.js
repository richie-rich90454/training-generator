import {defineConfig} from "vite";
import path from "path";
import fs from "fs";
import {glob} from "glob";
function copyPromptsPlugin(){
    return{
        name:"copy-prompts",
        writeBundle(){
            let srcDir=path.resolve(__dirname,"src/prompts");
            let destDir=path.resolve(__dirname,"dist/prompts");
            if(!fs.existsSync(srcDir)){
                console.warn(`Source directory ${srcDir} does not exist`);
                return;
            }
            if(!fs.existsSync(destDir)){
                fs.mkdirSync(destDir,{recursive:true});
            }
            let files=glob.sync("**/*",{cwd:srcDir,nodir:true});
            let copiedCount=0;
            for(let file of files){
                let srcFile=path.join(srcDir,file);
                let destFile=path.join(destDir,file);
                let destDirName=path.dirname(destFile);
                if(!fs.existsSync(destDirName)){
                    fs.mkdirSync(destDirName,{recursive:true});
                }
                fs.copyFileSync(srcFile,destFile);
                copiedCount++;
            }
            console.log(`Copied ${copiedCount} prompt files to dist/prompts`);
        }
    };
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
            input:{
                main:"./index.html",
            },
            output:{
                manualChunks(id){
                    if (id.includes("node_modules")){
                        if (id.includes("axios")){
                            return "vendor-axios";
                        }
                        if (id.includes("pdf-parse")||id.includes("mammoth")||id.includes("officeparser")){
                            return "vendor-parsers";
                        }
                        if (id.includes("html-to-text")||id.includes("rtf-parser-fixes")){
                            return "vendor-text";
                        }
                        return "vendor";
                    }
                    if (id.includes("src/renderer")){
                        return "renderer";
                    }
                    if (id.includes("src/core")){
                        return "core";
                    }
                    if (id.includes("src/workers")){
                        return "workers";
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
});