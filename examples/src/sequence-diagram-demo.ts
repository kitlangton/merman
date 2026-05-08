import { type CliRenderer, createCliRenderer, type KeyEvent } from "@opentui/core"
import { Sequence } from "@kitlangton/merman"
import { type FooterEntry } from "./lib/demo-footer.js"
import { DemoShell, type DemoShellTheme } from "./lib/demo-shell.js"
import { setupCommonDemoKeys } from "./lib/standalone-keys.js"

export const GROUP_SEQUENCE_DIAGRAM = `sequenceDiagram
  autonumber
  participant Shopper
  box Storefront
    participant Web
    participant Cart
  end
  box Providers
    participant Payments
    participant Email
  end
  Shopper->>Web: Submit order
  Web->>Web: Validate order
  Web->>Cart: reserve inventory
  Cart-->>Web: reserved
  Note over Web,Cart: inventory is held during payment
  Web->>Payments: authorize card
  Payments-->>Web: approved
  Web->>Email: send receipt
  Web-->>Shopper: Order confirmed`

export const SELF_LOOP_SEQUENCE_DIAGRAM = `sequenceDiagram
  autonumber
  participant Browser
  box Backend
    participant API
  end
  Browser->>API: GET /me
  API->>API: Validate JWT
  API-->>Browser: 200 { user }`

export const CACHE_SEQUENCE_DIAGRAM = `sequenceDiagram
  autonumber
  participant Client
  box Backend
    participant API
    participant Cache
  end
  box Storage
    participant DB
  end
  Client->>API: GET /users/42
  API->>Cache: get user:42
  alt cache hit
    Cache-->>API: { user }
  else cache miss
    Cache-->>API: null
    API->>DB: SELECT user WHERE id=42
    DB-->>API: row
  end
  API-->>Client: 200 { user }`

export const RETRY_SEQUENCE_DIAGRAM = `sequenceDiagram
  autonumber
  participant Client
  box Backend
    participant API
    participant Jobs
  end
  Client->>API: Start export
  API-->>Client: 202 accepted
  loop poll until ready
    Client->>API: GET /exports/7
    API->>Jobs: status export:7
    Jobs-->>API: pending
    API-->>Client: 202 pending
  end
  API-->>Client: 200 download URL`

export const ARROW_TYPES_SEQUENCE_DIAGRAM = `sequenceDiagram
  autonumber
  participant Browser
  box Backend
    participant API
    participant Worker
  end
  Browser->API: open request
  API-->Browser: provisional response
  API->>Worker: start job
  Worker-->>API: accepted
  API-)Worker: enqueue event
  Worker--)API: progress event
  API-xWorker: cancel job
  Worker--xAPI: timeout`

interface SequenceDiagramExample {
  title: string
  description: string
  content: string
}

const EXAMPLES: SequenceDiagramExample[] = [
  {
    title: "Grouped Checkout",
    description: "full-height participant groups with a straight request chain",
    content: GROUP_SEQUENCE_DIAGRAM,
  },
  {
    title: "Self Check",
    description: "single participant loopback inside a backend group",
    content: SELF_LOOP_SEQUENCE_DIAGRAM,
  },
  {
    title: "Cache Branch",
    description: "alt/else branch without a surrounding loop",
    content: CACHE_SEQUENCE_DIAGRAM,
  },
  {
    title: "Retry Polling",
    description: "loop region without branching",
    content: RETRY_SEQUENCE_DIAGRAM,
  },
  {
    title: "Arrow Styles",
    description: "open, filled, async, and failure arrow heads",
    content: ARROW_TYPES_SEQUENCE_DIAGRAM,
  },
]
const DEMO_FRAGMENT_BORDER_STYLE = "double" as const

let shell: DemoShell | null = null
let diagram: Sequence.Renderable | null = null
let keyHandler: ((key: KeyEvent) => void) | null = null
let pulseTimer: ReturnType<typeof setInterval> | null = null
let themeIndex = 0
let exampleIndex = 0
let pulseFrame = 0
let cachedDiagramSize: { width: number; height: number } | undefined

interface SequenceDiagramTheme {
  name: string
  description: string
  background: string
  panelBorder: string
  title: string
  footer: string
  foreground: string
  participant: string
  lifeline: string
  group: string
  request: string
  response: string
  note: string
  noteBackground: string
}

const THEMES: SequenceDiagramTheme[] = [
  {
    name: "Moss Copper",
    description: "green requests, copper responses, dusty mauve notes",
    background: "#101815",
    panelBorder: "#2F453B",
    title: "#E4EFE8",
    footer: "#8DA99B",
    foreground: "#D7E5DD",
    participant: "#E4EFE8",
    lifeline: "#6F8A7E",
    group: "#4E6359",
    request: "#86E1C8",
    response: "#E6B17E",
    note: "#D7E5DD",
    noteBackground: "#24382F",
  },
  {
    name: "Glacier",
    description: "cool slate, soft sky, warm amber",
    background: "#111827",
    panelBorder: "#374151",
    title: "#E7EDF5",
    footer: "#94A3B8",
    foreground: "#D6DEE9",
    participant: "#E7EDF5",
    lifeline: "#64748B",
    group: "#4F5A6B",
    request: "#7DD3FC",
    response: "#FCD34D",
    note: "#D6DEE9",
    noteBackground: "#253044",
  },
  {
    name: "Ink Peach",
    description: "blue ink, peach replies, fuchsia labels",
    background: "#111422",
    panelBorder: "#30384F",
    title: "#E8ECF8",
    footer: "#9AA6C1",
    foreground: "#D8DEEE",
    participant: "#E8ECF8",
    lifeline: "#69728B",
    group: "#51586A",
    request: "#93C5FD",
    response: "#FDBA74",
    note: "#D8DEEE",
    noteBackground: "#2B3144",
  },
  {
    name: "Quiet Notebook",
    description: "low-chroma, long-session friendly",
    background: "#11151C",
    panelBorder: "#303742",
    title: "#E3E8EF",
    footer: "#8B96A5",
    foreground: "#D2DAE5",
    participant: "#E3E8EF",
    lifeline: "#606B7A",
    group: "#4B5563",
    request: "#A5D8FF",
    response: "#FFE08A",
    note: "#D2DAE5",
    noteBackground: "#252C38",
  },
]

function measureDiagram(content: string): { width: number; height: number } {
  const lines = Sequence.render(content, {
    color: false,
    fragmentBorderStyle: DEMO_FRAGMENT_BORDER_STYLE,
  }).split("\n")
  return {
    width: Math.max(0, ...lines.map((line) => line.length)),
    height: lines.length,
  }
}

function diagramSize(): { width: number; height: number } {
  return cachedDiagramSize ?? { width: 0, height: 0 }
}

function shellThemeFor(theme: SequenceDiagramTheme): DemoShellTheme {
  return {
    background: theme.background,
    titleColor: theme.title,
    kindColor: theme.footer,
    keyColor: theme.foreground,
    labelColor: theme.footer,
  }
}

function applyExample(): void {
  const example = EXAMPLES[exampleIndex]!
  diagram!.content = example.content
  cachedDiagramSize = measureDiagram(example.content)
  shell?.setTitle(example.title)
  shell?.setStep(exampleIndex, EXAMPLES.length)
  shell?.recenter()
  shell?.scrollToOrigin()
}

function selectExample(renderer: CliRenderer, nextExampleIndex: number): void {
  if (nextExampleIndex < 0 || nextExampleIndex >= EXAMPLES.length) return
  exampleIndex = nextExampleIndex
  applyExample()
  applyTheme(renderer, THEMES[themeIndex]!)
}

function applyTheme(_renderer: CliRenderer, theme: SequenceDiagramTheme): void {
  diagram!.fg = theme.foreground
  diagram!.bg = theme.background
  diagram!.participantColor = theme.participant
  diagram!.lifelineColor = theme.lifeline
  diagram!.groupColor = theme.group
  diagram!.requestColor = theme.request
  diagram!.responseColor = theme.response
  diagram!.noteColor = theme.note
  diagram!.noteBackgroundColor = theme.noteBackground

  shell?.setTheme(shellThemeFor(theme))
  const entries: FooterEntry[] = [
    { keys: "←/→", label: "example" },
    { keys: "T", label: "theme" },
    { keys: "Esc", label: "back" },
  ]
  shell?.setFooterEntries(entries)
}

export function run(renderer: CliRenderer): void {
  exampleIndex = 0
  const initialTheme = THEMES[themeIndex]!

  shell = new DemoShell(renderer, {
    id: "sequence-diagram",
    kind: "sequence",
    theme: shellThemeFor(initialTheme),
  })

  diagram = new Sequence.Renderable(renderer, {
    id: "sequence-diagram-content",
    content: EXAMPLES[exampleIndex]!.content,
    fg: initialTheme.foreground,
    bg: initialTheme.background,
    participantColor: initialTheme.participant,
    lifelineColor: initialTheme.lifeline,
    fragmentBorderStyle: DEMO_FRAGMENT_BORDER_STYLE,
    groupColor: initialTheme.group,
    requestColor: initialTheme.request,
    responseColor: initialTheme.response,
    pulseFrame,
    pulseLength: 9,
    pulseGap: 16,
    noteColor: initialTheme.note,
    noteBackgroundColor: initialTheme.noteBackground,
  })
  diagram.selectable = false
  cachedDiagramSize = measureDiagram(EXAMPLES[exampleIndex]!.content)
  shell.mount({ renderable: diagram, getSize: diagramSize })
  shell.focus()
  applyExample()
  applyTheme(renderer, initialTheme)

  keyHandler = (key: KeyEvent) => {
    if (key.ctrl || key.meta) return

    if (key.name === "right" || key.name === "arrowright") {
      selectExample(renderer, (exampleIndex + 1) % EXAMPLES.length)
      return
    }

    if (key.name === "left" || key.name === "arrowleft") {
      selectExample(renderer, (exampleIndex + EXAMPLES.length - 1) % EXAMPLES.length)
      return
    }

    if (key.name === "t") {
      themeIndex = (themeIndex + 1) % THEMES.length
      applyTheme(renderer, THEMES[themeIndex]!)
    }
  }
  renderer.keyInput.on("keypress", keyHandler)

  if (pulseTimer) {
    clearInterval(pulseTimer)
  }
  pulseTimer = setInterval(() => {
    if (!diagram || diagram.isDestroyed) {
      if (pulseTimer) {
        clearInterval(pulseTimer)
        pulseTimer = null
      }
      return
    }
    pulseFrame = (pulseFrame + 1) % 10_000
    diagram.pulseFrame = pulseFrame
  }, 60)
}

export function destroy(renderer: CliRenderer): void {
  if (pulseTimer) {
    clearInterval(pulseTimer)
    pulseTimer = null
  }
  if (keyHandler) {
    renderer.keyInput.off("keypress", keyHandler)
    keyHandler = null
  }
  shell?.destroy()
  shell = null
  diagram = null
  cachedDiagramSize = undefined
}

if (import.meta.main) {
  if (process.argv.includes("--print")) {
    const shouldPrintPlain = process.argv.includes("--plain") || process.env.NO_COLOR !== undefined
    const selectedExample = EXAMPLES.find((_, index) => process.argv.includes(`--example=${index + 1}`)) ?? EXAMPLES[0]!
    console.log(
      Sequence.render(selectedExample.content, {
        color: !shouldPrintPlain,
        fragmentBorderStyle: DEMO_FRAGMENT_BORDER_STYLE,
      }),
    )
  } else {
    const renderer = await createCliRenderer({ exitOnCtrlC: true })
    run(renderer)
    setupCommonDemoKeys(renderer)
  }
}
