export interface ConfigProfile {
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
}

export async function saveProfile(profile: ConfigProfile): Promise<void> {
  let profiles = await listProfiles()
  let existing = profiles.findIndex(p => p.name === profile.name)
  if (existing >= 0) {
    profiles[existing] = profile
  } else {
    profiles.push(profile)
  }
  localStorage.setItem("train-generator-profiles", JSON.stringify(profiles))
}

export async function loadProfile(name: string): Promise<ConfigProfile | null> {
  let profiles = await listProfiles()
  return profiles.find(p => p.name === name) || null
}

export async function listProfiles(): Promise<ConfigProfile[]> {
  try {
    let data = localStorage.getItem("train-generator-profiles")
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export async function deleteProfile(name: string): Promise<void> {
  let profiles = await listProfiles()
  profiles = profiles.filter(p => p.name !== name)
  localStorage.setItem("train-generator-profiles", JSON.stringify(profiles))
}