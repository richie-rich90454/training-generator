// IPC Channel definitions with typed request/response contracts

export interface IpcChannels {
  'file:parse': {
    request: { filePath: string; fileType: string }
    response: { success: boolean; content?: string; error?: string }
  }
  'file:parseBatch': {
    request: FileObj[]
    response: { success: boolean; results?: unknown[]; error?: string }
  }
  'file:save': {
    request: { filePath: string; content: string }
    response: { success: boolean; error?: string }
  }
  'file:read': {
    request: { filePath: string }
    response: { success: boolean; content?: string; error?: string }
  }
  'dialog:openFile': {
    request: void
    response: FileObj[]
  }
  'dialog:saveFile': {
    request: { defaultFilename?: string }
    response: string | null
  }
  'ollama:check': {
    request: void
    response: { running: boolean; models: unknown[]; version: string } | { running: false; models: never[]; error: string }
  }
  'ollama:generate': {
    request: { model: string; prompt: string; options?: Record<string, unknown> }
    response: { success: boolean; response?: string; error?: string }
  }
  'ollama:generateStream': {
    request: { model: string; prompt: string; options?: Record<string, unknown> }
    response: AsyncIterable<{ done: boolean; content?: string }>
  }
  'openai:generate': {
    request: { apiKey: string; baseUrl: string; model: string; prompt: string; options?: Record<string, unknown> }
    response: { success: boolean; response?: string; usage?: { total_tokens: number }; error?: string }
  }
  'app:getVersion': {
    request: void
    response: string
  }
  'app:getPlatform': {
    request: void
    response: string
  }
  'secureKey:getKey': {
    request: void
    response: string | null
  }
  'secureKey:setKey': {
    request: { key: string }
    response: boolean
  }
  'cache:load': {
    request: void
    response: { success: boolean; data?: Record<string, any> }
  }
  'cache:save': {
    request: { data: Record<string, any> }
    response: { success: boolean }
  }
  'cache:clear': {
    request: void
    response: { success: boolean }
  }
  'progress:save': {
    request: { data: any }
    response: { success: boolean }
  }
  'progress:load': {
    request: void
    response: { success: boolean; data?: any }
  }
  'progress:clear': {
    request: void
    response: { success: boolean }
  }
  'save-checkpoint': {
    request: { data: any }
    response: { success: boolean }
  }
  'load-checkpoint': {
    request: void
    response: { success: boolean; data?: any }
  }
  'clear-checkpoint': {
    request: void
    response: { success: boolean }
  }
  'write-log': {
    request: { entry: unknown }
    response: void
  }
  'export-logs': {
    request: { data: string }
    response: { success: boolean; error?: string }
  }
}

export type IpcChannel = keyof IpcChannels
export type IpcRequest<C extends IpcChannel> = IpcChannels[C]['request']
export type IpcResponse<C extends IpcChannel> = IpcChannels[C]['response']

// Re-export FileObj used by dialog channels
export interface FileObj {
  path: string
  name: string
  size: number
  type: string
  lastModified: Date
}
