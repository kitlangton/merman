#!/usr/bin/env bun
import { readFile } from "node:fs/promises"
import { Console, Effect } from "effect"
import packageJson from "../../package.json" with { type: "json" }
import { firstMeaningfulMermaidLine } from "../core/mermaid.js"
import { isMermaidFlowchartDiagram } from "../flowchart/parser.js"
import { renderFlowchartDiagram, renderFlowchartDiagramAnsi } from "../flowchart/render.js"
import { isMermaidSequenceDiagram, renderSequenceDiagram, renderSequenceDiagramAnsi } from "../sequence/diagram.js"
import { renderStateDiagram, renderStateDiagramAnsi } from "../state/diagram.js"
import { isMermaidStateDiagram } from "../state/parser.js"

type DiagramKind = "flowchart" | "sequence" | "state"

interface CliOptions {
  readonly content?: string
  readonly file?: string
  readonly kind?: DiagramKind
  readonly color: boolean
  readonly help: boolean
  readonly version: boolean
}

const usage = `merman v${packageJson.version}

Render Mermaid diagrams in the terminal.

Usage:
  merman [content]
  merman --file <path>
  merman --kind <flowchart|sequence|state> --file <path>

Options:
  -f, --file <path>   Read the diagram from a file
      --kind <kind>   Override detection: flowchart, sequence, or state
      --no-color      Emit plain text instead of ANSI color escapes
  -h, --help          Show help
  -v, --version       Show version

If no content or file is provided, merman reads from stdin.`

const program = Effect.fnUntraced(function* (argv: ReadonlyArray<string>) {
  const options = yield* parseArgs(argv)

  if (options.help) {
    yield* Console.log(usage)
    return
  }

  if (options.version) {
    yield* Console.log(packageJson.version)
    return
  }

  const source = options.content ?? (options.file ? yield* readFileString(options.file) : yield* readStdin)
  if (source.trim() === "") {
    return yield* Effect.fail(
      new UsageError("No diagram source given. Pass content as an argument, with --file, or via stdin."),
    )
  }

  const kind = options.kind ?? detect(source)
  if (!kind) return yield* Effect.fail(new UnknownDiagramError(source))

  yield* Console.log(renderKind(source, kind, options.color))
})

const parseArgs = Effect.fnUntraced(function* (argv: ReadonlyArray<string>) {
  let content: string | undefined
  let file: string | undefined
  let kind: DiagramKind | undefined
  let color = true
  let help = false
  let version = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case "--help":
      case "-h":
        help = true
        break
      case "--version":
      case "-v":
        version = true
        break
      case "--no-color":
        color = false
        break
      case "--file":
      case "-f":
        file = yield* readValue(argv, index, arg)
        index += 1
        break
      case "--kind":
        kind = yield* parseKind(yield* readValue(argv, index, arg))
        index += 1
        break
      default:
        if (arg.startsWith("--file=")) {
          file = arg.slice("--file=".length)
        } else if (arg.startsWith("--kind=")) {
          kind = yield* parseKind(arg.slice("--kind=".length))
        } else if (arg.startsWith("-")) {
          return yield* Effect.fail(new UsageError(`Unknown option: ${arg}`))
        } else {
          content = content === undefined ? arg : `${content} ${arg}`
        }
    }
  }

  return { content, file, kind, color, help, version } satisfies CliOptions
})

function readValue(argv: ReadonlyArray<string>, index: number, flag: string): Effect.Effect<string, UsageError> {
  const value = argv[index + 1]
  return value === undefined || value.startsWith("-")
    ? Effect.fail(new UsageError(`Missing value for ${flag}`))
    : Effect.succeed(value)
}

function parseKind(value: string): Effect.Effect<DiagramKind, UsageError> {
  return value === "flowchart" || value === "sequence" || value === "state"
    ? Effect.succeed(value)
    : Effect.fail(new UsageError(`Invalid --kind: ${value}. Expected flowchart, sequence, or state.`))
}

const readStdin: Effect.Effect<string> = Effect.promise(
  () =>
    new Promise((resolve, reject) => {
      if (process.stdin.isTTY) {
        resolve("")
        return
      }
      const chunks: Array<Buffer> = []
      process.stdin.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      process.stdin.on("error", reject)
    }),
)

function readFileString(path: string): Effect.Effect<string> {
  return Effect.promise(() => readFile(path, "utf8"))
}

function detect(source: string): DiagramKind | undefined {
  if (isMermaidFlowchartDiagram(source)) return "flowchart"
  if (isMermaidSequenceDiagram(source)) return "sequence"
  if (isMermaidStateDiagram(source)) return "state"
  return undefined
}

function renderKind(source: string, kind: DiagramKind, color: boolean): string {
  switch (kind) {
    case "flowchart":
      return color ? renderFlowchartDiagramAnsi(source) : renderFlowchartDiagram(source)
    case "sequence":
      return color ? renderSequenceDiagramAnsi(source) : renderSequenceDiagram(source)
    case "state":
      return color ? renderStateDiagramAnsi(source) : renderStateDiagram(source)
  }
}

class UsageError extends Error {
  readonly _tag = "UsageError"
  constructor(message: string) {
    super(message)
    this.name = "UsageError"
  }
}

class UnknownDiagramError extends Error {
  readonly _tag = "UnknownDiagramError"
  constructor(content: string) {
    const head = firstMeaningfulMermaidLine(content) ?? "(empty)"
    super(
      `Could not detect diagram kind. Expected the first non-empty line to start with ` +
        `"flowchart", "graph", "sequenceDiagram", or "stateDiagram[-v2]". Got: "${head}"`,
    )
    this.name = "UnknownDiagramError"
  }
}

Effect.runPromise(program(process.argv.slice(2))).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
