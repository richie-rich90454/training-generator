import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
let srcDir: string=path.resolve(process.cwd(), "src");
let sourceExtensions: string[]=[".ts", ".tsx", ".vue", ".css", ".html", ".js"];
let skipDirs: string[]=["node_modules", "dist", ".git"];
let purplePalette: string[]=["#f3e5f5", "#e1bee7", "#9c27b0", "#7e57c2", "#b39ddb", "#d1c4e9", "#673ab7", "#3f51b5", "#5e35b1", "#8e24aa", "#ab47bc", "#ba68c8", "#ce93d8", "#e040fb", "#d500f9", "#aa00ff"];
function walkDir(dir: string, exts: string[]): string[]{
    let results: string[]=[];
    let entries=fs.readdirSync(dir, { withFileTypes: true });
    for (let entry of entries){
        let fullPath: string=path.join(dir, entry.name);
        if (entry.isDirectory()){
            if (skipDirs.includes(entry.name)){
                continue;
            }
            results.push(...walkDir(fullPath, exts));
        }
        else if (exts.some(ext => entry.name.endsWith(ext))){
            results.push(fullPath);
        }
    }
    return results;
}
function srcFiles(): string[]{
    return walkDir(srcDir, sourceExtensions);
}
function relPath(filePath: string): string{
    return path.relative(process.cwd(), filePath);
}
describe("Zero AI-tells verification", ()=>{
    it("no purple/lilac/violet hex colors anywhere in src/", ()=>{
        let files: string[]=srcFiles();
        let hits: string[]=[];
        for (let file of files){
            let content: string=fs.readFileSync(file, "utf-8").toLowerCase();
            for (let hex of purplePalette){
                if (content.includes(hex)){
                    hits.push(`${relPath(file)}: ${hex}`);
                }
            }
        }
        expect(hits, `purple hex colors found: ${hits.join("; ")}`).toEqual([]);
    });
    it("no decorative backdrop-filter anywhere in src/", ()=>{
        let files: string[]=srcFiles();
        let hits: string[]=[];
        for (let file of files){
            let content: string=fs.readFileSync(file, "utf-8");
            if (/backdrop-filter/i.test(content)){
                hits.push(relPath(file));
            }
        }
        expect(hits, `backdrop-filter found in: ${hits.join(", ")}`).toEqual([]);
    });
    it("no background-clip:text + gradient combinations in src/", ()=>{
        let files: string[]=srcFiles();
        let clipHits: string[]=[];
        let comboHits: string[]=[];
        for (let file of files){
            let content: string=fs.readFileSync(file, "utf-8");
            let hasClip=/(-webkit-)?background-clip\s*:\s*text/i.test(content);
            let hasGradient=/linear-gradient|radial-gradient|conic-gradient/i.test(content);
            if (hasClip){
                clipHits.push(relPath(file));
            }
            if (hasClip && hasGradient){
                comboHits.push(relPath(file));
            }
        }
        expect(comboHits, `gradient text found in: ${comboHits.join(", ")}`).toEqual([]);
        expect(clipHits, `background-clip:text found in: ${clipHits.join(", ")}`).toEqual([]);
    });
});
describe("Native app shell verification", ()=>{
    it("has zero Font Awesome class=\"fas\" references in source files", ()=>{
        let files: string[]=[
            "index.html",
            "src/splash.html"
        ];
        let tsFiles: string[]=[
            "src/renderer/App.tsx",
            "src/renderer/confirm.ts",
            "src/renderer/dashboard.ts",
            "src/renderer/templateEditor.ts",
            "src/renderer/helpContent.ts"
        ];
        let allFiles: string[]=[...files, ...tsFiles];
        for (let file of allFiles){
            let content: string=fs.readFileSync(file, "utf-8");
            expect(content).not.toMatch(/class="fas\b/);
            expect(content).not.toMatch(/class='fas\b/);
        }
    });
    it("has all required brand icon asset files", ()=>{
        let requiredFiles: string[]=[
            "assets/icon.svg",
            "assets/icon.png",
            "assets/favicon.png",
            "assets/favicon.ico",
            "assets/favicon.icns"
        ];
        for (let file of requiredFiles){
            expect(fs.existsSync(file)).toBe(true);
        }
    });
    it("index.html has SolidJS mount point and local favicon link",()=>{
        let content: string=fs.readFileSync("index.html", "utf-8");
        expect(content).toContain('<div id="app"></div>');
        expect(content).toContain('<script type="module" src="./src/renderer/App.tsx"></script>');
        expect(content).toContain('<link rel="icon" href="./assets/favicon.png">');
        expect(content).toContain('<link rel="apple-touch-icon" href="./assets/favicon.png">');
    });
    it("index.html has zero robot emoji occurrences", ()=>{
        let content: string=fs.readFileSync("index.html", "utf-8");
        expect(content).not.toContain("🤖");
    });
});
