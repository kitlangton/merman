#!/usr/bin/env bun
import { readFile } from "node:fs/promises"
import { Console, Effect } from "effect"
import packageJson from "../../package.json" with { type: "json" }
import { renderErDiagram, renderErDiagramAnsi } from "../er/render.js"
import { renderFlowchartDiagram, renderFlowchartDiagramAnsi } from "../flowchart/render.js"
import { detect, UnknownDiagramError, type DiagramKind } from "../index.js"
import { renderSequenceDiagram, renderSequenceDiagramAnsi } from "../sequence/diagram.js"
import { renderStateDiagram, renderStateDiagramAnsi } from "../state/diagram.js"
import { formatTypeScriptDocComment } from "./doc-comment.js"
import { replaceTypeScriptMermaidFences } from "./replace.js"

type DocComment = "ts"

interface CliOptions {
  readonly content?: string
  readonly file?: string
  readonly kind?: DiagramKind
  readonly docComment?: DocComment
  readonly replace?: string
  readonly color: boolean
  readonly compact: boolean
  readonly help: boolean
  readonly version: boolean
}

interface RenderKindOptions {
  readonly color: boolean
  readonly compact: boolean
  readonly flowchartMaxWidth?: number
}

const DEFAULT_TERMINAL_WIDTH = 120

const usage = `merman v${packageJson.version}

Render Mermaid diagrams in the terminal.

Usage:
  merman [content]
  merman --file <path>
  merman --kind <flowchart|sequence|state|er> --file <path>
  merman --replace <typescript-file>

Options:
  -f, --file <path>   Read the diagram from a file
      --kind <kind>   Override detection: flowchart, sequence, state, or er
      --no-color      Emit plain text instead of ANSI color escapes
      --compact       Use compact diagram rendering where available
      --doc-comment=ts  Wrap output in a TypeScript doc-comment block
      --replace <path>  Replace inline Mermaid doc-comment fences in a file
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

  if (options.replace !== undefined) {
    if (
      options.content !== undefined ||
      options.file !== undefined ||
      options.kind !== undefined ||
      options.docComment !== undefined ||
      !options.color
    ) {
      return yield* Effect.fail(new UsageError("--replace can only be combined with --compact."))
    }
    const count = yield* Effect.promise(() =>
      replaceTypeScriptMermaidFences(options.replace!, (source) => renderReplacementSource(source, options.compact)),
    )
    yield* Console.log(`Replaced ${count} Mermaid ${count === 1 ? "block" : "blocks"} in ${options.replace}.`)
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

  const rendered = renderKind(source, kind, {
    color: options.docComment === undefined && options.color,
    compact: options.compact,
  })
  yield* Console.log(options.docComment === "ts" ? formatTypeScriptDocComment(rendered) : rendered)
})

const parseArgs = Effect.fnUntraced(function* (argv: ReadonlyArray<string>) {
  let content: string | undefined
  let file: string | undefined
  let kind: DiagramKind | undefined
  let docComment: DocComment | undefined
  let replace: string | undefined
  let color = true
  let compact = false
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
      case "--compact":
        compact = true
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
      case "--doc-comment":
        docComment = yield* parseDocComment(yield* readValue(argv, index, arg))
        index += 1
        break
      case "--replace":
        replace = yield* readValue(argv, index, arg)
        index += 1
        break
      default:
        if (arg.startsWith("--file=")) {
          file = arg.slice("--file=".length)
        } else if (arg.startsWith("--kind=")) {
          kind = yield* parseKind(arg.slice("--kind=".length))
        } else if (arg.startsWith("--doc-comment=")) {
          docComment = yield* parseDocComment(arg.slice("--doc-comment=".length))
        } else if (arg.startsWith("--replace=")) {
          replace = arg.slice("--replace=".length)
        } else if (arg.startsWith("-")) {
          return yield* Effect.fail(new UsageError(`Unknown option: ${arg}`))
        } else {
          content = content === undefined ? arg : `${content} ${arg}`
        }
    }
  }

  return { content, file, kind, docComment, replace, color, compact, help, version } satisfies CliOptions
})

function readValue(argv: ReadonlyArray<string>, index: number, flag: string): Effect.Effect<string, UsageError> {
  const value = argv[index + 1]
  return value === undefined || value.startsWith("-")
    ? Effect.fail(new UsageError(`Missing value for ${flag}`))
    : Effect.succeed(value)
}

function parseKind(value: string): Effect.Effect<DiagramKind, UsageError> {
  return value === "flowchart" || value === "sequence" || value === "state" || value === "er"
    ? Effect.succeed(value)
    : Effect.fail(new UsageError(`Invalid --kind: ${value}. Expected flowchart, sequence, state, or er.`))
}

function parseDocComment(value: string): Effect.Effect<DocComment, UsageError> {
  return value === "ts"
    ? Effect.succeed(value)
    : Effect.fail(new UsageError(`Invalid --doc-comment: ${value}. Expected ts.`))
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

function renderReplacementSource(source: string, compact: boolean): string {
  const kind = detect(source)
  if (!kind) throw new UnknownDiagramError(source)
  return renderKind(source, kind, { color: false, compact, flowchartMaxWidth: DEFAULT_TERMINAL_WIDTH })
}

function renderKind(source: string, kind: DiagramKind, options: RenderKindOptions): string {
  switch (kind) {
    case "flowchart": {
      const maxWidth =
        options.flowchartMaxWidth ??
        (process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : DEFAULT_TERMINAL_WIDTH)
      return options.color
        ? renderFlowchartDiagramAnsi(source, { compact: options.compact, layoutMaxWidth: maxWidth })
        : renderFlowchartDiagram(source, { compact: options.compact, layoutMaxWidth: maxWidth })
    }
    case "sequence":
      return options.color
        ? renderSequenceDiagramAnsi(source, { compact: options.compact })
        : renderSequenceDiagram(source, { compact: options.compact })
    case "state":
      return options.color ? renderStateDiagramAnsi(source) : renderStateDiagram(source)
    case "er":
      return options.color
        ? renderErDiagramAnsi(source, { compact: options.compact, layoutMaxWidth: options.flowchartMaxWidth })
        : renderErDiagram(source, { compact: options.compact, layoutMaxWidth: options.flowchartMaxWidth })
  }
}

class UsageError extends Error {
  readonly _tag = "UsageError"
  constructor(message: string) {
    super(message)
    this.name = "UsageError"
  }
}

Effect.runPromise(program(process.argv.slice(2))).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
