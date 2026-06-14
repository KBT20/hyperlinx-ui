export type Node = {
  id: string
  type: string
  location?: { lat: number; lng: number }
  attributes?: Record<string, any>
}

export type Edge = {
  id: string
  from: string
  to: string
  type: "physical" | "service" | "logical"
  ownership: "internal" | "external"
  attributes?: Record<string, any>
}

export type Event = {
  id: string
  scopeVersionId: string
  type: string
  targetId: string
  timestamp: number
  payload?: Record<string, any>
}

export type Constraint = {
  id: string
  targetId: string
  type: string
  severity?: "low" | "medium" | "high"
}

export type DerivedState = {
  nodeStates: Record<string, any>
  edgeStates: Record<string, any>
}