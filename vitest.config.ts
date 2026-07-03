import{defineConfig}from "vitest/config"
import path from "path"
const __dirname=import.meta.dirname
export default defineConfig({
    test:{
        globals:true,
        environment:"happy-dom",
        include:["tests/**/*.test.ts","tests/**/*.test.tsx","src/**/*.test.ts"],
        testTimeout:30000,
        hookTimeout:30000,
        setupFiles:["./tests/setup.ts"],
        coverage:{
            provider:"v8",
            include:["src/**/*.ts"],
            exclude:["src/**/*.test.ts","src/types/**"]
        }
    },
    resolve:{
        alias:{
            "@":path.resolve(__dirname,"./src")
        }
    }
})
