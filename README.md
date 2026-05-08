# merman

```txt
                         .-""""""-.
                      .-'  _    _   '-.
                    .'    (o)  (o)     '.
                   /        .--.         \
                  ;        /____\         ;
                  |   .-.   '--'   .-.    |
                  |  /   \        /   \   |
                  ;  \_.-'  /\    '-._/   ;
                   \       /  \          /
                    '.    /____\       .'
                      '-.          .-'
                         '-.____.-'
                            /||\
                           /_||_\
                         _/  ||  \_
                       .'    ||    '.
                      /   .--||--.   \
                     /   /   ||   \   \
                    ;   ;    ||    ;   ;
                    |   |  __||__  |   |
                    |   | /  ||  \ |   |
                    ;   ; \__||__/ ;   ;
                     \   \   ||   /   /
                      '.  '--||--'  .'
                        '-.  ||  .-'
                           '-||-'
                             ||
                         ___/  \___
                   _.-""            ""-._
              _.-"   _..---.  .---.._    "-._
           .-'    .-'       \/       '-.      '-.
         .'      /      .-""  ""-.      \        '.
        /       ;      /  .-..-.  \      ;         \
       ;        |      | (  ><  ) |      |          ;
       |        ;      \  '-..-'  /      ;          |
       ;         \      '-.____.-'      /           ;
        \         '-._              _.-'           /
         '.            ""--....--""             .'
           '-._                              _.-'
               ""--..__              __..--""
                       """--------"""
```

Mermaid diagrams for the terminal — flowcharts, sequence diagrams, and state
diagrams as plain text, ANSI-colored output, or a live
[OpenTUI](https://github.com/anomalyco/opentui) renderable.

> Status: experimental. APIs may shift before `1.0`.

## Install

As a **library** (use the renderers from your own code):

```sh
bun add @kitlangton/merman @opentui/core
# or
npm install @kitlangton/merman @opentui/core
```

As a **CLI** (just want `merman` on your `$PATH`):

```sh
bun add -g @kitlangton/merman
# or
npm install -g @kitlangton/merman
```

ESM only. The library requires Node `>=20` (or any current Bun). The `merman`
CLI is a Bun executable and requires Bun on your `$PATH`.

## Library

`render` takes any Mermaid string — the leading `flowchart`/`sequenceDiagram`/
`stateDiagram-v2` line picks the right renderer for you.

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

// Plain text (no escapes) — handy for snapshots and pipes.
render(content, { color: false })

// Override the palette.
render(content, { theme: { node: "#86E1C8", edge: "#5D766B" } })
```

Two more top-level helpers:

```ts
import { parse, isMermaid } from "@kitlangton/merman"

isMermaid(content) // boolean — looks like any supported diagram?

const diagram = parse(content) // discriminated union
switch (diagram.kind) {
  case "flowchart":
    diagram.nodes.forEach(/* ... */)
    break
  case "sequence":
    diagram.steps.forEach(/* ... */)
    break
  case "state":
    diagram.states.forEach(/* ... */)
    break
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

`Sequence.Renderable` and `State.Renderable` follow the same pattern. Each
exposes theme setters, active-node/edge highlighting, and a `pulseFrame` for
animated edge pulses. See the demos in [`examples/`](./examples).

## CLI

`merman` ships a CLI for piping diagrams into the terminal, snapshots, or
other documents:

```sh
# Read from stdin (auto-detects diagram type from the first line)
echo "flowchart LR
  A --> B" | merman

# Or pass a file
merman --file diagram.mmd

# Pick the type explicitly (skips auto-detect)
merman --kind flowchart --file checkout.mmd
merman --kind sequence  --file auth.mmd
merman --kind state     --file form.mmd

# Plain text (no ANSI escapes) for piping into docs
merman --file diagram.mmd --no-color > rendered.txt
```

Built with Effect v4 primitives and shipped as a Bun executable.

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
