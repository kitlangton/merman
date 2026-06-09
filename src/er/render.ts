import { renderFlowchartGrid, renderGridText } from "../flowchart/drawing.js"
import { layoutFlowchartDiagram } from "../flowchart/layout.js"
import { renderGridAnsi } from "../flowchart/style.js"
import type { FlowchartEdgeRoute, FlowchartPoint } from "../flowchart/types.js"
import { erCardinalityMarker, erDiagramToFlowchartDiagram } from "./adapter.js"
import { parseMermaidErDiagram } from "./parser.js"
import type { ErCardinality, ErDiagram } from "./types.js"
import type { ErDiagramAnsiOptions, ErDiagramRenderOptions } from "./types.js"

const DEFAULT_ER_MIN_RANK_GAP = 18

function erRenderOptions(options: ErDiagramRenderOptions): ErDiagramRenderOptions {
  return { minRankGap: DEFAULT_ER_MIN_RANK_GAP, ...options }
}

function horizontalMarkerX(point: FlowchartPoint, next: FlowchartPoint, marker: string, endpoint: "source" | "target") {
  const movingRight = endpoint === "source" ? next.x > point.x : point.x > next.x
  return movingRight
    ? point.x - (endpoint === "target" ? marker.length - 1 : 0)
    : point.x - (endpoint === "source" ? marker.length - 1 : 0)
}

function markerPoint(
  route: FlowchartEdgeRoute,
  marker: string,
  endpoint: "source" | "target",
): FlowchartPoint | undefined {
  if (route.points.length < 2) return undefined

  const point = endpoint === "source" ? route.points[0]! : route.points[route.points.length - 1]!
  const neighbor = endpoint === "source" ? route.points[1]! : route.points[route.points.length - 2]!
  if (point.y === neighbor.y) {
    return { x: Math.max(0, horizontalMarkerX(point, neighbor, marker, endpoint)), y: point.y }
  }

  const movingDown = endpoint === "source" ? neighbor.y > point.y : point.y > neighbor.y
  return {
    x: Math.max(0, point.x - Math.floor(marker.length / 2)),
    y: Math.max(0, endpoint === "source" ? (movingDown ? point.y : point.y - 1) : movingDown ? point.y - 1 : point.y),
  }
}

function drawCardinalityMarker(
  grid: ReturnType<typeof renderFlowchartGrid>,
  route: FlowchartEdgeRoute,
  cardinality: ErCardinality,
  endpoint: "source" | "target",
): void {
  const marker = erCardinalityMarker(cardinality, endpoint)
  const point = markerPoint(route, marker, endpoint)
  if (point) grid.setText(point.x, point.y, marker, "edge")
}

export function renderErGrid(diagram: ErDiagram, options: ErDiagramRenderOptions = {}) {
  const renderOptions = erRenderOptions(options)
  const flowchart = erDiagramToFlowchartDiagram(diagram)
  const grid = renderFlowchartGrid(flowchart, renderOptions)
  const layout = layoutFlowchartDiagram(flowchart, renderOptions)

  for (const [index, route] of layout.routes.entries()) {
    const relationship = diagram.relationships[index]
    if (!relationship) continue
    drawCardinalityMarker(grid, route, relationship.fromCardinality, "source")
    drawCardinalityMarker(grid, route, relationship.toCardinality, "target")
  }

  return grid
}

export function renderErDiagram(content: string, options: ErDiagramRenderOptions = {}): string {
  return renderGridText(renderErGrid(parseMermaidErDiagram(content), options))
}

export function renderErDiagramAnsi(content: string, options: ErDiagramAnsiOptions = {}): string {
  return renderGridAnsi(renderErGrid(parseMermaidErDiagram(content), options), options.theme)
}
