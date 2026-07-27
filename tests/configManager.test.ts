// @vitest-environment node
import { describe, it, expect } from "vitest"
import { ConfigManager, InMemoryStorage, generateEncryptionKey, AppConfig, PipelinePreset } from "../src/core/configManager.js"
describe("ConfigManager", () => {
    it("should load default empty config", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({storage})
        let config=manager.load()
        expect(config.apiKeys).toEqual({})
        expect(config.providerSettings).toEqual({})
        expect(config.pipelinePresets).toEqual({})
        expect(config.uiSettings).toEqual({})
    })
    it("should save and load encrypted config", () => {
        let storage=new InMemoryStorage()
        let key=generateEncryptionKey()
        let manager=new ConfigManager({encryptionKey: key, storage})
        manager.setApiKey("openai", "sk-secret")
        let loaded=new ConfigManager({encryptionKey: key, storage}).load()
        expect(loaded.apiKeys.openai).toBe("sk-secret")
    })
    it("should round-trip api key", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({encryptionKey: generateEncryptionKey(), storage})
        manager.setApiKey("anthropic", "key-123")
        expect(manager.getApiKey("anthropic")).toBe("key-123")
    })
    it("should overwrite api key", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({encryptionKey: generateEncryptionKey(), storage})
        manager.setApiKey("openai", "first")
        manager.setApiKey("openai", "second")
        expect(manager.getApiKey("openai")).toBe("second")
    })
    it("should return undefined for missing api key", () => {
        let manager=new ConfigManager({storage: new InMemoryStorage()})
        expect(manager.getApiKey("missing")).toBeUndefined()
    })
    it("should round-trip provider setting", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({encryptionKey: generateEncryptionKey(), storage})
        manager.setProviderSetting("openai", "model", "gpt-4")
        expect(manager.getProviderSetting("openai", "model")).toBe("gpt-4")
    })
    it("should overwrite provider setting", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({encryptionKey: generateEncryptionKey(), storage})
        manager.setProviderSetting("openai", "temperature", 0.5)
        manager.setProviderSetting("openai", "temperature", 0.7)
        expect(manager.getProviderSetting("openai", "temperature")).toBe(0.7)
    })
    it("should return undefined for missing provider setting", () => {
        let manager=new ConfigManager({storage: new InMemoryStorage()})
        expect(manager.getProviderSetting("openai", "model")).toBeUndefined()
    })
    it("should round-trip pipeline preset", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({encryptionKey: generateEncryptionKey(), storage})
        let preset: PipelinePreset={
            name: "basic",
            steps: ["chunk", "parse"],
            options: {maxChunks: 10},
            description: "basic preset"
        }
        manager.setPipelinePreset("basic", preset)
        let loaded=manager.getPipelinePreset("basic")
        expect(loaded?.name).toBe("basic")
        expect(loaded?.steps).toEqual(["chunk", "parse"])
        expect(loaded?.options.maxChunks).toBe(10)
    })
    it("should overwrite pipeline preset", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({encryptionKey: generateEncryptionKey(), storage})
        manager.setPipelinePreset("p1", {name: "p1", steps: ["a"], options: {}})
        manager.setPipelinePreset("p1", {name: "p1", steps: ["a", "b"], options: {}})
        expect(manager.getPipelinePreset("p1")?.steps).toEqual(["a", "b"])
    })
    it("should delete pipeline preset", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({encryptionKey: generateEncryptionKey(), storage})
        manager.setPipelinePreset("p1", {name: "p1", steps: ["a"], options: {}})
        manager.deletePipelinePreset("p1")
        expect(manager.getPipelinePreset("p1")).toBeUndefined()
    })
    it("should not throw deleting missing pipeline preset", () => {
        let manager=new ConfigManager({storage: new InMemoryStorage()})
        expect(() => manager.deletePipelinePreset("missing")).not.toThrow()
    })
    it("should list all pipeline presets", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({encryptionKey: generateEncryptionKey(), storage})
        manager.setPipelinePreset("p1", {name: "p1", steps: ["a"], options: {}})
        manager.setPipelinePreset("p2", {name: "p2", steps: ["b"], options: {}})
        let presets=manager.listPipelinePresets()
        expect(presets.length).toBe(2)
        expect(presets.map((p) => p.name).sort()).toEqual(["p1", "p2"])
    })
    it("should reflect delete in preset list", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({encryptionKey: generateEncryptionKey(), storage})
        manager.setPipelinePreset("p1", {name: "p1", steps: ["a"], options: {}})
        manager.setPipelinePreset("p2", {name: "p2", steps: ["b"], options: {}})
        manager.deletePipelinePreset("p1")
        expect(manager.listPipelinePresets().length).toBe(1)
    })
    it("should persist ui settings", () => {
        let storage=new InMemoryStorage()
        let key=generateEncryptionKey()
        let manager=new ConfigManager({encryptionKey: key, storage})
        let config=manager.load()
        config.uiSettings={theme: "dark", lang: "en"}
        manager.save(config)
        let loaded=new ConfigManager({encryptionKey: key, storage}).load()
        expect(loaded.uiSettings.theme).toBe("dark")
        expect(loaded.uiSettings.lang).toBe("en")
    })
    it("should save plaintext when no encryption key", () => {
        let storage=new InMemoryStorage()
        let manager=new ConfigManager({storage})
        let config: AppConfig={
            apiKeys: {openai: "plain"},
            providerSettings: {},
            pipelinePresets: {},
            uiSettings: {}
        }
        manager.save(config)
        let raw=storage.getItem("tg-app-config")
        expect(raw).toContain("plain")
        let parsed=JSON.parse(raw!)
        expect(parsed.apiKeys.openai).toBe("plain")
    })
})
describe("InMemoryStorage", () => {
    it("should store and retrieve values", () => {
        let storage=new InMemoryStorage()
        storage.setItem("k1", "v1")
        expect(storage.getItem("k1")).toBe("v1")
    })
    it("should return null for missing key", () => {
        let storage=new InMemoryStorage()
        expect(storage.getItem("missing")).toBeNull()
    })
    it("should overwrite existing value", () => {
        let storage=new InMemoryStorage()
        storage.setItem("k1", "v1")
        storage.setItem("k1", "v2")
        expect(storage.getItem("k1")).toBe("v2")
    })
})
describe("generateEncryptionKey", () => {
    it("should return 64-character hex string", () => {
        let key=generateEncryptionKey()
        expect(key).toMatch(/^[0-9a-f]{64}$/i)
        expect(key.length).toBe(64)
    })
    it("should return different keys each call", () => {
        let key1=generateEncryptionKey()
        let key2=generateEncryptionKey()
        expect(key1).not.toBe(key2)
    })
})
describe("encryption helpers", () => {
    it("should round-trip encrypt and decrypt", () => {
        let manager=new ConfigManager()
        let key=generateEncryptionKey()
        let encrypted=manager.encrypt("hello world", key)
        expect(manager.decrypt(encrypted, key)).toBe("hello world")
    })
    it("should produce different ciphertext for same plaintext", () => {
        let manager=new ConfigManager()
        let key=generateEncryptionKey()
        let encrypted1=manager.encrypt("hello", key)
        let encrypted2=manager.encrypt("hello", key)
        expect(encrypted1).not.toBe(encrypted2)
    })
    it("should fail decryption with wrong key", () => {
        let manager=new ConfigManager()
        let key1=generateEncryptionKey()
        let key2=generateEncryptionKey()
        let encrypted=manager.encrypt("secret", key1)
        expect(() => manager.decrypt(encrypted, key2)).toThrow()
    })
    it("should fail decryption with tampered ciphertext", () => {
        let manager=new ConfigManager()
        let key=generateEncryptionKey()
        let encrypted=manager.encrypt("secret", key)
        let tampered=encrypted.slice(0, -1) + (encrypted.slice(-1)==="A" ? "B" : "A")
        expect(() => manager.decrypt(tampered, key)).toThrow()
    })
    it("should produce deterministic key for same salt", () => {
        let manager=new ConfigManager()
        let salt=Buffer.from("saltsaltsalt1234")
        let derived1=manager.deriveKey("password", salt)
        let derived2=manager.deriveKey("password", salt)
        expect(derived1.equals(derived2)).toBe(true)
    })
    it("should produce 32-byte derived key", () => {
        let manager=new ConfigManager()
        let salt=Buffer.from("saltsaltsalt1234")
        let derived=manager.deriveKey("password", salt)
        expect(derived.length).toBe(32)
    })
})
