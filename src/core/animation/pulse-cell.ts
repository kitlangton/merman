import type { DiagramCanvas } from "../canvas.js"
import { diagramPulseLevel } from "./pulse.js"

export function diagramPulseStyleLevel<Style extends string, PulseStyle extends Style>(
  style: Style | undefined,
  pulseStyles: readonly PulseStyle[],
): number {
  if (!style) return 0
  const index = (pulseStyles as readonly Style[]).indexOf(style)
  return index >= 0 ? index + 1 : 0
}

export function diagramPulseCellStyle<Style extends string, PulseStyle extends Style>(
  pulseStyles: readonly PulseStyle[],
  distance: number,
  radius: number,
  edgeDistance: number,
  char: string,
  straightChars = "─│",
): { style: PulseStyle; level: number } {
  const level = diagramPulseLevel(distance, radius, edgeDistance, straightChars.includes(char))
  return { style: pulseStyles[level - 1]!, level }
}

export function setDiagramPulseCell<Style extends string, Metadata extends object, PulseStyle extends Style>(
  grid: DiagramCanvas<Style, Metadata>,
  x: number,
  y: number,
  distance: number,
  radius: number,
  edgeDistance: number,
  pulseStyles: readonly PulseStyle[],
  canStyle: (style: Style | undefined) => boolean,
  straightChars?: string,
): void {
  const cell = grid.getCell(x, y)
  if (!cell || cell.char === " " || !canStyle(cell.style)) return

  const pulse = diagramPulseCellStyle(pulseStyles, distance, radius, edgeDistance, cell.char, straightChars)
  if (diagramPulseStyleLevel(cell.style, pulseStyles) > pulse.level) return
  cell.style = pulse.style
}
