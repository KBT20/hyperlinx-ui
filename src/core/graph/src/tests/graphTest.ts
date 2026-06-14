import { ScopeVersion } from "../core/graph"
import { deriveState } from "../core/graph"

const scope: ScopeVersion = {
  id: "test",
  nodes: [
    { id: "A", type: "site" },
    { id: "B", type: "site" }
  ],
  edges: [
    {
      id: "E1",
      from: "A",
      to: "B",
      type: "physical",
      ownership: "internal"
    }
  ],
  events: [
    {
      id: "1",
      scopeVersionId: "test",
      type: "activate_node",
      targetId: "A",
      timestamp: Date.now()
    }
  ]
}

const state = deriveState(scope)

console.log("STATE:", state)