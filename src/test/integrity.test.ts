import { describe, expect, test } from "bun:test"

describe("package integrity", () => {
  test("does not retain old extracted source folders", async () => {
    const entries = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: "src", onlyFiles: false }))

    expect(entries).not.toContain("renderables")
    expect(entries).not.toContain("shared")
  })

  test("keeps root exports focused on diagram APIs", async () => {
    const index = await Bun.file("src/index.ts").text()

    expect(index).toContain('export * from "./flowchart/index.js"')
    expect(index).toContain('export * from "./state/index.js"')
    expect(index).toContain('export * from "./sequence/index.js"')
    expect(index).not.toContain("./core/")
  })

  test("keeps internal test helpers out of package files", async () => {
    const packageJson = await Bun.file("package.json").json()

    expect(packageJson.files).toContain("!src/**/*.test.ts")
    expect(packageJson.files).toContain("!src/test/**")
  })
})
