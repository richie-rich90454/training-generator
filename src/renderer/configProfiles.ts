import { logger } from "./logger.js"

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
    backups?: ConfigProfile[]
}
const STORAGE_KEY="train-generator-profiles"
const BACKUP_KEY="train-generator-profiles-backups"
const STORE_VERSION=1
const MAX_PROFILE_NAME_LENGTH=100
const MAX_BACKUPS=10
export function validateProfileName(name: string): {valid: boolean, reason: string}{
    if(!name||typeof name!=="string"){
        return{valid:false, reason:"Profile name is required"}
    }
    let trimmed=name.trim()
    if(trimmed.length===0){
        return{valid:false, reason:"Profile name cannot be empty"}
    }
    if(trimmed.length>MAX_PROFILE_NAME_LENGTH){
        return{valid:false, reason:`Profile name exceeds ${MAX_PROFILE_NAME_LENGTH} characters`}
    }
    if(/[\/\\]/.test(trimmed)){
        return{valid:false, reason:"Profile name cannot contain path separators"}
    }
    return{valid:true, reason:""}
}
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
function readBackups(): ConfigProfile[]{
    try{
        let raw=localStorage.getItem(BACKUP_KEY)
        if(!raw)return[]
        let parsed=JSON.parse(raw)
        if(Array.isArray(parsed))return parsed
    }
    catch{
    }
    return[]
}
function writeBackups(backups: ConfigProfile[]): void{
    let trimmed=backups.slice(-MAX_BACKUPS)
    localStorage.setItem(BACKUP_KEY,JSON.stringify(trimmed))
}
export function saveProfile(profile: ConfigProfile): void{
    let nameCheck=validateProfileName(profile.name)
    if(!nameCheck.valid){
        logger.error(nameCheck.reason)
        return
    }
    let store=readStore()
    let profiles=store.profiles
    let existing=profiles.findIndex(p=>p.name===profile.name)
    let toSave:ConfigProfile=deepClone(profile)
    toSave.version=STORE_VERSION
    if(existing>=0){
        let previous=profiles[existing]
        toSave.createdAt=previous.createdAt||toSave.createdAt
        try{
            let backups=readBackups()
            backups.push(deepClone(previous))
            writeBackups(backups)
        }
        catch{
            logger.error("Failed to save profile backup")
        }
        profiles[existing]=toSave
    }
    else{
        profiles.push(toSave)
    }
    try{
        writeStore(store)
    }
    catch{
        logger.error("Failed to save profile")
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
        logger.error("Failed to delete profile")
    }
}
export function getProfileBackup(name: string): ConfigProfile|null{
    let backups=readBackups()
    let match=backups.filter(b=>b.name===name)
    return match.length>0?deepClone(match[match.length-1]):null
}
export function listBackups(): ConfigProfile[]{
    return readBackups().map(b=>deepClone(b))
}
