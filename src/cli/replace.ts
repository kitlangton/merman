import { readFile, writeFile } from "node:fs/promises"
import { extname } from "node:path"
import { formatTypeScriptDocCommentBody } from "./doc-comment.js"

const DOC_COMMENT_PATTERN = /\/\*\*[\s\S]*?\*\//g
const TYPESCRIPT_MERMAID_FENCE_PATTERN = /^([ \t]*)\*[ \t]?```mermaid[ \t]*(\r?\n)([\s\S]*?)^\1\*[ \t]?```[ \t]*$/gm
const MARKDOWN_MERMAID_FENCE_PATTERN = /^([ \t]*)```mermaid[ \t]*(\r?\n)([\s\S]*?)^\1```[ \t]*$/gm

export async function replaceMermaidFences(path: string, render: (source: string) => string): Promise<number> {
  return [".md", ".mdx"].includes(extname(path))
    ? replaceMarkdownMermaidFences(path, render)
    : replaceTypeScriptMermaidFences(path, render)
}

export async function replaceTypeScriptMermaidFences(
  path: string,
  render: (source: string) => string,
): Promise<number> {
  const content = await readFile(path, "utf8")
  let count = 0
  const updated = content.replace(DOC_COMMENT_PATTERN, (comment) =>
    comment.replace(TYPESCRIPT_MERMAID_FENCE_PATTERN, (_, indentation: string, newline: string, body: string) => {
      const source = (body.endsWith(newline) ? body.slice(0, -newline.length) : body)
        .split(newline)
        .map((line) => {
          const prefix = `${indentation}*`
          if (!line.startsWith(prefix)) throw new Error(`Invalid Mermaid doc-comment block in ${path}.`)
          return line.slice(prefix.length).replace(/^[ \t]/, "")
        })
        .join("\n")
      count += 1
      return formatTypeScriptDocCommentBody(render(source), indentation, newline)
    }),
  )

  if (count === 0) throw new Error(`No Mermaid doc-comment fences found in ${path}.`)
  if (updated !== content) await writeFile(path, updated, "utf8")
  return count
}

export async function replaceMarkdownMermaidFences(path: string, render: (source: string) => string): Promise<number> {
  const content = await readFile(path, "utf8")
  let count = 0
  const updated = content.replace(
    MARKDOWN_MERMAID_FENCE_PATTERN,
    (_, indentation: string, newline: string, body: string) => {
      const source = body.endsWith(newline) ? body.slice(0, -newline.length) : body
      count += 1
      return [
        `${indentation}\`\`\`text`,
        ...render(source)
          .split("\n")
          .map((line) => `${indentation}${line}`),
        `${indentation}\`\`\``,
      ].join(newline)
    },
  )

  if (count === 0) throw new Error(`No Mermaid fences found in ${path}.`)
  if (updated !== content) await writeFile(path, updated, "utf8")
  return count
}
