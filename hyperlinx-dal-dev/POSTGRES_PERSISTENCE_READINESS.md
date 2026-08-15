# PostgreSQL / PostGIS Persistence Readiness Audit

Date: 2026-07-07

## Current Physical Storage

Storage today is JSON filesystem under `server/data`.

Server infrastructure:

- `DATA_ROOT` and `DIRS` are defined in `server/routes/_shared.js`.
- Records are written with `persistRecord(dir, id, record)`.
- API routes are registered through a `node:http` handler array in `server/index.js`.
- This runtime does not use Express `app.use(...)` in the current code path.

## Observed Data Size Pressure

Current persisted JSON records include large blobs:

- `translation-commits`: about 37.9 MB total, with one file about 36.18 MB.
- `runtime-objects`: about 31.0 MB total, with multiple files over 1 MB.
- `commercial-routes`: about 10.9 MB total, with route records up to about 2.08 MB.
- `engineering-drafts`: about 3.46 MB total, with one file about 3.3 MB.
- `commercial-opportunities`: about 754 KB total.
- `proposal-drafts`: about 353 KB total.

This confirms PostgreSQL/PostGIS is needed, but also confirms migration should normalize geometry and runtime objects instead of lifting JSON blobs as-is.

## Object Classification

| Object | Classification | Persistence Recommendation |
|---|---|---|
| Repository Truth | Authoritative, persistent | PostgreSQL row per repository object |
| Customer | Authoritative, persistent | `customers` |
| Customer Twin | Derived from runtime inventory, persistent references | `customer_twins`, `runtime_inventories`, `runtime_objects`, `runtime_relationships` |
| Commercial Opportunity | Authoritative commercial record | `commercial_opportunities` |
| Route Repository | Authoritative route geometry owner | `commercial_routes`, `route_geometries` with PostGIS |
| Route Geometry | Authoritative under Route Repository only | `route_geometries` as `LineString`/`MultiLineString` plus hash |
| Commercial Change Set | Authoritative edit intent | New `commercial_change_sets` |
| Route Edit Patch | Authoritative patch entry when saved | New `commercial_change_set_patches` |
| Commercial Revision | Authoritative audit/revision | New `commercial_revisions` |
| Corridor | Derived execution session | Optional `corridor_execution_sessions` if durable |
| Segment | Derived from route geometry | `corridor_segments` if checkpoints durable; otherwise cache only |
| Checkpoint | Runtime cache or resumable worker state | `corridor_checkpoints` only if restart recovery required |
| Workbook | Derived commercial projection, may need snapshot | `commercial_workbooks` with normalized summary + JSONB detail |
| Estimate | Derived commercial projection, may need snapshot | `commercial_estimates` |
| Proposal | Authoritative proposal state | `proposals` |
| Draft IOF Package | Authoritative engineering source package | `draft_iof_packages` |
| Engineering Package | Authoritative handoff envelope | `engineering_packages`, reference-only |
| Station Plan | Engineering-owned future artifact | `engineering_station_plans` |
| Engineering Object Budget | Engineering-owned artifact | `engineering_budget_lines` |
| Certified IOF Package | Authoritative certified package | `certified_iof_packages` |
| Service Order | Commercial authorization | `service_orders` |
| ScopeVersion | Order for Execution | `scope_versions` |
| Field Closure | Completion evidence | `field_closures`, `closure_ledgers` |
| Projection Cache | Transient/cache | Redis or bounded in-process cache; not authoritative |
| Map Geometry Slice | Projection | Never persist as truth |
| Runtime Diagnostics | Observability | Optional metrics table; not truth |

## Recommended PostgreSQL Tables

Core commercial:

- `customers`
- `contacts`
- `customer_twins`
- `commercial_opportunities`
- `commercial_routes`
- `route_geometries`
- `route_geometry_vertices` only if vertex-level querying is required
- `route_evidence`
- `commercial_estimates`
- `commercial_workbooks`
- `proposals`
- `proposal_events`
- `draft_iof_packages`
- `service_orders`

Change set / revision:

- `commercial_change_sets`
- `commercial_change_set_patches`
- `commercial_revisions`
- `route_edit_revisions`

Corridor execution:

- `corridor_execution_sessions`
- `corridor_segments`
- `corridor_segment_summaries`
- `corridor_checkpoints`
- `corridor_projection_cache_metadata`

Engineering:

- `engineering_packages`
- `engineering_reference_integrity`
- `engineering_station_plans`
- `engineering_station_assignments`
- `engineering_budget_lines`
- `engineering_constraints`
- `engineering_doctrine_exceptions`
- `certified_iof_packages`
- `execution_authorization_certificates`

Execution:

- `scope_versions`
- `scope_version_events`
- `scope_version_objects`
- `scope_version_stations`
- `marketplace_quotes`
- `control_work_items`
- `field_closures`
- `closure_ledgers`
- `operational_twin_snapshots`

Runtime foundation:

- `runtime_inventories`
- `runtime_objects`
- `runtime_relationships`
- `runtime_evidence`
- `runtime_history`
- `translation_commits`
- `translation_commit_items`
- `runtime_workspaces`
- `runtime_workspace_sessions`

## Required Constraints

Route Repository:

- `commercial_routes.route_repository_id` primary key.
- `route_geometries.route_repository_id` foreign key.
- `commercial_opportunities.route_repository_id` foreign key.
- Opportunity must not duplicate geometry columns except reference IDs/hashes.

Proposal:

- Proposal status constrained to canonical transition set:
  - `DRAFT`
  - `WAITING_CUSTOMER_REVIEW`
  - `CUSTOMER_REVIEW`
  - `COMMERCIAL_APPROVED`
  - `ENGINEERING_SUBMITTED`

Engineering Package:

- Reference-only payload constraint.
- Foreign keys to opportunity, route repository, proposal, estimate, workbook, Draft IOF package.
- `reference_hash` unique for immutable handoff identity.

ScopeVersion:

- Requires executed Service Order and customer signature evidence for execution authority.
- No Commercial-created ScopeVersion.
- Immutable/certified status blocks overwrite.

Change Set:

- Patches are append-only.
- Patch commit references route repository and opportunity.
- Repository truth updates only on explicit commit.

## Transaction Boundaries Needed

Before migration, define database transactions for:

1. Generate route -> save route repository -> verify geometry hash -> save opportunity reference.
2. Save proposal -> approve proposal -> update proposal authority state.
3. Create Draft IOF Package -> submit Engineering Package -> update Commercial status.
4. Engineering certify -> create Certified IOF Package -> mark Service Order ready.
5. Executed Service Order -> Runtime creates ScopeVersion -> lock certified package.
6. Field close -> closure ledger -> ScopeVersion derived state update.

## Readiness Decision

Verdict: `PARTIALLY READY`

Reasons ready:

- Repository domains exist.
- API routes are mostly explicit.
- Route Repository authority is canonical.
- Engineering Package is reference-only.
- ScopeVersion guard exists.
- Corridor segment model exists.
- Route edit patch model exists.

Reasons not fully ready:

- Commercial Change Set is not a first-class persistent repository.
- Route geometry still appears in compatibility snapshots and React hydration.
- Several persisted JSON records exceed 1 MB.
- Corridor checkpoints are in-process only.
- No cross-repository database transaction boundary exists.
- React workspaces still consume full records, not only IDs/projections.
- Runtime ScopeVersion promotion is present in Engineering Certification route naming.

## Migration Recommendation

Do not migrate by copying JSON blobs into JSONB tables as the primary model.

Proceed in phases:

1. Design normalized schema and foreign keys.
2. Move route geometry to PostGIS first.
3. Move Proposal, Opportunity, Route, Draft IOF, Engineering Package references next.
4. Introduce durable Change Set tables.
5. Migrate runtime inventories/objects/relationships from translation commits.
6. Add transaction tests for constitutional gates.
7. Only then migrate ScopeVersion execution authority.
