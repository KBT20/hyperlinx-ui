# DAL Integration Surface Map

Status: audit and planning only.

| Surface | Current DAL Owner | Current Implementation | Constitutional Implementation | Integration Gap | Required Adapter | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| Customer | Customer modules | local customer contracts and fixtures | Customer traceability contract | production identity and tenant source not connected | read-only customer adapter | Medium |
| Opportunity | Customer/opportunity modules | local opportunity contracts and fixtures | Opportunity to Corridor to ScopeVersion trace | production opportunity repository not connected | read-only opportunity adapter | Medium |
| Corridor | Corridor modules | evidence, synthesis, Prism scoring contracts | Corridor evidence and promotion input | production corridor repository not connected | read-only corridor adapter | Medium |
| ScopeVersion | ScopeVersion modules | local ScopeVersion utilities and repository clients | constitutional state object | production authority fields require shadow validation | read-only ScopeVersion adapter | High |
| Marketplace | Marketplace modules | asset, capability, bid, budget, contract readiness contracts | commercial evidence and budget authority | production marketplace data requires authority boundary adapter | marketplace shadow adapter | High |
| Control | Control modules | control activation and work package contracts | execution authority | production work packages require guarded handoff | control read-only adapter | High |
| Field | Field modules | field activation and closure contracts | field execution and `FIELD_CLOSE` evidence | production closure ledger requires scope-bounded adapter | field closure adapter | Critical |
| Completion | Completion modules | completion readiness and `COMPLETION_CLOSE` contracts | delivery completion authority | no production completion service yet | completion shadow adapter | High |
| Operations | Operations modules | operations readiness and `OPERATIONS_CLOSE` contracts | operational readiness authority | no production operations service yet | operations shadow adapter | High |

## Surface Rule

Every surface must enter production through read-only adapters before any write path is promoted.

