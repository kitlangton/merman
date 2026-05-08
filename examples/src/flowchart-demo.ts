import { type CliRenderer, createCliRenderer, type KeyEvent, parseColor, RGBA } from "@opentui/core"
import { Flowchart } from "@kitlangton/merman"
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

export const SKETCH_FLOWCHART = `flowchart LR
  Brief([Sketch Brief]) --> Parse[Parse Mermaid]
  subgraph Plan [Diagram Plan]
    Parse --> Layout[Rank Layout]
    Parse --> Cache[(Diagram Cache)]
  end
  Layout --> Preview([Terminal Preview])
  Cache --> Preview`

export const CHECKOUT_FLOWCHART = `flowchart TD
  Cart([Cart]) --> Address[Address]
  Address --> Payment[Payment]
  Payment -->|approved| Orders[(Orders DB)]
  Payment -->|declined| Retry([Retry])
  Retry --> Payment
  Orders --> Receipt([Receipt])`

export const SUPPORT_FLOWCHART = `graph LR
  Ticket([Ticket]) --> Triage[Auto Triage]
  Triage -->|billing| Billing[Billing Queue]
  Triage -->|bug| Bugs[(Bug Tracker)]
  Triage -->|question| Docs[Docs Reply]
  Billing --> Done([Closed])
  Bugs --> Done
  Docs --> Done`

export const RELEASE_FLOWCHART = `flowchart LR
  Spec([Spec]) --> Plan[Plan]
  subgraph BuildPlan [Build Plan]
    Plan --> Build[Build]
    Build --> Gate{Ready?}
  end
  Gate -->|pass| Stage[(Stage)]
  subgraph ReleasePath [Release Path]
    Stage --> Done([Done])
    Notes --> Done
  end
  Gate -->|notes| Notes([Notes])`

export const HEY_JUDE_FLOWCHART = `flowchart TD
  Title[hey Jude] --> Dont

  subgraph Verse [don't]
    direction LR
    Dont[don't]
    Bad[make it bad]
    SadSong[take a sad song<br/>and make it better]
    Afraid[be afraid]
    GetHer[you were made<br/>to go out and get her]
    Down[let me down]
    GetHerNow[you have found her,<br/>now go and get her]
    Dont --> Bad
    Bad --> SadSong
    Dont --> Afraid
    Afraid --> GetHer
    Dont --> Down
    Down --> GetHerNow
  end

  SadSong --> Remember
  GetHer --> Remember
  GetHerNow --> Remember

  subgraph Remembering [remember to]
    direction LR
    Remember[remember to]
    Heart[let her into your heart]
    Skin[let her under your skin]
    Remember --> Heart
    Remember --> Skin
  end

  Heart --> ThenYou
  Skin --> ThenYou

  subgraph Bridge [then you]
    direction LR
    ThenYou[then you]
    Start[can start]
    Begin[begin]
    MakeBetter[to make it better]
    ThenYou --> Start
    ThenYou --> Begin
    Start --> MakeBetter
    Begin --> MakeBetter
  end

  MakeBetter --> Better[better better better better waaaaaa]
  Better --> Na[na]
  Na --> Na
  Na --> Title`

interface FlowchartExample {
  title: string
  content: string
}

interface FlowchartTheme {
  name: string
  background: string
  foreground: string
  footer: string
  node: string
  activeNode: string
  database: string
  edge: string
  activeEdge: string
  pulse: string
  label: string
  group: string
}

interface ParsedFlowchartTheme {
  background: RGBA
  foreground: RGBA
  footer: RGBA
  node: RGBA
  activeNode: RGBA
  database: RGBA
  edge: RGBA
  activeEdge: RGBA
  pulse: RGBA
  label: RGBA
  group: RGBA
}

const EXAMPLES: FlowchartExample[] = [
  { title: "Sketch Pipeline", content: SKETCH_FLOWCHART },
  { title: "Checkout", content: CHECKOUT_FLOWCHART },
  { title: "Support Routing", content: SUPPORT_FLOWCHART },
  { title: "Release Gate", content: RELEASE_FLOWCHART },
  { title: "Hey Jude", content: HEY_JUDE_FLOWCHART },
]

const THEMES: FlowchartTheme[] = [
  {
    name: "Moss Copper",
    background: "#101815",
    foreground: "#D7E5DD",
    footer: "#8DA99B",
    node: "#E4EFE8",
    activeNode: "#FFD3A0",
    database: "#E4EFE8",
    edge: "#86E1C8",
    activeEdge: "#E6B17E",
    pulse: "#FFF3D7",
    label: "#86E1C8",
    group: "#5D766B",
  },
  {
    name: "Glacier",
    background: "#111827",
    foreground: "#D6DEE9",
    footer: "#94A3B8",
    node: "#E7EDF5",
    activeNode: "#FFE38A",
    database: "#E7EDF5",
    edge: "#7DD3FC",
    activeEdge: "#FCD34D",
    pulse: "#FFF7CC",
    label: "#BAE6FD",
    group: "#64748B",
  },
  {
    name: "Ink Peach",
    background: "#111422",
    foreground: "#D8DEEE",
    footer: "#9AA6C1",
    node: "#E8ECF8",
    activeNode: "#FFD0A3",
    database: "#E8ECF8",
    edge: "#93C5FD",
    activeEdge: "#FDBA74",
    pulse: "#FFE7D0",
    label: "#C4B5FD",
    group: "#68738F",
  },
]

let diagram: Flowchart.Renderable | undefined
let shell: DemoShell | undefined
let exampleIndex = 0
let themeIndex = 0
let activeRenderer: CliRenderer | undefined
let keyHandler: ((key: KeyEvent) => void) | undefined
let animationTimer: ReturnType<typeof setInterval> | undefined
let lastPulseStepAt = 0
let currentThemeColors: ParsedFlowchartTheme | undefined
let themeTransition: { from: ParsedFlowchartTheme; to: ParsedFlowchartTheme; startedAt: number } | undefined
let followTransition: { edge: Flowchart.ActiveEdgeSelection; startedAt: number } | undefined
let edgeReleaseTransition: { startedAt: number } | undefined
let previousActiveNode: string | undefined
let activeNodeFlashPending = false
let activeNodeTransitionStartedAt = 0
const parsedThemeCache = new WeakMap<FlowchartTheme, ParsedFlowchartTheme>()
const THEME_TRANSITION_MS = 260
const EDGE_FADE_MS = 260
const FOLLOW_TRANSITION_MS = 620
const NODE_COLOR_FADE_MS = 840
const ANIMATION_INTERVAL_MS = 16
const PULSE_STEP_MS = 60
const DEMO_PULSE_LENGTH = 9
const DEMO_PULSE_GAP = 22

function cancelEdgeTransitions(): void {
  followTransition = undefined
  edgeReleaseTransition = undefined
}

function resetAnimationState(): void {
  cancelEdgeTransitions()
  previousActiveNode = undefined
  activeNodeFlashPending = false
  activeNodeTransitionStartedAt = 0
}

function parsedTheme(theme: FlowchartTheme): ParsedFlowchartTheme {
  const cached = parsedThemeCache.get(theme)
  if (cached) return cached

  const parsed = {
    background: parseColor(theme.background),
    foreground: parseColor(theme.foreground),
    footer: parseColor(theme.footer),
    node: parseColor(theme.node),
    activeNode: parseColor(theme.activeNode),
    database: parseColor(theme.database),
    edge: parseColor(theme.edge),
    activeEdge: parseColor(theme.activeEdge),
    pulse: parseColor(theme.pulse),
    label: parseColor(theme.label),
    group: parseColor(theme.group),
  }
  parsedThemeCache.set(theme, parsed)
  return parsed
}

function mixTheme(from: ParsedFlowchartTheme, to: ParsedFlowchartTheme, amount: number): ParsedFlowchartTheme {
  return {
    background: mixColor(from.background, to.background, amount),
    foreground: mixColor(from.foreground, to.foreground, amount),
    footer: mixColor(from.footer, to.footer, amount),
    node: mixColor(from.node, to.node, amount),
    activeNode: mixColor(from.activeNode, to.activeNode, amount),
    database: mixColor(from.database, to.database, amount),
    edge: mixColor(from.edge, to.edge, amount),
    activeEdge: mixColor(from.activeEdge, to.activeEdge, amount),
    pulse: mixColor(from.pulse, to.pulse, amount),
    label: mixColor(from.label, to.label, amount),
    group: mixColor(from.group, to.group, amount),
  }
}

function animatedActiveEdgeColor(colors: ParsedFlowchartTheme, now = animationNow()): RGBA {
  if (edgeReleaseTransition) {
    const releaseAmount = easeOutCubic((now - edgeReleaseTransition.startedAt) / EDGE_FADE_MS)
    return mixColor(colors.activeEdge, colors.edge, releaseAmount)
  }
  if (followTransition) return colors.activeEdge

  const fadeAmount = easeOutCubic((now - activeNodeTransitionStartedAt) / EDGE_FADE_MS)
  return mixColor(colors.edge, colors.activeEdge, fadeAmount)
}

function animatedNodeColors(colors: ParsedFlowchartTheme, now = animationNow()): Record<string, RGBA> | undefined {
  const activeNode = diagram?.activeNode
  if (followTransition && activeNode) {
    const progress = clamp01((now - followTransition.startedAt) / EDGE_FADE_MS)
    return {
      [activeNode]: mixColor(colors.activeNode, colors.node, easeOutCubic(progress)),
    }
  }
  if ((!previousActiveNode && !activeNodeFlashPending) || !activeNode) return undefined

  const progress = clamp01((now - activeNodeTransitionStartedAt) / NODE_COLOR_FADE_MS)
  if (progress >= 1) return undefined

  return diagramNodeActivationColors({
    activeId: activeNode,
    previousId: previousActiveNode,
    progress,
    activeColor: colors.activeNode,
    activeNeutralColor: colors.node,
    pulseColor: colors.pulse,
    keyForLevel: Flowchart.nodeColorKey,
  })
}

function activeNodeBackgroundColors(
  colors: ParsedFlowchartTheme,
  now = animationNow(),
): Record<string, RGBA> | undefined {
  if (followTransition) return undefined
  const activeNode = diagram?.activeNode
  if ((!previousActiveNode && !activeNodeFlashPending) || !activeNode) return undefined

  const progress = clamp01((now - activeNodeTransitionStartedAt) / NODE_COLOR_FADE_MS)
  if (progress >= 1) return undefined

  return diagramNodeBackgroundFlashColors({
    activeId: activeNode,
    progress,
    backgroundColor: colors.background,
    pulseColor: colors.pulse,
    keyForLevel: Flowchart.nodeColorKey,
  })
}

function applyAnimatedColors(now = animationNow()): void {
  if (!diagram || !currentThemeColors) return
  const nodeColors = animatedNodeColors(currentThemeColors, now)
  const nodeBgColors = activeNodeBackgroundColors(currentThemeColors, now)
  diagram.batchUpdate(() => {
    diagram!.activeEdgeColor = animatedActiveEdgeColor(currentThemeColors!, now)
    diagram!.nodeColors = nodeColors
    diagram!.nodeBgColors = nodeBgColors
  })
  if (!nodeColors && !nodeBgColors) {
    previousActiveNode = undefined
    activeNodeFlashPending = false
  }
}

function hasAnimatedColors(): boolean {
  return Boolean(followTransition || edgeReleaseTransition || previousActiveNode || activeNodeFlashPending)
}

function shellThemeFor(colors: ParsedFlowchartTheme): DemoShellTheme {
  return {
    background: colors.background,
    titleColor: colors.foreground,
    kindColor: colors.footer,
    keyColor: colors.foreground,
    labelColor: colors.footer,
  }
}

function applyThemeColors(_renderer: CliRenderer, colors: ParsedFlowchartTheme): void {
  shell?.setTheme(shellThemeFor(colors))
  if (diagram) {
    const currentDiagram = diagram
    currentDiagram.batchUpdate(() => {
      currentDiagram.fg = colors.foreground
      currentDiagram.bg = colors.background
      currentDiagram.nodeColor = colors.node
      currentDiagram.activeNodeColor = colors.activeNode
      currentDiagram.databaseColor = colors.database
      currentDiagram.edgeColor = colors.edge
      currentDiagram.activeEdgeColor = colors.activeEdge
      currentDiagram.pulseColor = colors.pulse
      currentDiagram.labelColor = colors.label
      currentDiagram.groupColor = colors.group
    })
  }
  currentThemeColors = colors
}

function ensureAnimationTimer(renderer: CliRenderer): void {
  if (animationTimer) return
  animationTimer = setInterval(() => tickAnimations(renderer), ANIMATION_INTERVAL_MS)
}

function tickPulse(now: number): void {
  if (!diagram) {
    lastPulseStepAt = now
    return
  }

  if (lastPulseStepAt === 0) lastPulseStepAt = now
  const steps = Math.floor((now - lastPulseStepAt) / PULSE_STEP_MS)
  if (steps <= 0) return

  lastPulseStepAt += steps * PULSE_STEP_MS
  diagram.pulseFrame = (diagram.pulseFrame ?? 0) + steps
}

function tickAnimations(renderer: CliRenderer): void {
  if (!diagram || diagram.isDestroyed) {
    if (animationTimer) {
      clearInterval(animationTimer)
      animationTimer = undefined
    }
    return
  }
  const now = animationNow()
  tickPulse(now)

  if (followTransition && diagram) {
    const amount = Math.min(1, (now - followTransition.startedAt) / FOLLOW_TRANSITION_MS)
    if (amount >= 1) {
      const completed = followTransition.edge
      diagram.batchUpdate(() => {
        diagram!.followSelectedConnection()
        diagram!.activeEdge = completed
        diagram!.activeEdgeProgress = undefined
      })
      followTransition = undefined
      edgeReleaseTransition = { startedAt: now }
      previousActiveNode = undefined
      activeNodeFlashPending = true
      activeNodeTransitionStartedAt = now
      updateFooter()
    } else {
      const edgeProgress = easeOutCubic(amount)
      diagram.batchUpdate(() => {
        diagram!.activeEdge = followTransition!.edge
        diagram!.activeEdgeProgress = edgeProgress
      })
    }
  }

  if (edgeReleaseTransition && diagram) {
    const amount = Math.min(1, (now - edgeReleaseTransition.startedAt) / EDGE_FADE_MS)
    if (amount >= 1) {
      edgeReleaseTransition = undefined
      activeNodeTransitionStartedAt = now
      diagram.activeEdge = undefined
      updateFooter()
    }
  }

  if (themeTransition) {
    const amount = Math.min(1, (now - themeTransition.startedAt) / THEME_TRANSITION_MS)
    applyThemeColors(renderer, mixTheme(themeTransition.from, themeTransition.to, amount))
    if (amount >= 1) themeTransition = undefined
  }

  if (hasAnimatedColors()) applyAnimatedColors(now)
}

function diagramSize(): { width: number; height: number } {
  return { width: diagram?.renderedWidth ?? 0, height: diagram?.renderedHeight ?? 0 }
}

function applyTheme(renderer: CliRenderer = activeRenderer!): void {
  const to = parsedTheme(THEMES[themeIndex]!)
  themeTransition = { from: currentThemeColors ?? to, to, startedAt: animationNow() }
  ensureAnimationTimer(renderer)
  updateFooter()
}

function updateHeader(): void {
  shell?.setTitle(EXAMPLES[exampleIndex]!.title)
  shell?.setStep(exampleIndex, EXAMPLES.length)
}

function updateFooter(): void {
  const entries: FooterEntry[] = [
    { keys: "Tab", label: "connection" },
    { keys: "Enter", label: diagram?.activeNode ? "follow" : "focus" },
    { keys: "←/→", label: "example" },
    { keys: "T", label: "theme" },
    { keys: "Esc", label: "back" },
  ]
  shell?.setFooterEntries(entries)
}

function updateDiagram(): void {
  if (!diagram) return
  resetAnimationState()
  diagram.content = EXAMPLES[exampleIndex]!.content
  diagram.activeEdge = undefined
  diagram.activeEdgeProgress = undefined
  diagram.nodeColors = undefined
  diagram.nodeBgColors = undefined
  shell?.recenter()
  shell?.scrollToOrigin()
  updateHeader()
  updateFooter()
}

function selectExample(nextExampleIndex: number): void {
  exampleIndex = (nextExampleIndex + EXAMPLES.length) % EXAMPLES.length
  updateDiagram()
}

export function run(renderer: CliRenderer): void {
  activeRenderer = renderer
  exampleIndex = 0
  const theme = THEMES[themeIndex]!
  currentThemeColors = parsedTheme(theme)
  const example = EXAMPLES[exampleIndex]!

  shell = new DemoShell(renderer, {
    id: "flowchart-demo",
    kind: "flowchart",
    theme: shellThemeFor(currentThemeColors),
  })

  diagram = new Flowchart.Renderable(renderer, {
    id: "flowchart-diagram",
    content: example.content,
    fg: currentThemeColors.foreground,
    bg: currentThemeColors.background,
    nodeColor: currentThemeColors.node,
    activeNodeColor: currentThemeColors.activeNode,
    databaseColor: currentThemeColors.database,
    edgeColor: currentThemeColors.edge,
    activeEdgeColor: currentThemeColors.activeEdge,
    pulseColor: currentThemeColors.pulse,
    labelColor: currentThemeColors.label,
    groupColor: currentThemeColors.group,
    pulseFrame: 0,
    pulseLength: DEMO_PULSE_LENGTH,
    pulseGap: DEMO_PULSE_GAP,
  })
  diagram.selectable = false
  lastPulseStepAt = animationNow()
  ensureAnimationTimer(renderer)
  shell.mount({ renderable: diagram, getSize: diagramSize })
  shell.focus()
  updateHeader()
  updateFooter()

  keyHandler = (key) => {
    if (key.name === "right" || key.name === "arrowright") {
      selectExample(exampleIndex + 1)
    } else if (key.name === "left" || key.name === "arrowleft") {
      selectExample(exampleIndex - 1)
    } else if (key.name === "t") {
      themeIndex = (themeIndex + 1) % THEMES.length
      applyTheme(renderer)
    } else if (key.name === "tab") {
      key.preventDefault()
      cancelEdgeTransitions()
      if (key.shift) diagram?.selectPreviousConnection()
      else diagram?.selectNextConnection()
      updateFooter()
    } else if (key.name === "return" || key.name === "enter") {
      key.preventDefault()
      if (!diagram?.activeNode) {
        diagram?.activateFirstNode()
        updateFooter()
      } else if (diagram.selectedConnection) {
        const selected = diagram.selectedConnection
        const now = animationNow()
        cancelEdgeTransitions()
        followTransition = { edge: selected, startedAt: now }
        diagram.batchUpdate(() => {
          diagram!.activeEdge = selected
          diagram!.activeEdgeProgress = 0
        })
        applyAnimatedColors(now)
        updateFooter()
        ensureAnimationTimer(renderer)
      }
    }
  }
  renderer.keyInput.on("keypress", keyHandler)

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
  lastPulseStepAt = 0
  themeTransition = undefined
  resetAnimationState()
  currentThemeColors = undefined
}

if (import.meta.main) {
  if (process.argv.includes("--print")) {
    const exampleArg = process.argv.find((arg) => arg.startsWith("--example="))
    const defaultExample = String(exampleIndex + 1)
    const index = Math.max(
      0,
      Math.min(EXAMPLES.length - 1, Number.parseInt(exampleArg?.split("=")[1] ?? defaultExample, 10) - 1),
    )
    const plain = process.argv.includes("--plain")
    const content = EXAMPLES[index]!.content
    process.stdout.write(Flowchart.render(content, { color: !plain }))
  } else {
    const renderer = await createCliRenderer({ targetFps: 30 })
    run(renderer)
  }
}
