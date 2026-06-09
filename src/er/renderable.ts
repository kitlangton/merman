import { TextBufferRenderable, type RenderContext } from "@opentui/core"
import { DiagramRenderablePipeline } from "../core/adapter/renderable-pipeline.js"
import { renderErGrid } from "./render.js"
import { renderGridStyledText, resolveFlowchartStyleColors, type FlowchartGrid } from "../flowchart/style.js"
import { parseMermaidErDiagram } from "./parser.js"
import type { ErDiagram, ErDiagramOptions } from "./types.js"

export class ErDiagramRenderable extends TextBufferRenderable {
  private _content: string
  private _compact: boolean
  private _renderedWidth = 0
  private _renderedHeight = 0
  private readonly _pipeline: DiagramRenderablePipeline<ErDiagram, FlowchartGrid>

  constructor(ctx: RenderContext, options: ErDiagramOptions = {}) {
    super(ctx, { ...options, wrapMode: options.wrapMode ?? "none" })
    this._content = options.content ?? ""
    this._compact = options.compact ?? false
    this._pipeline = new DiagramRenderablePipeline({
      parse: () => parseMermaidErDiagram(this._content),
      draw: (diagram) => renderErGrid(diagram, { compact: this._compact }),
      didDraw: (grid) => this.updateRenderedSize(grid),
      publish: (grid) => this.publishStyledText(grid),
    })
    this._pipeline.invalidateParsedDiagram()
  }

  get content(): string {
    return this._content
  }

  set content(value: string) {
    if (this._content === value) return
    this._content = value
    this._pipeline.invalidateParsedDiagram()
  }

  get renderedWidth(): number {
    return this._renderedWidth
  }

  get renderedHeight(): number {
    return this._renderedHeight
  }

  get compact(): boolean {
    return this._compact
  }

  set compact(value: boolean) {
    if (this._compact === value) return
    this._compact = value
    this._pipeline.invalidateGrid()
  }

  private updateRenderedSize(grid: FlowchartGrid): void {
    const size = grid.getTextSize({ trimTop: true, trimBottom: true })
    this._renderedWidth = size.width
    this._renderedHeight = size.height
  }

  private publishStyledText(grid: FlowchartGrid): void {
    this.textBuffer.setStyledText(renderGridStyledText(grid, resolveFlowchartStyleColors()))
    this.updateTextInfo()
  }
}
