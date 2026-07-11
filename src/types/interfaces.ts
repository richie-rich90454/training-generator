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
    metadata?:TrainingItemMetadata
}
export interface ChatMLTrainingItem{
    format:'chatml'
    messages?:ChatMessage[]
    instruction?:string
    input?:string
    output?:string
    text?:string
    _provenance?:unknown
    metadata?:TrainingItemMetadata
}
export interface TextTrainingItem{
    format:'text'
    text?:string
    instruction?:string
    input?:string
    output?:string
    messages?:ChatMessage[]
    _provenance?:unknown
    metadata?:TrainingItemMetadata
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
    customPrompt?:string
    ollamaHost?:string
    ollamaPort?:number
    providers?:ProviderConfig[]
    failoverPriority?:string[]
    ensembleModels?:string[]
    refinementPasses?:number
    qualityThreshold?:number
    validators?:ValidatorConfig[]
    watchFolders?:string[]
    webhooks?:WebhookConfig[]
    apiServer?:{enabled:boolean, port:number, auth?:string}
    pluginPaths?:string[]
    retentionDays?:number
    appLock?:{enabled:boolean, totpSecret?:string}
    density?:'compact'|'normal'|'spacious'
    dataResidency?:string
    proxy?:string
    otlpEndpoint?:string
    maxSessionTokens?:number
    incremental?:boolean
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
    enableThinking?:boolean
    providers?:ProviderConfig[]
    failoverPriority?:string[]
    ensembleModels?:string[]
    refinementPasses?:number
    qualityThreshold?:number
    validators?:ValidatorConfig[]
    watchFolders?:string[]
    webhooks?:WebhookConfig[]
    apiServer?:{enabled:boolean, port:number, auth?:string}
    pluginPaths?:string[]
    retentionDays?:number
    appLock?:{enabled:boolean, totpSecret?:string}
    density?:'compact'|'normal'|'spacious'
    dataResidency?:string
    proxy?:string
    otlpEndpoint?:string
    maxSessionTokens?:number
    incremental?:boolean
    workspaceId?:string
    telemetryEnabled?:boolean
    crashReportsEnabled?:boolean
    autoUpdate?:boolean
}
export interface LogEntry{
    timestamp:string
    level:'debug'|'info'|'warn'|'error'
    module:string
    message:string
    context?:Record<string,unknown>
}
export interface Citation{
    page?:number
    line?:number
    text:string
}
export interface QualityScores{
    overall?:number
    perplexity?:number
    diversity?:number
    bias?:number
    toxicity?:number
    hallucination?:number
    factualConsistency?:number
    grammar?:number
    readingLevel?:number
    coverage?:number
    completeness?:number
    ambiguity?:number
    adversarial?:number
}
export interface TrainingItemMetadata{
    difficulty?:'easy'|'medium'|'hard'
    topic?:string
    bloomLevel?:'remember'|'understand'|'apply'|'analyze'|'evaluate'|'create'
    citations?:Citation[]
    qualityScores?:QualityScores
    tags?:string[]
    piiFlags?:string[]
    sourceSpan?:{start:number, end:number}
    note?:string
    bookmarked?:boolean
    deletedAt?:number|null
    sensitive?:boolean
}
export interface ProviderConfig{
    id:string
    type:string
    name:string
    apiKey?:string
    baseUrl?:string
    model?:string
    priority:number
    enabled:boolean
    scopes?:('read'|'generate'|'export')[]
    region?:string
}
export interface ValidatorConfig{
    name:string
    enabled:boolean
    threshold?:number
    options?:Record<string, unknown>
}
export interface WebhookConfig{
    url:string
    events:string[]
    secret?:string
    enabled:boolean
}
export interface WorkspaceConfig{
    id:string
    name:string
    createdAt:number
    updatedAt:number
    settings?:AppSettings
}
