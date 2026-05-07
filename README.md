# opentui-diagrams

Experimental diagram renderers for OpenTUI.

This package depends on `@opentui/core` for public renderable primitives and owns the diagram-specific canvas, geometry, layout, routing, style, and Mermaid parsing code.

```ts
import { FlowchartDiagramRenderable, renderStateDiagram, renderSequenceDiagram } from "opentui-diagrams"
```

## Development

```sh
bun install
bun test
bun run typecheck
```
