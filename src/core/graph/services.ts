// src/core/graph/services.ts

import { Edge } from "./types"

export function createServiceEdge(params: {
  id: string
  from: string
  to: string
  carrier: string
  capacity: number
}): Edge {
  return {
    id: params.id,
    from: params.from,
    to: params.to,
    type: "service",
    ownership: "external",
    attributes: {
      carrier: params.carrier,
      capacity: params.capacity
    }
  }
}