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
