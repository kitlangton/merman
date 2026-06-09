import type {
  FlowchartDiagramAnsiOptions,
  FlowchartDiagramOptions,
  FlowchartDiagramRenderOptions,
} from "../flowchart/options.js"
import type { FlowchartDiagramAnsiTheme } from "../flowchart/style.js"

export type ErDiagramDirection = "TB" | "TD" | "BT" | "LR" | "RL"
export type ErCardinality = "zeroOrOne" | "exactlyOne" | "zeroOrMore" | "oneOrMore"
export type ErRelationshipIdentification = "identifying" | "non-identifying"
export type ErAttributeKey = "PK" | "FK" | "UK"

export interface ErAttribute {
  type: string
  name: string
  keys?: ErAttributeKey[]
  comment?: string
}

export interface ErEntity {
  id: string
  label: string
  attributes: ErAttribute[]
}

export interface ErRelationship {
  from: string
  to: string
  label: string
  fromCardinality: ErCardinality
  toCardinality: ErCardinality
  identifying: ErRelationshipIdentification
}

export interface ErDiagram {
  direction: ErDiagramDirection
  entities: ErEntity[]
  relationships: ErRelationship[]
}

export type ErDiagramRenderOptions = FlowchartDiagramRenderOptions
export type ErDiagramAnsiOptions = FlowchartDiagramAnsiOptions
export type ErDiagramOptions = FlowchartDiagramOptions
export type ErDiagramAnsiTheme = FlowchartDiagramAnsiTheme
