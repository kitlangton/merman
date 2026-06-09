import type { FlowchartDiagram, FlowchartDirection, FlowchartEdge } from "../flowchart/types.js"
import type { ErAttribute, ErCardinality, ErDiagram } from "./types.js"

function attributeLine(attribute: ErAttribute): string {
  const keys = attribute.keys?.length ? ` ${attribute.keys.join(",")}` : ""
  const comment = attribute.comment ? ` # ${attribute.comment}` : ""
  return `${attribute.type} ${attribute.name}${keys}${comment}`
}

function entityLabel(entity: ErDiagram["entities"][number]): string {
  if (entity.attributes.length === 0) return entity.label
  return [entity.label, "────────", ...entity.attributes.map(attributeLine)].join("<br/>")
}

export function erCardinalityMarker(cardinality: ErCardinality, side: "source" | "target"): string {
  switch (cardinality) {
    case "zeroOrOne":
      return side === "source" ? "|o" : "o|"
    case "exactlyOne":
      return "||"
    case "zeroOrMore":
      return side === "source" ? "}o" : "o{"
    case "oneOrMore":
      return side === "source" ? "}|" : "|{"
  }
}

function normalizeDirection(direction: ErDiagram["direction"]): FlowchartDirection {
  return direction === "TB" ? "TD" : direction
}

export function erDiagramToFlowchartDiagram(diagram: ErDiagram): FlowchartDiagram {
  const edges: FlowchartEdge[] = diagram.relationships.map((relationship) => ({
    from: relationship.from,
    to: relationship.to,
    label: relationship.label,
    style: relationship.identifying === "non-identifying" ? "dashed" : undefined,
    head: "none",
  }))

  return {
    direction: normalizeDirection(diagram.direction),
    nodes: diagram.entities.map((entity) => ({ id: entity.id, label: entityLabel(entity), shape: "box" })),
    edges,
  }
}
