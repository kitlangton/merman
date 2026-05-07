# opentui-diagrams

Experimental diagram renderers for OpenTUI.

This package depends on `@opentui/core` for renderable primitives and owns the diagram-specific parsing, layout, routing, rendering, and terminal drawing code.

```ts
import { FlowchartDiagramRenderable, renderStateDiagram, renderSequenceDiagram } from "opentui-diagrams"
```

## Source Layout

- `src/flowchart` owns Flowchart parsing, layout, routing, rendering, and OpenTUI adapter code.
- `src/state` owns StateDiagram parsing, layout, rendering, and OpenTUI adapter code.
- `src/sequence` owns SequenceDiagram parsing, rendering, and OpenTUI adapter code.
- `src/core` contains package-internal diagram primitives for canvas, geometry, drawing, color, animation, Mermaid line handling, terminal ANSI, and OpenTUI adapter helpers.

## Development

```sh
bun install
bun test
bun run typecheck
```
