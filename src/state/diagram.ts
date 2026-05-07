import { BorderChars, type BorderCharacters, type BorderStyle, type ColorInput, type RenderContext, type RGBA, type StyledText, TextBufferRenderable } from "@opentui/core"
import { DiagramCanvas, type DiagramCanvasCell } from "../core/canvas.js"
import type { DiagramCanvasRunOptions } from "../core/canvas.js"
import {
  diagramColorMapsEqual,
  diagramRadialCellColorLevel,
  normalizeDiagramColorMap,
} from "../core/color/map.js"
import { diagramArrowHead, diagramLineGlyph, drawDiagramFrame, mergeDiagramLineGlyph } from "../core/drawing.js"
import type { DiagramDirection } from "../core/geometry.js"
import { setDiagramPulseCell } from "../core/animation/pulse-cell.js"
import { parseDiagramRenderableColor, setDiagramRenderableColor } from "../core/adapter/renderable-color.js"
import {
  normalizeDiagramPulseFrame,
  normalizeDiagramPulseGap,
  normalizeDiagramPulseLength,
  normalizeDiagramPulseProgress,
  visitDiagramPulsePath,
} from "../core/animation/pulse.js"
import {
  createStateDiagramLayout,
  expandCompositeBoundsForFeedback,
  hasReverseTransition,
  splitStateDiagramLines as splitLines,
  type StateDiagramBoxBounds as BoxBounds,
  type StateDiagramNoteBounds as StateNoteBounds,
} from "./layout.js"
import { renderDiagramGridAnsi, renderDiagramGridStyledText } from "../core/render-grid.js"
import { diagramTextWidth } from "../core/text.js"
import { normalizeStateDiagramEndpoint } from "./endpoint.js"
import { parseMermaidStateDiagram } from "./parser.js"
import {
  isStateActiveTransitionStyle,
  isStateTransitionFadeStyle,
  resolveStateStyleColors,
  resolveStateAnsiTheme,
  STATE_ACTIVE_TRANSITION_PULSE_STYLES,
  stateActiveTransitionPulseStyleLevel,
  stateDiagramStateColorKey,
  stateInactiveTransitionStyle,
  stateStyleBgColor,
  stateStyleColor,
  stateTransitionFadeStyle,
  type StateStyleColors,
} from "./style.js"
import type {
  FadeSourceStyle,
  StateCellStyle,
  StateDiagram,
  StateDiagramActiveTransition,
  StateDiagramActiveTransitionMode,
  StateDiagramActiveTransitionSelection,
  StateDiagramAnsiOptions,
  StateDiagramAnsiTheme,
  StateDiagramArrowHeadStyle,
  StateDiagramDirection,
  StateDiagramOptions,
  StateDiagramRenderOptions,
  StateDiagramState,
  StateDiagramStateColors,
  StateDiagramTransition,
} from "./types.js"
export type {
  StateDiagram,
  StateDiagramActiveTransition,
  StateDiagramActiveTransitionMode,
  StateDiagramActiveTransitionSelection,
  StateDiagramAnsiOptions,
  StateDiagramAnsiTheme,
  StateDiagramArrowHeadStyle,
  StateDiagramCompositeState,
  StateDiagramDirection,
  StateDiagramNote,
  StateDiagramOptions,
  StateDiagramRenderOptions,
  StateDiagramState,
  StateDiagramStateColors,
  StateDiagramTransition,
} from "./types.js"
export { isMermaidStateDiagram, parseMermaidStateDiagram } from "./parser.js"
export { stateDiagramStateColorKey } from "./style.js"

interface StateDiagramRenderTransition extends StateDiagramTransition {
  sourceTransitions?: readonly StateDiagramTransition[]
}

interface StateCellMetadata {
  stateId?: string
  bgStateId?: string
}

type StateCell = DiagramCanvasCell<StateCellStyle, StateCellMetadata>
type StateGrid = DiagramCanvas<StateCellStyle, StateCellMetadata>

type StatePathPoint = readonly [number, number]

interface TransitionDrawContext {
  fadeSource: FadeSourceStyle
  active: boolean
  fadeFromSource: boolean
  path?: StatePathPoint[]
  sourceStateId: string
}

const DEFAULT_MIN_STATE_GAP = 5
const DEFAULT_BORDER_STYLE = "rounded" satisfies BorderStyle
const DEFAULT_ARROW_HEAD_STYLE = "filled" satisfies StateDiagramArrowHeadStyle
const DEFAULT_PULSE_LENGTH = 5
const DEFAULT_PULSE_GAP = 14
const ACTIVE_TRANSITION_FRONTIER_ACTIVE_SIDE = 2
const ACTIVE_TRANSITION_FRONTIER_INACTIVE_SIDE = 5

function visualLength(value: string): number {
  return diagramTextWidth(value)
}

function normalizePulseFrame(value: number | undefined): number | undefined {
  return normalizeDiagramPulseFrame(value)
}

function normalizePulseProgress(value: number | undefined): number | undefined {
  return normalizeDiagramPulseProgress(value)
}

function normalizeActiveTransitionMode(
  value: StateDiagramActiveTransitionMode | undefined,
): StateDiagramActiveTransitionMode {
  return value === "fade" ? "fade" : "reveal"
}

function normalizePulseLength(value: number | undefined): number {
  return normalizeDiagramPulseLength(value, DEFAULT_PULSE_LENGTH)
}

function normalizePulseGap(value: number | undefined): number {
  return normalizeDiagramPulseGap(value, DEFAULT_PULSE_GAP)
}

function normalizeActiveTransition(activeTransition: StateDiagramActiveTransition): StateDiagramActiveTransition {
  return {
    from: normalizeStateDiagramEndpoint(activeTransition.from, "from"),
    to: normalizeStateDiagramEndpoint(activeTransition.to, "to"),
    label: activeTransition.label,
  }
}

function normalizeActiveTransitions(
  activeTransition: StateDiagramActiveTransitionSelection | undefined,
): StateDiagramActiveTransition[] {
  if (!activeTransition) return []
  const transitions = Array.isArray(activeTransition) ? activeTransition : [activeTransition]
  return transitions.map(normalizeActiveTransition)
}

function activeTransitionEqual(left: StateDiagramActiveTransition, right: StateDiagramActiveTransition): boolean {
  return left.from === right.from && left.to === right.to && left.label === right.label
}

function activeTransitionListsEqual(
  left: readonly StateDiagramActiveTransition[],
  right: readonly StateDiagramActiveTransition[],
): boolean {
  return (
    left.length === right.length && left.every((transition, index) => activeTransitionEqual(transition, right[index]!))
  )
}

function isActiveTransition(
  transition: StateDiagramTransition,
  activeTransitions: readonly StateDiagramActiveTransition[],
): boolean {
  return activeTransitionIndex(transition, activeTransitions) !== -1
}

function activeTransitionIndex(
  transition: StateDiagramTransition,
  activeTransitions: readonly StateDiagramActiveTransition[],
): number {
  const exactIndex = activeTransitions.findIndex(
    (activeTransition) =>
      activeTransition.from === transition.from &&
      activeTransition.to === transition.to &&
      (activeTransition.label === undefined || activeTransition.label === transition.label),
  )
  if (exactIndex !== -1) return exactIndex

  const sourceTransitions = (transition as StateDiagramRenderTransition).sourceTransitions
  if (!sourceTransitions || sourceTransitions.length <= 1 || activeTransitions.length < sourceTransitions.length)
    return -1

  for (let index = 0; index <= activeTransitions.length - sourceTransitions.length; index++) {
    const matches = sourceTransitions.every((sourceTransition, offset) => {
      const activeTransition = activeTransitions[index + offset]!
      return (
        activeTransition.from === sourceTransition.from &&
        activeTransition.to === sourceTransition.to &&
        (activeTransition.label === undefined || activeTransition.label === sourceTransition.label)
      )
    })
    if (matches) return index
  }

  return -1
}

function makeGrid(width: number, height: number): StateGrid {
  return new DiagramCanvas(width, height, {
    mergeCell: (existing, incoming): StateCell => {
      const shouldMerge = isTransitionDrawingStyle(existing.style) && isTransitionDrawingStyle(incoming.style)
      return {
        ...incoming,
        char: shouldMerge
          ? (mergeDiagramLineGlyph(existing.char, incoming.char, "rounded") ?? incoming.char)
          : incoming.char,
      }
    },
  })
}

function isTransitionDrawingStyle(style: StateCellStyle | undefined): boolean {
  return (
    style === "transition" ||
    style === "activeTransition" ||
    isStateActiveTransitionStyle(style) ||
    isStateTransitionFadeStyle(style)
  )
}

function setCell(
  grid: StateGrid,
  x: number,
  y: number,
  char: string,
  style?: StateCellStyle,
  stateId?: string,
  bgStateId?: string,
): void {
  grid.setCell(x, y, char, style, { stateId, bgStateId })
}

function addPathPoint(path: StatePathPoint[] | undefined, x: number, y: number): void {
  path?.push([x, y])
}

function setPathCell(
  grid: StateGrid,
  path: StatePathPoint[] | undefined,
  x: number,
  y: number,
  char: string,
  style?: StateCellStyle,
  stateId?: string,
): void {
  setCell(grid, x, y, char, style, stateId)
  addPathPoint(path, x, y)
}

function setText(
  grid: StateGrid,
  x: number,
  y: number,
  text: string,
  style?: StateCellStyle,
  stateId?: string,
  bgStateId?: string,
): void {
  grid.setText(x, y, text, style, { stateId, bgStateId })
}

function isHiddenCompositeMarker(state: StateDiagramState | undefined): boolean {
  return Boolean(state?.parentId && (state.kind === "start" || state.kind === "end"))
}

function sourceTransitionsOf(transition: StateDiagramRenderTransition): readonly StateDiagramTransition[] {
  return transition.sourceTransitions ?? [transition]
}

function composeTransitionLabel(incoming: StateDiagramTransition, outgoing: StateDiagramTransition): string {
  return incoming.label || outgoing.label
}

function collapseHiddenCompositeMarkerTransitionsOnce(
  transitions: readonly StateDiagramRenderTransition[],
  statesById: ReadonlyMap<string, StateDiagramState>,
): { transitions: StateDiagramRenderTransition[]; changed: boolean } {
  const hiddenMarkers = new Set(
    [...statesById.values()].filter((state) => isHiddenCompositeMarker(state)).map((state) => state.id),
  )
  if (hiddenMarkers.size === 0) return { transitions: [...transitions], changed: false }

  const skipped = new Set<StateDiagramRenderTransition>()
  const collapsed: StateDiagramRenderTransition[] = []
  let changed = false

  for (const markerId of hiddenMarkers) {
    const incoming = transitions.filter((transition) => transition.to === markerId && transition.from !== markerId)
    const outgoing = transitions.filter((transition) => transition.from === markerId && transition.to !== markerId)
    if (incoming.length === 0 || outgoing.length === 0) continue

    changed = true
    for (const incomingTransition of incoming) {
      skipped.add(incomingTransition)
      for (const outgoingTransition of outgoing) {
        skipped.add(outgoingTransition)
        collapsed.push({
          from: incomingTransition.from,
          to: outgoingTransition.to,
          label: composeTransitionLabel(incomingTransition, outgoingTransition),
          sourceTransitions: [...sourceTransitionsOf(incomingTransition), ...sourceTransitionsOf(outgoingTransition)],
        })
      }
    }
  }

  return { transitions: [...transitions.filter((transition) => !skipped.has(transition)), ...collapsed], changed }
}

function collapseHiddenCompositeMarkerTransitions(diagram: StateDiagram): StateDiagramRenderTransition[] {
  const statesById = new Map(diagram.states.map((state) => [state.id, state]))
  let transitions: StateDiagramRenderTransition[] = diagram.transitions.map((transition) => ({
    ...transition,
    sourceTransitions: [transition],
  }))

  while (true) {
    const result = collapseHiddenCompositeMarkerTransitionsOnce(transitions, statesById)
    transitions = result.transitions
    if (!result.changed) return transitions
  }
}

function createRenderDiagram(diagram: StateDiagram): StateDiagram {
  const transitions = collapseHiddenCompositeMarkerTransitions(diagram)
  const referencedHiddenMarkers = new Set<string>()
  const statesById = new Map(diagram.states.map((state) => [state.id, state]))
  for (const transition of transitions) {
    const from = statesById.get(transition.from)
    const to = statesById.get(transition.to)
    if (from && isHiddenCompositeMarker(from)) referencedHiddenMarkers.add(from.id)
    if (to && isHiddenCompositeMarker(to)) referencedHiddenMarkers.add(to.id)
  }

  return {
    ...diagram,
    states: diagram.states.filter((state) => !isHiddenCompositeMarker(state) || referencedHiddenMarkers.has(state.id)),
    transitions,
  }
}

function drawBox(
  grid: StateGrid,
  state: StateDiagramState,
  bounds: BoxBounds,
  lines: string[],
  active: boolean,
  borderStyle: BorderStyle,
): void {
  if (isHiddenCompositeMarker(state)) return

  if (state.kind !== "state") {
    setCell(grid, bounds.left, bounds.top, state.label, active ? "activeState" : state.kind, state.id)
    return
  }
  const style: StateCellStyle = active ? "activeState" : "state"
  fillBoxInterior(grid, bounds, style, state.id)
  drawStateFrame(grid, bounds, BorderChars[borderStyle], style, state.id)
  lines.forEach((line, index) => {
    setStateText(grid, bounds, bounds.left + 2, bounds.top + 1 + index, line, style, state.id)
  })
}

function stateColorKeyForCell(bounds: BoxBounds, stateId: string, x: number, y: number, border = false): string {
  return stateDiagramStateColorKey(stateId, diagramRadialCellColorLevel(bounds, x, y, border))
}

function fillBoxInterior(grid: StateGrid, bounds: BoxBounds, style: StateCellStyle, stateId: string): void {
  for (let y = bounds.top + 1; y < bounds.top + bounds.height - 1; y++) {
    for (let x = bounds.left + 1; x < bounds.left + bounds.width - 1; x++) {
      const colorKey = stateColorKeyForCell(bounds, stateId, x, y)
      setCell(grid, x, y, " ", style, colorKey, colorKey)
    }
  }
}

function drawStateFrame(
  grid: StateGrid,
  bounds: BoxBounds,
  chars: BorderCharacters,
  style: StateCellStyle,
  stateId: string,
): void {
  const setBorderCell = (x: number, y: number, char: string) => {
    setCell(grid, x, y, char, style, stateColorKeyForCell(bounds, stateId, x, y, true))
  }

  drawDiagramFrame(bounds, chars, setBorderCell)
}

function setStateText(
  grid: StateGrid,
  bounds: BoxBounds,
  x: number,
  y: number,
  text: string,
  style: StateCellStyle,
  stateId: string,
): void {
  let offset = 0
  for (const char of text) {
    const colorKey = stateColorKeyForCell(bounds, stateId, x + offset, y)
    setCell(grid, x + offset, y, char, style, colorKey, colorKey)
    offset += visualLength(char)
  }
}

function drawContainerFrame(
  grid: StateGrid,
  bounds: BoxBounds,
  label: string,
  chars: BorderCharacters,
  style: StateCellStyle,
  stateId?: string,
): void {
  drawDiagramFrame(bounds, chars, (x, y, char) => setCell(grid, x, y, char, style, stateId))
  if (label) setText(grid, bounds.left + 2, bounds.top, ` ${label} `, style, stateId)
}

function drawHorizontalNoteConnector(grid: StateGrid, fromX: number, toX: number, y: number, char: string): void {
  const step = fromX <= toX ? 1 : -1
  for (let x = fromX; step === 1 ? x <= toX : x >= toX; x += step) {
    setCell(grid, x, y, char, "noteConnector")
  }
}

function drawNote(grid: StateGrid, bounds: StateNoteBounds, target: BoxBounds): void {
  const chars = BorderChars.double
  const connectorChars = BorderChars.double
  const noteX = bounds.note.position === "right" ? bounds.left - 1 : bounds.left + bounds.width
  const targetX = bounds.note.position === "right" ? target.left + target.width : target.left - 1
  const targetBottom = target.top + target.height - 1
  const noteBottom = bounds.top + bounds.height - 1
  const noteAbove = noteBottom < target.top
  const noteBelow = bounds.top > targetBottom
  let connectorY: number

  if (noteAbove || noteBelow) {
    const targetY = noteAbove ? target.top - 1 : targetBottom + 1
    connectorY = bounds.centerY
    const verticalStep = targetY <= connectorY ? 1 : -1

    for (let y = targetY; verticalStep === 1 ? y <= connectorY : y >= connectorY; y += verticalStep) {
      setCell(grid, targetX, y, connectorChars.vertical, "noteConnector")
    }

    drawHorizontalNoteConnector(grid, targetX, noteX, connectorY, connectorChars.horizontal)
    const connectorTurnsRight = targetX <= noteX
    const corner = noteAbove
      ? connectorTurnsRight
        ? connectorChars.topLeft
        : connectorChars.topRight
      : connectorTurnsRight
        ? connectorChars.bottomLeft
        : connectorChars.bottomRight
    setCell(grid, targetX, connectorY, corner, "noteConnector")
  } else {
    connectorY = Math.max(bounds.top + 1, Math.min(target.centerY, bounds.top + bounds.height - 2))
    drawHorizontalNoteConnector(grid, targetX, noteX, connectorY, connectorChars.horizontal)
  }

  drawContainerFrame(grid, bounds, "", chars, "noteBorder")
  setCell(
    grid,
    bounds.note.position === "right" ? bounds.left : bounds.left + bounds.width - 1,
    connectorY,
    bounds.note.position === "right" ? chars.rightT : chars.leftT,
    "noteBorder",
  )
  bounds.lines.forEach((line, index) => setText(grid, bounds.left + 2, bounds.top + 1 + index, line, "noteText"))
}

function transitionLineStyle(active: boolean): StateCellStyle {
  return active ? "activeTransition" : "transition"
}

function transitionLabelStyle(active: boolean): StateCellStyle {
  return active ? "activeTransition" : "label"
}

function transitionFadeCellStyle(context: TransitionDrawContext, distance: number): StateCellStyle {
  return stateTransitionFadeStyle(context.fadeSource, context.active, distance, context.fadeFromSource)
}

function drawHorizontalRamp(
  grid: StateGrid,
  fromX: number,
  toX: number,
  y: number,
  direction: 1 | -1,
  startDistance: number,
  context: TransitionDrawContext,
): void {
  let distance = startDistance
  for (let x = fromX; direction === 1 ? x <= toX : x >= toX; x += direction) {
    setPathCell(grid, context.path, x, y, "─", transitionFadeCellStyle(context, distance), context.sourceStateId)
    distance += 1
  }
}

function drawVerticalRamp(
  grid: StateGrid,
  x: number,
  fromY: number,
  toY: number,
  direction: 1 | -1,
  startDistance: number,
  context: TransitionDrawContext,
): void {
  let distance = startDistance
  for (let y = fromY; direction === 1 ? y <= toY : y >= toY; y += direction) {
    setPathCell(grid, context.path, x, y, "│", transitionFadeCellStyle(context, distance), context.sourceStateId)
    distance += 1
  }
}

function drawRightDeparture(grid: StateGrid, bounds: BoxBounds, context: TransitionDrawContext): void {
  if (bounds.width <= 1 || bounds.height <= 1) return
  setPathCell(
    grid,
    context.path,
    bounds.left + bounds.width - 1,
    bounds.centerY,
    BorderChars.rounded.leftT,
    transitionFadeCellStyle(context, 0),
    context.sourceStateId,
  )
}

function drawBottomDeparture(grid: StateGrid, bounds: BoxBounds, x: number, context: TransitionDrawContext): void {
  if (bounds.width <= 1 || bounds.height <= 1) return
  setPathCell(
    grid,
    context.path,
    x,
    bounds.top + bounds.height - 1,
    BorderChars.rounded.topT,
    transitionFadeCellStyle(context, 0),
    context.sourceStateId,
  )
}

function drawTopDeparture(grid: StateGrid, bounds: BoxBounds, x: number, context: TransitionDrawContext): void {
  if (bounds.width <= 1 || bounds.height <= 1) return
  setPathCell(
    grid,
    context.path,
    x,
    bounds.top,
    BorderChars.rounded.bottomT,
    transitionFadeCellStyle(context, 0),
    context.sourceStateId,
  )
}

function drawHorizontal(
  grid: StateGrid,
  from: BoxBounds,
  to: BoxBounds,
  label: string,
  transition: StateDiagramTransition,
  diagram: StateDiagram,
  feedbackLaneY: number,
  arrowHeadStyle: StateDiagramArrowHeadStyle,
  context: TransitionDrawContext,
): void {
  if (transition.from === transition.to) {
    drawSelfTransition(grid, from, label, arrowHeadStyle, context)
    return
  }

  const leftToRight = from.centerX <= to.centerX
  const targetState = diagram.states.find((state) => state.id === transition.to)
  const targetIsChoice = targetState?.kind === "choice" || isHiddenCompositeMarker(targetState)
  if (!leftToRight) {
    drawBottomFeedback(grid, from, to, label, feedbackLaneY, arrowHeadStyle, targetIsChoice, context)
    return
  }

  if (from.centerY !== to.centerY) {
    drawVerticalElbowTransition(
      grid,
      from,
      to,
      label,
      hasReverseTransition(diagram, transition),
      arrowHeadStyle,
      targetIsChoice,
      context,
    )
    return
  }

  const y = from.centerY
  const lineStyle = transitionLineStyle(context.active)
  drawRightDeparture(grid, from, context)
  const startX = from.left + from.width
  const endX = to.left - 1
  const startDistance = from.width <= 1 || from.height <= 1 ? 0 : 1
  drawHorizontalRamp(grid, startX, targetIsChoice ? endX : endX - 1, y, 1, startDistance, context)
  if (targetIsChoice) addPathPoint(context.path, to.left, y)
  else setPathCell(grid, context.path, endX, y, diagramArrowHead("right", arrowHeadStyle), lineStyle)
  if (label) {
    const text = splitLines(label)[0] ?? ""
    const labelX = Math.min(startX, endX) + Math.max(1, Math.floor(Math.abs(endX - startX - visualLength(text)) / 2))
    setText(grid, labelX, Math.max(0, y - 1), text, transitionLabelStyle(context.active))
  }
}

function drawSelfTransition(
  grid: StateGrid,
  bounds: BoxBounds,
  label: string,
  arrowHeadStyle: StateDiagramArrowHeadStyle,
  context: TransitionDrawContext,
): void {
  if (bounds.width <= 1 || bounds.height <= 1) return

  const lineStyle = transitionLineStyle(context.active)
  const sourceX = bounds.left + Math.max(2, Math.floor(bounds.width / 3))
  const bottomY = bounds.top + bounds.height - 1
  const railY = bottomY + 2
  const targetX = Math.max(sourceX + 3, bounds.left + Math.min(bounds.width - 3, Math.ceil((bounds.width * 2) / 3)))

  drawBottomDeparture(grid, bounds, sourceX, context)
  setPathCell(grid, context.path, sourceX, bottomY + 1, "│", transitionFadeCellStyle(context, 1), context.sourceStateId)
  setPathCell(grid, context.path, sourceX, railY, "╰", lineStyle)
  for (let x = sourceX + 1; x < targetX; x++) setPathCell(grid, context.path, x, railY, "─", lineStyle)
  setPathCell(grid, context.path, targetX, railY, "╯", lineStyle)
  setPathCell(grid, context.path, targetX, bottomY + 1, diagramArrowHead("up", arrowHeadStyle), lineStyle)

  if (label) setText(grid, targetX + 2, bottomY + 1, splitLines(label)[0] ?? "", transitionLabelStyle(context.active))
}

function outsideBottomY(bounds: BoxBounds): number {
  return bounds.top + bounds.height
}

function drawBottomFeedback(
  grid: StateGrid,
  from: BoxBounds,
  to: BoxBounds,
  label: string,
  railY: number,
  arrowHeadStyle: StateDiagramArrowHeadStyle,
  targetIsChoice: boolean,
  context: TransitionDrawContext,
): void {
  const lineStyle = transitionLineStyle(context.active)
  const sourceX = from.centerX
  const targetX = to.width > 1 ? (sourceX > to.centerX ? to.left + 1 : to.left + to.width - 2) : to.centerX
  const sourceBottomY = outsideBottomY(from)
  const targetBottomY = outsideBottomY(to)
  const startDistance = from.width <= 1 || from.height <= 1 ? 0 : 1

  drawBottomDeparture(grid, from, sourceX, context)
  drawVerticalRamp(grid, sourceX, sourceBottomY, railY - 1, 1, startDistance, context)
  setPathCell(grid, context.path, sourceX, railY, sourceX > targetX ? "╯" : "╰", lineStyle)
  if (sourceX !== targetX) {
    const horizontalStep = sourceX < targetX ? 1 : -1
    for (let x = sourceX + horizontalStep; x !== targetX; x += horizontalStep) {
      setPathCell(grid, context.path, x, railY, "─", lineStyle)
    }
  }
  setPathCell(grid, context.path, targetX, railY, sourceX > targetX ? "╰" : "╯", lineStyle)
  for (let y = railY - 1; y > targetBottomY; y--) setPathCell(grid, context.path, targetX, y, "│", lineStyle)
  setPathCell(
    grid,
    context.path,
    targetX,
    targetBottomY,
    targetIsChoice ? "│" : diagramArrowHead("up", arrowHeadStyle),
    lineStyle,
  )
  if (targetIsChoice) addPathPoint(context.path, to.left, to.top)

  if (label) {
    const text = splitLines(label)[0] ?? ""
    const labelX =
      Math.min(sourceX, targetX) + Math.max(1, Math.floor((Math.abs(sourceX - targetX) - visualLength(text)) / 2))
    setText(grid, labelX, Math.max(0, railY - 1), text, transitionLabelStyle(context.active))
  }
}

function drawVerticalElbowTransition(
  grid: StateGrid,
  from: BoxBounds,
  to: BoxBounds,
  label: string,
  hasReverse: boolean,
  arrowHeadStyle: StateDiagramArrowHeadStyle,
  targetIsChoice: boolean,
  context: TransitionDrawContext,
): void {
  const lineStyle = transitionLineStyle(context.active)
  const topToBottom = from.centerY < to.centerY
  const offset = hasReverse ? (topToBottom ? -2 : 2) : 0
  const startX = from.centerX + offset
  const endX = to.centerX + offset
  const startY = topToBottom ? from.top + from.height : from.top - 1
  const endY = topToBottom ? to.top - 1 : to.top + to.height
  const verticalStep = topToBottom ? 1 : -1
  const startDistance = from.width <= 1 || from.height <= 1 ? 0 : 1

  if (topToBottom) {
    drawBottomDeparture(grid, from, startX, context)
  } else {
    drawTopDeparture(grid, from, startX, context)
  }

  if (startY !== endY) drawVerticalRamp(grid, startX, startY, endY - verticalStep, verticalStep, startDistance, context)

  if (startX !== endX) {
    const horizontalStep = startX < endX ? 1 : -1
    setPathCell(
      grid,
      context.path,
      startX,
      endY,
      topToBottom ? (startX < endX ? "╰" : "╯") : startX < endX ? "╭" : "╮",
      lineStyle,
    )
    for (let x = startX + horizontalStep; x !== endX; x += horizontalStep) {
      setPathCell(grid, context.path, x, endY, "─", lineStyle)
    }
  }

  const targetChar = targetIsChoice
    ? startX === endX
      ? "│"
      : topToBottom
        ? "┬"
        : "┴"
    : diagramArrowHead(topToBottom ? "down" : "up", arrowHeadStyle)
  setPathCell(grid, context.path, endX, endY, targetChar, lineStyle)
  if (targetIsChoice) addPathPoint(context.path, to.left, to.top)
  if (label) {
    const text = splitLines(label)[0] ?? ""
    if (topToBottom) {
      const labelX = hasReverse || endX < startX ? startX - visualLength(text) - 2 : startX + 2
      setText(grid, labelX, Math.min(startY + 1, endY), text, transitionLabelStyle(context.active))
    } else {
      const labelX =
        Math.min(startX, endX) + Math.max(1, Math.floor((Math.abs(endX - startX) - visualLength(text)) / 2))
      setText(
        grid,
        startX === endX ? startX + 3 : labelX,
        Math.max(0, startY),
        text,
        transitionLabelStyle(context.active),
      )
    }
  }
}

function drawVertical(
  grid: StateGrid,
  from: BoxBounds,
  to: BoxBounds,
  label: string,
  arrowHeadStyle: StateDiagramArrowHeadStyle,
  targetIsChoice: boolean,
  context: TransitionDrawContext,
): void {
  const lineStyle = transitionLineStyle(context.active)
  const topToBottom = from.centerY <= to.centerY
  const x = from.centerX
  const startY = topToBottom ? from.top + from.height : from.top - 1
  const endY = topToBottom ? to.top - 1 : to.top + to.height
  const step = topToBottom ? 1 : -1
  const startDistance = from.width <= 1 || from.height <= 1 ? 0 : 1

  if (topToBottom) {
    drawBottomDeparture(grid, from, x, context)
  } else {
    drawTopDeparture(grid, from, x, context)
  }

  if (startY !== endY) drawVerticalRamp(grid, x, startY, endY - step, step, startDistance, context)
  setPathCell(
    grid,
    context.path,
    x,
    endY,
    targetIsChoice ? "│" : diagramArrowHead(topToBottom ? "down" : "up", arrowHeadStyle),
    lineStyle,
  )
  if (targetIsChoice) addPathPoint(context.path, to.left, to.top)
  if (label)
    setText(grid, x + 2, Math.min(startY, endY) + 1, splitLines(label)[0] ?? "", transitionLabelStyle(context.active))
}

function connectionDirection(from: BoxBounds, to: BoxBounds): DiagramDirection {
  const deltaX = to.centerX - from.centerX
  const deltaY = to.centerY - from.centerY
  if (Math.abs(deltaX) >= Math.abs(deltaY) && deltaX !== 0) return deltaX > 0 ? "right" : "left"
  if (deltaY !== 0) return deltaY > 0 ? "down" : "up"
  return "right"
}

function drawChoiceJunctions(
  grid: StateGrid,
  diagram: StateDiagram,
  bounds: Map<string, BoxBounds>,
  activeState: string | undefined,
  activeTransitions: readonly StateDiagramActiveTransition[],
): void {
  for (const state of diagram.states) {
    if (state.kind !== "choice") continue
    const choiceBounds = bounds.get(state.id)
    if (!choiceBounds) continue

    const connections = new Set<DiagramDirection>()
    let active = false
    for (const transition of diagram.transitions) {
      if (transition.to === state.id) {
        const sourceBounds = bounds.get(transition.from)
        if (sourceBounds) connections.add(connectionDirection(choiceBounds, sourceBounds))
        active = active || isActiveTransition(transition, activeTransitions)
      }
      if (transition.from === state.id) {
        const targetBounds = bounds.get(transition.to)
        if (targetBounds) {
          const feedback =
            (diagram.direction === "LR" || diagram.direction === "RL") && targetBounds.centerX < choiceBounds.centerX
          connections.add(feedback ? "down" : connectionDirection(choiceBounds, targetBounds))
        }
        active = active || isActiveTransition(transition, activeTransitions)
      }
    }

    setCell(
      grid,
      choiceBounds.left,
      choiceBounds.top,
      diagramLineGlyph(connections, "rounded"),
      state.id === activeState ? "activeState" : active ? "activeTransition" : "choice",
    )
  }
}

function drawHiddenCompositeMarkerJunctions(
  grid: StateGrid,
  diagram: StateDiagram,
  bounds: Map<string, BoxBounds>,
  activeState: string | undefined,
  activeTransitions: readonly StateDiagramActiveTransition[],
): void {
  for (const state of diagram.states) {
    if (!isHiddenCompositeMarker(state)) continue
    const markerBounds = bounds.get(state.id)
    if (!markerBounds) continue

    const connections = new Set<DiagramDirection>()
    let active = false
    for (const transition of diagram.transitions) {
      if (transition.to === state.id) {
        const sourceBounds = bounds.get(transition.from)
        if (sourceBounds) connections.add(connectionDirection(markerBounds, sourceBounds))
        active = active || isActiveTransition(transition, activeTransitions)
      }
      if (transition.from === state.id) {
        const targetBounds = bounds.get(transition.to)
        if (targetBounds) connections.add(connectionDirection(markerBounds, targetBounds))
        active = active || isActiveTransition(transition, activeTransitions)
      }
    }

    setCell(
      grid,
      markerBounds.left,
      markerBounds.top,
      diagramLineGlyph(connections, "rounded"),
      state.id === activeState ? "activeState" : active ? "activeTransition" : "transition",
    )
  }
}

function isActiveTransitionPulseTargetStyle(style: StateCellStyle | undefined): boolean {
  return isStateActiveTransitionStyle(style) || stateActiveTransitionPulseStyleLevel(style) > 0
}

function setActiveTransitionPulseCell(
  grid: StateGrid,
  x: number,
  y: number,
  distance: number,
  radius: number,
  edgeDistance: number,
): void {
  setTransitionPulseCell(grid, x, y, distance, radius, edgeDistance, isActiveTransitionPulseTargetStyle)
}

function isTransitionFrontierStyle(style: StateCellStyle | undefined): boolean {
  return isTransitionDrawingStyle(style) || stateActiveTransitionPulseStyleLevel(style) > 0
}

function setTransitionPulseCell(
  grid: StateGrid,
  x: number,
  y: number,
  distance: number,
  radius: number,
  edgeDistance: number,
  canStyle: (style: StateCellStyle | undefined) => boolean,
): void {
  setDiagramPulseCell(grid, x, y, distance, radius, edgeDistance, STATE_ACTIVE_TRANSITION_PULSE_STYLES, canStyle)
}

function setTransitionFrontierCell(
  grid: StateGrid,
  x: number,
  y: number,
  distance: number,
  radius: number,
  edgeDistance: number,
): void {
  setTransitionPulseCell(grid, x, y, distance, radius, edgeDistance, isTransitionFrontierStyle)
}

function activeTransitionPathLength(paths: readonly StatePathPoint[][]): number {
  return paths.reduce((total, path) => total + path.length, 0)
}

function activeTransitionPathPointAt(paths: readonly StatePathPoint[][], index: number): StatePathPoint | undefined {
  let offset = index
  for (const path of paths) {
    if (offset < path.length) return path[offset]
    offset -= path.length
  }
  return undefined
}

function drawActiveTransitionPulseOnPaths(
  grid: StateGrid,
  paths: readonly StatePathPoint[][],
  pulseFrame: number | undefined,
  pulseProgress: number | undefined,
  pulseLength: number,
  pulseGap: number,
): void {
  const pathLength = activeTransitionPathLength(paths)
  if (pathLength === 0 || (pulseFrame === undefined && pulseProgress === undefined)) return

  visitDiagramPulsePath({
    pathLength,
    pointAt: (index) => activeTransitionPathPointAt(paths, index),
    pulseFrame,
    pulseProgress,
    pulseLength,
    pulseGap,
    visit: ([x, y], distance, radius, edgeDistance) =>
      setActiveTransitionPulseCell(grid, x, y, distance, radius, edgeDistance),
  })
}

function applyActiveTransitionPulse(
  grid: StateGrid,
  pulseFrame: number | undefined,
  pulseProgress: number | undefined,
  pulseLength: number,
  pulseGap: number,
  activeTransitionPaths: readonly StatePathPoint[][],
): void {
  if (pulseFrame === undefined && pulseProgress === undefined) return

  drawActiveTransitionPulseOnPaths(grid, activeTransitionPaths, pulseFrame, pulseProgress, pulseLength, pulseGap)
}

function setInactiveTransitionCell(grid: StateGrid, x: number, y: number): void {
  const cell = grid.getCell(x, y)
  if (!cell || !isStateActiveTransitionStyle(cell.style)) return
  cell.style = stateInactiveTransitionStyle(cell.style)
}

function applyActiveTransitionMask(
  grid: StateGrid,
  activeTransitionPaths: readonly StatePathPoint[][],
  progress: number | undefined,
  mode: StateDiagramActiveTransitionMode,
): void {
  if (progress === undefined) return

  const pathLength = activeTransitionPathLength(activeTransitionPaths)
  if (pathLength === 0) return

  const cutoff = Math.round(progress * pathLength)
  for (let index = 0; index < pathLength; index++) {
    const inactive = mode === "reveal" ? index >= cutoff : index < cutoff
    if (!inactive) continue
    const point = activeTransitionPathPointAt(activeTransitionPaths, index)
    if (!point) continue
    const [x, y] = point
    setInactiveTransitionCell(grid, x, y)
  }

  const before = mode === "reveal" ? ACTIVE_TRANSITION_FRONTIER_ACTIVE_SIDE : ACTIVE_TRANSITION_FRONTIER_INACTIVE_SIDE
  const after = mode === "reveal" ? ACTIVE_TRANSITION_FRONTIER_INACTIVE_SIDE : ACTIVE_TRANSITION_FRONTIER_ACTIVE_SIDE
  const radius = Math.max(before, after)
  for (let offset = -before; offset <= after; offset++) {
    const pathIndex = cutoff + offset
    if (pathIndex < 0 || pathIndex >= pathLength) continue
    const point = activeTransitionPathPointAt(activeTransitionPaths, pathIndex)
    if (!point) continue
    const [x, y] = point
    const edgeDistance = Math.min(pathIndex, pathLength - 1 - pathIndex)
    setTransitionFrontierCell(grid, x, y, Math.abs(offset), radius, edgeDistance)
  }
}

function transitionFadeSource(
  statesById: Map<string, StateDiagramState>,
  transition: StateDiagramTransition,
  activeState: string | undefined,
): FadeSourceStyle {
  if (transition.from === activeState) return "activeState"
  const source = statesById.get(transition.from)
  if (isHiddenCompositeMarker(source)) return "composite"
  if (source?.kind === "start") return "start"
  if (source?.kind === "end") return "end"
  if (source?.kind === "choice") return "choice"
  return "state"
}

function layoutStateDiagram(content: string, options: StateDiagramRenderOptions = {}): StateGrid {
  const parsedDiagram = parseMermaidStateDiagram(content)
  parsedDiagram.direction = options.direction ?? parsedDiagram.direction
  const diagram = createRenderDiagram(parsedDiagram)
  const borderStyle = options.borderStyle ?? DEFAULT_BORDER_STYLE
  const arrowHeadStyle = options.arrowHeadStyle ?? DEFAULT_ARROW_HEAD_STYLE
  const minStateGap = Math.max(1, Math.floor(options.minStateGap ?? DEFAULT_MIN_STATE_GAP))
  const pulseFrame = normalizePulseFrame(options.pulseFrame)
  const pulseProgress = normalizePulseProgress(options.pulseProgress)
  const pulseLength = normalizePulseLength(options.pulseLength)
  const pulseGap = normalizePulseGap(options.pulseGap)
  const activeTransitionProgress = normalizePulseProgress(options.activeTransitionProgress)
  const activeTransitionMode = normalizeActiveTransitionMode(options.activeTransitionMode)
  const activeTransitions = normalizeActiveTransitions(options.activeTransition)
  const { bounds, sizes, compositeBounds, noteBounds } = createStateDiagramLayout(diagram, { minStateGap })
  const statesById = new Map(diagram.states.map((state) => [state.id, state]))
  let allBounds = [...bounds.values(), ...noteBounds]
  let maxY = Math.max(0, ...allBounds.map((bound) => bound.top + bound.height))
  const feedbackLaneY = maxY + 3
  expandCompositeBoundsForFeedback(diagram, bounds, compositeBounds, feedbackLaneY)
  allBounds = [...bounds.values(), ...noteBounds]
  const maxX = Math.max(0, ...allBounds.map((bound) => bound.left + bound.width))
  maxY = Math.max(0, ...allBounds.map((bound) => bound.top + bound.height))
  const grid = makeGrid(maxX + 24, maxY + 8)
  const activeTransitionPaths: StatePathPoint[][] = []

  for (const composite of diagram.composites) {
    const bound = compositeBounds.get(composite.id)
    if (!bound) continue
    drawContainerFrame(
      grid,
      bound,
      composite.label,
      BorderChars[borderStyle],
      options.activeState === composite.id ? "activeState" : "composite",
    )
  }

  for (const state of diagram.states) {
    const bound = bounds.get(state.id)
    const size = sizes.get(state.id)
    if (!bound || !size) continue
    drawBox(grid, state, bound, size.lines, options.activeState === state.id, borderStyle)
  }

  for (const transition of diagram.transitions) {
    const from = bounds.get(transition.from)
    const to = bounds.get(transition.to)
    if (!from || !to) continue
    const fadeSource = transitionFadeSource(statesById, transition, options.activeState)
    const activeIndex = activeTransitionIndex(transition, activeTransitions)
    const active = activeIndex !== -1
    const fadeFromSource = activeIndex <= 0
    const targetState = statesById.get(transition.to)
    const targetIsChoice = targetState?.kind === "choice" || isHiddenCompositeMarker(targetState)
    const activePath: StatePathPoint[] | undefined = active ? [] : undefined
    const drawContext: TransitionDrawContext = {
      fadeSource,
      active,
      fadeFromSource,
      path: activePath,
      sourceStateId: transition.from,
    }
    if (diagram.direction === "LR" || diagram.direction === "RL")
      drawHorizontal(grid, from, to, transition.label, transition, diagram, feedbackLaneY, arrowHeadStyle, drawContext)
    else drawVertical(grid, from, to, transition.label, arrowHeadStyle, targetIsChoice, drawContext)

    if (activePath?.length) activeTransitionPaths[activeIndex] = activePath
  }

  drawChoiceJunctions(grid, diagram, bounds, options.activeState, activeTransitions)
  drawHiddenCompositeMarkerJunctions(grid, diagram, bounds, options.activeState, activeTransitions)
  applyActiveTransitionMask(grid, activeTransitionPaths, activeTransitionProgress, activeTransitionMode)
  applyActiveTransitionPulse(grid, pulseFrame, pulseProgress, pulseLength, pulseGap, activeTransitionPaths)

  for (const noteBound of noteBounds) {
    const target = bounds.get(noteBound.note.target)
    if (target) drawNote(grid, noteBound, target)
  }

  return grid
}

function renderGridText(grid: StateGrid): string {
  return grid.toString({ trimBottom: true })
}

function renderGridStyledText(
  grid: StateGrid,
  colors: StateStyleColors,
  stateColors?: ReadonlyMap<string, RGBA>,
  stateBgColors?: ReadonlyMap<string, RGBA>,
): StyledText {
  const useStateRuns = Boolean(stateColors?.size || stateBgColors?.size)
  const runOptions: DiagramCanvasRunOptions<StateCellStyle, StateCellMetadata> | undefined = useStateRuns
    ? { key: (cell) => [cell.style, cell.stateId, cell.bgStateId] }
    : undefined

  return renderDiagramGridStyledText(
    grid,
    (run) => stateStyleColor(run.style, colors, stateColors, useStateRuns ? run.cell.stateId : undefined),
    (run) => stateStyleBgColor(stateBgColors, useStateRuns ? run.cell.bgStateId : undefined),
    runOptions,
  )
}

function renderGridAnsi(grid: StateGrid, theme: StateDiagramAnsiTheme = {}): string {
  const resolved = resolveStateAnsiTheme(theme)
  return renderDiagramGridAnsi(grid, (run) => (run.style ? resolved[run.style] : undefined), { trimBottom: true })
}

export function renderStateDiagram(content: string, options: StateDiagramRenderOptions = {}): string {
  return renderGridText(layoutStateDiagram(content, options))
}

export function renderStateDiagramAnsi(content: string, options: StateDiagramAnsiOptions = {}): string {
  return renderGridAnsi(layoutStateDiagram(content, options), options.theme)
}

export class StateDiagramRenderable extends TextBufferRenderable {
  private _content: string
  private _direction?: StateDiagramDirection
  private _borderStyle: BorderStyle
  private _arrowHeadStyle: StateDiagramArrowHeadStyle
  private _minStateGap: number
  private _activeState?: string
  private _activeTransitions: StateDiagramActiveTransition[]
  private _activeTransitionProgress?: number
  private _activeTransitionMode: StateDiagramActiveTransitionMode
  private _stateColor?: RGBA
  private _activeStateColor?: RGBA
  private _compositeColor?: RGBA
  private _transitionColor?: RGBA
  private _activeTransitionColor?: RGBA
  private _pulseColor?: RGBA
  private _labelColor?: RGBA
  private _noteBorderColor?: RGBA
  private _noteTextColor?: RGBA
  private _noteConnectorColor?: RGBA
  private _startColor?: RGBA
  private _endColor?: RGBA
  private _choiceColor?: RGBA
  private _stateColors: Map<string, RGBA>
  private _stateBgColors: Map<string, RGBA>
  private _pulseFrame?: number
  private _pulseProgress?: number
  private _pulseLength: number
  private _pulseGap: number
  private _batchDepth = 0
  private _needsUpdate = false

  constructor(ctx: RenderContext, options: StateDiagramOptions = {}) {
    super(ctx, { ...options, wrapMode: options.wrapMode ?? "none" })
    this._content = options.content ?? ""
    this._direction = options.direction
    this._borderStyle = options.borderStyle ?? DEFAULT_BORDER_STYLE
    this._arrowHeadStyle = options.arrowHeadStyle ?? DEFAULT_ARROW_HEAD_STYLE
    this._minStateGap = options.minStateGap ?? DEFAULT_MIN_STATE_GAP
    this._activeState = options.activeState
    this._activeTransitions = normalizeActiveTransitions(options.activeTransition)
    this._activeTransitionProgress = normalizePulseProgress(options.activeTransitionProgress)
    this._activeTransitionMode = normalizeActiveTransitionMode(options.activeTransitionMode)
    this._stateColor = parseDiagramRenderableColor(options.stateColor)
    this._activeStateColor = parseDiagramRenderableColor(options.activeStateColor)
    this._compositeColor = parseDiagramRenderableColor(options.compositeColor)
    this._transitionColor = parseDiagramRenderableColor(options.transitionColor)
    this._activeTransitionColor = parseDiagramRenderableColor(options.activeTransitionColor)
    this._pulseColor = parseDiagramRenderableColor(options.pulseColor)
    this._labelColor = parseDiagramRenderableColor(options.labelColor)
    this._noteBorderColor = parseDiagramRenderableColor(options.noteBorderColor)
    this._noteTextColor = parseDiagramRenderableColor(options.noteTextColor)
    this._noteConnectorColor = parseDiagramRenderableColor(options.noteConnectorColor)
    this._startColor = parseDiagramRenderableColor(options.startColor)
    this._endColor = parseDiagramRenderableColor(options.endColor)
    this._choiceColor = parseDiagramRenderableColor(options.choiceColor)
    this._stateColors = normalizeDiagramColorMap(options.stateColors)
    this._stateBgColors = normalizeDiagramColorMap(options.stateBgColors)
    this._pulseFrame = normalizePulseFrame(options.pulseFrame)
    this._pulseProgress = normalizePulseProgress(options.pulseProgress)
    this._pulseLength = normalizePulseLength(options.pulseLength)
    this._pulseGap = normalizePulseGap(options.pulseGap)
    this.updateDiagram()
  }

  get content(): string {
    return this._content
  }

  set content(value: string) {
    if (this._content === value) return
    this._content = value
    this.invalidateDiagram()
  }

  get activeState(): string | undefined {
    return this._activeState
  }

  set activeState(value: string | undefined) {
    if (this._activeState === value) return
    this._activeState = value
    this.invalidateDiagram()
  }

  get direction(): StateDiagramDirection | undefined {
    return this._direction
  }

  set direction(value: StateDiagramDirection | undefined) {
    if (this._direction === value) return
    this._direction = value
    this.invalidateDiagram()
  }

  get borderStyle(): BorderStyle {
    return this._borderStyle
  }

  set borderStyle(value: BorderStyle | undefined) {
    const next = value ?? DEFAULT_BORDER_STYLE
    if (this._borderStyle === next) return
    this._borderStyle = next
    this.invalidateDiagram()
  }

  get minStateGap(): number {
    return this._minStateGap
  }

  set minStateGap(value: number | undefined) {
    const next = value ?? DEFAULT_MIN_STATE_GAP
    if (this._minStateGap === next) return
    this._minStateGap = next
    this.invalidateDiagram()
  }

  get activeTransition(): StateDiagramActiveTransitionSelection | undefined {
    if (this._activeTransitions.length === 0) return undefined
    if (this._activeTransitions.length === 1) return this._activeTransitions[0]
    return [...this._activeTransitions]
  }

  set activeTransition(value: StateDiagramActiveTransitionSelection | undefined) {
    const next = normalizeActiveTransitions(value)
    if (activeTransitionListsEqual(this._activeTransitions, next)) return
    this._activeTransitions = next
    this.invalidateDiagram()
  }

  get activeTransitionProgress(): number | undefined {
    return this._activeTransitionProgress
  }

  set activeTransitionProgress(value: number | undefined) {
    const next = normalizePulseProgress(value)
    if (this._activeTransitionProgress === next) return
    this._activeTransitionProgress = next
    this.invalidateDiagram()
  }

  get activeTransitionMode(): StateDiagramActiveTransitionMode {
    return this._activeTransitionMode
  }

  set activeTransitionMode(value: StateDiagramActiveTransitionMode | undefined) {
    const next = normalizeActiveTransitionMode(value)
    if (this._activeTransitionMode === next) return
    this._activeTransitionMode = next
    this.invalidateDiagram()
  }

  get arrowHeadStyle(): StateDiagramArrowHeadStyle {
    return this._arrowHeadStyle
  }

  set arrowHeadStyle(value: StateDiagramArrowHeadStyle | undefined) {
    const next = value ?? DEFAULT_ARROW_HEAD_STYLE
    if (this._arrowHeadStyle === next) return
    this._arrowHeadStyle = next
    this.invalidateDiagram()
  }

  private setColor(
    current: RGBA | undefined,
    value: ColorInput | undefined,
    assign: (color: RGBA | undefined) => void,
  ): void {
    setDiagramRenderableColor(current, value, assign, () => this.invalidateDiagram())
  }

  set stateColor(value: ColorInput | undefined) {
    this.setColor(this._stateColor, value, (color) => (this._stateColor = color))
  }

  set activeStateColor(value: ColorInput | undefined) {
    this.setColor(this._activeStateColor, value, (color) => (this._activeStateColor = color))
  }

  set compositeColor(value: ColorInput | undefined) {
    this.setColor(this._compositeColor, value, (color) => (this._compositeColor = color))
  }

  set transitionColor(value: ColorInput | undefined) {
    this.setColor(this._transitionColor, value, (color) => (this._transitionColor = color))
  }

  set activeTransitionColor(value: ColorInput | undefined) {
    this.setColor(this._activeTransitionColor, value, (color) => (this._activeTransitionColor = color))
  }

  set pulseColor(value: ColorInput | undefined) {
    this.setColor(this._pulseColor, value, (color) => (this._pulseColor = color))
  }

  set labelColor(value: ColorInput | undefined) {
    this.setColor(this._labelColor, value, (color) => (this._labelColor = color))
  }

  set noteBorderColor(value: ColorInput | undefined) {
    this.setColor(this._noteBorderColor, value, (color) => (this._noteBorderColor = color))
  }

  set noteTextColor(value: ColorInput | undefined) {
    this.setColor(this._noteTextColor, value, (color) => (this._noteTextColor = color))
  }

  set noteConnectorColor(value: ColorInput | undefined) {
    this.setColor(this._noteConnectorColor, value, (color) => (this._noteConnectorColor = color))
  }

  set startColor(value: ColorInput | undefined) {
    this.setColor(this._startColor, value, (color) => (this._startColor = color))
  }

  set endColor(value: ColorInput | undefined) {
    this.setColor(this._endColor, value, (color) => (this._endColor = color))
  }

  set choiceColor(value: ColorInput | undefined) {
    this.setColor(this._choiceColor, value, (color) => (this._choiceColor = color))
  }

  set stateColors(value: StateDiagramStateColors | undefined) {
    const next = normalizeDiagramColorMap(value)
    if (diagramColorMapsEqual(this._stateColors, next)) return
    this._stateColors = next
    this.invalidateDiagram()
  }

  set stateBgColors(value: StateDiagramStateColors | undefined) {
    const next = normalizeDiagramColorMap(value)
    if (diagramColorMapsEqual(this._stateBgColors, next)) return
    this._stateBgColors = next
    this.invalidateDiagram()
  }

  get pulseFrame(): number | undefined {
    return this._pulseFrame
  }

  set pulseFrame(value: number | undefined) {
    const next = normalizePulseFrame(value)
    if (this._pulseFrame === next) return
    this._pulseFrame = next
    this.invalidateDiagram()
  }

  get pulseProgress(): number | undefined {
    return this._pulseProgress
  }

  set pulseProgress(value: number | undefined) {
    const next = normalizePulseProgress(value)
    if (this._pulseProgress === next) return
    this._pulseProgress = next
    this.invalidateDiagram()
  }

  get pulseLength(): number {
    return this._pulseLength
  }

  set pulseLength(value: number | undefined) {
    const next = normalizePulseLength(value)
    if (this._pulseLength === next) return
    this._pulseLength = next
    this.invalidateDiagram()
  }

  get pulseGap(): number {
    return this._pulseGap
  }

  set pulseGap(value: number | undefined) {
    const next = normalizePulseGap(value)
    if (this._pulseGap === next) return
    this._pulseGap = next
    this.invalidateDiagram()
  }

  batchUpdate(update: () => void): void {
    this._batchDepth += 1
    try {
      update()
    } finally {
      this._batchDepth -= 1
      if (this._batchDepth === 0 && this._needsUpdate) {
        this._needsUpdate = false
        this.updateDiagram()
      }
    }
  }

  private invalidateDiagram(): void {
    if (this._batchDepth > 0) {
      this._needsUpdate = true
      return
    }
    this.updateDiagram()
  }

  private updateDiagram(): void {
    const grid = layoutStateDiagram(this._content, {
      direction: this._direction,
      borderStyle: this._borderStyle,
      arrowHeadStyle: this._arrowHeadStyle,
      minStateGap: this._minStateGap,
      activeState: this._activeState,
      activeTransition: this._activeTransitions,
      activeTransitionProgress: this._activeTransitionProgress,
      activeTransitionMode: this._activeTransitionMode,
      pulseFrame: this._pulseFrame,
      pulseProgress: this._pulseProgress,
      pulseLength: this._pulseLength,
      pulseGap: this._pulseGap,
    })
    this.textBuffer.setStyledText(
      renderGridStyledText(
        grid,
        resolveStateStyleColors({
          state: this._stateColor,
          activeState: this._activeStateColor,
          composite: this._compositeColor,
          transition: this._transitionColor,
          activeTransition: this._activeTransitionColor,
          activeTransitionPulse: this._pulseColor,
          label: this._labelColor,
          noteBorder: this._noteBorderColor,
          noteText: this._noteTextColor,
          noteConnector: this._noteConnectorColor,
          start: this._startColor,
          end: this._endColor,
          choice: this._choiceColor,
        }),
        this._stateColors,
        this._stateBgColors,
      ),
    )
    this.updateTextInfo()
    this.requestRender()
  }
}
