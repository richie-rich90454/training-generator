const STORAGE_KEY = "train-generator-encryption-key"

async function getOrCreateKey(): Promise<CryptoKey> {
  // Try to get existing key from localStorage
  let storedKey = localStorage.getItem(STORAGE_KEY)
  if (storedKey) {
    let rawKey = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0))
    return await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
  }
  // Generate new key
  let key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
  let rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key))
  localStorage.setItem(STORAGE_KEY, btoa(String.fromCharCode(...rawKey)))
  return key
}

export async function encryptKey(plaintext: string): Promise<string> {
  if (!plaintext) return ""
  let key = await getOrCreateKey()
  let iv = crypto.getRandomValues(new Uint8Array(12))
  let encoded = new TextEncoder().encode(plaintext)
  let ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
  // Return iv + ciphertext as base64
  let combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptKey(encrypted: string): Promise<string> {
  if (!encrypted) return ""
  try {
    let key = await getOrCreateKey()
    let combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
    let iv = combined.slice(0, 12)
    let ciphertext = combined.slice(12)
    let decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch {
    // If decryption fails (e.g., old unencrypted key), return as-is for migration
    return encrypted
  }
}