import{deduplicate}from "../deduplicator.js"
import type{TrainingItem}from "../../types/index.js"
interface DedupWorkerMessage{
    id:number
    items:TrainingItem[]
    threshold:number
}
self.onmessage=(e:MessageEvent<DedupWorkerMessage>)=>{
    const id=e.data.id
    try{
        const{items,threshold}=e.data
        const result=deduplicate(items,threshold)
        self.postMessage({id,...result})
    }
    catch(error){
        self.postMessage({id,items:e.data.items,removed:0,error:(error as Error).message})
    }
}
