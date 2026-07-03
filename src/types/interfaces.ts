export interface FileObj{
    path:string
    name:string
    size:number
    type:string
    lastModified:Date
}
export interface ReadFileResult{
    success:boolean
    content?:string
    error?:string
}
export interface SaveFileResult{
    success:boolean
    error?:string
}
export interface ParseFileResult{
    success:boolean
    content?:string
    error?:string
}
export interface ParseBatchResult{
    success:boolean
    results?:ParseBatchItem[]
    error?:string
}
export interface ParseBatchItem{
    filePath:string
    success:boolean
    text:string
    error:string|null
}
export interface OllamaModel{
    name:string
    size?:number
    modified_at?:string
    digest?:string
}
export interface OllamaStatus{
    running:boolean
    models:OllamaModel[]
    version?:string
    error?:string
}
export interface OllamaGenerateOptions{
    temperature?:number
    top_p?:number
    num_predict?:number
    [key:string]:unknown
}
export interface OllamaGenerateResult{
    success:boolean
    response?:string
    error?:string
}
export interface SelectedFile{
    file:File|null
    name:string
    size:number
    type:string
    path:string|null
}
export interface ChatMessage{
    role:'system'|'user'|'assistant'
    content:string
}
export interface InstructionTrainingItem{
    format:'instruction'
    instruction?:string
    input?:string
    output?:string
    text?:string
    messages?:ChatMessage[]
    _provenance?:unknown
}
export interface ChatMLTrainingItem{
    format:'chatml'
    messages?:ChatMessage[]
    instruction?:string
    input?:string
    output?:string
    text?:string
    _provenance?:unknown
}
export interface TextTrainingItem{
    format:'text'
    text?:string
    instruction?:string
    input?:string
    output?:string
    messages?:ChatMessage[]
    _provenance?:unknown
}
export type TrainingItem=InstructionTrainingItem|ChatMLTrainingItem|TextTrainingItem
export interface QAPair{
    question:string
    answer:string
}
export interface ConversationTurn{
    user:string
    assistant:string
}
export interface ProcessFileResult{
    success:boolean
    data?:TrainingItem[]
    error?:string
}
export interface WorkerMessage{
    id:number
    buffer:Buffer
}
export interface WorkerResult{
    id:number
    success:boolean
    text?:string
    error?:string
    warning?:string
}
export interface AppSettings{
    model?:string
    processingType?:string
    outputFormat?:string
    language?:string
    chunkSize?:number
    concurrency?:number
    provider?:string
    apiKey?:string
    baseUrl?:string
    temperature?:number
}
export interface FullAppSettings{
    theme?:string
    fontSize?:string
    autoSave?:boolean
    autoCheckOllama?:boolean
    startMaximized?:boolean
    rememberWindowSize?:boolean
    maxFileSize?:number
    maxOutputItems?:number
    maxChunks?:number
    smartSizing?:boolean
    maxParallelFiles?:number
}
export interface LogEntry{
    timestamp:string
    level:'debug'|'info'|'warn'|'error'
    module:string
    message:string
    context?:Record<string,unknown>
}
