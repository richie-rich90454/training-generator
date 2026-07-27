import { DiagnosticsGenerator, DiagnosticsReport } from "./diagnostics.js";
export interface FeedbackPayload{
    type: "bug" | "feature" | "general";
    message: string;
    email?: string;
    rating?: number;
    attachDiagnostics?: boolean;
    diagnostics?: unknown;
    metadata?: Record<string, unknown>;
}
export interface IssueReporterOptions{
    endpoint?: string;
    githubRepo?: {owner: string, repo: string};
    apiToken?: string;
    diagnosticsGenerator?: DiagnosticsGenerator;
    fetch?: typeof fetch;
}
export function redactEmail(text: string): string{
    let emailRegex=/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return text.replace(emailRegex, "[REDACTED EMAIL]");
}
export function redactPhone(text: string): string{
    let phoneRegex=/(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    return text.replace(phoneRegex, "[REDACTED PHONE]");
}
export class IssueReporter{
    private endpoint?: string;
    private githubRepo?: {owner: string, repo: string};
    private apiToken?: string;
    private diagnosticsGenerator?: DiagnosticsGenerator;
    private fetch: typeof fetch;
    constructor(options: IssueReporterOptions){
        this.endpoint=options.endpoint;
        this.githubRepo=options.githubRepo;
        this.apiToken=options.apiToken;
        this.diagnosticsGenerator=options.diagnosticsGenerator;
        this.fetch=options.fetch||globalThis.fetch;
    }
    async submitFeedback(payload: FeedbackPayload): Promise<{success: boolean, issueUrl?: string, error?: string}>{
        let scrubbed=this.scrubPayload(payload);
        if (scrubbed.attachDiagnostics){
            scrubbed=await this.attachDiagnostics(scrubbed);
        }
        if (this.githubRepo){
            try{
                let issueUrl=await this.createGitHubIssue(scrubbed);
                return {success: true, issueUrl: issueUrl};
            }
            catch (error){
                return {success: false, error: error instanceof Error ? error.message : String(error)};
            }
        }
        if (this.endpoint){
            try{
                await this.submitToEndpoint(scrubbed);
                return {success: true};
            }
            catch (error){
                return {success: false, error: error instanceof Error ? error.message : String(error)};
            }
        }
        return {success: false, error: "No submission target configured. Provide an endpoint or githubRepo."};
    }
    async createGitHubIssue(payload: FeedbackPayload): Promise<string>{
        if (!this.githubRepo){
            throw new Error("GitHub repo not configured");
        }
        let url=`https://api.github.com/repos/${this.githubRepo.owner}/${this.githubRepo.repo}/issues`;
        let body=this.buildIssueBody(payload);
        let response=await this.fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/vnd.github+json",
                ...(this.apiToken ? {"Authorization": `Bearer ${this.apiToken}`} : {})
            },
            body: JSON.stringify(body)
        });
        if (!response.ok){
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
        let data=await response.json() as {html_url: string};
        return data.html_url;
    }
    async submitToEndpoint(payload: FeedbackPayload): Promise<void>{
        if (!this.endpoint){
            throw new Error("Endpoint not configured");
        }
        let response=await this.fetch(this.endpoint, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });
        if (!response.ok){
            throw new Error(`Endpoint error: ${response.status} ${response.statusText}`);
        }
    }
    scrubPayload(payload: FeedbackPayload): FeedbackPayload{
        let scrubbed: FeedbackPayload={
            type: payload.type,
            message: redactEmail(redactPhone(payload.message))
        };
        if (payload.email!==undefined){
            scrubbed.email=redactEmail(payload.email);
        }
        if (payload.rating!==undefined){
            scrubbed.rating=payload.rating;
        }
        if (payload.attachDiagnostics!==undefined){
            scrubbed.attachDiagnostics=payload.attachDiagnostics;
        }
        if (payload.diagnostics!==undefined){
            scrubbed.diagnostics=this.scrubDiagnostics(payload.diagnostics);
        }
        if (payload.metadata!==undefined){
            scrubbed.metadata=this.scrubMetadata(payload.metadata);
        }
        return scrubbed;
    }
    async attachDiagnostics(payload: FeedbackPayload): Promise<FeedbackPayload>{
        if (!this.diagnosticsGenerator){
            return {...payload, diagnostics: {error: "Diagnostics generator not available"}};
        }
        try{
            let report=await this.diagnosticsGenerator.generate();
            return {...payload, diagnostics: report};
        }
        catch (error){
            return {...payload, diagnostics: {error: error instanceof Error ? error.message : String(error)}};
        }
    }
    private scrubDiagnostics(diagnostics: unknown): unknown{
        if (typeof diagnostics==="string"){
            return redactEmail(redactPhone(diagnostics));
        }
        if (Array.isArray(diagnostics)){
            return diagnostics.map(item=>this.scrubDiagnostics(item));
        }
        if (diagnostics!==null&&typeof diagnostics==="object"){
            let result: Record<string, unknown>={};
            for (let key of Object.keys(diagnostics as Record<string, unknown>)){
                let value=(diagnostics as Record<string, unknown>)[key];
                if (typeof value==="string"){
                    result[key]=redactEmail(redactPhone(value));
                }
                else{
                    result[key]=this.scrubDiagnostics(value);
                }
            }
            return result;
        }
        return diagnostics;
    }
    private scrubMetadata(metadata: Record<string, unknown>): Record<string, unknown>{
        let result: Record<string, unknown>={};
        for (let key of Object.keys(metadata)){
            let value=metadata[key];
            if (typeof value==="string"){
                result[key]=redactEmail(redactPhone(value));
            }
            else{
                result[key]=this.scrubDiagnostics(value);
            }
        }
        return result;
    }
    private buildIssueBody(payload: FeedbackPayload): {title: string, body: string, labels?: string[]}{
        let title=`[${payload.type}] User feedback`;
        let body=`**Type:** ${payload.type}\n\n**Message:**\n${payload.message}`;
        if (payload.rating!==undefined){
            body+=`\n\n**Rating:** ${payload.rating}/5`;
        }
        if (payload.email){
            body+=`\n\n**Contact:** ${payload.email}`;
        }
        if (payload.diagnostics){
            body+=`\n\n**Diagnostics:**\n\`\`\`json\n${JSON.stringify(payload.diagnostics, null, 2)}\n\`\`\``;
        }
        if (payload.metadata){
            body+=`\n\n**Metadata:**\n\`\`\`json\n${JSON.stringify(payload.metadata, null, 2)}\n\`\`\``;
        }
        let labels: string[]=[];
        if (payload.type==="bug"){
            labels.push("bug");
        }
        else if (payload.type==="feature"){
            labels.push("enhancement");
        }
        else{
            labels.push("feedback");
        }
        return {title: title, body: body, labels: labels};
    }
}
