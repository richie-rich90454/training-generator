import WebSocket from "ws"
const pageId=process.argv[2]
if(!pageId){
    console.error("Usage: node scripts/eval-electron.mjs <page-id>")
    process.exit(1)
}
const ws=new WebSocket(`ws://localhost:9223/devtools/page/${pageId}`)
ws.on("open", ()=>{
    ws.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: { expression: `JSON.stringify({hasApi: typeof window.electronAPI !== "undefined", keys: typeof window.electronAPI === "object" ? Object.keys(window.electronAPI) : []})` }
    }))
})
ws.on("message", (data)=>{
    const msg=JSON.parse(data.toString())
    if(msg.id===1){
        const result=msg.result?.result?.value
        console.log("Runtime.evaluate result:", result)
        ws.close()
    }
})
ws.on("error", (err)=>{
    console.error("WebSocket error:", err.message)
    process.exit(1)
})
