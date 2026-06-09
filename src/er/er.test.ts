import { describe, expect, test } from "bun:test"
import { detect, parse, render } from "../index.js"
import { expectDiagram } from "../test/diagram.js"
import { parseMermaidErDiagram } from "./parser.js"
import { renderErDiagram } from "./render.js"

const checkout = `erDiagram
  direction LR
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  CUSTOMER {
    string id PK
    string email UK "login address"
  }`

describe("ER diagrams", () => {
  test("detects and parses Mermaid ER diagrams", () => {
    expect(detect(checkout)).toBe("er")

    const parsed = parse(checkout)
    expect(parsed.kind).toBe("er")
    if (parsed.kind !== "er") return
    expect(parsed.diagram.entities.map((entity) => entity.id)).toEqual(["CUSTOMER", "ORDER", "LINE_ITEM"])
    expect(parsed.diagram.relationships).toMatchObject([
      { from: "CUSTOMER", to: "ORDER", label: "places", fromCardinality: "exactlyOne", toCardinality: "zeroOrMore" },
      { from: "ORDER", to: "LINE_ITEM", label: "contains", fromCardinality: "exactlyOne", toCardinality: "oneOrMore" },
    ])
  })

  test("renders entities, attributes, labels, and cardinality markers", () => {
    const output = renderErDiagram(checkout)

    expectDiagram(output).toContainInOrder("CUSTOMER", "id PK", "email UK")
    expect(output).toContain("places")
    expect(output).toContain("contains")
    expect(output).toContain("||")
    expect(output).toContain("o{")
    expect(output).toContain("|{")
    expect(output.split("\n").some((line) => /^\s*(?:\|\||o\{|\|\{|}o|}\|)\s*$/.test(line))).toBe(false)
    expect(output).toContain("├||─ places")
    expect(output).toContain("o{│ ORDER")
    expect(output).toContain("ORDER ├||")
    expect(output).toContain("|{│ LINE_ITEM")
  })

  test("supports quoted entity names, aliases, and non-identifying relationships", () => {
    const source = `erDiagram
      "Named Driver"[Driver] }|..|{ CAR : "insured for"
      CAR {
        string registration_number PK
      }`
    const diagram = parseMermaidErDiagram(source)

    expect(diagram.entities).toMatchObject([
      { id: "Named Driver", label: "Driver" },
      { id: "CAR", label: "CAR" },
    ])
    expect(diagram.relationships[0]).toMatchObject({
      fromCardinality: "oneOrMore",
      toCardinality: "oneOrMore",
      identifying: "non-identifying",
      label: "insured for",
    })
    expect(render(source, { color: false })).toContain("insured for")
  })

  test("supports Mermaid cardinality and identifying aliases", () => {
    const diagram = parseMermaidErDiagram(`erDiagram
      PERSON one or more optionally to zero or one CAR : drives`)

    expect(diagram.relationships[0]).toMatchObject({
      fromCardinality: "oneOrMore",
      toCardinality: "zeroOrOne",
      identifying: "non-identifying",
      label: "drives",
    })
  })
})
