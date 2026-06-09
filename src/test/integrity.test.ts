import { describe, expect, test } from "bun:test"
import { Er, Flowchart, Sequence, State, detect, isMermaid, parse, render } from "../index.js"

describe("package integrity", () => {
  test("does not retain old extracted source folders", async () => {
    const entries = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: "src", onlyFiles: false }))

    expect(entries).not.toContain("renderables")
    expect(entries).not.toContain("shared")
  })

  test("publishes only compiled output and package documentation", async () => {
    const packageJson = await Bun.file("package.json").json()

    expect(packageJson.files).toEqual(["bin", "dist", "CHANGELOG.md", "README.md", "LICENSE"])
  })

  test("keeps core package-internal", async () => {
    const publicEntrypoints = [
      "src/index.ts",
      "src/flowchart/index.ts",
      "src/state/index.ts",
      "src/sequence/index.ts",
      "src/er/index.ts",
    ]

    for (const entrypoint of publicEntrypoints) {
      const source = await Bun.file(entrypoint).text()
      expect(source).not.toMatch(/export\s+(?:\*|\{[^}]*\})\s+from\s+["'][^"']*core\//)
    }
  })

  test("top-level surface exposes the namespace API", () => {
    expect(typeof render).toBe("function")
    expect(typeof parse).toBe("function")
    expect(typeof isMermaid).toBe("function")
    expect(typeof detect).toBe("function")

    for (const ns of [Flowchart, Sequence, State, Er]) {
      expect(typeof ns.render).toBe("function")
      expect(typeof ns.parse).toBe("function")
      expect(typeof ns.is).toBe("function")
      expect(typeof ns.Renderable).toBe("function")
    }
  })

  test("top-level render dispatches by content kind", () => {
    expect(detect("flowchart LR\n  A --> B")).toBe("flowchart")
    expect(detect("sequenceDiagram\n  Alice->>Bob: hi")).toBe("sequence")
    expect(detect("stateDiagram-v2\n  [*] --> Idle")).toBe("state")
    expect(detect("erDiagram\n  CUSTOMER ||--o{ ORDER : places")).toBe("er")
    expect(detect("not a diagram")).toBeUndefined()
    expect(isMermaid("flowchart LR\n  A --> B")).toBe(true)
    expect(isMermaid("not a diagram")).toBe(false)
  })

  test("top-level parse returns kind-tagged family diagrams", () => {
    const parsed = parse("erDiagram\n  CUSTOMER ||--o{ ORDER : places")

    expect(parsed.kind).toBe("er")
    if (parsed.kind === "er") expect(parsed.diagram.entities.map((entity) => entity.id)).toEqual(["CUSTOMER", "ORDER"])
  })
})
