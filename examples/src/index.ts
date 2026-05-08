import {
  BoxRenderable,
  createCliRenderer,
  type CliRenderer,
  type KeyEvent,
  type MouseEvent,
  parseColor,
  SelectRenderable,
  SelectRenderableEvents,
  type SelectOption,
  TextRenderable,
} from "@opentui/core"
import * as flowchartDemo from "./flowchart-demo.js"
import * as sequenceDemo from "./sequence-diagram-demo.js"
import * as stateDemo from "./state-diagram-demo.js"

interface SubDemo {
  readonly id: string
  readonly title: string
  readonly description: string
  run(renderer: CliRenderer): void
  destroy(renderer: CliRenderer): void
}

const DEMOS: SubDemo[] = [
  {
    id: "flowchart",
    title: "Flowchart",
    description: "Mermaid flowchart with active edges and pulse animation",
    run: flowchartDemo.run,
    destroy: flowchartDemo.destroy,
  },
  {
    id: "state",
    title: "State Diagram",
    description: "Composite states, transitions, and follow animation",
    run: stateDemo.run,
    destroy: stateDemo.destroy,
  },
  {
    id: "sequence",
    title: "Sequence Diagram",
    description: "Participants, messages, fragments, and activations",
    run: sequenceDemo.run,
    destroy: sequenceDemo.destroy,
  },
]

const MENU_BG = "#0F1419"
const TITLE_FG = "#E4EFE8"
const HINT_FG = "#8DA99B"
const ITEM_FG = "#D7E5DD"
const ITEM_BG = "#0F1419"
const SELECTED_FG = "#FFF3D7"
const SELECTED_BG = "#243439"
const DESCRIPTION_FG = "#86E1C8"
const SELECTED_DESCRIPTION_FG = "#FFD3A0"
const SELECT_ITEM_HEIGHT = 2

interface Menu {
  container: BoxRenderable
  title: TextRenderable
  hint: TextRenderable
  select: SelectRenderable
}

let activeDemo: SubDemo | undefined
let menu: Menu | undefined
let masterKeyHandler: ((key: KeyEvent) => void) | undefined

function buildMenu(renderer: CliRenderer): Menu {
  renderer.setBackgroundColor(parseColor(MENU_BG))

  const container = new BoxRenderable(renderer, {
    id: "demo-menu",
    flexGrow: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MENU_BG,
    padding: 2,
  })

  const title = new TextRenderable(renderer, {
    id: "demo-menu-title",
    content: "merman · examples",
    fg: TITLE_FG,
    marginBottom: 1,
  })

  const select = new SelectRenderable(renderer, {
    id: "demo-menu-select",
    options: DEMOS.map<SelectOption>((demo) => ({
      name: demo.title,
      description: demo.description,
      value: demo.id,
    })),
    backgroundColor: ITEM_BG,
    textColor: ITEM_FG,
    focusedBackgroundColor: ITEM_BG,
    focusedTextColor: ITEM_FG,
    selectedBackgroundColor: SELECTED_BG,
    selectedTextColor: SELECTED_FG,
    descriptionColor: DESCRIPTION_FG,
    selectedDescriptionColor: SELECTED_DESCRIPTION_FG,
    showDescription: true,
    wrapSelection: true,
    width: 60,
    height: DEMOS.length * SELECT_ITEM_HEIGHT + 1,
  })

  const optionIndexAt = (event: MouseEvent): number | undefined => {
    const localY = event.y - select.y
    if (localY < 0 || localY >= select.height) return undefined
    const index = Math.floor(localY / SELECT_ITEM_HEIGHT)
    return index >= 0 && index < DEMOS.length ? index : undefined
  }

  select.onMouseMove = (event) => {
    const index = optionIndexAt(event)
    if (index === undefined) return
    select.setSelectedIndex(index)
    select.focus()
  }
  select.onMouseDown = (event) => {
    if (event.button !== 0) return
    const index = optionIndexAt(event)
    if (index === undefined) return
    select.setSelectedIndex(index)
    select.focus()
  }
  select.onMouseUp = (event) => {
    if (event.button !== 0) return
    const index = optionIndexAt(event)
    if (index === undefined) return
    select.setSelectedIndex(index)
    const demo = DEMOS[index]
    if (demo) startDemo(renderer, demo)
  }

  const hint = new TextRenderable(renderer, {
    id: "demo-menu-hint",
    content: "↑/↓ or hover select · Enter/click run · Esc quit",
    fg: HINT_FG,
    marginTop: 1,
  })

  container.add(title)
  container.add(select)
  container.add(hint)
  renderer.root.add(container)
  select.focus()

  return { container, title, hint, select }
}

function destroyMenu(renderer: CliRenderer): void {
  if (!menu) return
  renderer.root.remove(menu.container.id)
  menu.container.destroyRecursively()
  menu = undefined
}

function showMenu(renderer: CliRenderer): void {
  if (menu) return
  const built = buildMenu(renderer)
  built.select.on(SelectRenderableEvents.ITEM_SELECTED, (_index: number, option: SelectOption) => {
    const demo = DEMOS.find((candidate) => candidate.id === option.value)
    if (demo) startDemo(renderer, demo)
  })
  menu = built
}

function startDemo(renderer: CliRenderer, demo: SubDemo): void {
  destroyMenu(renderer)
  activeDemo = demo
  demo.run(renderer)
}

function stopDemo(renderer: CliRenderer): void {
  if (!activeDemo) return
  activeDemo.destroy(renderer)
  activeDemo = undefined
}

function handleEscape(renderer: CliRenderer): void {
  if (activeDemo) {
    stopDemo(renderer)
    showMenu(renderer)
    return
  }
  process.exit(0)
}

if (import.meta.main) {
  const renderer = await createCliRenderer({ targetFps: 30, exitOnCtrlC: true })

  masterKeyHandler = (key) => {
    if (key.name === "escape") {
      key.preventDefault()
      handleEscape(renderer)
    }
  }
  renderer.keyInput.on("keypress", masterKeyHandler)

  showMenu(renderer)
}
