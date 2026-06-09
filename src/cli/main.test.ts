import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import stringWidth from "string-width"
import { renderFlowchartDiagram } from "../flowchart/render.js"
import { renderSequenceDiagram } from "../sequence/diagram.js"
import { formatTypeScriptDocComment } from "./doc-comment.js"

async function runCli(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const process = Bun.spawn(["bun", "src/cli/main.ts", ...args], {
    stdin: stdin === undefined ? "ignore" : new Blob([stdin]),
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  return { stdout, stderr, exitCode }
}

describe("merman CLI", () => {
  test("renders plain flowcharts from stdin", async () => {
    const result = await runCli(["--no-color"], "flowchart LR\n  A[Start] --> B[Done]")

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Start")
    expect(result.stdout).toContain("Done")
    expect(result.stdout).not.toContain("\u001b[")
  })

  test("wraps plain sequence diagrams in TypeScript doc-comment blocks", async () => {
    const source = `sequenceDiagram
  participant Leaf as leaf tool
  participant File as FileMutation
  Leaf->>File: commit(plan)`
    const result = await runCli(["--no-color", "--doc-comment=ts", source])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toBe(`${formatTypeScriptDocComment(renderSequenceDiagram(source))}\n`)
    expect(result.stdout).not.toContain("\u001b[")
  })

  test("emits plain text for TypeScript doc-comments without requiring --no-color", async () => {
    const source = "sequenceDiagram\n  Leaf->>File: commit(plan)"
    const result = await runCli(["--doc-comment=ts", source])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).not.toContain("\u001b[")
  })

  test("wraps compact sequence diagrams in TypeScript doc-comment blocks", async () => {
    const source = "sequenceDiagram\n  Leaf->>File: commit(plan)"
    const result = await runCli(["--no-color", "--compact", "--doc-comment=ts", source])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toBe(`${formatTypeScriptDocComment(renderSequenceDiagram(source, { compact: true }))}\n`)
  })

  test("wraps compact flowcharts in TypeScript doc-comment blocks", async () => {
    const source = "flowchart LR\n  A[Idea] --> B[Terminal]"
    const result = await runCli(["--no-color", "--compact", "--doc-comment=ts", source])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toBe(`${formatTypeScriptDocComment(renderFlowchartDiagram(source, { compact: true }))}\n`)
  })

  test("formats blank rendered lines without trailing spaces", () => {
    expect(formatTypeScriptDocComment("first\n\n  indented")).toBe(`/**
 * first
 *
 *   indented
 */`)
  })

  test("leaves sequence output unchanged without a doc-comment option", async () => {
    const source = "sequenceDiagram\n  Leaf->>File: commit(plan)"
    const result = await runCli(["--no-color", source])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toBe(`${renderSequenceDiagram(source)}\n`)
  })

  test("replaces every inline Mermaid doc-comment fence in a TypeScript file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "merman-cli-"))
    const target = join(directory, "example.ts")
    const firstSource = "sequenceDiagram\n  Client->>Server: request"
    const secondSource = "sequenceDiagram\n  Worker->>Store: commit"
    await writeFile(
      target,
      `const before = true

/**
 * \`\`\`mermaid
 * sequenceDiagram
 *   Client->>Server: request
 * \`\`\`
 */
export function request() {}

/**
 * \`\`\`mermaid
 * sequenceDiagram
 *   Worker->>Store: commit
 * \`\`\`
 */
export function commit() {}
`,
    )

    try {
      const result = await runCli(["--compact", "--replace", target])
      const updated = await readFile(target, "utf8")

      expect(result).toEqual({ stdout: `Replaced 2 Mermaid blocks in ${target}.\n`, stderr: "", exitCode: 0 })
      expect(updated).toBe(`const before = true

${formatTypeScriptDocComment(renderSequenceDiagram(firstSource, { compact: true }))}
export function request() {}

${formatTypeScriptDocComment(renderSequenceDiagram(secondSource, { compact: true }))}
export function commit() {}
`)
      expect(updated).not.toContain("\u001b[")
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("does not partially replace a file when an inline diagram cannot render", async () => {
    const directory = await mkdtemp(join(tmpdir(), "merman-cli-"))
    const target = join(directory, "example.ts")
    const original = `/**
 * \`\`\`mermaid
 * sequenceDiagram
 *   A->>B: valid
 * \`\`\`
 */

/**
 * \`\`\`mermaid
 * not a diagram
 * \`\`\`
 */
`
    await writeFile(target, original)

    try {
      const result = await runCli(["--replace", target])

      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe("")
      expect(await readFile(target, "utf8")).toBe(original)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("does not replace Mermaid fences outside TypeScript doc-comments", async () => {
    const directory = await mkdtemp(join(tmpdir(), "merman-cli-"))
    const target = join(directory, "example.ts")
    const original = `/*
 * \`\`\`mermaid
 * sequenceDiagram
 *   A->>B: untouched
 * \`\`\`
 */
`
    await writeFile(target, original)

    try {
      const result = await runCli(["--replace", target])

      expect(result.exitCode).toBe(1)
      expect(await readFile(target, "utf8")).toBe(original)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("folds horizontal flowcharts that exceed the redirected output width", async () => {
    const result = await runCli(
      ["--no-color"],
      `flowchart LR
  C[ReceiveInput] --> P[Persist ActivityRequested]
  P --> S[Self RunPendingActivity]
  S --> O[OpenCode async task]
  O --> M[Self OutputObserved]
  M --> E[Persist OutputObserved]`,
    )
    const lines = result.stdout.trimEnd().split("\n")

    expect(result.exitCode).toBe(0)
    expect(Math.max(...lines.map((line) => stringWidth(line)))).toBeLessThanOrEqual(120)
    expect(lines.findIndex((line) => line.includes("ReceiveInput"))).toBeLessThan(
      lines.findIndex((line) => line.includes("Persist ActivityRequested")),
    )
  })

  test("honors explicit kind for positional state input", async () => {
    const result = await runCli(["--no-color", "--kind", "state", "A --> B"])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(" A ")
    expect(result.stdout).toContain(" B ")
  })

  test("renders ER diagrams from stdin", async () => {
    const result = await runCli(["--no-color"], "erDiagram\n  CUSTOMER ||--o{ ORDER : places")

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("CUSTOMER")
    expect(result.stdout).toContain("ORDER")
    expect(result.stdout).toContain("places")
  })

  test("reports unsupported source without rendering output", async () => {
    const result = await runCli(["--no-color", "not a diagram"])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("Could not detect diagram kind")
  })

  test("reports unsupported syntax with its input line", async () => {
    const result = await runCli([], "flowchart LR\n  A --> B\n  A --- B")

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain('Unsupported syntax in flowchart diagram at line 3: "A --- B"')
  })
})
