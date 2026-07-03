import { spawn } from "child_process"

const isCi = process.env.CI === "true" || process.env.CI === "1" || process.env.NODE_ENV === "ci"

if (isCi) {
    console.log("[postinstall] CI environment detected; skipping electron-builder install-app-deps")
    process.exit(0)
}

const child = spawn("npx", ["electron-builder", "install-app-deps"], {
    stdio: "inherit",
    shell: true
})

child.on("exit", (code) => {
    process.exit(code ?? 0)
})
