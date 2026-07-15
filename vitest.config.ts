// Vitest configuration for SolidJS component tests.
// vite-plugin-solid (with HMR disabled in tests) compiles JSX for @solidjs/testing-library.
import{defineConfig}from "vitest/config"
import path from "path"
import solid from "vite-plugin-solid"
const __dirname=import.meta.dirname
export default defineConfig({
    test:{
        globals:true,
        environment:"happy-dom",
        include:["tests/**/*.test.{ts,tsx}","src/**/*.test.{ts,tsx}"],
        testTimeout:30000,
        hookTimeout:30000,
        setupFiles:["./tests/setup.ts"],
        pool:"forks",
        // @ts-ignore Vitest 4 runtime supports singleFork but types omit it.
        singleFork:true,
        coverage:{
            provider:"v8",
            include:["src/**/*.ts","src/**/*.tsx"],
            exclude:["src/**/*.test.ts","src/**/*.test.tsx","src/types/**"],
            // Initial regression floor (below current 78/68/82/78 baseline).
            // Task 2.1 of comprehensive-placeholder-audit-100pct-coverage spec
            // tightens these to 90/85/90/90 once the missing tests are added.
            thresholds:{
                lines:70,
                branches:60,
                functions:70,
                statements:70,
                perFile:false
            }
        }
    },
    resolve:{
        alias:{
            "@":path.resolve(__dirname,"./src")
        }
    },
    css:{
        modules:{
            // Match production: keep original class names so test queries that
            // use class selectors continue to work after migrating to CSS Modules.
            generateScopedName:"[local]"
        }
    },
    plugins:[solid({ hot: false })]
})
