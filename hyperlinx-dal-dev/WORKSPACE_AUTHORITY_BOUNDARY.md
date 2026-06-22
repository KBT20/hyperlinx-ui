# DAL Workspace Authority Boundary

Scope: `hyperlinx-dal-dev` only.

## Route Engineering

- May mutate: CertifiedRoute, ScopeVersion approval lifecycle.
- Must not mutate: Field closures, Control work completion, Twin projection.
- Events produced: route certification events, `scopeversion.approved`.
- APIs called: `/api/certified-routes`, `/api/scopeversions`.
- Projection responsibility: render and review route evidence before approval.

## Prism

- May mutate: OpportunitySeed, candidate ScopeVersion seed.
- Must not mutate: approved ScopeVersion lifecycle, Control work, Field closures.
- Events produced: `prism.opportunity.created`, `prism.scopeversion.seeded`, `prism.route.scanned`, `prism.constraint.detected`.
- APIs called: `/api/opportunity-seeds`, `/api/candidate-sites`, `/api/scopeversions`.
- Projection responsibility: opportunity discovery and candidate ranking.

## Marketplace

- May mutate: MarketplaceQuote and ScopeVersion quote basis/lifecycle via quote engine.
- Must not mutate: CertifiedRoute authority, Control work, Field closures.
- Events produced: `marketplace.quote.created`, `marketplace.quote.accepted`, `marketplace.quote.revised`, `scopeversion.quoted`.
- APIs called: `/api/marketplace/quotes`, `/api/scopeversions`.
- Projection responsibility: commercial worksheet and quote evidence.

## Control

- May mutate: ControlWorkItem, ScopeVersion execution state, `APPROVED -> CONTROL -> CONTROL_ACTIVE`.
- Must not mutate: route geometry, closure records, Twin projection.
- Events produced: `scopeversion.control.work_created`, `scopeversion.control.activated`, `control.work.*`.
- APIs called: `/api/control/work-items`, `/api/scopeversions`.
- Projection responsibility: work package status and execution readiness.

## Field

- May mutate: ScopeVersion ClosureRecord ledger, station/object states through ClosureAuthorityEngine.
- Must not mutate: route geometry, approval state, quote basis, Twin projection.
- Events produced: `field.object_state_transition.closed`, `field.station_state_transition.closed`, `field.range_state_transition.closed`, evidence/blocker events.
- APIs called: `/api/scopeversions/:id/closures`, `/api/control/work-items`, optionally `/api/field/closures` side ledger.
- Projection responsibility: selected active work and human asset execution.

## Twin

- May mutate: nothing.
- Must not mutate: ScopeVersion, CertifiedRoute, work items, closures.
- Events produced: none.
- APIs called: `/api/twin/state`, read-only supporting lists if server projection unavailable.
- Projection responsibility: selected ScopeVersion projection, timeline, violations, metrics.

## Operational Intelligence

- May mutate: nothing.
- Must not mutate: ScopeVersion, CertifiedRoute, work items, closures.
- Events produced: none.
- APIs called: read-only portfolio lists and projections.
- Projection responsibility: portfolio aggregation across many ScopeVersions.

## Translate

- May mutate: CandidateSite, InventoryGraph import records, candidate/inventory ScopeVersion transformation when committed.
- Must not mutate: Design/Route Engineering approval, Control work, Field closures.
- Events produced: `translate.source.ingested`, `translate.objects.extracted`, `translate.scopeversion.created`, validation events.
- APIs called: `/api/candidate-sites`, `/api/inventory-graphs`, baseline graph APIs, `/api/scopeversions` when transformation is committed.
- Projection responsibility: source extraction, validation queue, source-to-truth preparation.

## Shared Rules

- Workspaces must call kernel helpers for transitions.
- Workspaces must read lifecycle through `getAuthoritativeLifecycleState`.
- Workspaces must not maintain independent lifecycle truth.
- Workspaces must not treat IndexedDB fallback data as shared authority.
