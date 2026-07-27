import{describe, test, expect, vi, beforeEach}from"vitest";
import{UpdateInfo, UpdateNotifier, compareSemver, parseReleaseJson}from"../src/core/updateNotifier.js";
function makeMemoryStorage(): {getItem: (key: string)=>string|null; setItem: (key: string, value: string)=>void; data: Record<string, string>}{
    let data: Record<string, string>={};
    return{
        getItem: (key: string)=>data[key]??null,
        setItem: (key: string, value: string)=>{data[key]=value;},
        data: data
    };
}
function makeResponse(body: unknown, status=200, headers: Record<string, string>={}): Response{
    return new Response(JSON.stringify(body), {status: status, headers: headers});
}
function makeStreamResponse(data: Uint8Array, status=200, headers: Record<string, string>={}): Response{
    return new Response(new ReadableStream({
        start(controller){
            controller.enqueue(data);
            controller.close();
        }
    }), {status: status, headers: headers});
}
describe("compareSemver", ()=>{
    test("returns -1 when a<b", ()=>{
        expect(compareSemver("1.0.0", "1.0.1")).toBe(-1);
        expect(compareSemver("1.0.0", "1.1.0")).toBe(-1);
        expect(compareSemver("1.0.0", "2.0.0")).toBe(-1);
    });
    test("returns 1 when a>b", ()=>{
        expect(compareSemver("1.0.1", "1.0.0")).toBe(1);
        expect(compareSemver("1.1.0", "1.0.0")).toBe(1);
        expect(compareSemver("2.0.0", "1.0.0")).toBe(1);
    });
    test("returns 0 when equal", ()=>{
        expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
        expect(compareSemver("2.5.3", "2.5.3")).toBe(0);
    });
    test("strips v prefix", ()=>{
        expect(compareSemver("v1.0.0", "1.0.1")).toBe(-1);
        expect(compareSemver("v2.0.0", "v1.9.9")).toBe(1);
        expect(compareSemver("v1.0.0", "1.0.0")).toBe(0);
    });
    test("handles different segment counts", ()=>{
        expect(compareSemver("1.0", "1.0.0")).toBe(0);
        expect(compareSemver("1.0.0", "1.0.1")).toBe(-1);
    });
});
describe("parseReleaseJson", ()=>{
    test("accepts direct format", ()=>{
        let json={
            version: "2.1.0",
            releaseDate: "2024-01-01",
            downloadUrl: "https://example.com/update.zip",
            releaseNotes: "Bug fixes",
            mandatory: false
        };
        let info=parseReleaseJson(json);
        expect(info.version).toBe("2.1.0");
        expect(info.releaseDate).toBe("2024-01-01");
        expect(info.downloadUrl).toBe("https://example.com/update.zip");
        expect(info.releaseNotes).toBe("Bug fixes");
        expect(info.mandatory).toBe(false);
    });
    test("accepts GitHub release format", ()=>{
        let json={
            tag_name: "v2.1.0",
            published_at: "2024-01-01T00:00:00Z",
            body: "Release notes",
            assets: [{browser_download_url: "https://example.com/app.zip"}]
        };
        let info=parseReleaseJson(json);
        expect(info.version).toBe("v2.1.0");
        expect(info.releaseDate).toBe("2024-01-01T00:00:00Z");
        expect(info.downloadUrl).toBe("https://example.com/app.zip");
        expect(info.releaseNotes).toBe("Release notes");
    });
    test("rejects non-object", ()=>{
        expect(()=>parseReleaseJson(null)).toThrow("Invalid release JSON");
        expect(()=>parseReleaseJson("bad")).toThrow("Invalid release JSON");
    });
    test("rejects missing version", ()=>{
        expect(()=>parseReleaseJson({releaseDate: "2024-01-01"})).toThrow("Missing or invalid version");
    });
    test("rejects missing releaseDate", ()=>{
        expect(()=>parseReleaseJson({version: "2.0.0"})).toThrow("Missing or invalid releaseDate");
    });
    test("rejects invalid downloadUrl type", ()=>{
        expect(()=>parseReleaseJson({version: "2.0.0", releaseDate: "2024-01-01", downloadUrl: 123})).toThrow("Invalid downloadUrl");
    });
    test("rejects invalid mandatory type", ()=>{
        expect(()=>parseReleaseJson({version: "2.0.0", releaseDate: "2024-01-01", mandatory: "yes"})).toThrow("Invalid mandatory");
    });
});
describe("UpdateNotifier", ()=>{
    beforeEach(()=>{
        vi.useFakeTimers();
        vi.setSystemTime(1000000);
    });
    test("check fetches latest release", async()=>{
        let storage=makeMemoryStorage();
        let fetchFn=vi.fn().mockResolvedValue(makeResponse({version: "2.1.0", releaseDate: "2024-01-01", downloadUrl: "https://example.com/update.zip"}));
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", storage: storage, fetch: fetchFn});
        let info=await notifier.check();
        expect(info).toBeDefined();
        expect(info?.version).toBe("2.1.0");
        expect(fetchFn).toHaveBeenCalledWith("https://api.example.com/release", expect.any(Object));
    });
    test("check returns undefined when current is newer", async()=>{
        let fetchFn=vi.fn().mockResolvedValue(makeResponse({version: "1.9.0", releaseDate: "2024-01-01"}));
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", fetch: fetchFn});
        let info=await notifier.check();
        expect(info).toBeUndefined();
    });
    test("check returns undefined on fetch error", async()=>{
        let fetchFn=vi.fn().mockRejectedValue(new Error("Network failure"));
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", fetch: fetchFn});
        let info=await notifier.check();
        expect(info).toBeUndefined();
    });
    test("check returns undefined on non-ok response", async()=>{
        let fetchFn=vi.fn().mockResolvedValue(makeResponse({}, 500));
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", fetch: fetchFn});
        let info=await notifier.check();
        expect(info).toBeUndefined();
    });
    test("isNewer detects newer version", ()=>{
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release"});
        expect(notifier.isNewer("2.0.1")).toBe(true);
        expect(notifier.isNewer("2.1.0")).toBe(true);
        expect(notifier.isNewer("3.0.0")).toBe(true);
    });
    test("isNewer false for older or equal", ()=>{
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release"});
        expect(notifier.isNewer("1.9.9")).toBe(false);
        expect(notifier.isNewer("2.0.0")).toBe(false);
    });
    test("shouldNotify false for skipped version", ()=>{
        let storage=makeMemoryStorage();
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", storage: storage});
        notifier.skipVersion("2.1.0");
        let info: UpdateInfo={version: "2.1.0", releaseDate: "2024-01-01"};
        expect(notifier.shouldNotify(info)).toBe(false);
    });
    test("shouldNotify false when snoozed", ()=>{
        let storage=makeMemoryStorage();
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", storage: storage});
        notifier.snooze(2000000);
        let info: UpdateInfo={version: "2.1.0", releaseDate: "2024-01-01"};
        expect(notifier.shouldNotify(info)).toBe(false);
    });
    test("shouldNotify true when snooze expired", ()=>{
        let storage=makeMemoryStorage();
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", storage: storage});
        notifier.snooze(500000);
        let info: UpdateInfo={version: "2.1.0", releaseDate: "2024-01-01"};
        expect(notifier.shouldNotify(info)).toBe(true);
    });
    test("skipVersion persisted in storage", ()=>{
        let storage=makeMemoryStorage();
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", storage: storage});
        notifier.skipVersion("2.1.0");
        expect(storage.getItem("updateNotifier_skipVersion")).toBe("2.1.0");
    });
    test("snooze persisted in storage", ()=>{
        let storage=makeMemoryStorage();
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", storage: storage});
        notifier.snooze(1234567);
        expect(storage.getItem("updateNotifier_snoozeUntil")).toBe("1234567");
    });
    test("mandatory update bypasses snooze", ()=>{
        let storage=makeMemoryStorage();
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", storage: storage});
        notifier.snooze(2000000);
        notifier.skipVersion("2.1.0");
        let info: UpdateInfo={version: "2.1.0", releaseDate: "2024-01-01", mandatory: true};
        expect(notifier.shouldNotify(info)).toBe(true);
    });
    test("downloadUpdate returns buffer", async()=>{
        let fetchFn=vi.fn().mockResolvedValue(new Response(Buffer.from("update payload"), {status: 200}));
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", fetch: fetchFn});
        let info: UpdateInfo={version: "2.1.0", releaseDate: "2024-01-01", downloadUrl: "https://example.com/update.zip"};
        let result=await notifier.downloadUpdate(info);
        expect(Buffer.isBuffer(result)).toBe(true);
        expect(result.toString()).toBe("update payload");
    });
    test("downloadUpdate throws when no downloadUrl", async()=>{
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release"});
        let info: UpdateInfo={version: "2.1.0", releaseDate: "2024-01-01"};
        await expect(notifier.downloadUpdate(info)).rejects.toThrow("No downloadUrl available");
    });
    test("downloadUpdate throws on non-ok response", async()=>{
        let fetchFn=vi.fn().mockResolvedValue(makeResponse("error", 404));
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", fetch: fetchFn});
        let info: UpdateInfo={version: "2.1.0", releaseDate: "2024-01-01", downloadUrl: "https://example.com/update.zip"};
        await expect(notifier.downloadUpdate(info)).rejects.toThrow("Download failed");
    });
    test("downloadUpdate reports progress", async()=>{
        let data=new TextEncoder().encode("update payload");
        let fetchFn=vi.fn().mockResolvedValue(makeStreamResponse(data, 200, {"content-length": String(data.length)}));
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", fetch: fetchFn});
        let info: UpdateInfo={version: "2.1.0", releaseDate: "2024-01-01", downloadUrl: "https://example.com/update.zip"};
        let progress=vi.fn();
        let result=await notifier.downloadUpdate(info, progress);
        expect(result.toString()).toBe("update payload");
        expect(progress).toHaveBeenCalledWith(100);
    });
    test("lastCheck updated after check", async()=>{
        let fetchFn=vi.fn().mockResolvedValue(makeResponse({version: "2.1.0", releaseDate: "2024-01-01"}));
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", fetch: fetchFn});
        expect(notifier.getLastCheck()).toBe(0);
        await notifier.check();
        expect(notifier.getLastCheck()).toBe(1000000);
    });
    test("check sends Accept application/json header", async()=>{
        let fetchFn=vi.fn().mockResolvedValue(makeResponse({version: "2.1.0", releaseDate: "2024-01-01"}));
        let notifier=new UpdateNotifier({currentVersion: "2.0.0", updateUrl: "https://api.example.com/release", fetch: fetchFn});
        await notifier.check();
        expect(fetchFn).toHaveBeenCalledWith("https://api.example.com/release", expect.objectContaining({
            headers: expect.objectContaining({"Accept": "application/json"})
        }));
    });
});
