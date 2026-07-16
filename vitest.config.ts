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
            // Regression floor set just below the achieved baseline of
            // 79.78 / 68.76 / 83.16 / 80.14 (stmts / branches / funcs / lines).
            // Tightened from the initial 70/60/70/70 floor as part of the
            // comprehensive-placeholder-audit-100pct-coverage spec (Task 2.1).
            thresholds:{
                lines:79,
                branches:67,
                functions:82,
                statements:79,
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
