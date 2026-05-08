# Agents Guide

Orientation for AI assistants and humans dropping into this repo. Keep this in
sync with the actual layout — tests and consumers depend on the public surface
described here.

## What this package is

`merman` parses a small Mermaid-flavored DSL and renders three
diagram families to the terminal:

- **Flowchart** — boxed nodes, routed edges, subgraphs, animated pulses
- **State** — composite states, nested regions, active-transition highlighting
- **Sequence** — participants, messages, notes, fragments, activations

Each family has three rendering paths:

1. **Plain text** (`renderXDiagram`) — uncolored grid, ideal for tests
2. **ANSI** (`renderXDiagramAnsi`) — colored string for direct terminal print
3. **OpenTUI Renderable** (`XDiagramRenderable`) — live, themeable, interactive

`@opentui/core` is a **peer dependency**. We do not own renderable primitives,
the CLI loop, or styled text — we own diagram parsing, layout, routing, and
the diagram-specific rendering pipeline.

## Source layout

```
src/
├── index.ts             # Single public entrypoint (re-exports flowchart/state/sequence)
├── flowchart/           # Flowchart pipeline
│   ├── parser.ts        #   Mermaid string -> FlowchartDiagram
│   ├── layout.ts        #   Rank-based node placement
│   ├── routing.ts       #   Edge routing on the diagram grid
│   ├── labels.ts        #   Edge label placement
│   ├── render.ts        #   FlowchartDiagram -> string / ANSI
│   ├── drawing.ts       #   Glyph + box helpers
│   ├── style.ts         #   Themes, color keys
│   ├── options.ts       #   Public option types
│   ├── renderable.ts    #   FlowchartDiagramRenderable (OpenTUI)
│   ├── types.ts         #   Public data model
│   └── index.ts         #   Public re-exports for this family
├── state/               # State diagrams (parser, layout, render-grid, renderable)
├── sequence/            # Sequence diagrams (single-file pipeline in diagram.ts)
├── core/                # Package-internal primitives, NOT publicly exported
│   ├── canvas.ts        #   DiagramCanvas: 2D char grid abstraction
│   ├── geometry.ts      #   Boxes, points, intersection helpers
│   ├── drawing.ts       #   Box / line drawing primitives
│   ├── render-grid.ts   #   Grid -> string / ANSI / StyledText
│   ├── text.ts          #   Width-aware text helpers (string-width)
│   ├── text-lines.ts    #   Wrapping / line splitting
│   ├── mermaid.ts       #   Shared Mermaid line tokenization
│   ├── adapter/         #   Adapters between OpenTUI and our color types
│   ├── animation/       #   Pulse animation core (frame counter, cell styling)
│   ├── color/           #   Color ramps, theme maps, fade levels
│   └── terminal/        #   ANSI escape helpers
└── test/                # Cross-cutting integrity tests + shared test helpers
```

### What's public

Only what's re-exported through `src/index.ts` (which fans out to
`src/<family>/index.ts`). `src/core/*` is package-internal — do **not** import
it from a consumer. There's an integrity test that enforces this by checking
`src/index.ts` does not reference `./core/`.

## Conventions

- **Bun-first.** Use `bun` / `bunx` (not `npm` / `npx`), `bun run test` (not
  `bun test`) when invoking the script. Engine target is Node `>=20`.
- **ESM only.** All relative imports use the `.js` suffix (TypeScript NodeNext-
  style). `tsdown` outputs `.mjs` + `.d.mts`.
- **No barrels in core.** `core/` modules import from each other directly, not
  through an index file.
- **Two test entrypoints.** Unit tests sit next to source as `*.test.ts`; the
  cross-cutting `src/test/integrity.test.ts` enforces structural invariants.
- **Snapshots are diagrams.** Several tests render plain-text grids and
  compare; treat snapshot diffs as visual regressions, not noise. Use
  `expectDiagram(...).toEqualDiagram(...)` from `src/test/diagram.ts` to keep
  indentation tolerant.
- **No emojis in code or commits.** Default to none unless the user asks.

## Common workflows

```sh
# Day-to-day
bun install
bun run test               # 150+ tests, ~250ms
bun run typecheck          # src + examples

# Pre-publish gate (build, then static + types validation)
bun run validate           # tsdown build + publint + attw

# Demos (examples/ is a workspace; depends on merman via file:..)
bun run examples:flowchart
bun run examples:state
bun run examples:sequence

# Snapshot a single demo to stdout
bun examples/src/flowchart-demo.ts --print --plain
```

After editing the public surface, **rebuild** (`bun run build`) — the
examples workspace consumes `dist/` via the `exports` field.

## Adding a new public export

1. Add the symbol to the relevant `src/<family>/index.ts`.
2. If it lives in `core/`, decide whether it should actually be public; if
   yes, move it into `<family>/` first to keep `core/` package-internal.
3. Run `bun run validate` — `attw` will surface broken type resolution.
4. The version in `package.json` is `0.0.0` until first publish; bump and
   tag on release.

## Publishing

Set up once on npmjs.com (Trusted Publisher → GitHub Actions), then:

1. Bump `version` in `package.json`.
2. Push a tag matching `vX.Y.Z`.
3. `.github/workflows/release.yml` builds, validates, and publishes via OIDC
   (no `NPM_TOKEN` required).

See the workflow file for the exact gating sequence.

## Where to look first

- Want to understand parsing? Start at `src/<family>/parser.ts`.
- Want to understand the visual output? Start at the family's
  `render.ts` / `diagram.ts`, then trace into `core/canvas.ts` and
  `core/render-grid.ts`.
- Want to understand the live renderable? `src/<family>/renderable.ts` (or
  `diagram.ts` for sequence) — these wrap the string pipeline and add
  OpenTUI-specific lifecycle, theming, and animation hooks.
