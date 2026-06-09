export type GalleryDiagramKind = "flowchart" | "sequence" | "state" | "er"

export interface GalleryCase {
  title: string
  kind: GalleryDiagramKind
  content: string
}

export const GALLERY_CASES: readonly GalleryCase[] = [
  {
    title: "ER / checkout relationships",
    kind: "er",
    content: `erDiagram
  direction LR
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  ORDER ||--|| PAYMENT : paid_by
  PRODUCT ||--o{ LINE_ITEM : appears_in
  CUSTOMER {
    string id PK
    string email UK
  }`,
  },
  {
    title: "ER / memberships and teams",
    kind: "er",
    content: `erDiagram
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
  }`,
  },
  {
    title: "Flowchart / Unicode and crossings",
    kind: "flowchart",
    content: `flowchart LR
  Begin[Start] --> Kanji[界面]
  Kanji --> Accent[Cafe\u0301]
  Begin --> Emoji[ship 🚢]`,
  },
  {
    title: "Flowchart / nested grouping and feedback",
    kind: "flowchart",
    content: `flowchart TD
  subgraph Runtime [Terminal Runtime]
    direction LR
    Parse[Parse] --> Layout[Layout]
    Layout --> Render[(Render)]
  end
  Render -->|retry with a wider label| Layout`,
  },
  {
    title: "Flowchart / vertical branching and multiline Unicode",
    kind: "flowchart",
    content: `flowchart TD
  Input[Upload<br/>界 file] -->|valid payload| Store[(Archive)]
  Input -->|invalid payload| Review{Retry?}
  Review -->|yes| Input
  Review -->|no| Stop([Stop])`,
  },
  {
    title: "Flowchart / reverse horizontal branch and merge",
    kind: "flowchart",
    content: `flowchart RL
  Parser[Parser] --> Output[Rendered]
  Cache[(Cache)] --> Output
  Parser --> Cache
  Source[Mermaid Source] --> Parser`,
  },
  {
    title: "Flowchart / simple reverse horizontal edge",
    kind: "flowchart",
    content: `flowchart RL
  Parser[Parser] --> Output[Rendered]`,
  },
  {
    title: "Flowchart / multiline edge label clearance",
    kind: "flowchart",
    content: `flowchart TD
  Upload[Upload] -->|validate payload<br/>normalize fields<br/>persist record<br/>notify observer| Archive[(Archive)]`,
  },
  {
    title: "Flowchart / multiline subgraph title relocation",
    kind: "flowchart",
    content: `flowchart TD
  Input[Input] --> Parse
  subgraph Pipeline [Validation<br/>Pipeline]
    Parse[Parse] --> Store[(Store)]
  end`,
  },
  {
    title: "Flowchart / parallel multiline lanes",
    kind: "flowchart",
    content: `flowchart LR
  Source[Source] -->|first attempt<br/>accepted| Target[Target]
  Source -->|second attempt<br/>retry| Target
  Source -->|third attempt<br/>fallback| Target`,
  },
  {
    title: "State / reverse direction and long labels",
    kind: "state",
    content: `stateDiagram-v2
  direction RL
  Published --> Review: reopen after a very detailed reviewer comment
  Review --> Draft: changes requested
  Draft --> Review: resubmit`,
  },
  {
    title: "State / reciprocal narrow routes in reverse direction",
    kind: "state",
    content: `stateDiagram-v2
  direction RL
  A --> B
  B --> C: down
  C --> B: back`,
  },
  {
    title: "State / independent overlapping feedback paths",
    kind: "state",
    content: `stateDiagram-v2
  direction LR
  A --> B: advance
  B --> C: continue
  C --> D: finish
  C --> A: reset A
  D --> B: reset B`,
  },
  {
    title: "State / multiline transition labels",
    kind: "state",
    content: `stateDiagram-v2
  direction LR
  Draft --> Review: submit changes<br/>after validation
  Review --> Published: approve`,
  },
  {
    title: "State / vertical multiline labels and note",
    kind: "state",
    content: `stateDiagram-v2
  direction TB
  Draft --> Validation: submit changes<br/>with complete context
  Validation --> Published: approve
  note right of Validation : reviewer sees 界 and Cafe\u0301`,
  },
  {
    title: "State / choice split and repair loop",
    kind: "state",
    content: `stateDiagram-v2
  direction LR
  state Decision <<choice>>
  [*] --> Editing
  Editing --> Decision: validate
  Decision --> Published: clean
  Decision --> Errors: rejected
  Errors --> Editing: repair`,
  },
  {
    title: "State / reverse choice split",
    kind: "state",
    content: `stateDiagram-v2
  direction RL
  state Decision <<choice>>
  [*] --> Editing
  Editing --> Decision: validate
  Decision --> Published: clean
  Decision --> Errors: rejected`,
  },
  {
    title: "State / reverse composite straight route",
    kind: "state",
    content: `stateDiagram-v2
  direction RL
  state Runtime {
    Parse --> Render: format
  }`,
  },
  {
    title: "State / composites, choices, notes, and Unicode",
    kind: "state",
    content: `stateDiagram-v2
  direction LR
  state Socket {
    [*] --> Connecting
    Connecting --> Connected: open
    Connected --> Backoff: retry with Cafe\u0301 / 界
    Backoff --> Connecting: timer
    Backoff --> [*]: ready
  }
  state Decide <<choice>>
  Socket --> Decide: inspect
  Decide --> Complete: success
  note right of Backoff : wide label / 界面 cache`,
  },
  {
    title: "Sequence / long alternate branch",
    kind: "sequence",
    content: `sequenceDiagram
  participant UI as UI 界
  participant API as Cafe\u0301 API
  UI->>API: submit request
  alt ok
    API-->>UI: accepted
  else validation failed with a substantially longer explanation
    API-->>UI: retry with corrections
  end`,
  },
  {
    title: "Sequence / groups, notes, activation, and self-message",
    kind: "sequence",
    content: `sequenceDiagram
  box Frontend
    participant Browser
    participant Cache
  end
  box Backend
    participant Service
  end
  Browser->>Service: fetch document
  activate Service
  Service->>Service: validate and normalize
  Note over Browser,Service: response contains a wide 界 glyph
  Service-->>Browser: complete
  deactivate Service`,
  },
  {
    title: "Sequence / nested fragments and multiline messages",
    kind: "sequence",
    content: `sequenceDiagram
  participant Client
  participant Worker
  participant Store
  alt cached
    Worker-->>Client: return cached<br/>Cafe\u0301 result
  else rebuild requested
    loop retry while unavailable
      Worker->>Store: refresh<br/>界 index
      Store-->>Worker: ready
    end
    Worker-->>Client: complete
  end`,
  },
  {
    title: "Sequence / separate compact and wide fragments",
    kind: "sequence",
    content: `sequenceDiagram
  participant A
  participant B
  alt ok
    A->>B: first
  else no
    B-->>A: retry
  end
  alt accepted
    A->>B: next
  else validation failed with a very long explanation
    B-->>A: repair
  end`,
  },
  {
    title: "Sequence / long self-call and spanning note",
    kind: "sequence",
    content: `sequenceDiagram
  participant Browser
  participant Runtime
  Browser->>Runtime: render
  Runtime->>Runtime: measure a substantially longer Unicode label 界面
  Note over Browser,Runtime: stable terminal widths for Cafe\u0301 and 界
  Runtime-->>Browser: done`,
  },
]
