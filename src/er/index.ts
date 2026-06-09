import { renderErDiagram, renderErDiagramAnsi } from "./render.js"
import type { ErDiagramAnsiOptions, ErDiagramRenderOptions } from "./types.js"

export type {
  ErAttribute as Attribute,
  ErAttributeKey as AttributeKey,
  ErCardinality as Cardinality,
  ErDiagram as Diagram,
  ErDiagramAnsiOptions as AnsiRenderOptions,
  ErDiagramAnsiTheme as Theme,
  ErDiagramDirection as Direction,
  ErDiagramOptions as RenderableOptions,
  ErDiagramRenderOptions as PlainRenderOptions,
  ErEntity as Entity,
  ErRelationship as Relationship,
  ErRelationshipIdentification as RelationshipIdentification,
} from "./types.js"
export { erDiagramToFlowchartDiagram as toFlowchartDiagram } from "./adapter.js"
export { isMermaidErDiagram as is, parseMermaidErDiagram as parse } from "./parser.js"
export { ErDiagramRenderable as Renderable } from "./renderable.js"

export interface RenderOptions extends ErDiagramAnsiOptions {
  /** Emit ANSI color escapes. Default: `true`. Pass `false` for plain text. */
  color?: boolean
}

/**
 * Render a Mermaid ER diagram string for the terminal.
 *
 * Defaults to ANSI-colored output. Pass `{ color: false }` for plain text.
 */
export function render(content: string, options: RenderOptions = {}): string {
  const { color = true, ...rest } = options
  return color ? renderErDiagramAnsi(content, rest) : renderErDiagram(content, rest as ErDiagramRenderOptions)
}
