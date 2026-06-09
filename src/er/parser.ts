import { firstMeaningfulMermaidLine, numberedMermaidLines, stripMermaidQuotes as stripQuotes } from "../core/mermaid.js"
import { MermaidSyntaxError } from "../diagnostics.js"
import type {
  ErAttribute,
  ErAttributeKey,
  ErCardinality,
  ErDiagram,
  ErDiagramDirection,
  ErEntity,
  ErRelationshipIdentification,
} from "./types.js"

const DEFAULT_DIRECTION = "LR" satisfies ErDiagramDirection
const HEADER_RE = /^erDiagram$/i
const DIRECTION_RE = /^direction\s+(TB|TD|BT|LR|RL)$/i
const IGNORED_PRESENTATION_RE = /^(?:classDef|class|style)\b/i
const ATTRIBUTE_TYPE_RE = /^\p{L}[\p{L}\p{N}_\-()[\]]*$/u
const ATTRIBUTE_NAME_RE = /^\*?[\p{L}\p{N}_\-()[\]]+$/u
const SYMBOLIC_RELATIONSHIP_RE = /^([|}][o|])(--|\.\.)([o|][|{])\s+/u
const ATTRIBUTE_KEY_RE = /\b(PK|FK|UK)\b/gi

const CARDINALITY_ALIASES: ReadonlyArray<[string, ErCardinality]> = [
  ["one or zero", "zeroOrOne"],
  ["zero or one", "zeroOrOne"],
  ["one or more", "oneOrMore"],
  ["one or many", "oneOrMore"],
  ["zero or more", "zeroOrMore"],
  ["zero or many", "zeroOrMore"],
  ["many(1)", "oneOrMore"],
  ["many(0)", "zeroOrMore"],
  ["only one", "exactlyOne"],
  ["1+", "oneOrMore"],
  ["0+", "zeroOrMore"],
  ["1", "exactlyOne"],
] as const

const RELATIONSHIP_ALIASES: ReadonlyArray<[string, ErRelationshipIdentification]> = [
  ["optionally to", "non-identifying"],
  ["to", "identifying"],
] as const

interface EntityRef {
  id: string
  label?: string
  rest: string
}

interface RelationshipOperator {
  fromCardinality: ErCardinality
  toCardinality: ErCardinality
  identifying: ErRelationshipIdentification
  rest: string
}

function normalizeDirection(value?: string): ErDiagramDirection {
  const upper = value?.toUpperCase()
  if (upper === "TB" || upper === "TD" || upper === "BT" || upper === "LR" || upper === "RL") return upper
  return DEFAULT_DIRECTION
}

export function isMermaidErDiagram(content: string): boolean {
  return HEADER_RE.test(firstMeaningfulMermaidLine(content) ?? "")
}

function stripClassShorthand(value: string): string {
  return value.replace(/:::.+$/, "").trim()
}

function readQuoted(value: string): { text: string; end: number } | undefined {
  if (!value.startsWith('"')) return undefined
  for (let index = 1; index < value.length; index += 1) {
    if (value[index] === '"') return { text: value.slice(0, index + 1), end: index + 1 }
  }
  return undefined
}

function readBracketAlias(value: string, offset: number): { label: string; end: number } | undefined {
  let index = offset
  while (/\s/.test(value[index] ?? "")) index += 1
  if (value[index] !== "[") return undefined
  const end = value.indexOf("]", index + 1)
  if (end < 0) return undefined
  return { label: stripQuotes(value.slice(index + 1, end)), end: end + 1 }
}

function parseEntityRef(value: string): EntityRef | undefined {
  const trimmed = value.trimStart()
  if (!trimmed) return undefined

  const quoted = readQuoted(trimmed)
  if (quoted) {
    const alias = readBracketAlias(trimmed, quoted.end)
    const id = stripClassShorthand(stripQuotes(quoted.text))
    return { id, label: alias?.label, rest: trimmed.slice(alias?.end ?? quoted.end).trimStart() }
  }

  const idMatch = trimmed.match(/^([^\s[{]+)(?:\s*)/u)
  if (!idMatch) return undefined
  const rawId = idMatch[1]!
  const alias = readBracketAlias(trimmed, rawId.length)
  const id = stripClassShorthand(rawId)
  return { id, label: alias?.label, rest: trimmed.slice(alias?.end ?? rawId.length).trimStart() }
}

function ensureEntity(entities: Map<string, ErEntity>, id: string, label?: string): ErEntity {
  const existing = entities.get(id)
  if (existing) {
    if (label) existing.label = label
    return existing
  }
  const entity = { id, label: label ?? id, attributes: [] }
  entities.set(id, entity)
  return entity
}

function cardinalityFromMarker(marker: string): ErCardinality {
  if (marker === "|o" || marker === "o|") return "zeroOrOne"
  if (marker === "||") return "exactlyOne"
  if (marker === "}o" || marker === "o{") return "zeroOrMore"
  if (marker === "}|" || marker === "|{") return "oneOrMore"
  throw new Error(`Unknown cardinality marker: ${marker}`)
}

function parseSymbolicRelationshipOperator(value: string): RelationshipOperator | undefined {
  const match = value.match(SYMBOLIC_RELATIONSHIP_RE)
  if (!match) return undefined
  return {
    fromCardinality: cardinalityFromMarker(match[1]!),
    toCardinality: cardinalityFromMarker(match[3]!),
    identifying: match[2] === ".." ? "non-identifying" : "identifying",
    rest: value.slice(match[0].length),
  }
}

function escapedAliasPattern(alias: string): string {
  return alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
}

function parseAliasRelationshipOperator(value: string): RelationshipOperator | undefined {
  for (const [leftAlias, fromCardinality] of CARDINALITY_ALIASES) {
    for (const [relationshipAlias, identifying] of RELATIONSHIP_ALIASES) {
      for (const [rightAlias, toCardinality] of CARDINALITY_ALIASES) {
        const pattern = new RegExp(
          `^${escapedAliasPattern(leftAlias)}\\s+${escapedAliasPattern(relationshipAlias)}\\s+${escapedAliasPattern(rightAlias)}\\s+`,
          "iu",
        )
        const match = value.match(pattern)
        if (match) return { fromCardinality, toCardinality, identifying, rest: value.slice(match[0].length) }
      }
    }
  }
  return undefined
}

function parseRelationshipOperator(value: string): RelationshipOperator | undefined {
  return parseSymbolicRelationshipOperator(value) ?? parseAliasRelationshipOperator(value)
}

function parseAttribute(line: string, lineNumber: number): ErAttribute {
  let source = line.trim()
  let comment: string | undefined
  const commentMatch = source.match(/\s+"([^"]*)"\s*$/u)
  if (commentMatch) {
    comment = commentMatch[1]
    source = source.slice(0, commentMatch.index).trim()
  }

  const parts = source.split(/\s+/u)
  const type = parts[0]
  const name = parts[1]
  if (!type || !name || !ATTRIBUTE_TYPE_RE.test(type) || !ATTRIBUTE_NAME_RE.test(name)) {
    throw new MermaidSyntaxError("er", lineNumber, line, "Invalid attribute")
  }

  const keyText = parts.slice(2).join(" ")
  const keys = [...keyText.matchAll(ATTRIBUTE_KEY_RE)].map((match) => match[1]!.toUpperCase() as ErAttributeKey)
  return {
    type,
    name,
    ...(keys.length > 0 ? { keys: [...new Set(keys)] } : {}),
    ...(comment ? { comment } : {}),
  }
}

export function parseMermaidErDiagram(content: string): ErDiagram {
  const entities = new Map<string, ErEntity>()
  const relationships = [] as ErDiagram["relationships"]
  let direction: ErDiagramDirection = DEFAULT_DIRECTION
  let attributeEntity: { id: string; lineNumber: number; sourceLine: string } | undefined

  for (const source of numberedMermaidLines(content)) {
    const line = source.text
    if (!line || line.startsWith("%%") || HEADER_RE.test(line)) continue

    if (attributeEntity) {
      if (line === "}") {
        attributeEntity = undefined
        continue
      }
      if (line.startsWith("%%")) continue
      ensureEntity(entities, attributeEntity.id).attributes.push(parseAttribute(line, source.lineNumber))
      continue
    }

    const directionMatch = line.match(DIRECTION_RE)
    if (directionMatch) {
      direction = normalizeDirection(directionMatch[1])
      continue
    }

    if (IGNORED_PRESENTATION_RE.test(line)) continue

    const first = parseEntityRef(line)
    if (!first) throw new MermaidSyntaxError("er", source.lineNumber, line)
    const firstEntity = ensureEntity(entities, first.id, first.label)

    if (first.rest === "") continue

    if (first.rest === "{") {
      attributeEntity = { id: firstEntity.id, lineNumber: source.lineNumber, sourceLine: line }
      continue
    }

    const operator = parseRelationshipOperator(first.rest)
    if (!operator) throw new MermaidSyntaxError("er", source.lineNumber, line, "Unsupported relationship")

    const second = parseEntityRef(operator.rest)
    if (!second) throw new MermaidSyntaxError("er", source.lineNumber, line, "Missing relationship target")
    const secondEntity = ensureEntity(entities, second.id, second.label)
    const labelMatch = second.rest.match(/^:\s*(.+)$/u)
    if (!labelMatch) throw new MermaidSyntaxError("er", source.lineNumber, line, "Missing relationship label")

    relationships.push({
      from: firstEntity.id,
      to: secondEntity.id,
      label: stripQuotes(labelMatch[1]!.trim()),
      fromCardinality: operator.fromCardinality,
      toCardinality: operator.toCardinality,
      identifying: operator.identifying,
    })
  }

  if (attributeEntity) {
    throw new MermaidSyntaxError(
      "er",
      attributeEntity.lineNumber,
      attributeEntity.sourceLine,
      'Unclosed attribute block; expected "}"',
    )
  }

  return { direction, entities: [...entities.values()], relationships }
}
