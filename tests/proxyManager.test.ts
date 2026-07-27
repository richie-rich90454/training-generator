import{describe, test, expect, vi, beforeEach, afterEach}from"vitest";
import os from "os";
import fs from "fs/promises";
import path from "path";
let agentMocks=vi.hoisted(()=>{
    return{
        HttpProxyAgent: vi.fn(),
        HttpsProxyAgent: vi.fn(),
        SocksProxyAgent: vi.fn()
    };
});
vi.mock("http-proxy-agent", ()=>{
    return{
        HttpProxyAgent: agentMocks.HttpProxyAgent
    };
});
vi.mock("https-proxy-agent", ()=>{
    return{
        HttpsProxyAgent: agentMocks.HttpsProxyAgent
    };
});
vi.mock("socks-proxy-agent", ()=>{
    return{
        SocksProxyAgent: agentMocks.SocksProxyAgent
    };
});
import{ProxyManager, parseProxyUrl, formatProxyUrl}from"../src/core/proxyManager.js";
let certDir: string;
beforeEach(async()=>{
    vi.clearAllMocks();
    certDir=path.join(os.tmpdir(), "proxy-certs-"+Date.now());
    await fs.mkdir(certDir, {recursive: true});
});
afterEach(async()=>{
    await fs.rm(certDir, {recursive: true, force: true});
});
describe("parseProxyUrl", ()=>{
    test("extracts http fields without auth", ()=>{
        let config=parseProxyUrl("http://proxy.example.com:8080");
        expect(config.protocol).toBe("http");
        expect(config.host).toBe("proxy.example.com");
        expect(config.port).toBe(8080);
        expect(config.username).toBeUndefined();
        expect(config.password).toBeUndefined();
    });
    test("extracts auth fields", ()=>{
        let config=parseProxyUrl("http://user:pass@proxy.example.com:8080");
        expect(config.username).toBe("user");
        expect(config.password).toBe("pass");
    });
    test("decodes url-encoded auth", ()=>{
        let config=parseProxyUrl("http://user%40dom:p%40ss@proxy.example.com:8080");
        expect(config.username).toBe("user@dom");
        expect(config.password).toBe("p@ss");
    });
    test("defaults https port", ()=>{
        let config=parseProxyUrl("https://proxy.example.com");
        expect(config.port).toBe(443);
    });
    test("defaults http port", ()=>{
        let config=parseProxyUrl("http://proxy.example.com");
        expect(config.port).toBe(80);
    });
    test("handles socks5h", ()=>{
        let config=parseProxyUrl("socks5h://127.0.0.1:1080");
        expect(config.protocol).toBe("socks5h");
        expect(config.host).toBe("127.0.0.1");
        expect(config.port).toBe(1080);
    });
});
describe("formatProxyUrl", ()=>{
    test("formats url with auth", ()=>{
        let url=formatProxyUrl({protocol: "http", host: "p.example.com", port: 8080, username: "u", password: "p"});
        expect(url).toBe("http://u:p@p.example.com:8080");
    });
    test("formats url without auth", ()=>{
        let url=formatProxyUrl({protocol: "https", host: "p.example.com", port: 443});
        expect(url).toBe("https://p.example.com:443");
    });
    test("formats socks5h url", ()=>{
        let url=formatProxyUrl({protocol: "socks5h", host: "127.0.0.1", port: 1080});
        expect(url).toBe("socks5h://127.0.0.1:1080");
    });
    test("round-trips through parseProxyUrl", ()=>{
        let original={protocol: "http" as const, host: "proxy.example.com", port: 9090, username: "u", password: "p"};
        let parsed=parseProxyUrl(formatProxyUrl(original));
        expect(parsed).toEqual(original);
    });
});
describe("ProxyManager.getAxiosProxyAgent", ()=>{
    test("returns undefined when no proxy", async()=>{
        let manager=new ProxyManager({});
        let agent=await manager.getAxiosProxyAgent();
        expect(agent).toBeUndefined();
    });
    test("returns http agent", async()=>{
        let manager=new ProxyManager({proxy: {protocol: "http", host: "p.example.com", port: 8080}});
        let agent=await manager.getAxiosProxyAgent();
        expect(agent).toBeInstanceOf(agentMocks.HttpProxyAgent);
        expect(agentMocks.HttpProxyAgent).toHaveBeenCalledWith("http://p.example.com:8080");
    });
    test("returns https agent", async()=>{
        let manager=new ProxyManager({proxy: {protocol: "https", host: "p.example.com", port: 8443}});
        let agent=await manager.getAxiosProxyAgent();
        expect(agent).toBeInstanceOf(agentMocks.HttpsProxyAgent);
        expect(agentMocks.HttpsProxyAgent).toHaveBeenCalledWith("https://p.example.com:8443");
    });
    test("returns socks5 agent", async()=>{
        let manager=new ProxyManager({proxy: {protocol: "socks5", host: "127.0.0.1", port: 1080}});
        let agent=await manager.getAxiosProxyAgent();
        expect(agent).toBeInstanceOf(agentMocks.SocksProxyAgent);
        expect(agentMocks.SocksProxyAgent).toHaveBeenCalledWith("socks5://127.0.0.1:1080");
    });
    test("returns socks5h agent", async()=>{
        let manager=new ProxyManager({proxy: {protocol: "socks5h", host: "127.0.0.1", port: 1080}});
        let agent=await manager.getAxiosProxyAgent();
        expect(agent).toBeInstanceOf(agentMocks.SocksProxyAgent);
        expect(agentMocks.SocksProxyAgent).toHaveBeenCalledWith("socks5h://127.0.0.1:1080");
    });
    test("throws when http agent module is missing", async()=>{
        vi.doMock("http-proxy-agent", ()=>{
            return {HttpProxyAgent: undefined};
        });
        vi.resetModules();
        let {ProxyManager: PM}=await import("../src/core/proxyManager.js");
        let manager=new PM({proxy: {protocol: "http", host: "p", port: 80}});
        await expect(manager.getAxiosProxyAgent()).rejects.toThrow("http-proxy-agent is not installed");
        vi.doMock("http-proxy-agent", ()=>{
            return {HttpProxyAgent: agentMocks.HttpProxyAgent};
        });
        vi.resetModules();
    });
});
describe("ProxyManager.loadCustomCaCerts", ()=>{
    test("reads pem and crt files", async()=>{
        await fs.writeFile(path.join(certDir, "a.pem"), "CERT-A", "utf-8");
        await fs.writeFile(path.join(certDir, "b.crt"), "CERT-B", "utf-8");
        let manager=new ProxyManager({caCertDir: certDir});
        let certs=await manager.loadCustomCaCerts();
        expect(certs.length).toBe(2);
        expect(certs).toContain("CERT-A");
        expect(certs).toContain("CERT-B");
    });
    test("ignores non-cert files", async()=>{
        await fs.writeFile(path.join(certDir, "a.pem"), "CERT-A", "utf-8");
        await fs.writeFile(path.join(certDir, "readme.txt"), "README", "utf-8");
        let manager=new ProxyManager({caCertDir: certDir});
        let certs=await manager.loadCustomCaCerts();
        expect(certs).toEqual(["CERT-A"]);
    });
    test("returns empty array when caCertDir is missing", async()=>{
        let manager=new ProxyManager({caCertDir: path.join(certDir, "missing")});
        let certs=await manager.loadCustomCaCerts();
        expect(certs).toEqual([]);
    });
    test("returns empty array when caCertDir is undefined", async()=>{
        let manager=new ProxyManager({});
        let certs=await manager.loadCustomCaCerts();
        expect(certs).toEqual([]);
    });
});
describe("ProxyManager.isNoProxy", ()=>{
    test("matches exact domain", ()=>{
        let manager=new ProxyManager({proxy: {protocol: "http", host: "p", port: 80, noProxy: ["example.com"]}});
        expect(manager.isNoProxy("example.com")).toBe(true);
        expect(manager.isNoProxy("other.com")).toBe(false);
    });
    test("matches wildcard", ()=>{
        let manager=new ProxyManager({proxy: {protocol: "http", host: "p", port: 80, noProxy: ["*"]}});
        expect(manager.isNoProxy("anything.example.com")).toBe(true);
    });
    test("matches leading-dot subdomain pattern", ()=>{
        let manager=new ProxyManager({proxy: {protocol: "http", host: "p", port: 80, noProxy: [".example.com"]}});
        expect(manager.isNoProxy("sub.example.com")).toBe(true);
        expect(manager.isNoProxy("example.com")).toBe(true);
        expect(manager.isNoProxy("notexample.com")).toBe(false);
    });
    test("matches bare domain and its subdomains", ()=>{
        let manager=new ProxyManager({proxy: {protocol: "http", host: "p", port: 80, noProxy: ["example.com"]}});
        expect(manager.isNoProxy("example.com")).toBe(true);
        expect(manager.isNoProxy("sub.example.com")).toBe(true);
        expect(manager.isNoProxy("example.org")).toBe(false);
    });
    test("returns false when noProxy is empty", ()=>{
        let manager=new ProxyManager({proxy: {protocol: "http", host: "p", port: 80}});
        expect(manager.isNoProxy("example.com")).toBe(false);
    });
});
describe("ProxyManager.buildRequestConfig", ()=>{
    test("returns empty object when no proxy", async()=>{
        let manager=new ProxyManager({});
        let config=await manager.buildRequestConfig();
        expect(config).toEqual({});
    });
    test("includes https agent and ca", async()=>{
        await fs.writeFile(path.join(certDir, "c.pem"), "CERT-C", "utf-8");
        let manager=new ProxyManager({proxy: {protocol: "https", host: "p.example.com", port: 8443}, caCertDir: certDir});
        let config=await manager.buildRequestConfig();
        expect(config.proxy).toBe(false);
        expect(config.httpsAgent).toBeInstanceOf(agentMocks.HttpsProxyAgent);
        expect(config.httpAgent).toBeUndefined();
        expect(config.ca).toEqual(["CERT-C"]);
    });
    test("includes http agent", async()=>{
        let manager=new ProxyManager({proxy: {protocol: "http", host: "p.example.com", port: 8080}});
        let config=await manager.buildRequestConfig();
        expect(config.proxy).toBe(false);
        expect(config.httpAgent).toBeInstanceOf(agentMocks.HttpProxyAgent);
        expect(config.httpsAgent).toBeUndefined();
    });
    test("includes both agents for socks5", async()=>{
        let manager=new ProxyManager({proxy: {protocol: "socks5", host: "127.0.0.1", port: 1080}});
        let config=await manager.buildRequestConfig();
        expect(config.proxy).toBe(false);
        expect(config.httpAgent).toBeInstanceOf(agentMocks.SocksProxyAgent);
        expect(config.httpsAgent).toBeInstanceOf(agentMocks.SocksProxyAgent);
    });
    test("omits ca when no certs", async()=>{
        let manager=new ProxyManager({proxy: {protocol: "http", host: "p.example.com", port: 8080}, caCertDir: certDir});
        let config=await manager.buildRequestConfig();
        expect(config.ca).toBeUndefined();
    });
});
