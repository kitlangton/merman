# merman

```txt
       .-"""""-.          ╭─────╮                 ╭─────╮           ╭──────╮               ╭─────╮
    .-'  _   _  '-.       │ You │                 │ CLI │           │ Core │               │ TTY │
  .'    (o) (o)    '.     ╰──┬──╯                 ╰──┬──╯           ╰───┬──╯               ╰──┬──╯
 /        .-.        \       │                       │                  │                     │
;    .--./___\.--.    ;      │                       │                  │                     │
|   /   /_____\   \   |      │                 Mermaid in, terminal art out                   │
|   \__/  '-'  \__/   |      │                       │                  │                     │
;        /| |\        ;      │ merman diagram.mmd    │                  │                     │
 \      /_|_|_\      /       ├───────────────────────▶                  │                     │
  '.      | |      .'        │                       │                  │                     │
    '-.   | |   .-'          │                       ├──────────────╮   │                     │
       '--|_|--'             │                       │ detect kind  │   │                     │
         /| |\               │                       ◀──────────────╯   │                     │
        /_|_|_\              │                       │                  │                     │
      .'  | |  '.            │                       │ parse            │                     │
     /    | |    \           │                       ├──────────────────▶                     │
    ;  .--| |--.  ;          │                       │                  │                     │
    | /   | |   \ |          │                       │                  ├─────────────────╮   │
    | \__.| |.__/ |          │                       │                  │ layout + route  │   │
    ;     | |     ;          │                       │                  ◀─────────────────╯   │
     \   /| |\   /           │                       │                  │                     │
      '-' | | '-'            │                       │ grid             │                     │
          | |                │                       ◀──────────────────┤                     │
       ___| |___             │                       │                  │                     │
   _.-'   | |   '-._         │                       │ print            │                     │
.-'     __| |__     '-.      │                       ├────────────────────────────────────────▶
       /  | |  \             │                       │                  │                     │
      ;   | |   ;            │ diagrams!             │                  │                     │
      |  /   \  |            ◀────────────────────────────────────────────────────────────────┤
       '._   _.'             │                       │                  │                     │
          """
```

Mermaid diagrams for the terminal — flowcharts, sequence diagrams, state
diagrams, and entity-relationship diagrams as plain text, ANSI-colored output, or a live
[OpenTUI](https://github.com/anomalyco/opentui) renderable.

> Status: experimental. APIs may shift before `1.0`.

- [CLI](#cli)
- [Examples](#examples)
- [Library](#library)

## CLI

Install `merman` globally when you just want diagrams on your `$PATH`:

```sh
bun add -g @kitlangton/merman
# or
npm install -g @kitlangton/merman
```

Render Mermaid from stdin, a positional argument, or a file:

```sh
echo "flowchart LR
  A[Mermaid] --> B[Terminal]
  B --> C[OpenTUI]" | merman --no-color
```

```txt
╭─────────╮          ╭──────────╮          ╭─────────╮
│ Mermaid ├─────────▶│ Terminal ├─────────▶│ OpenTUI │
╰─────────╯          ╰──────────╯          ╰─────────╯
```

More ways to run it:

```sh
# Read from a file
merman --file diagram.mmd

# Plain text (no ANSI escapes) for piping into docs
merman --file diagram.mmd --no-color > rendered.txt

# Paste-safe TypeScript doc-comment block
merman --file diagram.mmd --no-color --doc-comment=ts

# More compact diagrams for source comments
merman --file diagram.mmd --no-color --compact --doc-comment=ts
```

`--doc-comment=ts` preserves the rendered diagram spacing after a `*`
prefix, wraps the result in `/**` and `*/`, and always emits plain text so the
output is safe to paste directly above a TypeScript symbol.

To replace inline Mermaid syntax in place, add one or more standard Mermaid
fences inside TypeScript doc-comments:

````ts
/**
 * ```mermaid
 * sequenceDiagram
 *   Worker->>Store: commit(plan)
 * ```
 */
export function commit() {}
````

Then replace every inline Mermaid fence in the file at once:

```sh
merman --compact --replace src/commit.ts
```

`--replace` consumes the Mermaid fences and writes aligned diagram lines into
their existing doc-comments. It always uses deterministic plain-text rendering,
so generated source files never contain ANSI escapes. `--compact` is optional.
For flowcharts it shortens routes while retaining node shapes. For sequence
diagrams it removes participant boxes and places single-line message labels
inside arrows while retaining a spacer row between messages.

The CLI is shipped as a Bun executable, so Bun must be available on your
`$PATH`. Wide horizontal flowcharts are automatically folded vertically when
they exceed the terminal width, or 120 columns when output is redirected.

## Examples

Flowchart:

```txt
╭──────╮          ╭───────╮          ╭────────╮          ╭──────────╮
│ Idea ├─────────▶│ Parse ├─────────▶│ Render ├─────────▶│ Terminal │
╰──────╯          ╰───────╯          ╰────────╯          ╰──────────╯
```

Sequence diagram:

```txt
╭──────╮         ╭────────╮       ╭──────────╮
│ User │         │ merman │       │ Terminal │
╰───┬──╯         ╰────┬───╯       ╰─────┬────╯
    │                 │                 │
    │ diagram.mmd     │                 │
    ├─────────────────▶                 │
    │                 │                 │
    │                 │ ANSI art        │
    │                 ├─────────────────▶
    │                 │                 │
    │ ship it         │                 │
    ◀───────────────────────────────────┤
    │                 │                 │
```

State diagram:

```txt
                           ╔═══════════╗           ╔═══════════════════╗
                       ╔═══╣ edit loop ║       ╔═══╣ terminal snapshot ║
                       ║   ╚═══════════╝       ║   ╚═══════════════════╝
                       ║                       ║
                       ║                       ║
              ╭───────╮   render    ╭─────────╮    ship     ╭───────────╮
●────────────▶│ Draft ├────────────▶│ Preview ├────────────▶│ Published ├────────────▶◎
              ╰──┬────╯             ╰──┬──────╯             ╰───┬───────╯
                 │  ▲ type             │    ▲ tweak             │    ▲ share
                 ╰──╯                  ╰────╯                   ╰────╯
```

## Library

Install the package with its OpenTUI peer dependency:

```sh
bun add @kitlangton/merman @opentui/core
# or
npm install @kitlangton/merman @opentui/core
```

ESM only. The current library entrypoint requires Bun because it includes
OpenTUI-backed renderables alongside plain and ANSI rendering helpers.

`render` takes any Mermaid string — the leading `flowchart`/`sequenceDiagram`/
`stateDiagram-v2`/`erDiagram` line picks the right renderer for you.

```ts
import { render } from "@kitlangton/merman"

// ANSI-colored string, ready for stdout.
console.log(
  render(`flowchart LR
  Cart([Cart]) --> Address[Address]
  Address --> Payment[Payment]
  Payment -->|approved| Orders[(Orders DB)]
  Payment -->|declined| Retry([Retry])
  Retry --> Payment`),
)

console.log(
  render(`sequenceDiagram
  Alice->>Bob: Hello
  Bob-->>Alice: Hi`),
)

console.log(
  render(`stateDiagram-v2
  [*] --> Editing
  Editing --> Submitted: submit`),
)

console.log(
  render(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains`),
)

// Plain text (no escapes) — handy for snapshots and pipes.
render(content, { color: false })

// Override the palette.
render(content, { theme: { node: "#86E1C8", edge: "#5D766B" } })
```

Flowchart-specific rendering can apply the same width-aware folding policy:

```ts
import { Flowchart } from "@kitlangton/merman"

Flowchart.render(content, { color: false, layoutMaxWidth: 100 })
```

Two more top-level helpers:

```ts
import { parse, isMermaid } from "@kitlangton/merman"

isMermaid(content) // boolean — looks like any supported diagram?

const parsed = parse(content) // { kind, diagram } discriminated union
switch (parsed.kind) {
  case "flowchart":
    parsed.diagram.nodes.forEach(/* ... */)
    break
  case "sequence":
    parsed.diagram.steps.forEach(/* ... */)
    break
  case "state":
    parsed.diagram.states.forEach(/* ... */)
    break
  case "er":
    parsed.diagram.entities.forEach(/* ... */)
    break
}
```

### Supported Syntax

`merman` implements a terminal-oriented Mermaid subset. Auto-detected input
must begin with one of the headers below (comments and blank lines may precede
it). `--kind` in the CLI can be used when the header is omitted.

| Diagram   | Supported statements                                                                                                                                                                                                                                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Flowchart | `flowchart` / `graph` with `TB`, `TD`, `BT`, `LR`, or `RL`; boxed, rounded, database, subroutine, and decision nodes; `-->`, `==>`, `-.->` edges with pipe or inline labels; nested `subgraph` / `end`; `direction` inside subgraphs; accepted but ignored `classDef`, `class`, `style`, and `linkStyle` presentation directives |
| Sequence  | `sequenceDiagram`; `participant` / `actor`; messages using `->>`, `-->>`, `->`, `-->`, `-x`, `--x`, `-)`, or `--)` with activation shorthand; `activate` / `deactivate`; `Note over`; `autonumber`; `box`, `alt` / `else`, and `loop` blocks closed by `end`                                                                     |
| State     | `stateDiagram` / `stateDiagram-v2`; `direction` with `TB`, `TD`, `LR`, or `RL`; `A --> B: label` transitions and `[*]` markers; quoted aliases (`state "Label" as Id`); choice states; composite states; inline or multiline left/right notes                                                                                    |
| ER        | `erDiagram`; `direction` with `TB`, `TD`, `BT`, `LR`, or `RL`; entity declarations, aliases, attribute blocks with optional `PK` / `FK` / `UK` keys and comments; symbolic crow's-foot relationships plus Mermaid's cardinality and identifying aliases; accepted but ignored `classDef`, `class`, and `style` directives        |

Unsupported structural statements are rejected rather than silently omitted
from the render. Flowchart `classDef`, `class`, `style`, and `linkStyle`
directives are accepted and ignored because terminal themes control styling.
`parse` and `render` throw `MermaidSyntaxError` for recognized diagram kinds
with unsupported structural or malformed syntax:

```ts
import { MermaidSyntaxError, render } from "@kitlangton/merman"

try {
  render(source)
} catch (error) {
  if (error instanceof MermaidSyntaxError) {
    console.error(error.kind, error.lineNumber, error.sourceLine)
  }
}
```

### Inside an OpenTUI app

Live, themeable, animatable diagrams are kind-specific (each has its own
theme/animation surface). Pick the matching namespace:

```ts
import { createCliRenderer } from "@opentui/core"
import { Flowchart } from "@kitlangton/merman"

const renderer = await createCliRenderer({ targetFps: 30 })

const diagram = new Flowchart.Renderable(renderer, {
  id: "diagram",
  content: `flowchart TD
    A[Start] --> B{Decide}
    B -->|yes| C[Do it]
    B -->|no| D[Skip]`,
})

renderer.root.add(diagram)
```

`Sequence.Renderable` and `State.Renderable` follow the same construction
pattern. All three renderables expose color controls and `pulseFrame` for
animated paths, plus `batchUpdate(() => { ... })` for atomic live option
changes. `Flowchart.Renderable` supports active nodes and edges;
`State.Renderable` supports active states and transitions; sequence diagrams
currently expose message pulse animation without active-selection controls.
See the demos in [`examples/`](./examples).

### Mermaid fences in Markdown

Use `createMermaidMarkdownRenderer` with OpenTUI's `MarkdownRenderable` to
replace fenced `mermaid` code blocks with live diagram renderables. Invalid or
incomplete Mermaid fences fall back to ordinary code blocks.

```ts
import { MarkdownRenderable } from "@opentui/core"
import { createMermaidMarkdownRenderer } from "@kitlangton/merman"

const markdown = new MarkdownRenderable(renderer, {
  content: `# Checkout

\`\`\`mermaid
flowchart LR
  Cart --> Payment --> Receipt
\`\`\``,
  syntaxStyle,
  renderNode: createMermaidMarkdownRenderer(renderer),
})

renderer.root.add(markdown)
```

For an OpenCode release that exposes language-keyed Markdown block renderers,
`merman` includes a TUI plugin entrypoint. Add the package to `tui.json` and
OpenCode resolves its `./tui` export automatically:

```json
{
  "plugin": ["@kitlangton/merman"]
}
```

## React

Coming soon as a separate package: `@kitlangton/merman-react`.

## Examples

Interactive demos (themes, active-node animation, scrolling, drag-to-pan) live
in [`examples/`](./examples):

```sh
bun run examples              # master demo: pick a sub-demo, Esc to go back
bun run examples:flowchart    # individual demos
bun run examples:state
bun run examples:sequence
bun run examples:gallery      # adversarial plain-text gallery for visual review
```

## Development

```sh
bun install
bun run test          # vitest-style suite via bun:test
bun run typecheck     # tsc on src + examples
bun run build         # tsdown -> dist/
bun run validate      # build + publint + attw (pre-publish gate)
```

See [`AGENTS.md`](./AGENTS.md) for the codebase map and conventions.

## License

MIT © [Kit Langton](https://github.com/kitlangton)
