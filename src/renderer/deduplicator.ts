import type{TrainingItem}from"../types/index.js"
import{mergeProvenance}from"./provenance.js"

function tokenize(str:string):string[]{
    let tokens:string[]=[]
    let regex=/[a-zA-Z0-9\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]+/g
    let match:RegExpExecArray|null
    while((match=regex.exec(str))!==null){
        tokens.push(match[0].toLowerCase())
    }
    if(tokens.length===0){
        for(let i=0;i<=str.length-3;i++){
            tokens.push(str.slice(i,i+3))
        }
    }
    return tokens
}

function hashToken(token:string):bigint{
    let hash=1469598103934665603n
    let prime=1099511628211n
    let mask=0xFFFFFFFFFFFFFFFFn
    for(let i=0;i<token.length;i++){
        hash^=BigInt(token.charCodeAt(i))
        hash=(hash*prime)&mask
    }
    return hash
}

function hashString(str:string):bigint{
    let tokens=tokenize(str)
    if(tokens.length===0)return 0n
    let sums:number[]=new Array(64).fill(0)
    for(let token of tokens){
        let h=hashToken(token)
        for(let i=0;i<64;i++){
            if((h>>BigInt(i))&1n){
                sums[i]++
            }
            else{
                sums[i]--
            }
        }
    }
    let result=0n
    for(let i=0;i<64;i++){
        if(sums[i]>=0){
            result|=1n<<BigInt(i)
        }
    }
    return result
}

function getItemText(item:TrainingItem):string{
    if(item.output)return item.output
    if(item.messages){
        return item.messages.map(m=>m.content).join(" ")
    }
    if(item.text)return item.text
    return JSON.stringify(item)
}

function hammingDistance(a:bigint,b:bigint):number{
    let xor=a^b
    let dist=0
    while(xor){
        dist++
        xor&=xor-1n
    }
    return dist
}

function jaccardSimilarity(a:string,b:string):number{
    let tokensA=new Set(tokenize(a))
    let tokensB=new Set(tokenize(b))
    if(tokensA.size===0&&tokensB.size===0)return 1
    if(tokensA.size===0||tokensB.size===0)return 0
    let intersection=0
    for(let token of tokensA){
        if(tokensB.has(token))intersection++
    }
    return intersection/(tokensA.size+tokensB.size-intersection)
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
    threshold=Math.min(1,Math.max(0,threshold))
    if(items.length<=1)return{items,removed:0}
    if(threshold===0){
        let result=[...items]
        let merged=result[0]
        for(let i=1;i<result.length;i++){
            merged=mergeProvenance(merged,result[i])
        }
        return{items:[merged],removed:items.length-1}
    }
    items=[...items]
    let texts=items.map(item=>getItemText(item))
    let hashes=items.map((_,i)=>hashString(texts[i]))
    let keep:boolean[]=new Array(items.length).fill(true)
    let removed=0
    let maxBits=64
    let maxDistance=Math.floor(maxBits*(1-threshold))
    let bands=4
    let bitsPerBand=16
    let bandBuckets:Map<number,Map<number,number[]>>=new Map()
    for(let b=0;b<bands;b++){
        bandBuckets.set(b,new Map())
    }
    for(let i=0;i<items.length;i++){
        for(let b=0;b<bands;b++){
            let shift=BigInt(b*bitsPerBand)
            let bandValue=Number((hashes[i]>>shift)&0xFFFFn)
            let bucket=bandBuckets.get(b)
            if(bucket){
                let list=bucket.get(bandValue)
                if(!list){
                    list=[]
                    bucket.set(bandValue,list)
                }
                list.push(i)
            }
        }
    }
    for(let i=0;i<items.length;i++){
        if(!keep[i])continue
        let candidates=new Set<number>()
        for(let b=0;b<bands;b++){
            let shift=BigInt(b*bitsPerBand)
            let bandValue=Number((hashes[i]>>shift)&0xFFFFn)
            let bucket=bandBuckets.get(b)
            let list=bucket?.get(bandValue)
            if(list){
                for(let j of list){
                    if(j>i)candidates.add(j)
                }
            }
        }
        for(let j of candidates){
            if(!keep[j])continue
            if(preFilterCheck(items[i],items[j]))continue
            let dist=hammingDistance(hashes[i],hashes[j])
            if(dist<=maxDistance){
                let sim=jaccardSimilarity(texts[i],texts[j])
                if(sim>=threshold){
                    keep[j]=false
                    items[i]=mergeProvenance(items[i],items[j])
                    removed++
                }
            }
        }
    }
    let result=items.filter((_,i)=>keep[i])
    return{items:result,removed}
}
