// @vitest-environment node
import { describe, test, expect, vi } from "vitest";
import { HealthChecker, HealthCheck, formatHealthReport } from "../src/core/healthChecker.js";
describe("HealthChecker", ()=>{
    test("register and run check", async ()=>{
        let checker=new HealthChecker();
        checker.register("custom", ()=>{
            return {name: "custom", status: "healthy", message: "ok", durationMs: 0};
        });
        let results=await checker.runAll();
        expect(results.length).toBe(1);
        expect(results[0].name).toBe("custom");
        expect(results[0].status).toBe("healthy");
    });
    test("runAll records duration", async ()=>{
        let checker=new HealthChecker();
        checker.register("slow", async ()=>{
            await new Promise(resolve=>setTimeout(resolve, 25));
            return {name: "slow", status: "healthy", message: "ok", durationMs: 0};
        });
        let results=await checker.runAll();
        expect(results[0].durationMs).toBeGreaterThanOrEqual(20);
    });
    test("runAll uses registered name when check omits name", async ()=>{
        let checker=new HealthChecker();
        checker.register("fallback", ()=>{
            return {status: "healthy", message: "ok", durationMs: 0} as HealthCheck;
        });
        let results=await checker.runAll();
        expect(results[0].name).toBe("fallback");
    });
    test("runAll marks thrown error as critical", async ()=>{
        let checker=new HealthChecker();
        checker.register("boom", ()=>{
            throw new Error("fail");
        });
        let results=await checker.runAll();
        expect(results[0].status).toBe("critical");
        expect(results[0].message).toContain("fail");
    });
    test("runAll executes checks concurrently", async ()=>{
        let checker=new HealthChecker();
        checker.register("a", async ()=>{
            await new Promise(resolve=>setTimeout(resolve, 25));
            return {name: "a", status: "healthy", message: "ok", durationMs: 0};
        });
        checker.register("b", async ()=>{
            await new Promise(resolve=>setTimeout(resolve, 25));
            return {name: "b", status: "healthy", message: "ok", durationMs: 0};
        });
        let start=Date.now();
        let results=await checker.runAll();
        let elapsed=Date.now()-start;
        expect(results.length).toBe(2);
        expect(elapsed).toBeLessThan(80);
    });
    test("getStatus overall healthy when all pass", async ()=>{
        let checker=new HealthChecker();
        checker.register("a", ()=>({name: "a", status: "healthy", message: "ok", durationMs: 0}));
        checker.register("b", ()=>({name: "b", status: "healthy", message: "ok", durationMs: 0}));
        let status=await checker.getStatus();
        expect(status.overall).toBe("healthy");
    });
    test("getStatus overall warning when one warning", async ()=>{
        let checker=new HealthChecker();
        checker.register("a", ()=>({name: "a", status: "healthy", message: "ok", durationMs: 0}));
        checker.register("b", ()=>({name: "b", status: "warning", message: "warn", durationMs: 0}));
        let status=await checker.getStatus();
        expect(status.overall).toBe("warning");
    });
    test("getStatus overall critical when one critical", async ()=>{
        let checker=new HealthChecker();
        checker.register("a", ()=>({name: "a", status: "healthy", message: "ok", durationMs: 0}));
        checker.register("b", ()=>({name: "b", status: "critical", message: "crit", durationMs: 0}));
        let status=await checker.getStatus();
        expect(status.overall).toBe("critical");
    });
    test("getStatus overall critical trumps warning", async ()=>{
        let checker=new HealthChecker();
        checker.register("a", ()=>({name: "a", status: "warning", message: "warn", durationMs: 0}));
        checker.register("b", ()=>({name: "b", status: "critical", message: "crit", durationMs: 0}));
        let status=await checker.getStatus();
        expect(status.overall).toBe("critical");
    });
    test("diskSpace healthy when free above 1GB", async ()=>{
        let result=await HealthChecker.diskSpace(()=>2*1024*1024*1024);
        expect(result.status).toBe("healthy");
    });
    test("diskSpace warns when low", async ()=>{
        let result=await HealthChecker.diskSpace(()=>700*1024*1024);
        expect(result.status).toBe("warning");
        expect(result.message).toContain("low");
    });
    test("diskSpace critical when very low", async ()=>{
        let result=await HealthChecker.diskSpace(()=>100*1024*1024);
        expect(result.status).toBe("critical");
    });
    test("diskSpace critical on error", async ()=>{
        let result=await HealthChecker.diskSpace(()=>{throw new Error("disk read failed");});
        expect(result.status).toBe("critical");
        expect(result.message).toContain("disk read failed");
    });
    test("memory healthy when RSS below 2GB", async ()=>{
        let result=await HealthChecker.memory(()=>({rss: 1024*1024*1024}));
        expect(result.status).toBe("healthy");
    });
    test("memory warns when high", async ()=>{
        let result=await HealthChecker.memory(()=>({rss: 3*1024*1024*1024}));
        expect(result.status).toBe("warning");
    });
    test("providerConnectivity healthy when all reachable", async ()=>{
        let fetchMock=vi.fn().mockResolvedValue({ok: true, status: 200});
        let result=await HealthChecker.providerConnectivity({
            providers: [{name: "p1", url: "https://example.com"}],
            fetch: fetchMock as unknown as typeof fetch
        });
        expect(result.status).toBe("healthy");
        expect(result.metadata?.reachable).toBe(1);
    });
    test("providerConnectivity fails on error", async ()=>{
        let fetchMock=vi.fn().mockRejectedValue(new Error("network down"));
        let result=await HealthChecker.providerConnectivity({
            providers: [{name: "p1", url: "https://example.com"}],
            fetch: fetchMock as unknown as typeof fetch
        });
        expect(result.status).toBe("critical");
        expect(result.message).toContain("unreachable");
    });
    test("providerConnectivity warning when partial failure", async ()=>{
        let fetchMock=vi.fn()
            .mockResolvedValueOnce({ok: true})
            .mockRejectedValueOnce(new Error("timeout"));
        let result=await HealthChecker.providerConnectivity({
            providers: [{name: "good", url: "https://a.com"}, {name: "bad", url: "https://b.com"}],
            fetch: fetchMock as unknown as typeof fetch
        });
        expect(result.status).toBe("warning");
        expect(result.metadata?.reachable).toBe(1);
    });
    test("providerConnectivity healthy with no providers", async ()=>{
        let result=await HealthChecker.providerConnectivity({providers: []});
        expect(result.status).toBe("healthy");
        expect(result.message).toBe("No providers configured");
    });
    test("formatHealthReport formats overall and checks", ()=>{
        let report={
            overall: "warning" as const,
            checks: [
                {name: "a", status: "healthy" as const, message: "ok", durationMs: 10},
                {name: "b", status: "warning" as const, message: "warn", durationMs: 20}
            ]
        };
        let text=formatHealthReport(report);
        expect(text).toContain("Overall: warning");
        expect(text).toContain("- a: healthy (10ms) ok");
        expect(text).toContain("- b: warning (20ms) warn");
    });
});
