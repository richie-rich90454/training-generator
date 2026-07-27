// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { IssueReporter, FeedbackPayload, redactEmail, redactPhone } from "../src/core/issueReporter.js";
import { DiagnosticsGenerator, DiagnosticsReport } from "../src/core/diagnostics.js";
function createFetch(response?: Partial<Response>): typeof fetch{
    return vi.fn(async ()=>({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async ()=>({html_url: "https://github.com/owner/repo/issues/1"}),
        ...response
    } as Response));
}
beforeEach(()=>{
    vi.clearAllMocks();
});
describe("redactEmail", ()=>{
    test("replaces email address with redacted token", ()=>{
        let result=redactEmail("Contact me at user@example.com please");
        expect(result).toBe("Contact me at [REDACTED EMAIL] please");
    });
    test("replaces multiple email addresses", ()=>{
        let result=redactEmail("a@b.com and c@d.org");
        expect(result).toBe("[REDACTED EMAIL] and [REDACTED EMAIL]");
    });
    test("leaves text without emails unchanged", ()=>{
        let result=redactEmail("No contact info here");
        expect(result).toBe("No contact info here");
    });
});
describe("redactPhone", ()=>{
    test("replaces phone number with redacted token", ()=>{
        let result=redactPhone("Call me at 555-123-4567 please");
        expect(result).toBe("Call me at [REDACTED PHONE] please");
    });
    test("replaces phone with country code", ()=>{
        let result=redactPhone("Call +1 555 123 4567");
        expect(result).toBe("Call [REDACTED PHONE]");
    });
    test("replaces parenthesized area code", ()=>{
        let result=redactPhone("Call (555) 123-4567");
        expect(result).toBe("Call [REDACTED PHONE]");
    });
    test("leaves text without phone unchanged", ()=>{
        let result=redactPhone("No phone here");
        expect(result).toBe("No phone here");
    });
});
describe("IssueReporter", ()=>{
    describe("submitFeedback", ()=>{
        test("submits to endpoint and returns success", async ()=>{
            let fetchMock=createFetch();
            let reporter=new IssueReporter({endpoint: "https://example.com/feedback", fetch: fetchMock});
            let payload: FeedbackPayload={type: "general", message: "Great app!"};
            let result=await reporter.submitFeedback(payload);
            expect(result.success).toBe(true);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith("https://example.com/feedback", expect.objectContaining({method: "POST"}));
        });
        test("creates GitHub issue and returns issueUrl", async ()=>{
            let fetchMock=createFetch();
            let reporter=new IssueReporter({githubRepo: {owner: "owner", repo: "repo"}, fetch: fetchMock});
            let payload: FeedbackPayload={type: "bug", message: "It crashed"};
            let result=await reporter.submitFeedback(payload);
            expect(result.success).toBe(true);
            expect(result.issueUrl).toBe("https://github.com/owner/repo/issues/1");
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
        test("prefers GitHub over endpoint when both configured", async ()=>{
            let fetchMock=createFetch();
            let reporter=new IssueReporter({
                endpoint: "https://example.com/feedback",
                githubRepo: {owner: "owner", repo: "repo"},
                fetch: fetchMock
            });
            let payload: FeedbackPayload={type: "feature", message: "Add dark mode"};
            let result=await reporter.submitFeedback(payload);
            expect(result.success).toBe(true);
            expect(result.issueUrl).toBeDefined();
            expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("api.github.com"), expect.any(Object));
        });
        test("returns error when no endpoint or githubRepo configured", async ()=>{
            let reporter=new IssueReporter({});
            let payload: FeedbackPayload={type: "general", message: "Hello"};
            let result=await reporter.submitFeedback(payload);
            expect(result.success).toBe(false);
            expect(result.error).toContain("No submission target configured");
        });
        test("returns error when endpoint responds with non-ok status", async ()=>{
            let fetchMock=createFetch({ok: false, status: 500, statusText: "Internal Server Error"});
            let reporter=new IssueReporter({endpoint: "https://example.com/feedback", fetch: fetchMock});
            let payload: FeedbackPayload={type: "general", message: "Hello"};
            let result=await reporter.submitFeedback(payload);
            expect(result.success).toBe(false);
            expect(result.error).toContain("500");
        });
        test("returns error when GitHub responds with non-ok status", async ()=>{
            let fetchMock=createFetch({ok: false, status: 401, statusText: "Unauthorized"});
            let reporter=new IssueReporter({githubRepo: {owner: "owner", repo: "repo"}, fetch: fetchMock});
            let payload: FeedbackPayload={type: "bug", message: "Hello"};
            let result=await reporter.submitFeedback(payload);
            expect(result.success).toBe(false);
            expect(result.error).toContain("401");
        });
        test("scrubs PII before submission", async ()=>{
            let fetchMock=createFetch();
            let reporter=new IssueReporter({endpoint: "https://example.com/feedback", fetch: fetchMock});
            let payload: FeedbackPayload={type: "bug", message: "I am user@example.com and my number is 555-123-4567"};
            await reporter.submitFeedback(payload);
            let callArgs=(fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
            let bodyJson=JSON.parse(callArgs[1].body);
            expect(bodyJson.message).not.toContain("user@example.com");
            expect(bodyJson.message).not.toContain("555-123-4567");
            expect(bodyJson.message).toContain("[REDACTED EMAIL]");
            expect(bodyJson.message).toContain("[REDACTED PHONE]");
        });
    });
    describe("createGitHubIssue", ()=>{
        test("returns issue URL from GitHub API response", async ()=>{
            let fetchMock=createFetch();
            let reporter=new IssueReporter({githubRepo: {owner: "owner", repo: "repo"}, fetch: fetchMock});
            let payload: FeedbackPayload={type: "bug", message: "Crash on startup"};
            let url=await reporter.createGitHubIssue(payload);
            expect(url).toBe("https://github.com/owner/repo/issues/1");
        });
        test("includes Authorization header when apiToken provided", async ()=>{
            let fetchMock=createFetch();
            let reporter=new IssueReporter({githubRepo: {owner: "owner", repo: "repo"}, apiToken: "token123", fetch: fetchMock});
            let payload: FeedbackPayload={type: "bug", message: "Crash"};
            await reporter.createGitHubIssue(payload);
            let callArgs=(fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
            expect(callArgs[1].headers["Authorization"]).toBe("Bearer token123");
        });
        test("throws when GitHub repo not configured", async ()=>{
            let reporter=new IssueReporter({});
            let payload: FeedbackPayload={type: "bug", message: "Crash"};
            await expect(reporter.createGitHubIssue(payload)).rejects.toThrow("GitHub repo not configured");
        });
        test("sets bug label for bug type", async ()=>{
            let fetchMock=createFetch();
            let reporter=new IssueReporter({githubRepo: {owner: "owner", repo: "repo"}, fetch: fetchMock});
            await reporter.createGitHubIssue({type: "bug", message: "Crash"});
            let callArgs=(fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
            let body=JSON.parse(callArgs[1].body);
            expect(body.labels).toEqual(["bug"]);
        });
        test("sets enhancement label for feature type", async ()=>{
            let fetchMock=createFetch();
            let reporter=new IssueReporter({githubRepo: {owner: "owner", repo: "repo"}, fetch: fetchMock});
            await reporter.createGitHubIssue({type: "feature", message: "Add feature"});
            let callArgs=(fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
            let body=JSON.parse(callArgs[1].body);
            expect(body.labels).toEqual(["enhancement"]);
        });
    });
    describe("submitToEndpoint", ()=>{
        test("throws when endpoint not configured", async ()=>{
            let reporter=new IssueReporter({});
            let payload: FeedbackPayload={type: "general", message: "Hello"};
            await expect(reporter.submitToEndpoint(payload)).rejects.toThrow("Endpoint not configured");
        });
        test("throws on non-ok response", async ()=>{
            let fetchMock=createFetch({ok: false, status: 400, statusText: "Bad Request"});
            let reporter=new IssueReporter({endpoint: "https://example.com/feedback", fetch: fetchMock});
            let payload: FeedbackPayload={type: "general", message: "Hello"};
            await expect(reporter.submitToEndpoint(payload)).rejects.toThrow("400");
        });
    });
    describe("scrubPayload", ()=>{
        test("removes PII from message", ()=>{
            let reporter=new IssueReporter({});
            let payload: FeedbackPayload={type: "bug", message: "I am user@example.com, call 555-123-4567"};
            let result=reporter.scrubPayload(payload);
            expect(result.message).toBe("I am [REDACTED EMAIL], call [REDACTED PHONE]");
        });
        test("removes PII from email field", ()=>{
            let reporter=new IssueReporter({});
            let payload: FeedbackPayload={type: "bug", message: "Bug", email: "user@example.com"};
            let result=reporter.scrubPayload(payload);
            expect(result.email).toBe("[REDACTED EMAIL]");
        });
        test("removes PII from metadata strings and arrays", ()=>{
            let reporter=new IssueReporter({});
            let payload: FeedbackPayload={
                type: "bug",
                message: "Bug",
                metadata: {user: "user@example.com", phones: ["555-123-4567", "no-pii"]}
            };
            let result=reporter.scrubPayload(payload);
            expect(result.metadata).toEqual({user: "[REDACTED EMAIL]", phones: ["[REDACTED PHONE]", "no-pii"]});
        });
        test("preserves non-PII fields", ()=>{
            let reporter=new IssueReporter({});
            let payload: FeedbackPayload={type: "feature", message: "Add export", rating: 4, attachDiagnostics: false};
            let result=reporter.scrubPayload(payload);
            expect(result.type).toBe("feature");
            expect(result.rating).toBe(4);
            expect(result.attachDiagnostics).toBe(false);
        });
    });
    describe("attachDiagnostics", ()=>{
        test("includes diagnostics report when generator provided", async ()=>{
            let report: DiagnosticsReport={
                generatedAt: Date.now(),
                appVersion: "1.0.0",
                platform: "win32",
                health: {},
                logs: [],
                settings: {},
                providerStatuses: {},
                itemSummary: {}
            };
            let generator={generate: vi.fn(async ()=>report)} as unknown as DiagnosticsGenerator;
            let reporter=new IssueReporter({diagnosticsGenerator: generator});
            let payload: FeedbackPayload={type: "bug", message: "Crash"};
            let result=await reporter.attachDiagnostics(payload);
            expect(result.diagnostics).toEqual(report);
            expect(generator.generate).toHaveBeenCalledTimes(1);
        });
        test("returns error diagnostics when generator not available", async ()=>{
            let reporter=new IssueReporter({});
            let payload: FeedbackPayload={type: "bug", message: "Crash"};
            let result=await reporter.attachDiagnostics(payload);
            expect(result.diagnostics).toEqual({error: "Diagnostics generator not available"});
        });
        test("returns error diagnostics when generator throws", async ()=>{
            let generator={generate: vi.fn(async ()=>{throw new Error("generator failed")})} as unknown as DiagnosticsGenerator;
            let reporter=new IssueReporter({diagnosticsGenerator: generator});
            let payload: FeedbackPayload={type: "bug", message: "Crash"};
            let result=await reporter.attachDiagnostics(payload);
            expect(result.diagnostics).toEqual({error: "generator failed"});
        });
    });
    describe("diagnostics attachment in submitFeedback", ()=>{
        test("attaches diagnostics when attachDiagnostics is true", async ()=>{
            let report: DiagnosticsReport={
                generatedAt: Date.now(),
                appVersion: "1.0.0",
                platform: "win32",
                health: {},
                logs: [],
                settings: {},
                providerStatuses: {},
                itemSummary: {}
            };
            let generator={generate: vi.fn(async ()=>report)} as unknown as DiagnosticsGenerator;
            let fetchMock=createFetch();
            let reporter=new IssueReporter({endpoint: "https://example.com/feedback", diagnosticsGenerator: generator, fetch: fetchMock});
            let payload: FeedbackPayload={type: "bug", message: "Crash", attachDiagnostics: true};
            await reporter.submitFeedback(payload);
            let callArgs=(fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
            let bodyJson=JSON.parse(callArgs[1].body);
            expect(bodyJson.diagnostics).toEqual(report);
        });
        test("does not attach diagnostics when attachDiagnostics is false", async ()=>{
            let generator={generate: vi.fn(async ()=>({}))} as unknown as DiagnosticsGenerator;
            let fetchMock=createFetch();
            let reporter=new IssueReporter({endpoint: "https://example.com/feedback", diagnosticsGenerator: generator, fetch: fetchMock});
            let payload: FeedbackPayload={type: "bug", message: "Crash", attachDiagnostics: false};
            await reporter.submitFeedback(payload);
            let callArgs=(fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
            let bodyJson=JSON.parse(callArgs[1].body);
            expect(bodyJson.diagnostics).toBeUndefined();
            expect(generator.generate).not.toHaveBeenCalled();
        });
        test("does not attach diagnostics when option omitted", async ()=>{
            let generator={generate: vi.fn(async ()=>({}))} as unknown as DiagnosticsGenerator;
            let fetchMock=createFetch();
            let reporter=new IssueReporter({endpoint: "https://example.com/feedback", diagnosticsGenerator: generator, fetch: fetchMock});
            let payload: FeedbackPayload={type: "bug", message: "Crash"};
            await reporter.submitFeedback(payload);
            let callArgs=(fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
            let bodyJson=JSON.parse(callArgs[1].body);
            expect(bodyJson.diagnostics).toBeUndefined();
            expect(generator.generate).not.toHaveBeenCalled();
        });
    });
});
