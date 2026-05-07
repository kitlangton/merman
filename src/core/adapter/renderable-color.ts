import { parseColor, type ColorInput, type RGBA } from "@opentui/core"
import { colorsEqual } from "../color/style.js"

export function setDiagramRenderableColor(
  current: RGBA | undefined,
  value: ColorInput | undefined,
  assign: (color: RGBA | undefined) => void,
  invalidate: () => void,
): void {
  const next = value ? parseColor(value) : undefined
  if (colorsEqual(current, next)) return
  assign(next)
  invalidate()
}
