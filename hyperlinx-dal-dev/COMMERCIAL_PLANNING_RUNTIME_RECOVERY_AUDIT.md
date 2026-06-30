# Commercial Planning Runtime Recovery Audit

Sprint: Commercial Planning Runtime Recovery
Status: implemented and validated locally
Commit status: no commit created

## Root Cause

Commercial Planning initialization stopped at the Existing Inventory -> Customer Twin boundary.

The authenticated runtime migration made the runtime the source of truth, but Commercial Planning still had no authoritative way to commit customer infrastructure into that runtime. The old static inventory path in `CustomerNetworkInventory.ts` is intentionally disabled and returns the diagnostic:

`Static customer inventory loading is disabled. Commit customer evidence through the shared runtime instead.`

At the same time, the Commercial Planning import preview flow only captured pending file names and draft disposition. It did not parse the file, create runtime objects, commit evidence, or refresh the runtime-backed Customer Twin.

Result before this sprint:

1. Authentication succeeded.
2. Workspace context loaded.
3. Customer selection loaded.
4. `loadCustomerInventoryForAccount()` looked for runtime customer inventories.
5. No authoritative customer inventory existed.
6. Customer Twin initialized as an empty graph.
7. Downstream map, A/Z, attachment, OSRM, commercial draft, engineering draft, and proposal flows had no inventory authority to consume.

This was not a broken button problem. The root failure was missing runtime inventory initialization.

## Initialization Audit

| Stage | Runtime path | Result |
| --- | --- | --- |
| Authentication | `TeralinxAuthProvider` -> `/api/auth/login` | Ryan, Fran, and Kyle authenticate into independent workspaces. |
| Workspace Context | `/api/runtime/workspaces/me`, runtime header state | Workspace identity is available to Commercial Planning. |
| Customer Selection | `selectedAccount` state in `GoogleRfpWorkspace.tsx` | Account-scoped initialization starts correctly. |
| Existing Inventory | new `handleExistingInventoryFile()` runtime import path | Restored. KMZ, KML, GeoJSON, CSV, and Runtime Inventory JSON commit authoritative runtime objects. Shapefile UI is future-ready. |
| Customer Twin | `loadCustomerInventoryForAccount()` -> runtime inventories/objects -> `buildCustomerTwinFromNetworkGraph()` | Restored. Twin builds from persisted runtime inventory instead of static local assets. |
| Commercial Opportunity | `handleNewCommercialOpportunity()`, `handleBeginExtendExistingOpportunity()`, `handleBeginAzOpportunity()` | Restored. New Opportunity starts with the Customer Twin visible, then either extends existing network or creates a greenfield A/Z corridor. |
| Map Interaction | `ProposedNetworkMapPanel` events -> `handleScoutMapCoordinate()` and redline handlers | Wired. Map click, pan, wheel zoom, fit controls, selection, drag, and edit callbacks reach Commercial Planning state. |
| A/Z Controller | `handleResolveAzTextLocation()`, `handleResolveAzExistingLocation()`, `handleBeginAzMapPlacement()` | Wired. A/Z text, route, station, POP, object, and map placement update explicit resolved locations. |
| Corridor Builder | `handleRunAzBuilderScout()` | Wired. Creates corridor seed only after A and Z resolve. |
| OSRM | `handleGenerateCommercialRoute()` -> `routeCommercialCorridorWithOsrm()` | Wired. No straight-line fallback is generated if OSRM fails. |
| Commercial Draft | `handleLockScoutCandidate()` -> commercial corridor draft state | Wired. Draft activation depends on routed geometry. |
| Engineering Draft | `handleEnterEngineeringMode()` | Wired. Engineering handoff remains separate from inventory authority. |
| Proposal | `handleSaveLiveProposalSnapshot()`, `handleSaveCommercialDraftSnapshot()`, `handleAcceptProposal()` | Wired. Proposal snapshots persist to the shared proposal library. |
| Runtime Object Library | `/api/runtime/commit`, `/api/runtime/objects`, commercial opportunity mirror | Restored for Existing Inventory and governed Commercial Opportunity objects. |
| Activity History | `recordActivity()` and runtime commit history | Restored. Existing Inventory imports and opportunity operations append activity/history. |

## Interaction Audit

| Interaction | UI event | Runtime/state update | Status |
| --- | --- | --- | --- |
| Click on Map | `ProposedNetworkMapPanel.onMapCoordinateClick` | `handleScoutMapCoordinate()` sets candidate coordinate or A/Z map location | wired |
| Resolve A | text, existing inventory, or map placement button | `azOriginLocation` updates | wired |
| Resolve Z | text, existing inventory, or map placement button | `azDestinationLocation` updates | wired |
| A POP / Z POP | A/Z POP buttons | `handleResolveAzExistingLocation(slot, "CUSTOMER_POP")` consumes Customer Twin objects | wired after Twin inventory exists |
| A Route / Z Route | A/Z Route buttons | `handleResolveAzExistingLocation(slot, "CUSTOMER_ROUTE")` consumes Customer Twin routes | wired after Twin inventory exists |
| A Object / Z Object | A/Z Object buttons | `handleResolveAzExistingLocation(slot, "CUSTOMER_OBJECT")` consumes Customer Twin objects | wired after Twin inventory exists |
| Create Corridor | Create Corridor Seed | `handleRunAzBuilderScout()` creates an A/Z seed candidate | wired |
| Generate OSRM | Generate OSRM Route | `handleGenerateCommercialRoute()` sets routing state and result | wired |
| Fit Inventory | map camera button | `fitViewForCoordinates()` in `ProposedNetworkMapPanel` | wired |
| Refresh Twin | Refresh Twin / Reload Customer Inventory | increments `inventoryRefreshNonce`, reloads runtime-backed inventory | wired |
| Commercial Layers | layer toggles | `updateNetworkLayerState()` controls visible/locked/reference/diversity flags | wired |
| Selection | graph/twin feature click | `setInventoryMapSelection()` and selection overlays update | wired |
| Dragging | pointer drag | map panning or redline control drag updates view/revision state | wired |
| Highlighting | selected feature state | selected feature overlay and detail panel update | wired |
| Editing | redline controls | add via, protect/reset/split segment, avoidance polygon, save/discard revision | wired |
| Snapping | existing inventory selection | resolved A/Z and attachment candidates reference Twin route/station/object IDs | wired after Twin inventory exists |
| OSRM visualization | route result geometry | commercial route result and corridor overlay render on the map | wired |

## Restored Existing Inventory Workspace

Commercial Planning now includes an Existing Inventory runtime section.

Supported now:

- KMZ
- KML
- GeoJSON
- CSV
- JSON Runtime Inventory

Future-ready:

- Shapefile interface is present; this sprint returns a clear conversion notice instead of pretending to ingest `.shp` or `.zip`.

Import behavior:

1. Parse the selected file.
2. Normalize geometry and classifications.
3. Create evidence records.
4. Create Runtime Objects.
5. Create Runtime Inventory records.
6. Commit through authenticated `/api/runtime/commit`.
7. Refresh Customer Twin from the runtime libraries.
8. Record activity history.

Every imported runtime object now carries:

- Object ID
- Object Type
- Owner
- Created By
- Assigned To
- Organization
- Workspace
- Visibility
- Authority
- Lifecycle State
- Version
- Evidence Links
- Relationship Links
- Created Date
- Modified Date
- ScopeVersion placeholder
- Customer
- Source
- Geometry
- Classification
- Confidence

Inventory records also carry organization, workspace, owner, visibility, authority, lifecycle state, customer, and source metadata.

## Customer Twin Recovery

Customer Twin now builds from runtime inventories and runtime objects. It no longer depends on local static KMZ loading.

Persistence model:

- Customer Inventory is an organization asset.
- Runtime objects persist independently of the user session.
- Ryan, Fran, and Kyle can consume the same Customer Inventory when visibility/authority allows it.
- Private opportunity edits remain workspace responsibility until shared.

The loader also accepts runtime inventory line geometry even when an imported JSON uses customer-specific classifications such as `CUSTOMER_ROUTE` or `CUSTOMER_SEGMENT`.

## Opportunity Workflow Recovery

New Opportunity no longer starts as a blank map.

The recovered flow is:

Customer Twin -> Select Existing Inventory -> Extend Existing Network or Create Greenfield Corridor -> A/Z Controller -> OSRM -> Commercial Draft -> Engineering Draft -> Proposal

Commercial Opportunity persistence now uses the authenticated Opportunity Library. Save, open, clone, archive, share, and assign are routed through governed server endpoints.

Ownership and authority behavior:

- Default visibility is private.
- Owner/contributor/approver authority governs modification.
- Reviewer/executive assignment grants review visibility without uncontrolled edit rights.
- Ryan cannot modify Kyle's private drafts without authority.
- Kyle cannot modify Ryan's private drafts without authority.
- Shared Customer Inventory remains consumable by both when it is organization-visible.

## Cloudflare Runtime Validation

Application API calls are relative through `DAL_API = ""`.

Removed app-level deployment assumptions:

- no client localhost API base
- no `127.0.0.1` API proxy fallback
- no hardcoded app API port fallback
- server URL parsing no longer uses a localhost base

Remaining `http://` strings are XML namespace literals for KML parsing fixtures and are not network calls.

Runtime mutations now require authenticated bearer context for `/api/runtime/commit` and runtime foundation mutations.

## Validation Results

Commands run:

- `npx tsc --noEmit -p tsconfig.json`
- `npm.cmd run build`
- temporary runtime endpoint validation with isolated `DAL_DATA_ROOT`

Endpoint validation proved:

- `/health` returned healthy.
- unauthenticated `/api/runtime/commit` returned `401`.
- Ryan logged into `workspace-teralinx-ryan`.
- authenticated runtime commit returned `COMMITTED`.
- evidence, inventory, runtime object, and history records persisted.
- persisted object retained owner, authority, visibility, and workspace.

Build note:

- Vite build succeeded.
- Existing large bundle warning remains; it is not introduced by this sprint.
