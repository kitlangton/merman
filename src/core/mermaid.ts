export function* mermaidLines(content: string): Generator<string> {
  for (const line of content.split(/\r?\n/)) {
    yield line.trim()
  }
}

export function* meaningfulMermaidLines(content: string): Generator<string> {
  for (const line of mermaidLines(content)) {
    if (line && !line.startsWith("%%")) yield line
  }
}

export function firstMeaningfulMermaidLine(content: string): string | undefined {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line && !line.startsWith("%%")) return line
  }
  return undefined
}

export function stripMermaidQuotes(value: string): string {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}
