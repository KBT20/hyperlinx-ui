# Integration Risk Register

Status: audit and planning only.

| Risk | Surface | Severity | Mitigation |
| --- | --- | --- | --- |
| Browser fallback treated as authority | ScopeVersion, Inventory, Candidate Site | Critical | server-backed read-only adapters before write promotion |
| Workspace-local lifecycle state diverges | Control, Field, Twin, OI | Critical | canonical ScopeVersion lifecycle adapter |
| Closure evidence not replayable | Field, Completion, Operations | Critical | close ledger adapter and audit chain validation |
| Marketplace estimates treated as budget truth | Marketplace, Control | High | Budget Lock adapter and commercial authority boundary |
| Work package data not scope-bounded | Control, Field | High | work package adapter keyed by `scopeVersionId` |
| Completion readiness inferred from Field alone | Completion | High | require `COMPLETION_CLOSE` and acceptance evidence |
| Operations readiness conflated with production activation | Operations | High | keep `OPERATIONS_CLOSE` separate from billing, telemetry, and service activation |
| Actor identity is local or implicit | All authority layers | High | actor identity adapter and role validation |
| Tenant/account isolation missing | Customer, Opportunity, ScopeVersion | High | tenant-scoped repository adapter |
| Legacy route references bypass ScopeVersion | Corridor, Prism, Design import paths | Medium | legacy reference mapping into ScopeVersion snapshots |

## Classification

Risk levels:

- Low
- Medium
- High
- Critical

Any Critical risk blocks production adoption.

