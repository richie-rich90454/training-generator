import type{TrainingItem}from"../types/index.js"

function hashString(str:string):number{
    let hash=0
    for(let i=0;i<str.length;i++){
        let char=str.charCodeAt(i)
        hash=((hash<<5)-hash)+char
        hash=hash&hash
    }
    return Math.abs(hash)
}

function getItemText(item:TrainingItem):string{
    if(item.output)return item.output
    if(item.messages){
        return item.messages.map(m=>m.content).join(" ")
    }
    if(item.text)return item.text
    return JSON.stringify(item)
}

function hammingDistance(a:number,b:number):number{
    let xor=a^b
    let dist=0
    while(xor){
        dist+=xor&1
        xor>>>=1
    }
    return dist
}

export function deduplicate(items:TrainingItem[],threshold:number=0.9):{items:TrainingItem[];removed:number}{
    if(items.length<=1)return{items,removed:0}
    let hashes=items.map(item=>hashString(getItemText(item)))
    let keep:boolean[]=new Array(items.length).fill(true)
    let removed=0
    let maxBits=32
    let maxDistance=Math.floor(maxBits*(1-threshold))

    for(let i=0;i<items.length;i++){
        if(!keep[i])continue
        for(let j=i+1;j<items.length;j++){
            if(!keep[j])continue
            let dist=hammingDistance(hashes[i],hashes[j])
            if(dist<=maxDistance){
                keep[j]=false
                removed++
            }
        }
    }
    let result=items.filter((_,i)=>keep[i])
    return{items:result,removed}
}