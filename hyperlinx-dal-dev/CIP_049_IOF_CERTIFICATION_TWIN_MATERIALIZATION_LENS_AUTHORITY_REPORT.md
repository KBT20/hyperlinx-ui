# CIP-049 — IOF Certification → Twin Materialization & Lens Authority Report

## Result

The real `3SWR` Engineering package was certified through the existing server-authoritative certification transaction. The immutable Certification Ledger and Certified IOF projection were persisted, and the existing IOF Package Twin repository now exposes the certified IOF as the current governed Twin state.

Current Twin state:

- IOF: `CERTIFIED`
- Certification: `CERTIFIED`
- Execution: `NOT_AUTHORIZED`
- Service Order: `NOT_CREATED`
- ScopeVersion: `NOT_CREATED`

No Service Order or ScopeVersion was created.

## Exact certification request and result

The explicit `Certify IOF Package` client action now submits the canonical revision identity returned by server approval eligibility. The exercised request used:

- Draft IOF Package: `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Engineering Package: `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Engineering Revision: `ENG-REV-ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2-000`
- Engineering Revision hash: `engineering-revision-29ac9a51d822ac4a`
- Engineering Approval: `ENG-APPROVAL-ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2-29ac9a51d822ac4a-2bc2d2c47f53`
- Engineering Approval hash validated by the server: `b22a98a39fdbf389733d96190b986024c9f4b9e9581dc487fab81c7133461f80`
- Checklist confidence: `94`
- Station authority count: `7,957`
- Object assignment count submitted by reference: `433`
- Engineering-approved budget total: `$433,000`
- Request mode: compact reference-only station/object basis; no giant graph was retransmitted

Successful transaction result:

- HTTP result: `200`
- Duration: `15,299 ms`
- Certified IOF identity: `CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Certification Ledger: `CERT-LEDGER-CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Certification hash: `aaa450430fa23eb42fa6ccaceb491024497a92c37abe265c5b0a97a7ea49f022`
- Certified by: `Kyle`
- Certified at: `2026-08-14T16:31:05.458Z`

The handler preserved its existing route, geometry, doctrine, projected-object, constitutional-state, quantity, constraint, exact-approval, and immutable-reference predicates. Two obsolete embedded-payload assumptions were made reference-compatible without weakening authority: an empty legacy `proposedIofUnits` array now resolves through the governed Projected Object Manifest, and embedded work/state graphs are no longer required when the immutable Closure Ledger, Twin, execution/lifecycle graph references, and Constitutional State Validation are present and `PASS`.

## Certification → Twin trace

```text
Engineering Revision
  → exact Human Engineering Approval
  → Certification Ledger
  → Certified IOF projection
  → IOF Package Twin repository
  → current Certified IOF Twin projection
```

Logical Twin identity:

`DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2:IOF-PACKAGE-TWIN`

Current state identity:

`DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2:IOF-PACKAGE-TWIN:CERTIFIED:aaa450430fa23eb4:V4`

The original pre-certification Twin artifact was not overwritten as the current certified state. During validation, four append-only certified-state schema projections were retained rather than erased; `V4` is the current state and points to `V3`, preserving the normalization history. All share the same logical Twin identity and certification hash. A fresh certification using the final contract creates only the current `V4` contract record.

## Governed content and lineage

- Organization / tenant: `org-teralinx`
- Customer: `customer-account-2`
- Account: `account-2`
- Opportunity: `OPP-DEMO-OPPORTUNITY-3SWR-1786645604709`
- Product: `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER`
- Product Doctrine: `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER`, version `20C.1.0`
- Project configuration: `OPP-DEMO-OPPORTUNITY-3SWR-1786645604709:DUCT-DARK-FIBER-CONFIG:R1`
- Proposal: `PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Proposal Revision: `PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`
- Proposal hash: `bf45a5b291f79acbedddec87487fe37a0db118d92d569a1c3e2a0754a7ab437e`
- Commercial Revision: `COMM-REV-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-V1-PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`
- Commercial Revision hash: `commercial-revision-8a77a0d019f16d94`
- Commercial Release: `COMM-REL-COMM-REV-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-V1-PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1-commercial-release-9cae2`
- Commercial Release hash: `commercial-release-9cae2ac1e9b5c1d1`
- Engineering Revision and Human Approval: exact identities/hashes listed above

Authority counts exposed by the Twin:

- Stations: `7,957`
- Governed constitutional objects: `437`
- Route-projected objects: `433`
- Governed spans: `436`
- Route-projected spans: `432`
- Work segments: `1,308`
- Engineering conditions: `1`; resolved/accepted: `1`; open: `0`

The difference between governed and route-projected counts is explicit; the values are not treated as conflicting presentations.

Quantity authority remains a reference to `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2:COMMERCIAL-AUDIT-RECONCILIATION` and its immutable repository hash. Object, station, centerline, Closure Ledger, execution graph, lifecycle graph, Product Doctrine, configuration, and evidence content remain reference-only in Twin state.

## Route and shared-map validation

- Commercial Route Repository: `ROUTE-REPO-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-COMMERCIAL-DRAFT-IMPORT-ROUTE-HELSWR-REVISED-71526-1`
- Route revision: `1`
- Geometry hash: `rg-0d302bb0`
- Orientation: `SOURCE_START_TO_END`
- Route: `150.68 miles` / `795,574 feet`
- Governed coordinates projected: `340`
- Endpoints projected: `2`

Twin uses `Commercial Route Repository → Shared Opportunity Map Projection → MapKernel`. It does not hydrate the full Draft IOF solely to draw the route and does not reconstruct Twin geometry. Browser validation rendered one MapKernel SVG in `REGIONAL` disclosure with A/Z and no thousands-of-label regional rendering.

## Lens authority

The persisted lens contract has `sourceAuthority: CERTIFIED_IOF_TWIN`, `sharedStateIdentityRequired: true`, `mutationAuthority: NONE`, and `reasoningAuthority: ADVISORY_ONLY`.

- Marketplace may read certified objects, quantities, constraints, geography, work-package references, and configuration. Vendor responses cannot become Twin truth without future governed reconciliation/change authority.
- Control may inspect the certified planned state but cannot release work while execution is `NOT_AUTHORIZED` and ScopeVersion is `NOT_CREATED`.
- Field is read-only/fail-closed before a signed Service Order and ScopeVersion; certification alone creates no field work.
- Operational Intelligence can inspect certified planned state immediately; future authorized/actual comparison remains downstream work.
- Reasoning may inspect, summarize, explain, flag discrepancies, and recommend. It cannot certify, approve, authorize, close, or mutate governed state.

No major new lens workflow was introduced.

## Engineering completed-state UX

The existing Engineering success surface now shows IOF certification, execution not authorized, Service Order not created, ScopeVersion not created, and a primary `View IOF Twin` action. The action opens the existing Twin workspace.

The certified Twin surface leads with lifecycle state, product/opportunity, route mileage/revision, and the shared Opportunity Map. Certification lineage and certified basis remain visible; lens authority and package-integrity hashes are collapsed under `Lens Authority & Package Integrity`.

## Certified revision immutability

An attempted reassignment mutation against the certified Draft IOF returned HTTP `409`. The existing unit/change handlers also fail closed for `CERTIFIED` status and direct callers to a new proposal/revision cycle. The certified Engineering Revision and Human Approval were not modified.

Expected future path remains:

`Certified R1 → proposed change → Engineering Revision R2 → review → approval → certification → Twin state transition`.

## Reload and console validation

A real full browser reload was executed through the existing debug browser, followed by navigation to Twin. Rehydration came from the Certification Ledger, Certified IOF, IOF Package Twin, and Commercial Route repositories—not React-only state.

Visible after reload:

- Certified IOF Twin: yes
- `CERTIFIED`: yes
- `NOT AUTHORIZED`: yes
- Service Order `NOT CREATED`: yes
- ScopeVersion `NOT CREATED`: yes
- Shared Opportunity Map: yes
- Certification lineage: yes
- Lens authority/integrity surface: yes

Console results:

- Runtime exceptions: `0`
- Integrity/render-authority failures: `0`
- Failed repository requests: `0`
- Console errors: `0`
- Non-reasoning console warnings: `0`
- Reasoning infrastructure warnings: isolated circuit-breaker warning only; certification/Twin remained functional

## Repository mutation audit

Certification created or updated only these lifecycle projections/records:

- Certification Ledger: one immutable entry
- Certified IOF repository: one reference-only projection
- IOF Package Twin repository: append-only certified state records; current state is `V4`
- Draft IOF Package: existing lifecycle contract updated it to `CERTIFIED`, added certification/Twin references, and stored a compact reference-only station-plan summary plus certified object IDs
- Engineering Package: existing lifecycle/status projection updated to `ENGINEERING_CERTIFIED`
- Engineering Intake: existing lifecycle/status projection updated to `CERTIFIED`
- Runtime object mirrors: Certified IOF and Draft IOF status projections
- Runtime history: certification/checklist audit events
- Runtime workspace: normal login/workspace activity timestamp

No matching record was created in Service Orders or ScopeVersions. Counts for the certified package remained unchanged at zero matches.

The exercised legacy `persistDraftPackage` path physically rewrote the existing immutable IOF artifact files with their same governed payload/reference identities while freezing the Draft IOF. This unnecessary write amplification was discovered during the mutation audit and repaired: certification now reuses existing artifact references and no longer calls artifact persistence for the lifecycle-only Draft IOF update. No source authority identity or content was changed by the exercised transaction.

No Commercial Route, Proposal Revision, Commercial Revision, Commercial Release, Engineering Baseline, Engineering Revision, Engineering Approval, Product Doctrine, or Project Configuration semantic mutation was performed.

## Performance

- Certification transaction: `15,299 ms` — over 500 ms; dominant remaining performance gap
- Twin materialization alone with already-hydrated certification context: `22.6 ms`
- Certified Twin API projection including 340-coordinate shared map: `335 ms` cold; approximately `166–186 ms` warm after process warm-up
- Twin API response: `35,033 bytes`
- Full development-browser reload to certified Twin-ready DOM: approximately `12.4 s` — over 500 ms; includes application bootstrap/auth/reasoning startup and remains a performance gap
- Map projection no longer incurs the prior approximately `26 s` full Draft IOF hydration
- Object disclosure: resolution-aware MapKernel policy; regional validation rendered one map SVG and compact A/Z/route disclosure

Integrity was not weakened for these improvements.

## Regression results

- `npm run build`: PASS
- `npx tsc --noEmit -p tsconfig.json`: PASS
- Exact revision/approval hash binding: PASS
- Certification Ledger persistence: PASS
- Certified IOF projection: PASS
- Twin state and lineage persistence: PASS
- Shared route revision/hash/orientation: PASS
- Reference-only station/object/state authority compatibility: PASS
- Certified revision mutation fail-closed: PASS (`409`)
- Service Order unchanged: PASS
- ScopeVersion unchanged: PASS
- Full browser reload/rehydration: PASS
- Browser console integrity: PASS; reasoning warning isolated

## Remaining architectural gaps

- Certification remains a 15.3-second synchronous transaction and needs profiling below its current integrity gates; this CIP did not weaken or split those gates.
- Full development-browser reload remains about 12.4 seconds even though Twin/map repository projection is sub-500-ms after warm-up.
- Marketplace, Control, Field, and Operational Intelligence still need their future governed interaction/event workflows; CIP-049 establishes only their read/mutation authority contract.
- Service Order, customer signature, ScopeVersion activation, and execution-state transition intentionally remain for CIP-050.

## Stop condition

Met. The real certified IOF is represented by the governed Twin with the same route, station/object/quantity/constraint/configuration/certification lineage. Execution is not authorized, Service Order is not created, and ScopeVersion is not created. Work stops here before CIP-050.
