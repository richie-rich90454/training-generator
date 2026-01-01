import {defineConfig} from "vite";
import path from "path";
export default defineConfig({
    base: "./",
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        outDir: "dist",
        emptyOutDir: true,
        target: "esnext",
        minify: "terser",
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
            },
        },
        cssMinify: true,
        sourcemap: false,
        rollupOptions: {
            input: {
                main: "./index.html",
            },
            output: {
                manualChunks: undefined,
                entryFileNames: "assets/[name]-[hash].js",
                chunkFileNames: "assets/[name]-[hash].js",
                assetFileNames: "assets/[name]-[hash].[ext]",
            },
        },
        assetsDir: "assets",
        chunkSizeWarningLimit: 1000,
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },
    optimizeDeps: {
        exclude: ["electron"],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    clearScreen: false,
});