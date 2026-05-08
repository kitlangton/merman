import { defineConfig } from "tsdown"

const shared = {
  format: "esm",
  dts: true,
  sourcemap: true,
  target: "es2022",
} as const

export default defineConfig([
  {
    ...shared,
    entry: ["src/index.ts"],
    clean: true,
    unbundle: true,
  },
  {
    ...shared,
    entry: { "cli/main": "src/cli/main.ts" },
    clean: false,
  },
])
