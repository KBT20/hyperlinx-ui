# DAL Server Contract Audit

Date: 2026-06-17

Scope: DAL development environment only. This audit enumerates API endpoints expected by the DAL UI, compares them against the repo-local DAL server implementation, probes the configured DAL1 endpoint, and identifies where browser IndexedDB fallback may currently be mistaken for authoritative truth.

Configured environment from `hyperlinx-dal-dev/.env`:

```text
VITE_DAL_API=http://67.213.118.179:3001
VITE_DAL_BASELINE_API=http://67.213.118.179:3001
VITE_DAL_BASELINE_GRAPH_API=http://67.213.118.179:3001
VITE_DAL_INVENTORY_GRAPH_API=http://67.213.118.179:3001
VITE_DAL_GEOCODER_PROVIDER=server
VITE_DAL_REASONING_PRIMARY_API=http://72.46.85.137:8000
```

## Executive Finding

DAL1 `67.213.118.179:3001` currently behaves as a baseline graph persistence service, not the full DAL truth server expected by the UI.

Live probes confirm:

- `GET /api/baseline-graphs` returns `200` and persisted inventory metadata.
- `GET /api/baseline-graphs/:inventoryId` returns `200` and inventory ScopeVersion metadata.
- `GET /api/baseline-graphs/:inventoryId/chunks/:chunkIndex?chunkType=nodes` returns `200`.
- Most non-inventory DAL endpoints return `404 Cannot GET ...`.
- `POST /api/geocode` returns `404 Cannot POST /api/geocode` even though the UI is configured for server geocoding.

This means several DAL workflows can currently prove architecture against browser IndexedDB fallback rather than DAL1 server truth.

## Constitutional Rule

A ScopeVersion may never derive authority from browser fallback data when an authoritative DAL endpoint is expected.

Browser fallback exists only for development continuity and may not establish truth.

If a required server endpoint is missing, records loaded from IndexedDB must be labeled:

```text
NOT AUTHORITATIVE
```

and must not be treated as DAL Truth.

## Expected API vs Actual API

Live status was probed against `http://67.213.118.179:3001` on 2026-06-17. Create/update routes were not mutation-tested unless noted.

| Endpoint | Expected By | Repo-Local Server | Live DAL1 Status | Returns Mock Data? | Authority |
| --- | --- | --- | --- | --- | --- |
| `GET /api/baseline-graphs` | Inventory Recovery, `listServerBaselineGraphMetadata` | Not in repo-local server | `200` | No; returned persisted inventory metadata for `test` and two 10-node inventories | DAL baseline graph truth |
| `POST /api/baseline-graphs` | Inventory Recovery push | Not in repo-local server | Not mutation-tested; service advertises CORS and workflow expects it | No evidence of mock | DAL baseline graph truth if accepted |
| `GET /api/baseline-graphs/:inventoryId` | Inventory Recovery, graph rehydration | Not in repo-local server | `200` for `inventory-984fa8a3-5a66-42d5-849c-abe3e88d9d88` | No | DAL baseline graph truth |
| `POST /api/baseline-graphs/:inventoryId/chunks` | Inventory Recovery push | Not in repo-local server | Not mutation-tested | No evidence of mock | DAL baseline graph truth if accepted |
| `GET /api/baseline-graphs/:inventoryId/chunks/:chunkIndex?chunkType=nodes` | Inventory Recovery pull | Not in repo-local server | `200` | No | DAL baseline graph truth |
| `GET /api/baseline-graphs/:inventoryId/chunks/nodes/0` | Legacy/alternate chunk shape | Not expected by current UI | `404` | No | None |
| `GET /api/inventory-graphs` | `listInventoryGraphs` alias path | Not implemented | `404` | No | None |
| `POST /api/inventory-graphs` | `saveInventoryGraph` alias path | Not implemented | Not mutation-tested; corresponding GET is `404` | No | None |
| `GET /api/inventory-graphs/:id` | `loadInventoryGraph` alias path | Not implemented | Not probed; parent route is `404` | No | None |
| `GET /api/candidate-sites` | Candidate Sites, Network Affinity, Site Decision | Not implemented | `404` | No | None |
| `POST /api/candidate-sites` | Save single candidate | Not implemented | Not mutation-tested; list route is `404` | No | None |
| `POST /api/candidate-sites/bulk` | Candidate import/geocode save | Not implemented | Not mutation-tested; list route is `404` | No | None |
| `POST /api/geocode` | Candidate server geocoder | Implemented repo-local | `404` | No | None |
| `GET /api/opportunity-seeds` | Candidate Sites, Portfolio, Site Decision, Twin | Not implemented | `404` | No | None |
| `POST /api/opportunity-seeds` | Save seed | Not implemented | Not mutation-tested; list route is `404` | No | None |
| `POST /api/opportunity-seeds/bulk` | Save generated seed batch | Not implemented | Not mutation-tested; list route is `404` | No | None |
| `GET /api/prism/opportunities` | Prism workspace | Not implemented | `404` | No | None |
| `POST /api/prism/opportunities` | Save Prism opportunity | Not implemented | Not mutation-tested; list route is `404` | No | None |
| `GET /api/marketplace/quotes` | Marketplace, Site Decision, Control, Operational Intelligence | Not implemented | `404` | No | None |
| `POST /api/marketplace/quotes` | Quote generation | Not implemented | Not mutation-tested; list route is `404` | No | None |
| `GET /api/graph-extensions` | Graph Extension workspace | Not implemented | `404` | No | None |
| `GET /api/graph-extensions/:id` | Graph Extension load | Not implemented | Not probed; parent route is `404` | No | None |
| `POST /api/graph-extensions` | Save Graph Extension | Not implemented | Not mutation-tested; list route is `404` | No | None |
| `GET /api/scopeversions` | ScopeVersion repository, many workspaces | Implemented repo-local | `404` | No | None on DAL1 |
| `POST /api/scopeversions` | Create ScopeVersion | Implemented repo-local | Not mutation-tested; list route is `404` | No | None on DAL1 |
| `GET /api/scopeversions/:id` | Load ScopeVersion | Implemented repo-local | Not probed; parent route is `404` | No | None on DAL1 |
| `PUT /api/scopeversions/:id` | Update ScopeVersion | Implemented repo-local | Not mutation-tested; parent route is `404` | No | None on DAL1 |
| `DELETE /api/scopeversions/:id` | Delete non-certified ScopeVersion | Implemented repo-local | Not mutation-tested; parent route is `404` | No | None on DAL1 |
| `POST /api/scopeversions/:id/certify` | Certify ScopeVersion | Implemented repo-local | Not mutation-tested; parent route is `404` | No | None on DAL1 |
| `GET /api/iof-packages` | IOF Package repository, Operational Intelligence | Implemented repo-local | `404` | No | None on DAL1 |
| `POST /api/iof-packages` | Create IOF Package | Implemented repo-local | Not mutation-tested; list route is `404` | No | None on DAL1 |
| `GET /api/iof-packages/:id` | Load IOF Package | Implemented repo-local | Not probed; parent route is `404` | No | None on DAL1 |
| `PUT /api/iof-packages/:id` | Update IOF Package | Implemented repo-local | Not mutation-tested; parent route is `404` | No | None on DAL1 |
| `POST /api/iof-packages/:id/archive` | Archive IOF Package | Implemented repo-local | Not mutation-tested; parent route is `404` | No | None on DAL1 |
| `POST /api/iof-packages/:id/close` | Close IOF Package and create Close Event / child ScopeVersion | Implemented repo-local | Not mutation-tested; parent route is `404` | No | None on DAL1 |
| `GET /api/close-events` | Close Event repository, Operational Intelligence | Implemented repo-local | `404` | No | None on DAL1 |
| `POST /api/close-events` | Create Close Event | Implemented repo-local | Not mutation-tested; list route is `404` | No | None on DAL1 |
| `GET /api/close-events/:id` | Load Close Event | Implemented repo-local | Not probed; parent route is `404` | No | None on DAL1 |
| `GET /api/control/work-items` | Control, Field, Twin, Operational Intelligence | Not implemented | `404` | No | None |
| `POST /api/control/work-items` | Save Control work item | Not implemented | Not mutation-tested; list route is `404` | No | None |
| `GET /api/field/closures` | Field, Twin, Operational Intelligence | Not implemented | `404` | No | None |
| `POST /api/field/closures` | Save Field closure | Not implemented | Not mutation-tested; list route is `404` | No | None |
| `GET /api/twin/state` | Twin workspace | Not implemented | `404` | No | None |
| `GET /api/inventory-import-jobs` | Inventory Recovery import jobs | Not implemented in repo-local server | `404` | No | None |
| `GET /health` | Connectivity check for repo-local server | Implemented repo-local | `404 Cannot GET /health` | No | None on DAL1 |
| `GET /v1/models` on `72.46.85.137:8000` | Reasoning fabric health discovery | External GPU/vLLM, not DAL server | `200` | No; returned `mistralai/Mistral-7B-Instruct-v0.2` | Advisory reasoning fabric |
| `POST /api/reasoning/query` on `72.46.85.137:8000` | Reasoning panel query path | Not OpenAI-compatible vLLM route | `404` via OPTIONS probe | No | None |

Note: DAL1 returns generic CORS `204` to `OPTIONS` on missing routes. `OPTIONS 204` is not evidence that an endpoint exists.

## Repo-Local Server vs Configured DAL1

`hyperlinx-dal-dev/server/index.js` implements:

- `POST /api/geocode`
- `GET/POST /api/scopeversions`
- `GET/PUT/DELETE /api/scopeversions/:id`
- `POST /api/scopeversions/:id/certify`
- `GET/POST /api/iof-packages`
- `GET/PUT /api/iof-packages/:id`
- `POST /api/iof-packages/:id/archive`
- `POST /api/iof-packages/:id/close`
- `GET/POST /api/close-events`
- `GET /api/close-events/:id`
- `GET /health`

The configured DAL1 server at `67.213.118.179:3001` does not currently expose those repo-local routes. It exposes baseline graph routes. Therefore, when the DAL UI runs against DAL1, ScopeVersions, IOF Packages, Close Events, and geocoding fall back or fail unless another process/port is configured.

## IndexedDB Fallback Usage

IndexedDB database:

```text
hyperlinx-dal-dev
```

Object stores:

```text
inventoryGraphs
inventoryImportJobs
candidateSites
graphExtensions
scopeVersions
iofPackages
closeEvents
opportunities
opportunitySeeds
quotes
workItems
closures
```

Fallback paths found:

| Fallback Path | Trigger | IndexedDB Store | Affected Workspace | Authority Risk |
| --- | --- | --- | --- | --- |
| `listInventoryGraphs` | `/api/inventory-graphs` fails; baseline graph discovery may still succeed | `inventoryGraphs` merged with server baseline metadata | Translate, Inventory, Inventory Recovery, Graph Viewer, Network Affinity, Site Decision | Medium. Server baseline graph metadata is authoritative; browser-only graph records are not. |
| `loadInventoryGraph` | Baseline graph load and `/api/inventory-graphs/:id` fail | `inventoryGraphs` | Graph Viewer, Network Affinity, Site Decision | High when graph is browser-only. |
| `saveInventoryGraph` | `/api/inventory-graphs` fails | `inventoryGraphs` | Translate, Inventory Workspace | High. Saves browser-only graph unless baseline graph recovery push is used. |
| `listCandidateSites` | `/api/candidate-sites` fails | `candidateSites` | Candidate Sites, Network Affinity, Site Decision, Twin | Critical. Candidate coordinates and certifications may be browser-only. |
| `saveCandidateSite(s)` | `/api/candidate-sites` or `/bulk` fails | `candidateSites` | Candidate import/geocode/review | Critical. Texas 400 can be local-only. |
| `geocodeCandidateSiteViaServer` | `POST /api/geocode` fails | No direct store; returns `FAILED_GEOCODE`, then saved through `candidateSites` | Candidate Sites | Critical. Server geocoder is configured but absent on DAL1. |
| `listOpportunitySeeds` | `/api/opportunity-seeds` fails | `opportunitySeeds` | Candidate Sites, Portfolio, Site Decision, Twin | High. Opportunity ranking can be browser-only. |
| `saveOpportunitySeed(s)` | `/api/opportunity-seeds` or `/bulk` fails | `opportunitySeeds` | Candidate Sites, Prism, Portfolio | High. Portfolio state can be browser-only. |
| `listPrismOpportunities` / `savePrismOpportunity` | `/api/prism/opportunities` fails | `opportunities` | Prism | High. Prism opportunities are local fallback. |
| `listMarketplaceQuotes` / `saveMarketplaceQuote` | `/api/marketplace/quotes` fails | `quotes` | Marketplace, Site Decision, Control, Operational Intelligence | Critical. Commercial quote truth may be browser-only. |
| `listGraphExtensions` / `saveGraphExtension` | `/api/graph-extensions` fails | `graphExtensions` | Graph Extension workspace | Critical. Extension truth may be browser-only. |
| `listScopeVersions` / create/update/delete | `/api/scopeversions` fails | `scopeVersions` | Inventory Recovery, Site Decision, Marketplace, Control, Operational Intelligence | Critical. ScopeVersion truth may be browser-only on DAL1. |
| `listIofPackages` / create/update/archive/close | `/api/iof-packages` fails | `iofPackages`; close also writes `closeEvents` and may create local child ScopeVersion | IOF Package flows, Operational Intelligence | Critical. Execution truth may be browser-only. |
| `listCloseEvents` / create | `/api/close-events` fails | `closeEvents` | Operational Intelligence, package closure | Critical. Authorized transformation truth may be browser-only. |
| `listControlWorkItems` / save | `/api/control/work-items` fails | `workItems` | Control, Field, Twin | High. Work execution state can be browser-only. |
| `listFieldClosures` / save | `/api/field/closures` fails | `closures` | Field, Twin, Operational Intelligence | High. Field closure state can be browser-only. |
| `loadTwinState` | `/api/twin/state` fails | Derived from `workItems` and `closures` | Twin | Medium to high. Twin can display derived local runtime state. |
| `listInventoryImportJobs` / get job | `/api/inventory-import-jobs` fails | `inventoryImportJobs` | Inventory Recovery | Medium. Import telemetry can be browser-only. |
| Constraint reference layers | No DAL server endpoint observed | In-memory registry/session state | Route Engineering, Constraint Evidence, Certification Authority | Critical for certification. Missing reference layers produce incomplete/unknown evidence and must not imply certified route truth. |

## Certification Risk Audit

| Domain | Current Server Authority on DAL1 | Browser Fallback Present? | Authoritative? | Notes |
| --- | --- | --- | --- | --- |
| Inventory Graphs | Yes, but only through `/api/baseline-graphs` | Yes, `inventoryGraphs` | Server-backed inventories only | Browser-only inventory graphs are NOT AUTHORITATIVE. |
| Candidate Sites | No, `/api/candidate-sites` is `404` | Yes, `candidateSites` | No | Candidate Sites currently derive from browser fallback when DAL1 is configured. |
| Quotes | No, `/api/marketplace/quotes` is `404` | Yes, `quotes` | No | Preliminary quotes can be local-only and must not be treated as commercial truth. |
| ScopeVersions | No, `/api/scopeversions` is `404` on DAL1 | Yes, `scopeVersions` | No on DAL1 | Repo-local server supports ScopeVersions, but configured DAL1 does not expose them. |
| Geocoding | No, `POST /api/geocode` is `404` on DAL1 | Results can be saved into `candidateSites` after failure/manual approval | No | Server geocoder is configured but missing on DAL1. |
| Constraint Layers | No server endpoint observed | In-memory registry/session state | No | Constraint evidence may be complete only if layers are loaded in the session. Otherwise it must be incomplete/unknown. |
| IOF Packages | No, `/api/iof-packages` is `404` on DAL1 | Yes, `iofPackages` | No on DAL1 | Repo-local server supports packages, but DAL1 does not expose them. |
| Close Events | No, `/api/close-events` is `404` on DAL1 | Yes, `closeEvents` | No on DAL1 | Authorized transformations may be local-only. |
| Work Items / Field Closures | No | Yes, `workItems`, `closures` | No | Execution views can be browser-local. |
| Reasoning | GPU `/v1/models` is online | No truth fallback; query path currently 404 on vLLM | Advisory only | Reasoning fabric cannot establish DAL truth. |

## Missing Authoritative Endpoints

These endpoints are expected by DAL UI but absent from configured DAL1 `:3001`:

```text
POST /api/geocode
GET  /api/inventory-graphs
POST /api/inventory-graphs
GET  /api/candidate-sites
POST /api/candidate-sites
POST /api/candidate-sites/bulk
GET  /api/opportunity-seeds
POST /api/opportunity-seeds
POST /api/opportunity-seeds/bulk
GET  /api/prism/opportunities
POST /api/prism/opportunities
GET  /api/marketplace/quotes
POST /api/marketplace/quotes
GET  /api/graph-extensions
POST /api/graph-extensions
GET  /api/scopeversions
POST /api/scopeversions
GET  /api/iof-packages
POST /api/iof-packages
GET  /api/close-events
POST /api/close-events
GET  /api/control/work-items
POST /api/control/work-items
GET  /api/field/closures
POST /api/field/closures
GET  /api/twin/state
GET  /api/inventory-import-jobs
```

## Actual DAL1 Baseline Graph API

The currently functioning authoritative API is:

```text
GET /api/baseline-graphs
GET /api/baseline-graphs/:inventoryId
GET /api/baseline-graphs/:inventoryId/chunks/:chunkIndex?chunkType={nodes|edges|stations|routes}
```

Observed metadata:

```text
test
inventory-984fa8a3-5a66-42d5-849c-abe3e88d9d88
inventory-a37ed47b-ce91-4cad-b4fb-761f3717d1b0
```

The two inventory records report:

```text
nodeCount = 10
edgeCount = 9
stationCount = 559
routeCount = 1
chunkCounts = 1/1/1/1
```

## Authority Risk Summary

The biggest risk is not rendering or route logic. It is authority ambiguity.

When DAL UI is pointed at DAL1 `67.213.118.179:3001`, the following are currently not DAL server truth:

- Candidate Sites
- Candidate geocoding results
- Opportunity Seeds
- Marketplace Quotes
- ScopeVersions
- IOF Packages
- Close Events
- Control Work Items
- Field Closures
- Twin state
- Graph Extensions
- Constraint reference layers

Only server-backed baseline graph inventory is currently DAL1 truth through the configured endpoint.

## Required Contract Decision

Before building more workflow features, choose one:

1. Deploy the repo-local DAL server contract to DAL1 alongside the baseline graph service.
2. Move missing endpoints into the existing DAL1 baseline graph service.
3. Reconfigure `VITE_DAL_API` to the actual server process that exposes ScopeVersions, IOF Packages, Close Events, and geocoding.

Until one of those is true, DAL should visually mark fallback-derived records as:

```text
NOT AUTHORITATIVE
```

and block claims of DAL Truth for browser-only ScopeVersions, quotes, close events, candidate sites, and geocodes.

