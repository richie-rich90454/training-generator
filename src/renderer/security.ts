const STORAGE_KEY="train-generator-encryption-key"
const CHUNK_SIZE=65536
let rekeyThreshold=100000
try{
    if(typeof process!=="undefined"&&process.env&&process.env.TRAINING_GENERATOR_REKEY_THRESHOLD){
        rekeyThreshold=Number(process.env.TRAINING_GENERATOR_REKEY_THRESHOLD)
    }
}catch{
    rekeyThreshold=100000
}
const REKEY_THRESHOLD=rekeyThreshold
let memoryKey:CryptoKey|null=null
let previousKeys:CryptoKey[]=[]
let encryptionCount=0
async function importKeyNonExtractable(raw:Uint8Array):Promise<CryptoKey>{
    return crypto.subtle.importKey("raw", raw as BufferSource, {name:"AES-GCM"}, false, ["encrypt","decrypt"])
}
function arrayBufferToBase64Chunked(buffer:Uint8Array):string{
    let chunks:string[]=[]
    for(let i=0;i<buffer.length;i+=CHUNK_SIZE){
        let slice=buffer.slice(i, i+CHUNK_SIZE)
        chunks.push(btoa(String.fromCharCode(...slice)))
    }
    return chunks.join("")
}
function base64ToUint8Array(data:string):Uint8Array{
    return Uint8Array.from(atob(data), c=>c.charCodeAt(0))
}
async function storeSecureKey(key:string):Promise<boolean>{
    if(typeof window!=="undefined" && window.electronAPI?.setSecureKey){
        return window.electronAPI.setSecureKey(key)
    }
    return false
}
async function generateAndCacheKey():Promise<CryptoKey>{
    let extractable=await crypto.subtle.generateKey({name:"AES-GCM", length:256}, true, ["encrypt","decrypt"])
    let raw=new Uint8Array(await crypto.subtle.exportKey("raw", extractable))
    let encoded=arrayBufferToBase64Chunked(raw)
    let stored=await storeSecureKey(encoded)
    if(!stored){
        try{
            localStorage.setItem(STORAGE_KEY, encoded)
        }catch{}
    }
    memoryKey=await importKeyNonExtractable(raw)
    return memoryKey
}
async function getOrCreateKey():Promise<CryptoKey>{
    try{
        if(memoryKey){
            return memoryKey
        }
        let stored:string|null=null
        if(typeof window!=="undefined" && window.electronAPI?.getSecureKey){
            stored=await window.electronAPI.getSecureKey()
        }
        if(!stored){
            try{
                let old=localStorage.getItem(STORAGE_KEY)
                if(old){
                    stored=old
                    localStorage.removeItem(STORAGE_KEY)
                    await storeSecureKey(old)
                }
            }
            catch{}
        }
        if(stored){
            try{
                let raw=base64ToUint8Array(stored)
                memoryKey=await importKeyNonExtractable(raw)
                return memoryKey
            }
            catch{
                return generateAndCacheKey()
            }
        }
        return generateAndCacheKey()
    }
    catch{
        return generateAndCacheKey()
    }
}
export async function encryptKey(plaintext:string):Promise<string>{
    if(!plaintext){
        return ""
    }
    let key=await getOrCreateKey()
    let iv=crypto.getRandomValues(new Uint8Array(12))
    let encoded=new TextEncoder().encode(plaintext)
    let ciphertext=await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, encoded)
    let combined=new Uint8Array(iv.length+ciphertext.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(ciphertext), iv.length)
    encryptionCount++
    if(REKEY_THRESHOLD>0&&encryptionCount>=REKEY_THRESHOLD){
        encryptionCount=0
        if(memoryKey){
            previousKeys.push(memoryKey)
        }
        await generateAndCacheKey()
    }
    return arrayBufferToBase64Chunked(combined)
}
export async function decryptKey(encrypted:string):Promise<string|null>{
    if(!encrypted){
        return null
    }
    let combined:Uint8Array
    try{
        combined=base64ToUint8Array(encrypted)
    }
    catch{
        return null
    }
    let iv=combined.slice(0,12)
    let ciphertext=combined.slice(12)
    let key=await getOrCreateKey()
    try{
        let decrypted=await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, ciphertext)
        return new TextDecoder().decode(decrypted)
    }
    catch{
        for(let prevKey of previousKeys){
            try{
                let decrypted=await crypto.subtle.decrypt({name:"AES-GCM", iv}, prevKey, ciphertext)
                return new TextDecoder().decode(decrypted)
            }
            catch{
                continue
            }
        }
        return null
    }
}
