import { type CliRenderer, createCliRenderer, type KeyEvent, parseColor } from "@opentui/core"
import { Er } from "@kitlangton/merman"
import { type FooterEntry } from "./lib/demo-footer.js"
import { DemoShell, type DemoShellTheme } from "./lib/demo-shell.js"
import { setupCommonDemoKeys } from "./lib/standalone-keys.js"

export interface ErExample {
  title: string
  content: string
}

export const ECOMMERCE_ER = `erDiagram
  direction LR
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  ORDER ||--|| PAYMENT : paid_by
  PRODUCT ||--o{ LINE_ITEM : appears_in
  CUSTOMER {
    string id PK
    string email UK
    string name
  }
  ORDER {
    string id PK
    string customer_id FK
    datetime placed_at
  }
  PRODUCT {
    string id PK
    string sku UK
    decimal price
  }`

export const TEAMS_ER = `erDiagram
  direction LR
  USER ||--o{ MEMBERSHIP : joins
  TEAM ||--o{ MEMBERSHIP : includes
  USER ||--o{ PROJECT : owns
  TEAM ||--o{ INVITE : sends
  USER {
    string id PK
    string email UK
  }
  TEAM {
    string id PK
    string slug UK
  }
  MEMBERSHIP {
    string user_id FK
    string team_id FK
    string role
  }`

export const LIBRARY_ER = `erDiagram
  direction LR
  LIBRARY ||--o{ BOOK_COPY : owns
  BOOK ||--o{ BOOK_COPY : has
  MEMBER ||--o{ LOAN : borrows
  BOOK_COPY ||--o{ LOAN : loaned_as
  LOAN ||--o| FINE : may_generate
  BOOK {
    string isbn PK
    string title
  }
  MEMBER {
    string id PK
    string email UK
  }`

export const HEALTHCARE_ER = `erDiagram
  direction LR
  PATIENT ||--o{ APPOINTMENT : books
  DOCTOR ||--o{ APPOINTMENT : attends
  APPOINTMENT ||--o{ PRESCRIPTION : may_create
  PRESCRIPTION ||--|{ PRESCRIPTION_ITEM : contains
  MEDICATION ||--o{ PRESCRIPTION_ITEM : prescribed_as
  PATIENT {
    string id PK
    string name
    date birth_date
  }
  APPOINTMENT {
    string id PK
    datetime starts_at
    string status
  }`

export const INSURANCE_ER = `erDiagram
  direction LR
  PERSON ||--o{ POLICY : owns
  PERSON ||--|{ CAR : insured_for
  POLICY ||--|{ COVERAGE : includes
  CAR ||--o{ CLAIM : involved_in
  CAR {
    string vin PK
    string plate UK
  }
  PERSON {
    string id PK
    string name
  }`

export const ER_EXAMPLES: ErExample[] = [
  { title: "Checkout Data Model", content: ECOMMERCE_ER },
  { title: "Teams and Memberships", content: TEAMS_ER },
  { title: "Library Loans", content: LIBRARY_ER },
  { title: "Healthcare Scheduling", content: HEALTHCARE_ER },
  { title: "Insurance Policies", content: INSURANCE_ER },
]

const SHELL_THEMES: readonly DemoShellTheme[] = [
  {
    background: parseColor("#101815"),
    titleColor: parseColor("#E4EFE8"),
    kindColor: parseColor("#86E1C8"),
    keyColor: parseColor("#FFF3D7"),
    labelColor: parseColor("#8DA99B"),
  },
  {
    background: parseColor("#111827"),
    titleColor: parseColor("#E7EDF5"),
    kindColor: parseColor("#7DD3FC"),
    keyColor: parseColor("#FFE38A"),
    labelColor: parseColor("#94A3B8"),
  },
]

const SHOWCASE_DELAY_MS = 2_300
const CLEAR_SCREEN = "\x1b[2J\x1b[H"
const RESET = "\x1b[0m"

let diagram: Er.Renderable | undefined
let shell: DemoShell | undefined
let exampleIndex = 0
let themeIndex = 0
let keyHandler: ((key: KeyEvent) => void) | undefined

function currentTheme(): DemoShellTheme {
  return SHELL_THEMES[themeIndex]!
}

function diagramSize(): { width: number; height: number } {
  return { width: diagram?.renderedWidth ?? 0, height: diagram?.renderedHeight ?? 0 }
}

function updateHeader(): void {
  shell?.setTitle(ER_EXAMPLES[exampleIndex]!.title)
  shell?.setStep(exampleIndex, ER_EXAMPLES.length)
}

function updateFooter(): void {
  const entries: FooterEntry[] = [
    { keys: "←/→", label: "example" },
    { keys: "C", label: diagram?.compact ? "wide" : "compact" },
    { keys: "T", label: "theme" },
    { keys: "Esc", label: "back" },
  ]
  shell?.setFooterEntries(entries)
}

function updateDiagram(): void {
  if (!diagram) return
  diagram.content = ER_EXAMPLES[exampleIndex]!.content
  shell?.recenter()
  shell?.scrollToOrigin()
  updateHeader()
  updateFooter()
}

function selectExample(nextExampleIndex: number): void {
  exampleIndex = (nextExampleIndex + ER_EXAMPLES.length) % ER_EXAMPLES.length
  updateDiagram()
}

function applyTheme(renderer: CliRenderer): void {
  const theme = currentTheme()
  shell?.setTheme(theme)
  if (diagram) {
    diagram.bg = theme.background
    diagram.fg = theme.titleColor
  }
  renderer.setBackgroundColor(theme.background)
}

export function run(renderer: CliRenderer): void {
  exampleIndex = 0
  const theme = currentTheme()
  const example = ER_EXAMPLES[exampleIndex]!

  shell = new DemoShell(renderer, {
    id: "er-diagram-demo",
    kind: "er diagram",
    theme,
  })

  diagram = new Er.Renderable(renderer, {
    id: "er-diagram",
    content: example.content,
    fg: theme.titleColor,
    bg: theme.background,
  })
  diagram.selectable = false

  shell.mount({ renderable: diagram, getSize: diagramSize })
  shell.focus()
  updateHeader()
  updateFooter()

  keyHandler = (key) => {
    if (key.name === "right" || key.name === "arrowright") {
      selectExample(exampleIndex + 1)
    } else if (key.name === "left" || key.name === "arrowleft") {
      selectExample(exampleIndex - 1)
    } else if (key.name === "c") {
      if (!diagram) return
      diagram.compact = !diagram.compact
      shell?.recenter()
      updateFooter()
    } else if (key.name === "t") {
      themeIndex = (themeIndex + 1) % SHELL_THEMES.length
      applyTheme(renderer)
    }
  }
  renderer.keyInput.on("keypress", keyHandler)

  setupCommonDemoKeys(renderer)
}

export function destroy(renderer: CliRenderer): void {
  if (keyHandler) renderer.keyInput.off("keypress", keyHandler)
  shell?.destroy()
  diagram = undefined
  shell = undefined
  keyHandler = undefined
}

function exampleFromArgs(): ErExample {
  const exampleArg = process.argv.find((arg) => arg.startsWith("--example="))
  const index = Math.max(0, Math.min(ER_EXAMPLES.length - 1, Number.parseInt(exampleArg?.split("=")[1] ?? "1", 10) - 1))
  return ER_EXAMPLES[index]!
}

function renderPlainExample(example: ErExample, plain: boolean): string {
  return `${Er.render(example.content, { color: !plain })}\n`
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function runShowcase(plain: boolean): Promise<void> {
  for (const [index, example] of ER_EXAMPLES.entries()) {
    process.stdout.write(CLEAR_SCREEN)
    process.stdout.write(`merman erDiagram examples · ${index + 1}/${ER_EXAMPLES.length}\n`)
    process.stdout.write(`${example.title}\n\n`)
    process.stdout.write(renderPlainExample(example, plain))
    process.stdout.write(RESET)
    await sleep(SHOWCASE_DELAY_MS)
  }
}

if (import.meta.main) {
  if (process.argv.includes("--showcase")) {
    await runShowcase(process.argv.includes("--plain"))
  } else if (process.argv.includes("--print")) {
    process.stdout.write(renderPlainExample(exampleFromArgs(), process.argv.includes("--plain")))
  } else {
    const renderer = await createCliRenderer({ targetFps: 30 })
    run(renderer)
  }
}
