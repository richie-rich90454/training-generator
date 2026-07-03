export interface ConfigProfile{
    name: string
    model: string
    processingType: string
    outputFormat: string
    language: string
    chunkSize: string
    concurrency: string
    provider: string
    baseUrl?: string
    smartSizing?: boolean
    maxOutputItems?: number
    createdAt: string
    version?: number
}
interface ProfilesStore{
    version: number
    profiles: ConfigProfile[]
}
const STORAGE_KEY="train-generator-profiles"
const STORE_VERSION=1
function deepClone<T>(value: T): T{
    return JSON.parse(JSON.stringify(value))
}
function readStore(): ProfilesStore{
    try{
        let raw=localStorage.getItem(STORAGE_KEY)
        if(!raw)return{version:STORE_VERSION,profiles:[]}
        let parsed=JSON.parse(raw)
        if(parsed&&typeof parsed==="object"&&Array.isArray(parsed.profiles)){
            return{version:typeof parsed.version==="number"?parsed.version:STORE_VERSION,profiles:parsed.profiles}
        }
        if(Array.isArray(parsed)){
            return{version:STORE_VERSION,profiles:parsed}
        }
    }
    catch{
    }
    return{version:STORE_VERSION,profiles:[]}
}
function writeStore(store: ProfilesStore): void{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(store))
}
export function saveProfile(profile: ConfigProfile): void{
    let store=readStore()
    let profiles=store.profiles
    let existing=profiles.findIndex(p=>p.name===profile.name)
    let toSave:ConfigProfile=deepClone(profile)
    toSave.version=STORE_VERSION
    if(existing>=0){
        let previous=profiles[existing]
        toSave.createdAt=previous.createdAt||toSave.createdAt
        profiles[existing]=toSave
    }
    else{
        profiles.push(toSave)
    }
    try{
        writeStore(store)
    }
    catch{
        console.error("Failed to save profile")
    }
}
export function loadProfile(name: string): ConfigProfile|null{
    let profiles=listProfiles()
    return profiles.find(p=>p.name===name)||null
}
export function listProfiles(): ConfigProfile[]{
    let store=readStore()
    if(!Array.isArray(store.profiles))return[]
    return deepClone(store.profiles)
}
export function deleteProfile(name: string): void{
    let store=readStore()
    store.profiles=store.profiles.filter(p=>p.name!==name)
    try{
        writeStore(store)
    }
    catch{
        console.error("Failed to delete profile")
    }
}
