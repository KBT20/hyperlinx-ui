// src/core/graph/scopeVersion.ts

import { Node, Edge, Event } from "./types"

export type ScopeVersion = {
  id: string
  nodes: Node[]
  edges: Edge[]
  events: Event[]
  metadata?: Record<string, any>
}