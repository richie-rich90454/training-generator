// IPC Channel definitions with typed request/response contracts

export interface IpcChannels {
  'parse-file': {
    request: { path: string; type: string }
    response: { success: boolean; content?: string; error?: string }
  }
  'parse-batch': {
    request: { files: { filePath: string; type: string }[] }
    response: { success: boolean; results?: { filePath: string; success: boolean; text: string; error: string | null }[]; error?: string }
  }
  'save-file': {
    request: { path: string; content: string }
    response: { success: boolean; error?: string }
  }
  'export-logs': {
    request: { data: string }
    response: { success: boolean; error?: string }
  }
  'write-log': {
    request: { entry: unknown }
    response: void
  }
  'save-checkpoint': {
    request: { data: unknown }
    response: void
  }
  'load-checkpoint': {
    request: void
    response: { success: boolean; data?: unknown }
  }
  'clear-checkpoint': {
    request: void
    response: void
  }
  'save-profile': {
    request: { profile: unknown }
    response: { success: boolean; error?: string }
  }
  'load-profile': {
    request: { name: string }
    response: { success: boolean; data?: unknown }
  }
  'list-profiles': {
    request: void
    response: { success: boolean; profiles?: unknown[] }
  }
  'ollama:generate': {
    request: { model: string; prompt: string; options?: Record<string, unknown> }
    response: { success: boolean; response?: string; error?: string }
  }
  'openai:generate': {
    request: { apiKey: string; baseUrl: string; model: string; prompt: string; options?: Record<string, unknown> }
    response: { success: boolean; response?: string; usage?: { total_tokens: number }; error?: string }
  }
}

export type IpcChannel = keyof IpcChannels
export type IpcRequest<C extends IpcChannel> = IpcChannels[C]['request']
export type IpcResponse<C extends IpcChannel> = IpcChannels[C]['response']