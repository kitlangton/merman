# @kitlangton/merman

## 0.2.2

### Patch Changes

- bb59296: Support replacing fenced Mermaid diagrams in Markdown files with rendered text fences through `merman --replace`.
- 92ed4d0: Fix compact flowchart routing for vertical sibling subtrees so fan-out edges stay attached to their true parent instead of wrapping around nearby nodes.

## 0.2.1

### Patch Changes

- 307e747: Fold overly wide horizontal flowcharts into a vertical layout when rendering through the CLI or when using the new `layoutMaxWidth` flowchart option.
- Add a plain-text `--doc-comment=ts` CLI output mode for rendering diagrams as paste-safe TypeScript doc-comment blocks, `--replace <typescript-file>` for replacing every inline Mermaid doc-comment fence in a file in place, and `--compact` for shorter flowchart routes and sequence diagrams with bare participant labels and inline message labels.

## 0.2.0

### Minor Changes

- ddaff2b: Add `createMermaidMarkdownRenderer` for rendering fenced Mermaid blocks inside OpenTUI `MarkdownRenderable` content and a `./tui` entrypoint for OpenCode's optional code-block renderer plugin API.

### Patch Changes

- 5f042db: Preserve arrow direction for horizontal Flowchart cycles, feedback edges, and parallel connections, keep transitive DAG targets after their intermediate stages, and render multiline edge, parallel-edge, and subgraph labels without exposing Mermaid `<br/>` markup or merging labels.
- 5f042db: Keep long Sequence messages and notes inside their containing group and fragment frames, and stop animated self-message pulses at explicit arrowheads.
- 04b9e89: Improve State diagram rendering for self-loops, parallel transitions, independent and duplicate feedback paths, note-safe feedback corridors, reconverging branches, choice junctions, and routed elbow transitions.

## 0.1.2

### Patch Changes

- 33a9c0d: Report unsupported structural Mermaid statements and malformed blocks with diagram kind, source line number, and offending input, explicitly ignore Flowchart presentation directives that do not apply to terminal themes, and document the supported syntax subset.
- 4f57a0b: Fix terminal-width rendering for wide and combined Unicode labels, correct reverse-direction and multiline state transition layout, size sequence fragment frames for their widest branch label, and normalize invalid sequence participant spacing. Improve live OpenTUI rendering by caching parsed diagrams and semantic grids for style-only updates, normalizing mutable state spacing consistently, and supporting batched Sequence option updates alongside Flowchart and State. Clarify that the current OpenTUI-backed package entrypoint requires Bun and constrain the supported OpenTUI peer range to tested versions.
