// @vitest-environment node
import {describe, it, expect, vi, beforeEach, afterEach} from "vitest"
import {IdleProcessor, LazyModelLoader} from "../src/core/idleProcessor.js"
function mockCpuUsage(sequence: Array<{user: number; system: number}>): ReturnType<typeof vi.spyOn>{
    let index=0;
    return vi.spyOn(process, "cpuUsage").mockImplementation(()=>{
        let usage=sequence[index]??{user: 0, system: 0};
        if (index<sequence.length-1){
            index++;
        }
        return usage;
    });
}
describe("IdleProcessor", ()=>{
    beforeEach(()=>{
        vi.useFakeTimers();
        vi.stubGlobal("requestIdleCallback", undefined);
        vi.stubGlobal("cancelIdleCallback", undefined);
    });
    afterEach(()=>{
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
    it("should report idle before any measurement", ()=>{
        let processor=new IdleProcessor({cpuThreshold: 10});
        expect(processor.isIdle()).toBe(true);
    });
    it("should register tasks and report pending count", ()=>{
        let processor=new IdleProcessor();
        processor.registerTask(async()=>{});
        processor.registerTask(()=>{});
        expect(processor.getPendingCount()).toBe(2);
    });
    it("should run task when cpu is idle", async()=>{
        mockCpuUsage([
            {user: 10000, system: 0},
            {user: 0, system: 0}
        ]);
        let processor=new IdleProcessor({checkIntervalMs: 1000, cpuThreshold: 10});
        let ran=false;
        processor.registerTask(()=>{
            ran=true;
        });
        processor.start();
        await vi.advanceTimersByTimeAsync(1000);
        expect(ran).toBe(true);
        expect(processor.getPendingCount()).toBe(0);
        processor.stop();
    });
    it("should not run task when cpu is busy", async()=>{
        mockCpuUsage([
            {user: 500000, system: 0},
            {user: 0, system: 0}
        ]);
        let processor=new IdleProcessor({checkIntervalMs: 1000, cpuThreshold: 10});
        let ran=false;
        processor.registerTask(()=>{
            ran=true;
        });
        processor.start();
        await vi.advanceTimersByTimeAsync(1000);
        expect(ran).toBe(false);
        expect(processor.isIdle()).toBe(false);
        processor.stop();
    });
    it("should run multiple tasks in one idle window", async()=>{
        mockCpuUsage([
            {user: 10000, system: 0},
            {user: 0, system: 0}
        ]);
        let processor=new IdleProcessor({checkIntervalMs: 1000, cpuThreshold: 10});
        let count=0;
        processor.registerTask(()=>{count++;});
        processor.registerTask(()=>{count++;});
        processor.registerTask(()=>{count++;});
        processor.start();
        await vi.advanceTimersByTimeAsync(1000);
        expect(count).toBe(3);
        processor.stop();
    });
    it("should stop scheduling when stopped", async()=>{
        mockCpuUsage([
            {user: 10000, system: 0},
            {user: 0, system: 0}
        ]);
        let processor=new IdleProcessor({checkIntervalMs: 1000, cpuThreshold: 10});
        let count=0;
        processor.registerTask(()=>{count++;});
        processor.start();
        await vi.advanceTimersByTimeAsync(1000);
        processor.stop();
        count=0;
        await vi.advanceTimersByTimeAsync(1000);
        expect(count).toBe(0);
    });
    it("should use requestIdleCallback when available", async()=>{
        mockCpuUsage([
            {user: 10000, system: 0},
            {user: 0, system: 0}
        ]);
        let ran=false;
        (globalThis as any).requestIdleCallback=vi.fn((cb: (deadline: IdleDeadline)=>void)=>{
            setTimeout(()=>{
                cb({timeRemaining: ()=>50, didTimeout: false});
            }, 0);
            return 42;
        });
        (globalThis as any).cancelIdleCallback=vi.fn();
        let processor=new IdleProcessor({checkIntervalMs: 1000, cpuThreshold: 10});
        processor.registerTask(()=>{ran=true;});
        processor.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(ran).toBe(true);
        expect((globalThis as any).requestIdleCallback).toHaveBeenCalled();
        processor.stop();
        expect((globalThis as any).cancelIdleCallback).toHaveBeenCalled();
    });
});
describe("LazyModelLoader", ()=>{
    it("should fetch models on first call", async()=>{
        let fetcher=vi.fn(async (_provider: string)=>["m1", "m2"]);
        let loader=new LazyModelLoader({fetchModels: fetcher});
        let models=await loader.getModels("ollama");
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(fetcher).toHaveBeenCalledWith("ollama");
        expect(models).toEqual(["m1", "m2"]);
    });
    it("should cache models for subsequent calls", async()=>{
        let fetcher=vi.fn(async (_provider: string)=>["m1", "m2"]);
        let loader=new LazyModelLoader({fetchModels: fetcher});
        let first=await loader.getModels("ollama");
        let second=await loader.getModels("ollama");
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(first).toBe(second);
    });
    it("should invalidate provider cache", async()=>{
        let fetcher=vi.fn(async (_provider: string)=>["m1", "m2"]);
        let loader=new LazyModelLoader({fetchModels: fetcher});
        await loader.getModels("ollama");
        loader.invalidate("ollama");
        await loader.getModels("ollama");
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
    it("should cache per provider", async()=>{
        let fetcher=vi.fn(async (provider: string)=>[provider+"-m1"]);
        let loader=new LazyModelLoader({fetchModels: fetcher});
        let ollama=await loader.getModels("ollama");
        let openai=await loader.getModels("openai");
        expect(fetcher).toHaveBeenCalledTimes(2);
        expect(ollama).toEqual(["ollama-m1"]);
        expect(openai).toEqual(["openai-m1"]);
    });
    it("should share in-flight promise for concurrent calls", async()=>{
        let resolveFn: (value: string[])=>void=()=>{};
        let fetcher=vi.fn(()=>new Promise<string[]>((resolve)=>{resolveFn=resolve;}));
        let loader=new LazyModelLoader({fetchModels: fetcher});
        let p1=loader.getModels("ollama");
        let p2=loader.getModels("ollama");
        expect(fetcher).toHaveBeenCalledTimes(1);
        resolveFn(["m1"]);
        let r1=await p1;
        let r2=await p2;
        expect(r1).toEqual(["m1"]);
        expect(r2).toEqual(["m1"]);
    });
    it("should not call fetcher after invalidate for other providers", async()=>{
        let fetcher=vi.fn(async (provider: string)=>[provider+"-m1"]);
        let loader=new LazyModelLoader({fetchModels: fetcher});
        await loader.getModels("ollama");
        loader.invalidate("openai");
        await loader.getModels("ollama");
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});
