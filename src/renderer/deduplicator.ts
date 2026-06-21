import type{TrainingItem}from"../types/index.js"
import{mergeProvenance}from"./provenance.js"

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

function detectScript(text:string):string{
    let hasCJK=false
    let hasLatin=false
    let hasArabic=false
    for(let i=0;i<text.length;i++){
        let code=text.charCodeAt(i)
        if((code>=0x4E00&&code<=0x9FFF)||
           (code>=0x3400&&code<=0x4DBF)||
           (code>=0xF900&&code<=0xFAFF)||
           (code>=0x3040&&code<=0x309F)||
           (code>=0x30A0&&code<=0x30FF)||
           (code>=0xAC00&&code<=0xD7AF)){
            hasCJK=true
        }else if((code>=0x0041&&code<=0x005A)||
                 (code>=0x0061&&code<=0x007A)||
                 (code>=0x00C0&&code<=0x024F)){
            hasLatin=true
        }else if(code>=0x0600&&code<=0x06FF){
            hasArabic=true
        }
    }
    if(hasCJK&&!hasLatin&&!hasArabic)return'cjk'
    if(!hasCJK&&hasLatin&&!hasArabic)return'latin'
    if(!hasCJK&&!hasLatin&&hasArabic)return'arabic'
    return'mixed'
}

function preFilterCheck(itemA:TrainingItem,itemB:TrainingItem):boolean{
    let textA=getItemText(itemA)
    let textB=getItemText(itemB)
    let lenA=textA.length
    let lenB=textB.length
    if(lenA===0||lenB===0)return false
    let lengthRatio=Math.abs(lenA-lenB)/Math.max(lenA,lenB)
    if(lengthRatio>0.5)return true
    let scriptA=detectScript(textA)
    let scriptB=detectScript(textB)
    if((scriptA==='cjk'&&scriptB==='latin')||(scriptA==='latin'&&scriptB==='cjk'))return true
    return false
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
            if(preFilterCheck(items[i],items[j]))continue
            let dist=hammingDistance(hashes[i],hashes[j])
            if(dist<=maxDistance){
                keep[j]=false
                items[i]=mergeProvenance(items[i],items[j])
                removed++
            }
        }
    }
    let result=items.filter((_,i)=>keep[i])
    return{items:result,removed}
}