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

export interface TrainingItem{
    instruction?:string
    input?:string
    output?:string
    text?:string
    messages?:Array<{role:string;content:string}>
}

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
    chunkSize?:string
    concurrency?:string
    provider?:string
    apiKey?:string
    baseUrl?:string
}

export interface FullAppSettings{
    theme?:string
    fontSize?:string
    "auto-save"?:boolean
    "auto-check-ollama"?:boolean
    "start-maximized"?:boolean
    "remember-window-size"?:boolean
    "max-file-size"?:number
    maxOutputItems?:number
    maxChunks?:number
}
