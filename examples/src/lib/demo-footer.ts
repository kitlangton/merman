import {
  BoxRenderable,
  fg,
  StyledText,
  stringToStyledText,
  t,
  type TextChunk,
  TextRenderable,
  type CliRenderer,
  type ColorInput,
} from "@opentui/core"

export interface FooterEntry {
  keys: string
  label: string
}

export interface DemoFooterTheme {
  keyColor: ColorInput
  labelColor: ColorInput
  background?: ColorInput
}

const ENTRY_GAP = "   "

function formatFooterContent(entries: FooterEntry[], theme: DemoFooterTheme): StyledText {
  if (entries.length === 0) return stringToStyledText("")
  const key = fg(theme.keyColor)
  const label = fg(theme.labelColor)
  const chunks: TextChunk[] = []
  entries.forEach((entry, index) => {
    if (index > 0) chunks.push(...stringToStyledText(ENTRY_GAP).chunks)
    chunks.push(...t`${key(entry.keys)} ${label(entry.label)}`.chunks)
  })
  return new StyledText(chunks)
}

export class DemoFooter {
  readonly box: BoxRenderable
  private readonly text: TextRenderable
  private readonly resizeHandler: () => void
  private theme: DemoFooterTheme
  private entries: FooterEntry[] = []

  constructor(
    private readonly renderer: CliRenderer,
    options: { id: string; theme: DemoFooterTheme },
  ) {
    this.theme = options.theme
    this.box = new BoxRenderable(renderer, {
      id: options.id,
      position: "absolute",
      left: 0,
      top: Math.max(0, renderer.height - 1),
      width: renderer.width,
      height: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: options.theme.background,
    })
    this.text = new TextRenderable(renderer, {
      id: `${options.id}-text`,
      content: "",
      truncate: true,
      bg: options.theme.background,
    })
    this.box.add(this.text)
    renderer.root.add(this.box)

    this.resizeHandler = () => {
      this.box.top = Math.max(0, renderer.height - 1)
      this.box.width = renderer.width
    }
    renderer.on("resize", this.resizeHandler)
  }

  setEntries(entries: FooterEntry[]): void {
    this.entries = entries
    this.text.content = formatFooterContent(entries, this.theme)
  }

  setTheme(theme: DemoFooterTheme): void {
    this.theme = theme
    this.box.backgroundColor = theme.background
    this.text.bg = theme.background
    this.text.content = formatFooterContent(this.entries, theme)
  }

  destroy(): void {
    this.renderer.off("resize", this.resizeHandler)
    this.renderer.root.remove(this.box.id)
    this.box.destroyRecursively()
  }
}
