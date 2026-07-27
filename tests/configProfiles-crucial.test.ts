import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { saveProfile, loadProfile, listProfiles, deleteProfile, ConfigProfile } from "../src/renderer/configProfiles.js"
const STORAGE_KEY = "train-generator-profiles"
function baseProfile(overrides: Partial<ConfigProfile> = {}): ConfigProfile {
    return {
        name: "default",
        model: "llama2",
        processingType: "instruction",
        outputFormat: "jsonl",
        language: "en",
        chunkSize: "8000",
        concurrency: "3",
        provider: "ollama",
        createdAt: "2024-01-01T00:00:00Z",
        ...overrides
    }
}
describe("saveProfile", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    afterEach(() => {
        localStorage.clear()
    })
    it("stores a new profile", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        let raw = localStorage.getItem(STORAGE_KEY)
        expect(raw).toContain("alpha")
    })
    it("stores profile inside versioned store", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        let store = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
        expect(store.version).toBe(1)
        expect(store.profiles.length).toBe(1)
    })
    it("sets version on saved profile", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        let store = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
        expect(store.profiles[0].version).toBe(1)
    })
    it("updates existing profile by name", () => {
        saveProfile(baseProfile({ name: "alpha", model: "old" }))
        saveProfile(baseProfile({ name: "alpha", model: "new" }))
        let loaded = loadProfile("alpha")
        expect(loaded!.model).toBe("new")
    })
    it("preserves createdAt when updating", () => {
        saveProfile(baseProfile({ name: "alpha", createdAt: "2024-01-01T00:00:00Z" }))
        saveProfile(baseProfile({ name: "alpha", createdAt: "2025-01-01T00:00:00Z" }))
        let loaded = loadProfile("alpha")
        expect(loaded!.createdAt).toBe("2024-01-01T00:00:00Z")
    })
    it("stores multiple profiles", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        saveProfile(baseProfile({ name: "beta" }))
        expect(listProfiles().length).toBe(2)
    })
    it("does not duplicate profiles with same name", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        saveProfile(baseProfile({ name: "alpha" }))
        expect(listProfiles().length).toBe(1)
    })
    it("clones profile before saving", () => {
        let profile = baseProfile({ name: "alpha" })
        saveProfile(profile)
        profile.model = "mutated"
        let loaded = loadProfile("alpha")
        expect(loaded!.model).toBe("llama2")
    })
    it("survives localStorage quota errors", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota") })
        expect(() => saveProfile(baseProfile())).not.toThrow()
        vi.restoreAllMocks()
    })
})
describe("loadProfile", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    afterEach(() => {
        localStorage.clear()
    })
    it("returns null when no profiles exist", () => {
        expect(loadProfile("missing")).toBeNull()
    })
    it("returns null for missing profile name", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        expect(loadProfile("beta")).toBeNull()
    })
    it("returns matching profile", () => {
        saveProfile(baseProfile({ name: "alpha", model: "mistral" }))
        let loaded = loadProfile("alpha")
        expect(loaded!.model).toBe("mistral")
    })
    it("returns a clone of stored profile", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        let first = loadProfile("alpha")
        first!.model = "mutated"
        let second = loadProfile("alpha")
        expect(second!.model).toBe("llama2")
    })
})
describe("listProfiles", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    afterEach(() => {
        localStorage.clear()
    })
    it("returns empty array by default", () => {
        expect(listProfiles()).toEqual([])
    })
    it("returns saved profiles", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        saveProfile(baseProfile({ name: "beta" }))
        let profiles = listProfiles()
        expect(profiles.map(p => p.name)).toContain("alpha")
        expect(profiles.map(p => p.name)).toContain("beta")
    })
    it("returns clones of profiles", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        let profiles = listProfiles()
        profiles[0].model = "mutated"
        expect(loadProfile("alpha")!.model).toBe("llama2")
    })
    it("returns empty array when storage is corrupted", () => {
        localStorage.setItem(STORAGE_KEY, "not json")
        expect(listProfiles()).toEqual([])
    })
    it("returns empty array when profiles field is missing", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1 }))
        expect(listProfiles()).toEqual([])
    })
    it("migrates array-only storage to versioned store", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([baseProfile({ name: "legacy" })]))
        let profiles = listProfiles()
        expect(profiles.length).toBe(1)
        expect(profiles[0].name).toBe("legacy")
    })
    it("ignores invalid store shapes gracefully", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, profiles: "nope" }))
        expect(listProfiles()).toEqual([])
    })
})
describe("deleteProfile", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    afterEach(() => {
        localStorage.clear()
    })
    it("removes a profile", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        deleteProfile("alpha")
        expect(loadProfile("alpha")).toBeNull()
    })
    it("does nothing when profile does not exist", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        expect(() => deleteProfile("beta")).not.toThrow()
        expect(listProfiles().length).toBe(1)
    })
    it("removes only matching profile", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        saveProfile(baseProfile({ name: "beta" }))
        deleteProfile("alpha")
        expect(loadProfile("beta")).not.toBeNull()
        expect(loadProfile("alpha")).toBeNull()
    })
    it("survives localStorage quota errors on delete", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota") })
        expect(() => deleteProfile("alpha")).not.toThrow()
        vi.restoreAllMocks()
    })
})
describe("configProfiles edge cases", () => {
    beforeEach(() => {
        localStorage.clear()
    })
    afterEach(() => {
        localStorage.clear()
    })
    it("handles profile with optional fields", () => {
        let profile = baseProfile({ name: "advanced", baseUrl: "http://localhost", smartSizing: true, maxOutputItems: 1000 })
        saveProfile(profile)
        let loaded = loadProfile("advanced")
        expect(loaded!.baseUrl).toBe("http://localhost")
        expect(loaded!.smartSizing).toBe(true)
        expect(loaded!.maxOutputItems).toBe(1000)
    })
    it("preserves all profile fields through round trip", () => {
        let profile = baseProfile({
            name: "full",
            model: "gpt-4",
            processingType: "conversation",
            outputFormat: "csv",
            language: "zh-Hans",
            chunkSize: "4000",
            concurrency: "5",
            provider: "openai",
            baseUrl: "https://api.openai.com",
            smartSizing: true,
            maxOutputItems: 500
        })
        saveProfile(profile)
        let loaded = loadProfile("full")
        expect(loaded).toEqual(expect.objectContaining(profile))
    })
    it("treats profile names case-sensitively", () => {
        saveProfile(baseProfile({ name: "Alpha" }))
        expect(loadProfile("alpha")).toBeNull()
        expect(loadProfile("Alpha")).not.toBeNull()
    })
    it("returns empty list after deleting all profiles", () => {
        saveProfile(baseProfile({ name: "alpha" }))
        saveProfile(baseProfile({ name: "beta" }))
        deleteProfile("alpha")
        deleteProfile("beta")
        expect(listProfiles()).toEqual([])
    })
    it("handles localStorage being unavailable", () => {
        vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null)
        expect(listProfiles()).toEqual([])
        vi.restoreAllMocks()
    })
})
