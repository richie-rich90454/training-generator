import {defineConfig} from "vite";
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
        minify: 'terser',
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
            },
        },
        assetsDir: 'assets',
        chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
        exclude: ["electron"],
    },
});