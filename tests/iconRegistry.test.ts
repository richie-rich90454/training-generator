// @vitest-environment node
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { iconRegistry, renderIcon } from "../src/renderer/icons.js";
let auditedFiles: string[]=[
    "index.html",
    "src/renderer/App.tsx",
    "src/renderer/confirm.ts",
    "src/renderer/dashboard.ts",
    "src/renderer/templateEditor.ts",
    "src/renderer/stores/fileStore.ts",
    "src/renderer/components/ProcessingCard.tsx",
    "src/renderer/components/Dashboard.tsx",
    "src/renderer/components/TemplateEditor.tsx",
    "src/renderer/components/SettingsModal.tsx",
    "src/renderer/components/ConfigPanel.tsx",
    "src/renderer/components/TitleBar.tsx",
    "src/renderer/components/OutputCard.tsx",
    "src/renderer/components/Footer.tsx",
    "src/renderer/components/StatusPanel.tsx",
    "src/renderer/components/UploadCard.tsx",
    "src/renderer/components/ToastContainer.tsx"
];
describe("icon registry completeness", ()=>{
    test("every renderIcon name referenced in source files has a registry entry", ()=>{
        let allNames: Set<string>=new Set();
        let pattern: RegExp=/renderIcon\(["'`]fa-([a-z-]+)/g;
        for(let file of auditedFiles){
            let fullPath: string=path.resolve(process.cwd(), file);
            let content: string=fs.readFileSync(fullPath, "utf-8");
            let match: RegExpExecArray|null=pattern.exec(content);
            while(match!==null){
                allNames.add("fa-"+match[1]);
                match=pattern.exec(content);
            }
        }
        expect(allNames.size).toBeGreaterThan(0);
        for(let name of allNames){
            expect(iconRegistry).toHaveProperty(name);
        }
    });
});
describe("icon registry SVG shape", ()=>{
    test("every registry value is a valid stroke-based SVG", ()=>{
        for(let key of Object.keys(iconRegistry)){
            let svg: string=iconRegistry[key];
            expect(svg).toMatch(/^<svg[\s\S]*<\/svg>$/);
            expect(svg).toContain('viewBox="0 0 24 24"');
            expect(svg).toContain('fill="none"');
            expect(svg).toContain('stroke="currentColor"');
            expect(svg).toContain('stroke-width="1.5"');
        }
    });
});
describe("renderIcon",()=>{
    beforeEach(()=>{
        vi.spyOn(console,"warn").mockImplementation(()=>{})
    })
    afterEach(()=>{
        vi.restoreAllMocks()
    })
    test("renderIcon overrides width and height to the requested size",()=>{
        let svg: string=renderIcon("fa-cog", 20);
        expect(svg).toContain('width="20"');
        expect(svg).toContain('height="20"');
    });
    test("renderIcon defaults to 16x16", ()=>{
        let svg: string=renderIcon("fa-cog");
        expect(svg).toContain('width="16"');
        expect(svg).toContain('height="16"');
    });
    test("renderIcon returns fallback on unknown name", ()=>{
        let svg: string=renderIcon("fa-nonexistent");
        expect(svg).toContain('viewBox="0 0 24 24"');
        expect(svg).toContain('width="16"');
        expect(svg).toContain('height="16"');
    });
});
