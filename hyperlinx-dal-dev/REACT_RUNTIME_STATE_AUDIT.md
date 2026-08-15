# React Runtime State Audit

Date: 2026-07-07

## Scope

Primary audited components:

- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx`
- `src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx`
- `src/mapkernel/MapKernel.tsx`

## Commercial Planning State

`GoogleRfpWorkspace.tsx` currently owns a large amount of runtime state, including:

- bid plan
- budget assumption states
- transparent estimate controls
- workbook open sections
- live commercial session
- proposal snapshots
- proposal runtime records
- Engineering review queue
- active Draft IOF Package
- commercial Draft IOF Package
- runtime lifecycle state
- runtime rehydration state
- customer drafts
- accepted proposal
- governed accounts/contacts/history
- imported commercial draft
- loaded commercial draft snapshot
- commercial opportunities
- commercial route repository records
- generated route repository snapshot
- route persistence audit log
- repository browser data
- opportunity restore state
- customer network graph
- runtime performance state
- corridor execution session/progress/projections/metrics
- route edit session/revision preview
- network layer state

## Large State Objects

High-risk state objects:

- `commercialOpportunities`
- `commercialRouteRepositoryRecords`
- `generatedRouteRepositorySnapshot`
- `loadedCommercialDraftSnapshot`
- `commercialCorridorDraft`
- `selectedImportedCommercialDraft`
- `activeDraftIofPackage`
- `commercialDraftIofPackage`
- `proposalRuntimeRecords`
- `customerNetworkGraph`
- `routeEditSession`
- `corridorAggregateProjection`
- `corridorViewportProjection`

These objects can include route geometry, commercial estimate data, workbook sections, proposal payloads, Draft IOF data, route repository snapshots, and map projection data.

## Engineering Certification State

`EngineeringCertificationWorkspace.tsx` holds:

- review queue
- active Draft IOF Package
- active Engineering Package
- selected object ID
- certified package records
- active certified package
- manual station plan
- engineering budget rows
- constraint input fields
- object move fields
- redline fields
- doctrine exception fields
- certification notes
- commercial revision reason

High-risk state objects:

- `activeDraft`
- `activeEngineeringPackage`
- `certifiedPackages`
- `activeCertifiedPackage`
- `manualStationPlan`
- `engineeringBudgetRows`
- `projection`

The workspace now validates projection before rendering, which reduces crash risk, but it still consumes full draft/package records.

## Map State

`ProposedNetworkMapPanel.tsx` receives:

- full `ProposedGraph`
- optional `CustomerTwinRenderableState`
- commercial map layers
- commercial opportunity overlay
- optional `CorridorViewportProjection`
- commercial ILA stations
- compare overlay
- redline controls

It keeps local state for:

- viewport size
- view center/zoom
- drag state
- control drag state
- layer toggles
- developer layer panel

Map virtualization is present and good, but full graph and full customer twin layers can still be passed as props.

## Browser Storage Use

Browser storage is present in:

- auth session (`localStorage`)
- estimate explorer open sections (`localStorage`)
- map kernel view state (`localStorage`)
- Route Engineering workspace mode (`sessionStorage`)
- legacy inventory recovery browser cache / IndexedDB utilities

Audit assessment:

- Auth and view preferences are acceptable non-truth browser state.
- Inventory recovery cache must remain clearly labeled as cache/fallback, not authority.

## Objects Larger Than About 1 MB

Persisted JSON evidence shows objects that can become large if loaded into React:

- `translation-commits/...json`: about 36.18 MB
- `engineering-drafts/...json`: about 3.3 MB
- `commercial-routes/...json`: about 2.08 MB
- multiple route/runtime object records: about 1.07 MB to 1.33 MB

These should not be passed wholesale to React views after PostgreSQL/PostGIS migration.

## Components Receiving Large Props

| Component | Large Inputs | Current Mitigation |
|---|---|---|
| `GoogleRfpWorkspace` | opportunities, routes, proposals, Draft IOF packages, customer graph, estimates | Some restore validation, cache, corridor projections |
| `ProposedNetworkMapPanel` | graph, customer twin layers, overlay geometry, ILA stations | map virtualization and optional corridor viewport projection |
| `TransparentEstimateExplorer` | full estimate and controls | section collapse and local UI state |
| `EngineeringCertificationWorkspace` | Draft IOF package, Engineering Package, projection, station plan, budget rows | projection validation and error boundary |
| `MapKernel` | map render specs | map kernel render/audit functions |

## Projection Substitution Opportunities

Replace:

- full route repository records in UI state

with:

- `routeRepositoryId`, `geometryHash`, `routeMiles`, `routeFeet`, `CorridorAggregateProjection`, `CorridorViewportProjection`

Replace:

- full commercial opportunities list with embedded snapshots

with:

- opportunity summary list plus selected opportunity detail loader

Replace:

- full proposal runtime records in dashboard lists

with:

- proposal authority state summaries

Replace:

- active Draft IOF Package full object in Commercial view

with:

- Draft IOF summary projection and package ID

Replace:

- Engineering active draft full object where possible

with:

- Engineering Package ID, projection, selected object/station slices

## React Ownership Findings

1. Commercial Planning is still the primary large-object owner in the browser.
2. Corridor Execution projections reduce map/workbook pressure but do not yet eliminate full geometry state.
3. Engineering Certification is safer after projection hardening but still carries full draft/package state.
4. Map panel has good viewport projection behavior, but full graph/twin props remain.
5. Repository Browser is useful for development but should not become operator flow.

## Recommendation

Before PostgreSQL/PostGIS:

1. Add summary/list endpoints for every repository.
2. Add selected-detail lazy loaders.
3. Pass IDs and projection handles through workspaces.
4. Move route geometry slices to PostGIS-backed viewport/segment APIs.
5. Persist Change Sets and use them as projection inputs.
6. Keep developer repository browser behind a diagnostics flag.
7. Add size guard warnings for any React state payload over 1 MB.
