// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
let encryptKey: (plaintext: string) => Promise<string>
let decryptKey: (encrypted: string) => Promise<string | null>
function stubSecureKey(store: Record<string, string> = {}): void {
    vi.stubGlobal("window", {
        ...window,
        electronAPI: {
            setSecureKey: vi.fn(async(key: string) => {
                store.key = key
                return true
            }),
            getSecureKey: vi.fn(async() => store.key || null)
        }
    } as unknown as Window & typeof globalThis)
}
async function loadSecurity(): Promise<void> {
    vi.resetModules()
    let security = await import("../src/renderer/security.js")
    encryptKey = security.encryptKey
    decryptKey = security.decryptKey
}
beforeEach(async() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    await loadSecurity()
})
describe("Security encryption", () => {
    it("encrypts and decrypts a key", async() => {
        let plaintext = "sk-secret-key"
        let encrypted = await encryptKey(plaintext)
        expect(encrypted.length).toBeGreaterThan(0)
        expect(encrypted).not.toBe(plaintext)
        let decrypted = await decryptKey(encrypted)
        expect(decrypted).toBe(plaintext)
    })
    it("returns empty string for empty plaintext", async() => {
        expect(await encryptKey("")).toBe("")
    })
    it("returns null for empty encrypted", async() => {
        expect(await decryptKey("")).toBeNull()
    })
    it("returns null for corrupted encrypted data", async() => {
        expect(await decryptKey("not-valid-base64!!!")).toBeNull()
    })
    it("produces different ciphertexts for same plaintext", async() => {
        let plaintext = "same-input"
        let encrypted1 = await encryptKey(plaintext)
        let encrypted2 = await encryptKey(plaintext)
        expect(encrypted1).not.toBe(encrypted2)
    })
})
describe("Security electron secure key", () => {
    it("uses electron secure key when available", async() => {
        let store: Record<string, string> = {}
        stubSecureKey(store)
        await loadSecurity()
        let encrypted = await encryptKey("electron-secret")
        expect(window.electronAPI!.setSecureKey).toHaveBeenCalled()
        expect(store.key.length).toBeGreaterThan(0)
        let decrypted = await decryptKey(encrypted)
        expect(decrypted).toBe("electron-secret")
    })
    it("falls back to localStorage when electron returns false", async() => {
        vi.stubGlobal("window", {
            ...window,
            electronAPI: {
                setSecureKey: vi.fn(async() => false),
                getSecureKey: vi.fn(async() => null)
            }
        } as unknown as Window & typeof globalThis)
        await loadSecurity()
        let encrypted = await encryptKey("fallback-secret")
        expect(encrypted.length).toBeGreaterThan(0)
        let decrypted = await decryptKey(encrypted)
        expect(decrypted).toBe("fallback-secret")
    })
    it("migrates old localStorage key to secure storage", async() => {
        let store: Record<string, string> = {}
        stubSecureKey(store)
        await loadSecurity()
        await encryptKey("first")
        localStorage.setItem("train-generator-encryption-key", store.key)
        store.key = ""
        await loadSecurity()
        let second = await encryptKey("second")
        expect(window.electronAPI!.setSecureKey).toHaveBeenCalled()
        let decrypted = await decryptKey(second)
        expect(decrypted).toBe("second")
    })
})
describe("Security key rotation", () => {
    it("rotates key after rekey threshold", async() => {
        vi.stubGlobal("process", { env: { TRAINING_GENERATOR_REKEY_THRESHOLD: "3" } })
        let store: Record<string, string> = {}
        stubSecureKey(store)
        await loadSecurity()
        await encryptKey("a")
        await encryptKey("b")
        let keyBefore = store.key
        await encryptKey("c")
        expect(store.key).not.toBe(keyBefore)
        let decrypted = await decryptKey(await encryptKey("d"))
        expect(decrypted).toBe("d")
    })
})
describe("Security previous-key fallback", () => {
    it("decrypts old ciphertext using previous key after rekey", async() => {
        vi.stubGlobal("process", { env: { TRAINING_GENERATOR_REKEY_THRESHOLD: "3" } })
        let store: Record<string, string> = {}
        stubSecureKey(store)
        await loadSecurity()
        let oldEncrypted = await encryptKey("old-secret")
        let keyBefore = store.key
        await encryptKey("filler1")
        await encryptKey("filler2")
        expect(store.key).not.toBe(keyBefore)
        let decrypted = await decryptKey(oldEncrypted)
        expect(decrypted).toBe("old-secret")
    })
})
describe("Security localStorage failure handling", () => {
    it("handles localStorage.setItem failure without crashing", async() => {
        vi.stubGlobal("window", {
            ...window,
            electronAPI: {
                setSecureKey: vi.fn(async() => false),
                getSecureKey: vi.fn(async() => null)
            }
        } as unknown as Window & typeof globalThis)
        let setItemMock = vi.fn(() => { throw new Error("private mode") })
        vi.stubGlobal("localStorage", {
            getItem: vi.fn(() => null),
            setItem: setItemMock,
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(() => null),
            length: 0
        } as unknown as Storage)
        await loadSecurity()
        let encrypted = await encryptKey("private-mode-secret")
        expect(encrypted.length).toBeGreaterThan(0)
        let decrypted = await decryptKey(encrypted)
        expect(decrypted).toBe("private-mode-secret")
        expect(setItemMock).toHaveBeenCalled()
    })
    it("handles localStorage.getItem failure without crashing", async() => {
        vi.stubGlobal("window", {
            ...window,
            electronAPI: {
                setSecureKey: vi.fn(async() => true),
                getSecureKey: vi.fn(async() => null)
            }
        } as unknown as Window & typeof globalThis)
        let getItemMock = vi.fn(() => { throw new Error("private mode") })
        vi.stubGlobal("localStorage", {
            getItem: getItemMock,
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(() => null),
            length: 0
        } as unknown as Storage)
        await loadSecurity()
        let encrypted = await encryptKey("ssr-secret")
        expect(encrypted.length).toBeGreaterThan(0)
        let decrypted = await decryptKey(encrypted)
        expect(decrypted).toBe("ssr-secret")
        expect(getItemMock).toHaveBeenCalled()
    })
})
describe("Security decrypt failure", () => {
    it("returns null when decryption fails with no previous keys", async() => {
        let fakeCiphertext = btoa(String.fromCharCode(...new Uint8Array(32)))
        let result = await decryptKey(fakeCiphertext)
        expect(result).toBeNull()
    })
    it("returns null when current and all previous keys fail to decrypt", async() => {
        vi.stubGlobal("process", { env: { TRAINING_GENERATOR_REKEY_THRESHOLD: "1" } })
        let store: Record<string, string> = {}
        stubSecureKey(store)
        await loadSecurity()
        await encryptKey("trigger-rekey")
        let fakeCiphertext = btoa(String.fromCharCode(...new Uint8Array(32)))
        let result = await decryptKey(fakeCiphertext)
        expect(result).toBeNull()
    })
})
