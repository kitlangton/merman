import type { BorderStyle } from "@opentui/core"
import {
  normalizeDiagramPositiveInt,
  normalizeDiagramPulseFrame,
  normalizeDiagramPulseGap,
  normalizeDiagramPulseLength,
  normalizeDiagramPulseProgress,
} from "../core/animation/pulse.js"
import type { StateDiagramArrowHeadStyle } from "./types.js"

export const DEFAULT_STATE_DIAGRAM_MIN_STATE_GAP = 5
export const DEFAULT_STATE_PULSE_LENGTH = 5
export const DEFAULT_STATE_PULSE_GAP = 14

export const DEFAULT_STATE_BORDER_STYLE = "rounded" satisfies BorderStyle
export const DEFAULT_STATE_ARROW_HEAD_STYLE = "filled" satisfies StateDiagramArrowHeadStyle

export function normalizeStateMinStateGap(value: number | undefined): number {
  return normalizeDiagramPositiveInt(value, DEFAULT_STATE_DIAGRAM_MIN_STATE_GAP)
}

export function normalizeStatePulseFrame(value: number | undefined): number | undefined {
  return normalizeDiagramPulseFrame(value)
}

export function normalizeStatePulseProgress(value: number | undefined): number | undefined {
  return normalizeDiagramPulseProgress(value)
}

export function normalizeStatePulseLength(value: number | undefined): number {
  return normalizeDiagramPulseLength(value, DEFAULT_STATE_PULSE_LENGTH)
}

export function normalizeStatePulseGap(value: number | undefined): number {
  return normalizeDiagramPulseGap(value, DEFAULT_STATE_PULSE_GAP)
}
