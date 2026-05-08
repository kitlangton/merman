import { type CliRenderer, createCliRenderer, type KeyEvent, parseColor, RGBA } from "@opentui/core"
import { State } from "@kitlangton/merman"
import {
  animationNow,
  clamp01,
  diagramNodeActivationColors,
  diagramNodeBackgroundFlashColors,
  easeOutCubic,
  mixColor,
} from "./lib/diagram-animation.js"
import { type FooterEntry } from "./lib/demo-footer.js"
import { DemoShell, type DemoShellTheme } from "./lib/demo-shell.js"
import { setupCommonDemoKeys } from "./lib/standalone-keys.js"

export const REQUEST_STATE_DIAGRAM = `stateDiagram-v2
  direction LR
  [*] --> Idle
  Idle --> Loading: submit
  Loading --> Success: 200 OK
  Loading --> Error: timeout
  note right of Loading : waiting for response
  Error --> Loading: retry
  Success --> [*]`

export const AUTH_STATE_DIAGRAM = `stateDiagram-v2
  direction LR
  [*] --> Authenticated: login
  state "Authenticated Session" as Authenticated {
    [*] --> Browsing
    Browsing --> Editing: open
    Editing --> Browsing: save
    Browsing --> [*]: logout
  }
  Authenticated --> [*]
  note right of Editing : unsaved changes`

export const CHECKOUT_STATE_DIAGRAM = `stateDiagram-v2
  direction TB
  [*] --> Cart
  Cart --> Payment: checkout
  Payment --> Authorized: approved
  Payment --> Failed: declined
  Failed --> Payment: retry
  Authorized --> Fulfillment
  Fulfillment --> Complete
  Complete --> [*]`

export const EDITOR_STATE_DIAGRAM = `stateDiagram-v2
  direction LR
  state Decision <<choice>>
  [*] --> Editing
  Editing --> Editing: type
  Editing --> Validating: submit
  Validating --> Decision
  Decision --> Submitted: valid
  Decision --> Invalid: errors
  Invalid --> Editing: fix`

export const SOCKET_STATE_DIAGRAM = `stateDiagram-v2
  direction LR
  [*] --> Socket
  state "Socket Session" as Socket {
    state "Backoff<br/>Timer" as Backoff
    [*] --> Disconnected
    Disconnected --> Connecting: connect
    Connecting --> Connected: open
    Connecting --> Backoff: fail
    Connected --> Disconnected: close
    Backoff --> Connecting: timer
  }`

export const TWITTER_STATE_DIAGRAM = `stateDiagram-v2
  direction LR
  state "Focus<br/>Mode" as Focus
  [*] --> Focus
  Focus --> Vortex: one sec
  state "Scroll Vortex" as Vortex {
    [*] --> Checking
    state "Check<br/>Feed" as Checking
    state "Open<br/>Thread" as Thread
    state "Draft<br/>Take" as Draft
    state "Guilt" as Guilt
    state "Ritual" as Ritual
    Checking --> Checking: refresh
    Checking --> Thread: bait
    Thread --> Draft: reply
    Draft --> Guilt: post
    Guilt --> Ritual: promise
    Ritual --> Checking: snooze
    note right of Checking : one more refresh
    note right of Ritual : snooze wins
  }
`

interface StateDiagramExample {
  title: string
  content: string
  size?: { width: number; height: number }
}

interface SelectableTransition {
  label: string
  to: string
  path: State.ActiveTransition[]
}

function renderedSize(content: string): { width: number; height: number } {
  const lines = State.render(content, { color: false }).split("\n")
  return {
    width: Math.max(0, ...lines.map((line) => line.length)),
    height: lines.length,
  }
}

const EXAMPLES: StateDiagramExample[] = [
  { title: "Request Lifecycle", content: REQUEST_STATE_DIAGRAM },
  { title: "Authenticated Session", content: AUTH_STATE_DIAGRAM },
  { title: "Checkout", content: CHECKOUT_STATE_DIAGRAM },
  { title: "Form Submit", content: EDITOR_STATE_DIAGRAM },
  { title: "WebSocket", content: SOCKET_STATE_DIAGRAM },
  { title: "Twitter Loop", content: TWITTER_STATE_DIAGRAM },
]

interface StateDiagramTheme {
  name: string
  background: string
  foreground: string
  footer: string
  state: string
  activeState: string
  composite: string
  transition: string
  activeTransition: string
  pulse: string
  noteBorder: string
  noteText: string
  noteConnector: string
  end: string
}

interface ParsedThemeColors {
  background: RGBA
  state: RGBA
  activeState: RGBA
  transition: RGBA
  activeTransition: RGBA
  pulse: RGBA
  end: RGBA
}

const THEMES: StateDiagramTheme[] = [
  {
    name: "Moss Copper",
    background: "#101815",
    foreground: "#D7E5DD",
    footer: "#8DA99B",
    state: "#E4EFE8",
    activeState: "#FFD3A0",
    composite: "#6F8A7E",
    transition: "#86E1C8",
    activeTransition: "#E6B17E",
    pulse: "#FFF3D7",
    noteBorder: "#A9795B",
    noteText: "#F4DEC5",
    noteConnector: "#A9795B",
    end: "#E6B17E",
  },
  {
    name: "Glacier",
    background: "#111827",
    foreground: "#D6DEE9",
    footer: "#94A3B8",
    state: "#E7EDF5",
    activeState: "#FFE38A",
    composite: "#64748B",
    transition: "#7DD3FC",
    activeTransition: "#FCD34D",
    pulse: "#FFF7CC",
    noteBorder: "#94A3B8",
    noteText: "#E0F2FE",
    noteConnector: "#64748B",
    end: "#FCD34D",
  },
  {
    name: "Ink Peach",
    background: "#111422",
    foreground: "#D8DEEE",
    footer: "#9AA6C1",
    state: "#E8ECF8",
    activeState: "#FFD0A3",
    composite: "#69728B",
    transition: "#93C5FD",
    activeTransition: "#FDBA74",
    pulse: "#FFE7D0",
    noteBorder: "#C4B5FD",
    noteText: "#FFE7D0",
    noteConnector: "#A78BFA",
    end: "#FDBA74",
  },
  {
    name: "Ember Terminal",
    background: "#17120F",
    foreground: "#F3E8D8",
    footer: "#BDA38B",
    state: "#F3E8D8",
    activeState: "#FF9AAD",
    composite: "#8A7664",
    transition: "#F59E0B",
    activeTransition: "#FB7185",
    pulse: "#FFE4E6",
    noteBorder: "#B45309",
    noteText: "#FFE4E6",
    noteConnector: "#92400E",
    end: "#FB7185",
  },
]

const parsedThemeColorCache = new WeakMap<StateDiagramTheme, ParsedThemeColors>()

let diagram: State.Renderable | undefined
let shell: DemoShell | undefined
let exampleIndex = 0
let themeIndex = 0
let parsedDiagram = State.parse(EXAMPLES[exampleIndex]!.content)
let activeState: string | undefined
let previousActiveState: string | undefined
let activeTransitionIndex = 0
let activeRenderer: CliRenderer | undefined
let keyHandler: ((key: KeyEvent) => void) | undefined
let animationTimer: ReturnType<typeof setInterval> | undefined
let transitionAnimationStartedAt = 0
let stateTransitionStartedAt = 0
let pendingFollow: { transition: SelectableTransition; startedAt: number } | undefined

const EDGE_FADE_MS = 260
const EDGE_REVEAL_MS = 620
const FOLLOW_PULSE_MS = 620
const STATE_COLOR_FADE_MS = 840
const ANIMATION_INTERVAL_MS = 33

function exampleSize(example: StateDiagramExample): { width: number; height: number } {
  example.size ??= renderedSize(example.content)
  return example.size
}

function diagramSize(): { width: number; height: number } {
  return exampleSize(EXAMPLES[exampleIndex]!)
}

function centerDiagram(): void {
  shell?.recenter()
}

function shellThemeFor(theme: StateDiagramTheme): DemoShellTheme {
  return {
    background: theme.background,
    titleColor: theme.foreground,
    kindColor: theme.footer,
    keyColor: theme.foreground,
    labelColor: theme.footer,
  }
}

function applyTheme(_renderer: CliRenderer): void {
  if (!diagram) return
  const theme = THEMES[themeIndex]!
  diagram.fg = theme.foreground
  diagram.bg = theme.background
  diagram.stateColor = theme.state
  diagram.activeStateColor = theme.activeState
  diagram.compositeColor = theme.composite
  diagram.transitionColor = theme.transition
  diagram.labelColor = theme.transition
  diagram.noteBorderColor = theme.noteBorder
  diagram.noteTextColor = theme.noteText
  diagram.noteConnectorColor = theme.noteConnector
  diagram.pulseColor = theme.pulse
  diagram.startColor = theme.transition
  diagram.choiceColor = theme.transition
  diagram.endColor = theme.end

  shell?.setTheme(shellThemeFor(theme))
  updateFooter()
  applyAnimatedColors()
  centerDiagram()
}

function parsedThemeColors(theme: StateDiagramTheme): ParsedThemeColors {
  const cached = parsedThemeColorCache.get(theme)
  if (cached) return cached
  const colors = {
    background: parseColor(theme.background),
    state: parseColor(theme.state),
    activeState: parseColor(theme.activeState),
    transition: parseColor(theme.transition),
    activeTransition: parseColor(theme.activeTransition),
    pulse: parseColor(theme.pulse),
    end: parseColor(theme.end),
  }
  parsedThemeColorCache.set(theme, colors)
  return colors
}

function animatedActiveTransitionColor(theme: StateDiagramTheme, now = animationNow()): RGBA {
  const colors = parsedThemeColors(theme)
  const fadeAmount = easeOutCubic((now - transitionAnimationStartedAt) / EDGE_FADE_MS)
  const baseColor = mixColor(colors.transition, colors.activeTransition, fadeAmount)
  const pulsePhase = now / (pendingFollow ? 68 : 420)
  const pulseAmount = pendingFollow ? ((Math.sin(pulsePhase) + 1) / 2) * 0.68 : 0
  return pulseAmount > 0 ? mixColor(baseColor, colors.activeState, pulseAmount) : baseColor
}

function stateNeutralColor(colors: ParsedThemeColors, stateId: string | undefined): RGBA {
  const state = parsedDiagram.states.find((candidate) => candidate.id === stateId)
  if (state?.kind === "start" || state?.kind === "choice") return colors.transition
  if (state?.kind === "end") return colors.end
  return colors.state
}

function animatedStateColors(theme: StateDiagramTheme, now = animationNow()): Record<string, RGBA> | undefined {
  const colors = parsedThemeColors(theme)
  if (pendingFollow && activeState) {
    const progress = clamp01((now - pendingFollow.startedAt) / EDGE_FADE_MS)
    return {
      [activeState]: mixColor(colors.activeState, stateNeutralColor(colors, activeState), easeOutCubic(progress)),
    }
  }

  if (!previousActiveState || !activeState) return undefined
  const progress = clamp01((now - stateTransitionStartedAt) / STATE_COLOR_FADE_MS)
  if (progress >= 1) return undefined

  const incomingNeutral = stateNeutralColor(colors, activeState)
  const outgoingNeutral = stateNeutralColor(colors, previousActiveState)
  return diagramNodeActivationColors({
    activeId: activeState,
    previousId: previousActiveState,
    progress,
    activeColor: colors.activeState,
    activeNeutralColor: incomingNeutral,
    previousNeutralColor: outgoingNeutral,
    pulseColor: colors.pulse,
    keyForLevel: State.stateColorKey,
  })
}

function activeStateBackgroundColors(theme: StateDiagramTheme, now = animationNow()): Record<string, RGBA> | undefined {
  if (pendingFollow) return undefined
  if (!previousActiveState || !activeState) return undefined

  const colors = parsedThemeColors(theme)
  const progress = clamp01((now - stateTransitionStartedAt) / STATE_COLOR_FADE_MS)
  if (progress >= 1) return undefined

  return diagramNodeBackgroundFlashColors({
    activeId: activeState,
    progress,
    backgroundColor: colors.background,
    pulseColor: colors.pulse,
    keyForLevel: State.stateColorKey,
  })
}

function applyAnimatedColors(now = animationNow()): void {
  if (!diagram) return
  const theme = THEMES[themeIndex]!
  const edgeProgress = pendingFollow
    ? clamp01((now - pendingFollow.startedAt) / FOLLOW_PULSE_MS)
    : clamp01((now - transitionAnimationStartedAt) / EDGE_REVEAL_MS)
  diagram.activeTransitionColor = animatedActiveTransitionColor(theme, now)
  diagram.activeTransitionMode = pendingFollow ? "fade" : "reveal"
  diagram.activeTransitionProgress = edgeProgress
  const stateColors = animatedStateColors(theme, now)
  const stateBgColors = activeStateBackgroundColors(theme, now)
  diagram.stateColors = stateColors
  diagram.stateBgColors = stateBgColors
  if (!stateColors) previousActiveState = undefined
}

function restartTransitionAnimation(now = animationNow()): void {
  transitionAnimationStartedAt = now
}

function restartStateColorAnimation(from: string | undefined, to: string | undefined, now = animationNow()): void {
  previousActiveState = from ?? to
  stateTransitionStartedAt = now
}

function selectableTransitionsFrom(
  parsed: State.Diagram,
  from: string,
  visited: Set<string> = new Set(),
): SelectableTransition[] {
  if (visited.has(from)) return []
  const nextVisited = new Set(visited)
  nextVisited.add(from)
  const statesById = new Map(parsed.states.map((state) => [state.id, state]))
  const transitions = parsed.transitions.filter((transition) => transition.from === from)
  const selectables: SelectableTransition[] = []

  for (const transition of transitions) {
    const path = [{ from: transition.from, to: transition.to, label: transition.label }]
    const targetKind = statesById.get(transition.to)?.kind
    if (
      (targetKind === "choice" || targetKind === "start" || targetKind === "end") &&
      parsed.transitions.some((next) => next.from === transition.to)
    ) {
      const branches = selectableTransitionsFrom(parsed, transition.to, nextVisited)
      if (branches.length > 0) {
        for (const branch of branches) {
          selectables.push({
            label: transition.label || branch.label || "next",
            to: branch.to,
            path: [...path, ...branch.path],
          })
        }
        continue
      }
    }

    selectables.push({ label: transition.label || "next", to: transition.to, path })
  }

  return selectables
}

function selectableTransitions(parsed = parsedDiagram): SelectableTransition[] {
  if (!activeState) return []
  return selectableTransitionsFrom(parsed, activeState)
}

function selectedTransition(parsed = parsedDiagram): SelectableTransition | undefined {
  const transitions = selectableTransitions(parsed)
  if (transitions.length === 0) return undefined
  const index = ((activeTransitionIndex % transitions.length) + transitions.length) % transitions.length
  return transitions[index]
}

function selectedActiveTransition(parsed = parsedDiagram): State.ActiveTransition[] | undefined {
  const transition = selectedTransition(parsed)
  if (!transition) return undefined
  return transition.path
}

function visibleActiveTransition(parsed = parsedDiagram): State.ActiveTransition[] | undefined {
  return pendingFollow?.transition.path ?? selectedActiveTransition(parsed)
}

function resetInteraction(): void {
  const parsed = parsedDiagram
  activeState = parsed.states.find((state) => state.kind === "start")?.id ?? parsed.states[0]?.id
  previousActiveState = undefined
  activeTransitionIndex = 0
}

function updateFooter(): void {
  const entries: FooterEntry[] = [
    { keys: "Tab", label: "transition" },
    { keys: "Enter", label: "follow" },
    { keys: "←/→", label: "example" },
    { keys: "T", label: "theme" },
    { keys: "Esc", label: "back" },
  ]
  shell?.setFooterEntries(entries)
}

function updateHeader(): void {
  shell?.setTitle(EXAMPLES[exampleIndex]!.title)
  shell?.setStep(exampleIndex, EXAMPLES.length)
}

function syncInteraction(): void {
  if (!diagram) return
  const parsed = parsedDiagram
  diagram.batchUpdate(() => {
    diagram!.activeState = activeState
    diagram!.activeTransition = visibleActiveTransition(parsed)
    applyAnimatedColors()
  })
  updateFooter()
}

function updateDiagram(): void {
  if (!diagram || !activeRenderer) return
  const example = EXAMPLES[exampleIndex]!
  pendingFollow = undefined
  parsedDiagram = State.parse(example.content)
  diagram.content = example.content
  resetInteraction()
  restartTransitionAnimation()
  syncInteraction()
  applyTheme(activeRenderer)
  updateHeader()
  shell?.scrollToOrigin()
}

function cycleTransition(direction: 1 | -1): void {
  if (pendingFollow) return
  const transitions = selectableTransitions()
  if (transitions.length === 0) return
  activeTransitionIndex = (activeTransitionIndex + direction + transitions.length) % transitions.length
  restartTransitionAnimation()
  syncInteraction()
}

function followSelectedTransition(): void {
  if (pendingFollow) return
  const transition = selectedTransition()
  if (!transition) return
  const now = animationNow()
  pendingFollow = { transition, startedAt: now }
  transitionAnimationStartedAt = now - EDGE_FADE_MS
  if (diagram) diagram.pulseProgress = 0
  syncInteraction()
}

function finishPendingFollow(): void {
  if (!pendingFollow) return
  const previousState = activeState
  activeState = pendingFollow.transition.to
  pendingFollow = undefined
  if (diagram) diagram.pulseProgress = undefined
  activeTransitionIndex = 0
  restartTransitionAnimation()
  restartStateColorAnimation(previousState, activeState)
  syncInteraction()
}

function tickAnimations(): void {
  if (!diagram || diagram.isDestroyed) {
    if (animationTimer) {
      clearInterval(animationTimer)
      animationTimer = undefined
    }
    return
  }
  const now = animationNow()
  const update = () => {
    if (diagram) {
      diagram.pulseFrame = (diagram.pulseFrame ?? 0) + (pendingFollow ? 3 : 1)
      diagram.pulseProgress = pendingFollow ? clamp01((now - pendingFollow.startedAt) / FOLLOW_PULSE_MS) : undefined
    }
    if (pendingFollow && now - pendingFollow.startedAt >= FOLLOW_PULSE_MS) {
      finishPendingFollow()
      return
    }
    applyAnimatedColors(now)
  }

  if (diagram) {
    diagram.batchUpdate(update)
  } else {
    update()
  }
}

export function run(renderer: CliRenderer): void {
  activeRenderer = renderer
  exampleIndex = 0
  const theme = THEMES[themeIndex]!
  const example = EXAMPLES[exampleIndex]!
  parsedDiagram = State.parse(example.content)
  resetInteraction()
  restartTransitionAnimation()

  shell = new DemoShell(renderer, {
    id: "state-diagram",
    kind: "state",
    theme: shellThemeFor(theme),
  })

  diagram = new State.Renderable(renderer, {
    id: "state-diagram-content",
    content: example.content,
    activeState,
    activeTransition: selectedActiveTransition(),
    fg: theme.foreground,
    bg: theme.background,
    stateColor: theme.state,
    activeStateColor: theme.activeState,
    compositeColor: theme.composite,
    transitionColor: theme.transition,
    activeTransitionColor: theme.activeTransition,
    pulseColor: theme.pulse,
    pulseFrame: 0,
    pulseLength: 9,
    pulseGap: 16,
    labelColor: theme.transition,
    noteBorderColor: theme.noteBorder,
    noteTextColor: theme.noteText,
    noteConnectorColor: theme.noteConnector,
    startColor: theme.transition,
    choiceColor: theme.transition,
    endColor: theme.end,
  })
  diagram.selectable = false
  shell.mount({ renderable: diagram, getSize: diagramSize })
  shell.focus()

  applyTheme(renderer)
  syncInteraction()
  updateHeader()

  keyHandler = (key) => {
    if (key.name === "right" || key.name === "arrowright") {
      exampleIndex = (exampleIndex + 1) % EXAMPLES.length
      updateDiagram()
    } else if (key.name === "left" || key.name === "arrowleft") {
      exampleIndex = (exampleIndex - 1 + EXAMPLES.length) % EXAMPLES.length
      updateDiagram()
    } else if (key.name === "tab") {
      key.preventDefault()
      cycleTransition(key.shift ? -1 : 1)
    } else if (key.name === "return" || key.name === "linefeed" || key.name === "enter") {
      key.preventDefault()
      followSelectedTransition()
    } else if (key.name === "t") {
      themeIndex = (themeIndex + 1) % THEMES.length
      applyTheme(renderer)
    }
  }
  renderer.keyInput.on("keypress", keyHandler)

  if (animationTimer) clearInterval(animationTimer)
  animationTimer = setInterval(tickAnimations, ANIMATION_INTERVAL_MS)
  setupCommonDemoKeys(renderer)
}

export function destroy(renderer: CliRenderer): void {
  if (animationTimer) clearInterval(animationTimer)
  if (keyHandler) renderer.keyInput.off("keypress", keyHandler)
  shell?.destroy()
  diagram = undefined
  shell = undefined
  activeRenderer = undefined
  keyHandler = undefined
  animationTimer = undefined
  pendingFollow = undefined
  previousActiveState = undefined
}

if (import.meta.main) {
  if (process.argv.includes("--print")) {
    const exampleArg = process.argv.find((arg) => arg.startsWith("--example="))
    const index = Math.max(0, Math.min(EXAMPLES.length - 1, Number.parseInt(exampleArg?.split("=")[1] ?? "1", 10) - 1))
    const plain = process.argv.includes("--plain")
    const content = EXAMPLES[index]!.content
    process.stdout.write(State.render(content, { color: !plain }))
  } else {
    const renderer = await createCliRenderer({ targetFps: 30 })
    run(renderer)
  }
}
