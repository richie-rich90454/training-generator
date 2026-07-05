import crypto from "crypto"
export interface PipelinePreset{
    name: string
    steps: string[]
    options: Record<string, unknown>
    description?: string
}
export interface AppConfig{
    apiKeys: Record<string, string>
    providerSettings: Record<string, Record<string, unknown>>
    pipelinePresets: Record<string, PipelinePreset>
    uiSettings: Record<string, unknown>
}
export interface Storage{
    getItem(key: string): string|null
    setItem(key: string, value: string): void
}
export class InMemoryStorage implements Storage{
    private store: Record<string, string>
    constructor(){
        this.store={}
    }
    getItem(key: string): string|null{
        return this.store[key]??null
    }
    setItem(key: string, value: string): void{
        this.store[key]=value
    }
}
function createDefaultConfig(): AppConfig{
    return {
        apiKeys: {},
        providerSettings: {},
        pipelinePresets: {},
        uiSettings: {}
    }
}
function createDefaultStorage(): Storage{
    if (typeof localStorage!=="undefined"){
        return localStorage as unknown as Storage
    }
    return new InMemoryStorage()
}
export class ConfigManager{
    private encryptionKey?: string
    private storage: Storage
    private config: AppConfig|null
    private readonly storageKey="tg-app-config"
    constructor(options: {encryptionKey?: string, storage?: Storage}={}){
        this.encryptionKey=options.encryptionKey
        this.storage=options.storage??createDefaultStorage()
        this.config=null
    }
    load(): AppConfig{
        let raw=this.storage.getItem(this.storageKey)
        let loaded: AppConfig
        if (raw===null){
            loaded=createDefaultConfig()
        }
        else if (this.encryptionKey){
            let decrypted=this.decrypt(raw, this.encryptionKey)
            loaded=JSON.parse(decrypted) as AppConfig
        }
        else{
            loaded=JSON.parse(raw) as AppConfig
        }
        this.config=loaded
        return loaded
    }
    save(config: AppConfig): void{
        let data=JSON.stringify(config)
        if (this.encryptionKey){
            data=this.encrypt(data, this.encryptionKey)
        }
        this.storage.setItem(this.storageKey, data)
        this.config=config
    }
    private getConfig(): AppConfig{
        if (this.config===null){
            this.load()
        }
        return this.config!
    }
    getApiKey(provider: string): string|undefined{
        return this.getConfig().apiKeys[provider]
    }
    setApiKey(provider: string, key: string): void{
        let config=this.getConfig()
        config.apiKeys[provider]=key
        this.save(config)
    }
    getProviderSetting(provider: string, key: string): unknown|undefined{
        return this.getConfig().providerSettings[provider]?.[key]
    }
    setProviderSetting(provider: string, key: string, value: unknown): void{
        let config=this.getConfig()
        if (!config.providerSettings[provider]){
            config.providerSettings[provider]={}
        }
        config.providerSettings[provider][key]=value
        this.save(config)
    }
    getPipelinePreset(name: string): PipelinePreset|undefined{
        return this.getConfig().pipelinePresets[name]
    }
    setPipelinePreset(name: string, preset: PipelinePreset): void{
        let config=this.getConfig()
        config.pipelinePresets[name]=preset
        this.save(config)
    }
    deletePipelinePreset(name: string): void{
        let config=this.getConfig()
        delete config.pipelinePresets[name]
        this.save(config)
    }
    listPipelinePresets(): PipelinePreset[]{
        return Object.values(this.getConfig().pipelinePresets)
    }
    encrypt(plaintext: string, key: string): string{
        let salt=crypto.randomBytes(16)
        let iv=crypto.randomBytes(12)
        let derivedKey=this.deriveKey(key, salt)
        let cipher=crypto.createCipheriv("aes-256-gcm", derivedKey, iv)
        let encrypted=Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
        let authTag=cipher.getAuthTag()
        let combined=Buffer.concat([salt, iv, authTag, encrypted])
        return combined.toString("base64")
    }
    decrypt(ciphertext: string, key: string): string{
        let data=Buffer.from(ciphertext, "base64")
        let salt=data.subarray(0, 16)
        let iv=data.subarray(16, 28)
        let authTag=data.subarray(28, 44)
        let encrypted=data.subarray(44)
        let derivedKey=this.deriveKey(key, salt)
        let decipher=crypto.createDecipheriv("aes-256-gcm", derivedKey, iv)
        decipher.setAuthTag(authTag)
        let decrypted=Buffer.concat([decipher.update(encrypted), decipher.final()])
        return decrypted.toString("utf8")
    }
    deriveKey(password: string, salt: Buffer): Buffer{
        return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256")
    }
}
export function generateEncryptionKey(): string{
    return crypto.randomBytes(32).toString("hex")
}
