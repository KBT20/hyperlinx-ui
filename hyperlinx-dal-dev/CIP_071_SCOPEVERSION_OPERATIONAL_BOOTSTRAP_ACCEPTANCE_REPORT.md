# CIP-071 — ScopeVersion Operational Bootstrap & Lens-Neutral Execution Authority Acceptance Report

Date: 2026-08-17  
Environment: DAL1 / `org-demo`  
Starting runtime: `77fa28344776004669e2bb54684bb47a556d59fb`  
Accepted/deployed runtime: `3587fef53959c622495415be6e0a7ed3eabcac66`  
Result: **PASS**

## Constitutional result

The existing Northstar ScopeVersion is now resolved through one canonical, server-authoritative, read-only Operational Baseline. Marketplace, Control, Field, and Twin consume bounded projections of that same baseline. Bootstrap persists no record and creates no alternate authority chain. ScopeVersion remains the Order for Execution; governed Close remains the only realized-spine mutation boundary.

Direct HTTP creation of a ScopeVersion is now rejected with `403`. The existing atomic authorized countersignature transaction remains the creation authority.

## Exact authority used

- Account: `ACCOUNT-DEMO-NORTHSTAR` — Northstar Cloud Infrastructure
- Opportunity: `OPPORTUNITY-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Proposal Revision: `PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE-revision-2`
- Proposal hash: `7e0fe9001045e2a5d4f98b0ea3bd9192a3024eef98a535fc7bc20f6d3e4a7a58`
- Engineering Package: `ENG-PKG-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Engineering Revision: `ENG-REV-ENG-PKG-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE-000`
- Engineering Approval: `ENG-APPROVAL-ENG-PKG-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE-06090e31b2fd9a8b-0cc5ab3e128b`
- Certified IOF: `CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Certified IOF hash: `7c311a10f17114662f9d97946f65944e4c9b1c870824980c62fd6b73099361cc`
- Service Order: `SO-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE-R001`
- Service Order hash: `d9bc7fcf443e385f11ee447761a7d28f0e7bec1922e458034ab4fd22c663cce1`
- ScopeVersion: `ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`, revision 1
- ScopeVersion deterministic content hash: `ecf3c5a65650bd024b97f838bd9e6d735003538231ab7d70172d2981e810e13d`
- Product Doctrine: `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER`, version `20C.1.0`
- Product Doctrine hash: `81c488a6d4bd35183e35eabf1a1c533e53a7c700d38db5d5bf67e8c2b3883bdd`

No Proposal, certification, signature, Service Order, ScopeVersion, or upstream authority was regenerated.

## Operational Baseline

- Baseline ID: `OPERATIONAL-BASELINE-ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Baseline hash: `395809c8e3ce2f77fa7efce39ecce8bb9cdfea6587f76ccbd8917bd94f72c3e1`
- Contract version: 1
- Materialization: deterministic response projection; not persisted
- Canonical API: `GET /api/operational-baselines/:scopeVersionId`
- Lens API: `GET /api/operational-baselines/:scopeVersionId/lenses/:lensId`

The hash covers the exact ScopeVersion, Certified IOF, Service Order, geometry, station authority, object manifest, execution graph, lifecycle graph, and closure ledger reference set. Strict Draft IOF artifact hydration verifies persisted artifact IDs, revisions, hashes, and organization/opportunity scope.

## Spatial and operational census

- Route: `ROUTE-DEMO-CIP067-NORTHSTAR-PERSISTENCE`, revision 1
- Geometry: `ROUTE-DEMO-CIP067-NORTHSTAR-PERSISTENCE:GEOMETRY:v1`
- Geometry hash: `rg-64c0ada0`
- Governed spine: `DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE:MEASURED-CENTERLINE:mc-2f23e2248c2a`
- Stations: 54
- Authorized objects: 4
- Governed relationships/addresses/spans: 7
- Authorized work segments: 9
- Closure events: 0
- Initial state: `AUTHORIZED_NOT_REALIZED`; `physicallyComplete=false`; `realized=false`

Bound authorities:

- Closure Ledger: `DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE:CLOSURE-LEDGER`
- Execution Graph: `DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE:EXECUTION-GRAPH`
- Lifecycle Graph: `DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE:LIFECYCLE-GRAPH`
- Authorized Twin: `DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE:IOF-PACKAGE-TWIN:AUTHORIZED:ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE:V1`
- Authorized Twin hash: `1c5bba9c3438a81e563d86499586075968a77055d35ed8db01a75b1b7fefb283`

## Lens parity

Marketplace, Control, Field, and Twin returned the same ScopeVersion, route revision, geometry ID/hash, 54 station identities, 4 object identities, 7 relationship identities, and 9 work-segment identities. Each projection declares `mutatesSpine=false` and `createsCloseAuthority=false`.

- Marketplace may create fulfillment evidence/state; fulfillment is not Close.
- Control may create execution workflow state; Control completion is not Close.
- Field may record activity/evidence; Field completion is explicitly `NOT_CLOSE_AUTHORITY`.
- Twin is projection-only with mutation authority `NONE`.
- Future lenses can register against the same baseline contract without changing ScopeVersion semantics.

The shared UI authority banner is present in all four workspaces. It displays customer/account context, Opportunity, exact ScopeVersion, route revision, station/object/work census, and `AUTHORIZED · NOT REALIZED`.

## Negative and isolation evidence

- Missing ScopeVersion bootstrap: **REJECTED** with a structured predicate.
- Non-GET Operational Baseline request: **REJECTED** (`405`).
- Direct human/API ScopeVersion creation: **REJECTED** (`403`).
- Production repository context resolving Northstar Demo authority: **REJECTED**.
- Demo repository context resolving Production authority: **REJECTED**.
- Customer personas remain blocked from internal operational routes by the existing bounded Customer lens policy.
- Marketplace direct spine mutation: **REJECTED by capability contract; no such API exists**.
- Control direct spine mutation: **REJECTED by capability contract; no such API exists**.
- Field direct spine mutation: **REJECTED by capability contract; Field activity is not Close authority**.
- Twin direct spine mutation: **REJECTED by capability contract; no such API exists**.

No test-only mutation endpoint was created.

## Persistence, restart, and deployment evidence

- Two consecutive baseline reads were byte-equivalent.
- A fresh login and full four-lens acceptance run passed.
- PM2 was restarted; a second fresh login and full run produced byte-identical JSON.
- Baseline hash before/after restart: `395809c8e3ce2f77fa7efce39ecce8bb9cdfea6587f76ccbd8917bd94f72c3e1`.
- PM2 process: `hyperlinx-dal-api`, status `online`.
- Public runtime: HTTP 200, Git commit `3587fef53959`.
- Public application bundle: `assets/index-NN3lWHHz.js`.
- Public Operational Authority chunk: HTTP 200; contains canonical `operational-baselines` client binding.

Pre/post governed repository reconciliation:

- Production: 2,477 files, checksum-identical.
- Demo: 179 files, checksum-identical.
- Northstar lineage mutations: zero.
- Demo governed mutations: zero.
- New ScopeVersions: zero.
- New Proposals: zero.
- Demo reset: zero.
- PostgreSQL cutover: zero.
- Chicago access: zero.

## Acceptance matrix

| Requirement | Result |
|---|---|
| Existing ScopeVersion / immutability | PASS |
| Certified IOF / Service Order / Proposal / Opportunity / Account lineage | PASS |
| Deterministic, idempotent, reference-oriented Operational Baseline | PASS |
| Restart persistence | PASS |
| Route / revision / geometry / spine identity | PASS |
| Station / object / relationship / work-segment identity | PASS |
| Closure Ledger / Execution Graph / Lifecycle Graph / Authorized Twin binding | PASS |
| Marketplace / Control / Field / Twin bootstrap | PASS |
| Cross-lens ScopeVersion, route, station, object, and work parity | PASS |
| Lens-neutral contract and future extensibility | PASS |
| Planned versus realized distinction | PASS |
| ScopeVersion does not imply completion | PASS |
| Close preserved as realized mutation boundary | PASS |
| Field / Control / Marketplace completion is not Close | PASS |
| Actor attribution capability | PASS |
| Organization isolation | PASS |
| Customer operational mutation | REJECTED |
| Refresh / logout-login / PM2 restart persistence | PASS |
| Existing authority regeneration or governed data mutation | ZERO |

## Boundaries preserved

File persistence remains the accepted authority. No PostgreSQL cutover was performed. Production governed records were not mutated. Demo was not reset. Chicago was not accessed. Redline and detailed Marketplace, Control, Field, validation, and Close workflows were not implemented under CIP-071.
