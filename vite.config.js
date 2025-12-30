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
        rollupOptions: {
            input: {
                main: "./index.html",
            },
        },
    },
    optimizeDeps: {
        exclude: ["electron"],
    },
});