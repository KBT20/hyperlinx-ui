# UI_RATIONALIZATION_PLAN

Date: 2026-07-03
Program: CIP-010 - Constitutional Workspace Rationalization, Performance Audit & Foundation Review

## Objective

Reduce visual and runtime complexity without adding business functionality.

## Primary UI Problems

1. The left navigation is flat and does not express the constitutional lifecycle.
2. Commercial Planning contains too many roles: account management, opportunity scout, customer twin, map, pricing, proposal runtime, lifecycle bridge, product configurator, IOF assembly preview, and engineering intake.
3. Engineering Certification needs a clearer object/address/dependency workbench.
4. Diagnostics and recovery tools appear as peer lifecycle workspaces.
5. Operational Intelligence is useful but behaves like a deep runtime projection, not a summary dashboard.

## Navigation Plan

| Group | Primary items | Hidden/collapsed items |
| --- | --- | --- |
| Intake | Translate, Route Intake | Customer design diagnostics |
| Commercial | Commercial Planning | Preliminary Proposal as a tab |
| Discovery | Portfolio, Prism | Candidate Sites, Network Affinity as tabs |
| Decision | Site Decision | Route diagnostics drawer |
| Engineering | Engineering Certification | Route engineering debug views |
| Constitutional Truth | ScopeVersion | Lifecycle debug JSON |
| Execution | Marketplace, Control, Field | Work package diagnostics |
| Operations | Twin, Operational Intelligence | Inventory recovery summaries |
| System | Inventory Graphs | Inventory Recovery, Graph Viewer, Graph Extensions |

## Commercial Planning Simplification

Commercial Planning should be reorganized into five task-focused surfaces:

| Surface | User question | Visible content |
| --- | --- | --- |
| Customer and Product | Who is the customer and what are we selling? | Account, contacts, product, A/Z, imported design reference. |
| Commercial Design | What are we building commercially? | Customer twin, route/draft map, route length, high-level constraints. |
| Financial Soundness | Is it financially sound? | NRC/MRC/TCV/margin/payback, assumptions, confidence, override ledger. |
| Constitutional Completeness | Is the package complete? | Product doctrine status, Draft IOF Package status, missing inputs, no engineering truth claims. |
| Engineering Handoff | Is it ready for Engineering? | Draft IOF Package version, audit projection summary, object/address gaps, submit to queue. |

Move out of primary commercial view:

- detailed engineering object placement,
- production/payment profile detail,
- raw Draft IOF Package JSON,
- map render diagnostics,
- route engineering certification controls.

## Engineering UI Plan

Engineering should answer:

- Is every object present?
- Is every object addressed?
- Is every object placed correctly?
- Is every dependency satisfied?
- Is every sequence legal?
- Is every object certifiable?

Recommended layout:

| Panel | Purpose |
| --- | --- |
| Package Header | Package id, version, source proposal, certification state, blockers. |
| Object Workbench | Spine object table with status, address, station/range, parent, dependency, evidence, review owner. |
| Address Queue | Unassigned/review objects and PD-002A assignment actions. |
| Dependency Graph | Kernel execution graph filtered to selected object. |
| Sequence Validator | Legal/expected sequence, closure expectations, exception status. |
| Map | Object/address synchronized view with visible layer toggles. |
| Certification Ledger | Notes, exceptions, evidence, checklist, immutable certification result. |

## Map UI Plan

1. Show a layer dock with independent toggles.
2. Keep expensive object/station/label layers off until requested or zoomed in.
3. Separate base/reference layers from constitutional layers.
4. Use one MapKernel path for ScopeVersion, IOF Package, Engineering, and OI metrics.
5. Do not expose debug JSON or render-authority rows by default.

Constitutional layer groups:

| Group | Layers |
| --- | --- |
| Reference | street, parcel, building, water, railroad, terrain. |
| Source truth | inventory, customer design, certified route. |
| Constitutional truth | ScopeVersion route, station, node, edge, object. |
| Work truth | IOF package, work package, field closure. |
| Engineering review | address review, unassigned object, exception, redline. |
| Operations | twin state, completion state, blockers. |

## Workspace Visibility Plan

| Workspace | Visible now? | Change |
| --- | --- | --- |
| Commercial Planning | Yes | Keep as default, but make shell lightweight. |
| Translate | Yes | Keep. |
| Engineering Certification | Yes | Keep and promote in lifecycle nav. |
| ScopeVersion | Yes | Keep. |
| Marketplace/Control/Field/Twin/OI | Yes | Keep downstream and lazy. |
| Preliminary Proposal | No as first-level | Move into Commercial. |
| Candidate Sites/Network Affinity/Prism | Group | Collapse into Discovery. |
| Inventory Recovery/Graph Viewer/Graph Extensions | System only | Hide from lifecycle default. |

## UI Debt To Remove

- Raw JSON blocks in primary panels.
- Render/projection debug logs in normal render paths.
- Duplicate map implementations for commercial proposed network and MapKernel.
- Commercial panels that show engineering-only detail before handoff.
- First-level nav items that represent diagnostics rather than lifecycle authority.

