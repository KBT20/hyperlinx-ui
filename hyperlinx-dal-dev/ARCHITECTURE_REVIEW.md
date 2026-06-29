# Hyperlinx DAL Architecture Review

Date: 2026-06-28
Scope: Pre-commit audit for the current `hyperlinx-dal-dev` milestone after Translate 2.0, Customer Design Library, Opportunity workflow, Commercial Planning, Transparent Estimate Authoring, Sales Engineering, Route Engineering, Corridor Candidates, ILA Planning, Financial Authority, design persistence, and handoff work.

This document is an audit artifact only. It does not introduce product behavior.

## Current System Overview

Hyperlinx DAL is currently organized as an evidence-to-authority workflow:

1. Customer artifacts and opportunities enter DAL through Translate and commercial planning workspaces.
2. Customer evidence is normalized into DAL route/design objects without creating ScopeVersion truth.
3. Commercial Planning produces priced corridor drafts, transparent estimates, financial authority summaries, and optional engineering handoff requests.
4. Route Engineering owns draft revisions, route candidates, engineering comparisons, and the approval gate toward Certified Route / ScopeVersion authority.
5. ScopeVersion, Control, Field, Twin, and Operational Intelligence remain downstream authority layers.

The strongest current pattern is separation between advisory/commercial objects and authoritative execution objects. Customer imports, commercial drafts, ILA planning results, and route engineering drafts carry lineage and provenance but do not by themselves mutate the Customer Twin, inventory graph, Control, Field, or OI authority.

## Workspace Responsibilities

| Workspace / Area | Responsibility | Authority posture |
| --- | --- | --- |
| Translate 2.0 | Ingest KMZ/KML/CSV-style customer artifacts, normalize route geometry, preserve provenance, and stage customer design imports. | Customer evidence only; no ScopeVersion creation and no inventory mutation. |
| Customer Design Library | Persist imported customer designs and selected customer design state for DAL reuse. | Local DAL storage persistence; not yet server-grade authority. |
| Opportunity / Commercial Planning | Build commercial route drafts, estimate assumptions, transparent estimates, ILA plans, financial authority summaries, and handoff requests. | Commercial advisory authority; no engineering or ScopeVersion truth. |
| Transparent Estimate Authoring | Review algorithm values, support human override authority, record estimate audit events, and recalculate financials live. | Estimate authority inside the commercial estimate object. |
| Sales Engineering / Corridor Candidates | Generate and compare corridor alternatives from commercial or engineering context. | Advisory candidate generation until accepted into route engineering draft state. |
| Route Engineering | Maintain engineering drafts, revisions, accepted revision state, and ScopeVersion approval gating. | Engineering draft authority; only approved/certified paths may advance toward ScopeVersion. |
| Proposed Network Map | Render route geometry, commercial overlays, ILA station overlays, and selection synchronization. | Visual projection only. |
| ScopeVersion / Control / Field / Twin / OI | Govern production truth, work execution, field closure, twin projection, and operational intelligence. | Production authority boundaries remain downstream of commercial and engineering draft work. |

## Major Engines

| Engine / Module | Current role |
| --- | --- |
| `CustomerDesignImportEngine` | Parses customer design artifacts, creates customer evidence objects, tracks provenance/audit/lineage flags, and attaches priced drafts. |
| `customerDesignLibrary` | Persists customer design import records through DAL storage. |
| `CommercialCorridorDraftEngine` | Builds commercial corridor drafts and estimate inputs from active route geometry and assumptions. |
| `CommercialOsrmRoutingEngine` | Produces route geometry for commercial planning where routed geometry is available. |
| `TransparentEstimatingEngine` | Computes transparent estimate lines, downstream summary metrics, constraint authority, and ILA planning integration. |
| `CommercialFinancialAuthority` | Produces canonical financial metrics: cost, sell price, gross margin, NRC/MRC, lifecycle revenue, per-mile and per-foot metrics, and warnings. |
| `IlaPlanningEngine` | Creates station-based ILA planning objects from route geometry, controls, facility profile assumptions, bookend settings, and station overrides. |
| `RouteEngineeringDraftEngine` | Maintains engineering draft revisions, route geometry snapshots, station deltas, and candidate acceptance state. |
| `CorridorCandidateEngine` | Builds route candidate comparisons and engineering preview deltas. |
| `ScopeVersionLifecycle*` and transition authority modules | Model lifecycle transitions, close requirements, transition validation, and AI authority containment. |

## Shared State Model

`DALStateProvider` is the main shared UI state coordinator for this milestone. It holds customer design imports, selected customer import IDs, selected commercial corridor draft, route engineering activation requests, selected route engineering draft state, workspace routing, selected customer, selected ScopeVersion, and related execution context.

Commercial planning additionally uses local workspace state and local storage for opportunity/session continuity. Customer design imports are persisted through DAL storage. Route engineering drafts are tracked through shared DAL state and route engineering persistence helpers.

The shared state model is useful for rapid DAL workflow restoration, but it is becoming a central coordination surface. The next stabilization pass should separate durable authority state, workspace session state, and visual selection state more explicitly.

## Known Authority Boundaries

| Boundary | Current assessment |
| --- | --- |
| Customer evidence vs ScopeVersion | Preserved. Imported customer designs carry no-ScopeVersion and no-inventory-mutation flags. |
| Commercial draft vs engineering revision | Mostly preserved. Commercial drafts can request handoff but do not become engineering truth until route engineering accepts or promotes them. |
| Estimate authority vs financial authority | Improved. `CommercialFinancialAuthority` centralizes financial totals, but some UI summary math remains close to presentation code. |
| ILA station objects vs production route stations | Preserved for now. ILA stations are commercial/engineering planning objects and not production ScopeVersion stations. |
| Map rendering vs authority | Preserved. Map overlays render selected data but are not authoritative mutation points. |
| AI/advisory reasoning vs lifecycle authority | Mostly preserved. Transition authority explicitly blocks AI-assistant advisory actors from lifecycle mutation, although not every advisory object has a fully structured AI provenance record yet. |
| Control/Field/Twin/OI | Preserved in this audit. Current commercial and route engineering changes did not directly mutate these authority layers. |

## Current Lifecycle

The active DAL lifecycle is:

1. Customer or opportunity context is selected.
2. Customer artifacts are imported or opportunity routes are generated.
3. Customer design imports are persisted and can be priced as commercial drafts.
4. Commercial Planning reviews corridor geometry, assumptions, constraints, transparent estimate lines, ILA plans, and financial authority.
5. Optional Sales Engineering / Route Engineering handoff activates a route engineering draft.
6. Engineering revisions and corridor candidates are compared, saved, accepted, or made current.
7. A certified/provisionally certified route can pass the ScopeVersion approval gate.
8. ScopeVersion, Control, Field, Completion, Twin, and OI remain downstream production authority stages.

The lifecycle is directionally aligned with IOF doctrine, but two lifecycle vocabularies currently coexist: the older guard states and the newer close-event-based lifecycle registry. This is the most important architectural convergence item before production hardening.

## Known Technical Debt

| Area | Risk |
| --- | --- |
| Dual lifecycle registries | `ScopeVersionLifecycleGuard` and `ScopeVersionLifecycle` encode different state vocabularies and transition models. |
| UI-owned commercial logic | `GoogleRfpWorkspace` still owns civil mix balancing, estimate override orchestration, and several workflow state transitions that should move into engines or reducers. |
| Customer Design Library persistence | Customer designs persist locally through DAL storage, but the library is not yet a server-backed source of record. |
| ILA / optical assumptions | `IlaPlanningEngine` is now the ILA cost/placement source, but route engineering still has its own spacing/optical preview assumptions. |
| Financial summary consumption | `CommercialFinancialAuthority` exists, but every summary card should be audited to ensure it consumes the canonical authority object rather than recomputing metrics locally. |
| Map layer freshness | Commercial overlays and station overlays are reactive, but layer selection, route fit, and older map projection paths still deserve stale-geometry tests. |
| Engineering close authority | Route engineering approval uses gating, but the current UI path should be reconciled with close-event transition authority. |
| Monolithic workspace files | Commercial planning and translate workspaces are large enough that authority logic, persistence logic, and presentation logic are harder to verify. |

## Immediate Stabilization Priorities

1. Converge ScopeVersion lifecycle handling onto the close-event transition authority model.
2. Extract commercial estimate editing, civil mix balancing, and human-override audit mutations from UI components into commercial authority engines.
3. Promote Customer Design Library persistence from local DAL storage to a server-backed repository with explicit opportunity lineage.
4. Make `CommercialFinancialAuthority` the only source for all commercial financial cards and per-mile/per-foot metrics.
5. Unify ILA spacing and optical preview assumptions between Route Engineering and `IlaPlanningEngine`.
6. Add automated stale-geometry tests for commercial maps, route engineering maps, and ILA station overlays.

## Next Recommended Milestones

| Milestone | Recommendation |
| --- | --- |
| Phase 9B | Complete ILA planning integration with engineering revisions: recommendation approval, moved/added/removed station diffing, and optical comparison persistence. |
| Phase 10 | Lifecycle authority convergence: make close events the single path for ScopeVersion truth changes. |
| Phase 11 | Server-backed Customer Design Library and opportunity-linked commercial draft persistence. |
| Phase 12 | Commercial authority extraction: reducers/engines for estimate editing, assumption edits, civil mix modes, and audit history. |
| Phase 13 | Production hardening for map projection freshness, graph authority, and station object promotion rules. |
