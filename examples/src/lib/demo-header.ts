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

export interface DemoHeaderTheme {
  titleColor: ColorInput
  kindColor: ColorInput
  background?: ColorInput
}

const KIND_TITLE_GAP = "  "
const TITLE_INDICATOR_GAP = "   "

function formatHeaderContent(
  title: string,
  kind: string | undefined,
  indicator: string | undefined,
  theme: DemoHeaderTheme,
): StyledText {
  const titleChunks = t`${fg(theme.titleColor)(title)}`.chunks
  const indicatorChunks = indicator ? stringToStyledText(`${TITLE_INDICATOR_GAP}${indicator}`).chunks : []
  if (!kind) return new StyledText([...titleChunks, ...indicatorChunks])
  const chunks: TextChunk[] = []
  chunks.push(...t`${fg(theme.kindColor)(kind)}`.chunks)
  chunks.push(...stringToStyledText(KIND_TITLE_GAP).chunks)
  chunks.push(...titleChunks)
  chunks.push(...indicatorChunks)
  return new StyledText(chunks)
}

export class DemoHeader {
  readonly box: BoxRenderable
  private readonly text: TextRenderable
  private readonly resizeHandler: () => void
  private theme: DemoHeaderTheme
  private title = ""
  private kind: string | undefined
  private indicator: string | undefined

  constructor(
    private readonly renderer: CliRenderer,
    options: { id: string; theme: DemoHeaderTheme; kind?: string },
  ) {
    this.theme = options.theme
    this.kind = options.kind
    this.box = new BoxRenderable(renderer, {
      id: options.id,
      position: "absolute",
      left: 0,
      top: 0,
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
      this.box.width = renderer.width
    }
    renderer.on("resize", this.resizeHandler)
  }

  setTitle(title: string): void {
    this.title = title
    this.text.content = formatHeaderContent(title, this.kind, this.indicator, this.theme)
  }

  setKind(kind: string | undefined): void {
    this.kind = kind
    this.text.content = formatHeaderContent(this.title, kind, this.indicator, this.theme)
  }

  setIndicator(indicator: string | undefined): void {
    this.indicator = indicator
    this.text.content = formatHeaderContent(this.title, this.kind, indicator, this.theme)
  }

  setTheme(theme: DemoHeaderTheme): void {
    this.theme = theme
    this.box.backgroundColor = theme.background
    this.text.bg = theme.background
    this.text.content = formatHeaderContent(this.title, this.kind, this.indicator, theme)
  }

  destroy(): void {
    this.renderer.off("resize", this.resizeHandler)
    this.renderer.root.remove(this.box.id)
    this.box.destroyRecursively()
  }
}
