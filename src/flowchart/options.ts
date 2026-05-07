import type { BorderStyle, ColorInput, TextBufferOptions } from "@opentui/core"
import {
  normalizeDiagramPulseFrame,
  normalizeDiagramPulseGap,
  normalizeDiagramPulseLength,
  normalizeDiagramPulseProgress,
} from "../core/animation/pulse.js"
import type { FlowchartDiagramAnsiTheme, FlowchartNodeColors } from "./style.js"
import type { FlowchartActiveEdgeSelection, FlowchartDirection } from "./types.js"

export function normalizeFlowchartPulseFrame(value: number | undefined): number | undefined {
  return normalizeDiagramPulseFrame(value)
}

export function normalizeFlowchartPulseProgress(value: number | undefined): number | undefined {
  return normalizeDiagramPulseProgress(value)
}

export function normalizeFlowchartPulseLength(value: number | undefined): number {
  return normalizeDiagramPulseLength(value)
}

export function normalizeFlowchartPulseGap(value: number | undefined): number {
  return normalizeDiagramPulseGap(value)
}

export interface FlowchartDiagramRenderOptions {
  direction?: FlowchartDirection
  borderStyle?: BorderStyle
  minNodeGap?: number
  minRankGap?: number
  pulseFrame?: number
  pulseProgress?: number
  pulseLength?: number
  pulseGap?: number
  activeNode?: string
  activeEdge?: FlowchartActiveEdgeSelection
  activeEdgeProgress?: number
}

export interface FlowchartDiagramAnsiOptions extends FlowchartDiagramRenderOptions {
  theme?: FlowchartDiagramAnsiTheme
}

export interface FlowchartDiagramOptions extends TextBufferOptions, FlowchartDiagramRenderOptions {
  content?: string
  nodeColor?: ColorInput
  nodeColors?: FlowchartNodeColors
  nodeBgColors?: FlowchartNodeColors
  databaseColor?: ColorInput
  edgeColor?: ColorInput
  activeNodeColor?: ColorInput
  activeEdgeColor?: ColorInput
  pulseColor?: ColorInput
  labelColor?: ColorInput
  groupColor?: ColorInput
}
