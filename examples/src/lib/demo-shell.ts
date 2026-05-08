import { type CliRenderer, type ColorInput, type MouseEvent, type Renderable, ScrollBoxRenderable } from "@opentui/core"
import { DemoFooter, type FooterEntry } from "./demo-footer.js"
import { DemoHeader } from "./demo-header.js"

export interface DemoShellTheme {
  background: ColorInput
  titleColor: ColorInput
  kindColor: ColorInput
  keyColor: ColorInput
  labelColor: ColorInput
}

export interface DemoShellOptions {
  id: string
  theme: DemoShellTheme
  kind?: string
}

export interface MountedContent {
  renderable: Renderable
  getSize(): { width: number; height: number }
}

const VIEWPORT_PADDING = 1
const HEADER_HEIGHT = 1
const FOOTER_HEIGHT = 1

function viewportHeight(renderer: CliRenderer): number {
  return Math.max(1, renderer.height - HEADER_HEIGHT - FOOTER_HEIGHT)
}

const CLICK_DRAG_THRESHOLD = 2

export class DemoShell {
  readonly header: DemoHeader
  readonly footer: DemoFooter
  readonly scrollBox: ScrollBoxRenderable
  private theme: DemoShellTheme
  private mounted: MountedContent | undefined
  private resizeHandler: () => void
  private recenterTimer: ReturnType<typeof setTimeout> | undefined
  private dragLast: { x: number; y: number } | undefined
  private dragStart: { x: number; y: number } | undefined
  private dragMoved = false

  constructor(
    private readonly renderer: CliRenderer,
    options: DemoShellOptions,
  ) {
    this.theme = options.theme
    renderer.setBackgroundColor(options.theme.background)

    this.scrollBox = new ScrollBoxRenderable(renderer, {
      id: `${options.id}-scrollbox`,
      position: "absolute",
      left: 0,
      top: HEADER_HEIGHT,
      width: renderer.width,
      height: viewportHeight(renderer),
      scrollX: true,
      scrollY: true,
      rootOptions: { border: false, backgroundColor: options.theme.background },
      viewportOptions: { backgroundColor: options.theme.background },
      contentOptions: { backgroundColor: options.theme.background, minHeight: 0 },
    })
    this.scrollBox.verticalScrollBar.visible = false
    this.scrollBox.horizontalScrollBar.visible = false
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      this.dragStart = { x: event.x, y: event.y }
      this.dragLast = { x: event.x, y: event.y }
      this.dragMoved = false
    }
    const handleMouseDrag = (event: MouseEvent) => {
      if (!this.dragLast) return
      const dx = event.x - this.dragLast.x
      const dy = event.y - this.dragLast.y
      if (dx === 0 && dy === 0) return
      this.dragLast = { x: event.x, y: event.y }
      const start = this.dragStart
      if (start) {
        const totalDx = Math.abs(event.x - start.x)
        const totalDy = Math.abs(event.y - start.y)
        if (totalDx + totalDy >= CLICK_DRAG_THRESHOLD) this.dragMoved = true
      }
      this.scrollBox.scrollBy({ x: -dx, y: -dy })
    }
    const handleMouseDragEnd = () => {
      this.finishDrag()
    }
    const handleMouseUp = (event: MouseEvent) => {
      if (event.button !== 0) return
      this.finishDrag()
    }
    this.scrollBox.onMouseDown = handleMouseDown
    this.scrollBox.viewport.onMouseDown = handleMouseDown
    this.scrollBox.content.onMouseDown = handleMouseDown
    this.scrollBox.onMouseDrag = handleMouseDrag
    this.scrollBox.viewport.onMouseDrag = handleMouseDrag
    this.scrollBox.content.onMouseDrag = handleMouseDrag
    this.scrollBox.onMouseDragEnd = handleMouseDragEnd
    this.scrollBox.viewport.onMouseDragEnd = handleMouseDragEnd
    this.scrollBox.content.onMouseDragEnd = handleMouseDragEnd
    this.scrollBox.onMouseUp = handleMouseUp
    this.scrollBox.viewport.onMouseUp = handleMouseUp
    this.scrollBox.content.onMouseUp = handleMouseUp
    renderer.root.add(this.scrollBox)

    this.header = new DemoHeader(renderer, {
      id: `${options.id}-header`,
      kind: options.kind,
      theme: {
        titleColor: options.theme.titleColor,
        kindColor: options.theme.kindColor,
        background: options.theme.background,
      },
    })
    this.footer = new DemoFooter(renderer, {
      id: `${options.id}-footer`,
      theme: {
        keyColor: options.theme.keyColor,
        labelColor: options.theme.labelColor,
        background: options.theme.background,
      },
    })

    this.resizeHandler = () => {
      this.scrollBox.width = renderer.width
      this.scrollBox.height = viewportHeight(renderer)
      this.recenter()
    }
    renderer.on("resize", this.resizeHandler)
  }

  mount(content: MountedContent): void {
    if (this.mounted) {
      this.scrollBox.remove(this.mounted.renderable.id)
    }
    this.mounted = content
    this.scrollBox.add(content.renderable)
    this.recenter()
    this.recenterAfterLayout()
  }

  recenter(): void {
    if (!this.mounted) return
    const { renderable, getSize } = this.mounted
    const size = getSize()
    renderable.width = size.width
    renderable.height = size.height
    const viewport = this.scrollBox.viewport
    this.scrollBox.content.width = Math.max(viewport.width, size.width + VIEWPORT_PADDING * 2)
    this.scrollBox.content.height = Math.max(viewport.height, size.height + VIEWPORT_PADDING * 2)
    const dx = Math.max(VIEWPORT_PADDING, Math.floor((viewport.width - size.width) / 2))
    const dy = Math.max(VIEWPORT_PADDING, Math.floor((viewport.height - size.height) / 2))
    renderable.marginLeft = dx
    renderable.marginTop = dy
    renderable.marginRight = VIEWPORT_PADDING
    renderable.marginBottom = VIEWPORT_PADDING
  }

  scrollToOrigin(): void {
    this.scrollBox.scrollTo({ x: 0, y: 0 })
  }

  private recenterAfterLayout(): void {
    if (this.recenterTimer) clearTimeout(this.recenterTimer)
    this.recenterTimer = setTimeout(() => {
      this.recenterTimer = undefined
      this.recenter()
      this.scrollToOrigin()
    }, 0)
  }

  private finishDrag(): void {
    this.dragLast = undefined
    this.dragStart = undefined
    this.dragMoved = false
  }

  setTitle(title: string): void {
    this.header.setTitle(title)
  }

  setStep(index: number, total: number): void {
    const indicator = Array.from({ length: total }, (_, step) => (step === index ? "●" : "○")).join(" ")
    this.header.setIndicator(indicator)
  }

  setKind(kind: string | undefined): void {
    this.header.setKind(kind)
  }

  setFooterEntries(entries: FooterEntry[]): void {
    this.footer.setEntries(entries)
  }

  setTheme(theme: DemoShellTheme): void {
    this.theme = theme
    this.renderer.setBackgroundColor(theme.background)
    this.scrollBox.backgroundColor = theme.background
    this.scrollBox.viewport.backgroundColor = theme.background
    this.scrollBox.content.backgroundColor = theme.background
    this.header.setTheme({
      titleColor: theme.titleColor,
      kindColor: theme.kindColor,
      background: theme.background,
    })
    this.footer.setTheme({
      keyColor: theme.keyColor,
      labelColor: theme.labelColor,
      background: theme.background,
    })
  }

  focus(): void {
    this.scrollBox.focus()
  }

  destroy(): void {
    if (this.recenterTimer) clearTimeout(this.recenterTimer)
    this.renderer.off("resize", this.resizeHandler)
    this.scrollBox.destroyRecursively()
    this.header.destroy()
    this.footer.destroy()
    this.mounted = undefined
  }
}
