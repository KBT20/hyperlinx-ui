// src/core/graph/constraints.ts

import { Constraint } from "./types"

export function applyConstraint(state: any, constraint: Constraint) {
  if (constraint.type === "block") {
    state.blocked = true
  }
}