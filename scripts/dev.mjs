import {spawn} from "child_process"
import http from "http"
const VITE_PORT=5173
const VITE_URL=`http://localhost:${VITE_PORT}/`
function waitForVite(maxMs=30000){
    return new Promise((resolve,reject)=>{
        let start=Date.now()
        function check(){
            let req=http.get(VITE_URL,(res)=>{
                if(res.statusCode>=200&&res.statusCode<400){
                    resolve()
                }
                else{
                    retry()
                }
            })
            req.on("error",retry)
            req.setTimeout(2000,()=>{
                req.destroy()
                retry()
            })
        }
        function retry(){
            if(Date.now()-start>maxMs){
                reject(new Error("Vite dev server did not start in time"))
                return
            }
            setTimeout(check,300)
        }
        check()
    })
}
function killProcess(proc){
    if(!proc||proc.killed){
        return
    }
    if(process.platform==="win32"){
        spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {stdio: "ignore"})
    }
    else{
        proc.kill("SIGTERM")
    }
}
const viteProcess=spawn(process.execPath, ["node_modules/vite/bin/vite.js"], {
    stdio: "inherit",
    env: {...process.env, NODE_ENV: "development"}
})
waitForVite().then(()=>{
    const electronProcess=spawn(process.execPath, ["--import", "tsx/esm", "node_modules/electron/cli.js", "."], {
        stdio: "inherit",
        env: {...process.env, NODE_ENV: "development"}
    })
    electronProcess.on("exit",(code)=>{
        killProcess(viteProcess)
        process.exit(code??0)
    })
    electronProcess.on("error",(error)=>{
        console.error("[dev] failed to start electron:",error)
        killProcess(viteProcess)
        process.exit(1)
    })
}).catch((error)=>{
    console.error("[dev]",error.message)
    killProcess(viteProcess)
    process.exit(1)
})
process.on("SIGINT",()=>{
    killProcess(viteProcess)
    process.exit(0)
})
process.on("SIGTERM",()=>{
    killProcess(viteProcess)
    process.exit(0)
})
