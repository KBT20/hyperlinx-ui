# CIP-052 — Marketplace Capacity, Material Fulfillment & Human Work Allocation

## Result

PASS. Marketplace now consumes the exact authorized 3SWR ScopeVersion as a bounded, reference-oriented demand projection; collects immutable vendor/supplier response versions; calculates deterministic capacity and material coverage; supports human work/material allocations and immutable awards; exposes a bounded Vendor Portal; and generates locally downloadable Bid Package PDF/KMZ artifacts.

No Commercial Route, Proposal, Engineering Package, Engineering Revision, Certified IOF, Service Order, ScopeVersion, Control work, or Field work was regenerated or mutated.

## Existing Architecture Audit

| Existing structure | Classification | Reconciliation |
|---|---|---|
| `MarketplaceWorkspace.tsx` preliminary ScopeVersion quote staging | DEPRECATE / PRESENTATION ONLY | Replaced as the primary screen by authorized fulfillment. Legacy quote data remains readable and its repository was not deleted. |
| `marketplace-quotes` API and `MarketplaceQuote` records | REUSE for legacy preliminary quotes | Kept separate as historical/pre-authorization commercial staging; not promoted into execution authority. |
| `BidPackage`, `BidPackageItem`, quantities, station/segment/object references | EXTEND | Existing package identity and reference semantics retained. Statuses now include OPEN through CLOSED, and persisted Marketplace Packages carry compatible `packageId` plus `marketplacePackageId`. |
| Bid Package generation fixtures | PRESENTATION / CONTRACT TEST EVIDENCE | Preserved. Real 3SWR package demand is projected from ScopeVersion instead of fixture quantities. |
| `VendorProfile`, qualification, service area, capability, asset and price-book contracts | REUSE | Remain the vendor discovery/qualification vocabulary. They do not become award authority. |
| `BudgetVendorResponse` | EXTEND | Backward-compatible optional fields add response series/version, structured capacity/materials, exceptions, missing dimensions and content hash. Existing fixtures still typecheck. |
| `BudgetCandidate`, comparison and lock | EXTEND / SECONDARY | Preserved for commercial candidate comparison. CIP-052 coverage is calculated from structured demand and response evidence, not free-text `capacitySummary`. |
| Control `vendorAllocationReferences` | REUSE downstream only | Existing Control boundary can later consume approved references. CIP-052 does not create or activate Control work. |
| Vendor Response persistence | NEW, no conflicting authority existed | Bounded immutable record family under Marketplace authority. |
| Work Allocation persistence | NEW, no conflicting authority existed | Human decision evidence referencing ScopeVersion and exact response versions. |
| Award persistence | NEW, no conflicting authority existed | Immutable selection evidence; explicitly non-executing. |
| Material/Pricing/Capacity observations | NEW evidence projection | Time-bound market observations with QUOTED/AWARDED progression; never pricing or doctrine authority. |

No constitutional conflict was discovered.

## ScopeVersion Authority

The implementation consumes:

- ScopeVersion: `ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Scope projection hash: `2a62cb650f11a66bcbc833285fd082abf535e600b37c127d898a44e591c0bc74`
- Certified IOF: `CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Service Order: `SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001`
- Customer: `customer-account-2`
- Opportunity: `OPP-DEMO-OPPORTUNITY-3SWR-1786645604709`
- Route Repository: `ROUTE-REPO-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-COMMERCIAL-DRAFT-IMPORT-ROUTE-HELSWR-REVISED-71526-1`
- Route revision: `1`
- Geometry hash: `rg-0d302bb0`
- Route: 150.68 miles / 795,574 feet / 340 governed coordinates
- Stations: 7,957 stable identities
- Objects: 433 stable identities

The validation hashes the ScopeVersion, Certified IOF and Service Order files before and after the complete workflow. `sourceAuthorityUnchanged: true`.

## Demand Decomposition

`projectDemand()` reads the ScopeVersion and its embedded Product Doctrine assembly by reference. It exposes:

- route identity, revision, geometry identity/hash and measurements;
- Certified IOF and Service Order lineage;
- station, segment and object identities;
- material demand from governed conduit/fiber assemblies and object counts;
- Engineering constraints;
- schedule capacity requirements as explicitly labeled Marketplace schedule requirements.

The public projection is bounded: it returns 81 sampled stable station references rather than copying all 7,957 station records. Server-side allocation validation still checks submitted station IDs against the complete ScopeVersion station authority.

Two reconciled packages were created:

1. `MP-3SWR-CONSTRUCTION` — civil construction/equipment/capacity.
2. `MP-3SWR-MATERIALS` — authorized conduit, fiber and structure material demand.

They carry references and never become a second scope model.

## Vendor Response Contract

Supported response types:

- `FULL_SCOPE`
- `PARTIAL_SCOPE`
- `CAPACITY_OFFER`
- `MATERIAL_OFFER`
- `NO_BID`

Each submitted response freezes:

- package and ScopeVersion/hash;
- vendor and provider type;
- prices and Teralinx-issued response lines;
- crew/equipment counts and production rates;
- mobilization, availability, duration and work schedule;
- geography and constraint capabilities;
- vendor-added lines preserving original wording;
- exceptions, qualifications, alternates and attachments;
- version, parent version, submitter/time and content hash.

Structured completeness evaluation reports missing mandatory dimensions without inventing values.

## Materials

Governed 3SWR material demand:

| Material | Required |
|---|---:|
| 3 × 1.25-inch HDPE conduit | 2,386,788 ft |
| 864-count fiber | 835,376 ft |
| Handholes | 319 ea |
| Vaults | 19 ea |
| Splice cases | 33 ea |

Material responses retain manufacturer/part number, requested/offered quantity, price, inventory, production/delivery capacity, lead/fabrication/shipping time, locations, freight, minimum order, validity, compliance, qualifications and exclusions.

`SUPPLIER-ALTERNATE` demonstrates an `ALTERNATE` conduit offer with `PENDING_ENGINEERING_REVIEW`. Because specification compliance is `EXCEPTION`, its otherwise available quantity contributes zero fulfillment coverage. Marketplace records it but does not approve it or alter Product Doctrine/Engineering.

## Versioning

Vendor A evidence proves immutable versioning:

- V1: `VR-3SWR-VENDOR-A-V1`, HDD production 2,200 ft/day, hash `0e9f5e6ca88f81c8f1d50aca826f8da58990f9e9c9c88121a98b27446695a6c1`.
- V2: `VR-3SWR-VENDOR-A-V2`, HDD production 2,400 ft/day, hash `7abceeb4b7cce7c339c3ee5fd0c1dd5a3984c699a33b8a6ec9edb6492d488e5f`.

V2 references V1; V1 remains unchanged and queryable.

Allocation revisions use the same rule:

- `ALLOC-3SWR-A-R1` remains immutable.
- `ALLOC-3SWR-A-R2` explicitly names R1 as its parent/superseded revision.
- Coverage counts only the latest allocation in a series, preventing revision double-counting.

## Coverage

Final real 3SWR coverage:

| Dimension | Required | Offered | Allocated | Remaining |
|---|---:|---:|---:|---:|
| HDD rigs | 8 | 16 | 7 | 1 |
| Plows | 4 | 8 | 1 | 3 |
| Specialty crossing crews | 3 | 2 | 2 | 1 |
| Conduit | 2,386,788 ft | 2,386,788 compliant ft | 2,386,788 ft | 0 |
| Fiber | 835,376 ft | 0 | 0 | 835,376 ft |
| Handholes | 319 | 0 | 0 | 319 |
| Vaults | 19 | 0 | 0 | 19 |
| Splice cases | 33 | 0 | 0 | 33 |

Schedule coverage is `AT_RISK`; Vendor C's availability cannot meet its proposed HDD completion window. Gaps are primary workflow content, not hidden diagnostics.

Coverage arithmetic is deterministic and does not invoke reasoning.

## Human Allocation

Construction allocations:

- Vendor A R1/R2 → exact response `VR-3SWR-VENDOR-A-V2`; HDD commitments `A-HDD-V2`, plow commitment `A-PLOW-V2`; governed station IDs STA-00000 through STA-02500; value $1,067,520.
- Vendor B R1 → exact response `VR-3SWR-VENDOR-B-V1`; commitments `B-HDD`, `B-SPECIAL`; governed station IDs STA-02501 through STA-05000; value $1,837,000.

Material allocations:

- Supplier A → 800,000 ft conduit; $536,000.
- Supplier B → 1,586,788 ft conduit; $1,015,544.32.
- Total conduit allocation → exactly 2,386,788 / 2,386,788 ft.

The server rejects:

- invented station identities;
- overlapping station ranges;
- duplicate segments or objects;
- reused/exceeded capacity commitments;
- material quantities above a selected response;
- aggregate material over-allocation;
- allocation revisions that do not explicitly supersede the current revision.

No validation silently corrects a conflict.

## Awards

Two human awards are present:

- `AWARD-3SWR-A` binds Vendor A response V2 and allocation `ALLOC-3SWR-A-R1`.
- `AWARD-3SWR-B` binds Vendor B response V1 and allocation `ALLOC-3SWR-B-R1`.

New Award records freeze response/allocation content hashes, accepted vendor-added lines, qualifications, alternates, exclusions, capacity/material commitments and schedule commitment. Reusing an Award ID returns HTTP 409 rather than overwriting it.

Every Award records:

```text
createsControlWork: false
createsFieldWork: false
```

## Forward Intelligence

The demo retains 22 market observations:

- 8 pricing observations, including exact vendor wording and normalized classification for mobilization;
- 8 time-bound capacity observations;
- 3 material observations, including the unaccepted alternate;
- remaining observations from governed fixture response evidence.

Examples:

- Pricing: Vendor A HDD at $7.55/ft plus the original `HDD mobilization` vendor line.
- Capacity: Vendor A, 2 HDD rigs, 2,400 ft/day, available 2026-09-15 through 2026-11-30.
- Material: Supplier A, 800,000 ft conduit at $0.67/ft, 21-day lead and 250,000 ft/week delivery.
- Condition/cost: Vendor B retains river/special-bore capability and specialty crossing price/capacity context.

Observations begin at `QUOTED`; Awards provide `AWARDED` evidence. No quote is represented as executed or closed/verified.

## Vendor Portal and Marketplace UI

The sanitized Marketplace hierarchy is:

1. Authorized Scope.
2. Fulfillment lifecycle ribbon.
3. Delivery Readiness with visible gaps.
4. Marketplace Packages.
5. Vendor/Supplier Responses and comparison.
6. Shared governed Opportunity Map.
7. Bounded Vendor Portal.
8. Human Allocations.
9. Awards/Commitments.
10. Compact Market Intelligence.
11. Collapsed Diagnostics / Package Integrity.

The Vendor Portal displays only project/package scope, governed map, requirements and response controls. It exposes Full, Partial, Capacity, Material and No Bid; crew/equipment/production, lead time, material quantity, unit rate, vendor-added line and exception fields. Governed route and required quantities are read-only.

## Exports

Visible browser controls:

- `Download Bid Package PDF`
- `Download Bid Package KMZ`

Validated browser downloads:

- `Teralinx_3SWR_CONSTRUCTION_Bid_Package.pdf` — 1,209 bytes.
- `Teralinx_3SWR_CONSTRUCTION_Bid_Package.kmz` — 6,054 bytes.

The PDF carries ScopeVersion, Certified IOF, Service Order, package, route/hash, dates and quantities. The KMZ contains the exact 340 governed coordinates and `rg-0d302bb0`. Browser runtime exceptions: 0. Console errors: 0.

## Performance Boundary

Three normal fulfillment reads measured 397 ms, 384 ms and 411 ms; average 397.3 ms. Response size is 115,786 bytes.

No interaction regenerates route, geometry, stations, Engineering, Certified IOF, ScopeVersion, Service Order or Twin. No reasoning call is made for arithmetic. The map receives the same shared Opportunity Map projection and stable geometry hash.

## Security

- Runtime user is required; unauthenticated request returns HTTP 401.
- Marketplace mutations require internal platform/proposal-management authority and matching organization scope.
- Package artifacts verify that the package belongs to the requested ScopeVersion.
- Submitted station/segment/object/material references are checked against the authoritative ScopeVersion projection.

This is a bounded internal demo portal. External vendor identity federation/invitation-token authentication is not introduced by CIP-052.

## Downstream Boundary

The implemented chain ends at immutable Award/Commitment evidence:

```text
ScopeVersion
  -> Demand Projection
  -> Marketplace Package
  -> Vendor/Supplier Response Version
  -> Deterministic Coverage
  -> Human Allocation
  -> Human Award
  -> Control (explicit later action)
```

The UI provides `Open Control`, but Award creation does not call Control and never creates Field work.

## Validation and Regression

| Check | Result |
|---|---|
| `cip052-marketplace-capacity-material-allocation-validation.mjs` | PASS |
| Exact source authority unchanged | PASS |
| All five response types | PASS |
| Vendor A immutable V1/V2 | PASS |
| Alternate excluded pending technical review | PASS |
| Capacity/material aggregation | PASS |
| Overlap/over-allocation/invented identity rejection | PASS |
| Allocation R1/R2 lineage | PASS |
| Exact response/allocation Award binding | PASS |
| Immutable duplicate Award rejection | PASS |
| Browser Marketplace/Vendor Portal | PASS |
| Browser PDF/KMZ local save | PASS |
| Browser exceptions/console errors | 0 / 0 |
| TypeScript | PASS |
| Production build | PASS; existing >500 kB chunk warning only |
| CIP-051 customer deliverables | PASS |
| CIP-050 commercial authorization | PASS |
| CIP-049 Twin | PASS; 0 integrity failures/runtime exceptions, expected advisory reasoning warning only |
| CIP-047 Engineering human approval | PASS |
| CIP-045B route authority | PASS, 88/88 |
| `git diff --check` | PASS; line-ending conversion warnings only |

## Files and persistence

Primary implementation:

- `server/routes/marketplace-fulfillment.js`
- `server/routes/_shared.js`
- `server/index.js`
- `src/marketplace/MarketplaceFulfillment.ts`
- `src/marketplace/BidPackage.ts`
- `src/marketplace/BudgetCandidate.ts`
- `src/api/teralinxRuntime.ts`
- `src/workspaces/MarketplaceWorkspace.tsx`
- `cip052-marketplace-capacity-material-allocation-validation.mjs`

Bounded Marketplace persistence families:

- `server/data/marketplace-packages`
- `server/data/marketplace-responses`
- `server/data/marketplace-allocations`
- `server/data/marketplace-awards`
- `server/data/marketplace-observations`

Thirty-two temporary repeated validation response files created during development were removed after their exact Marketplace-only paths were verified. They were generated test clutter and are not recoverable; the nine intentional named response versions remain.

## Known Limits

- Vendor authentication is a bounded internal demo, not an external identity/onboarding implementation.
- Package dates and the 8-HDD/4-plow/3-specialty schedule requirement are explicitly labeled Marketplace schedule requirements; they do not claim to be Engineering or ScopeVersion quantities.
- Predictive allocation and forward pricing are intentionally not implemented. The evidence required for those future advisory functions is retained.
- Control release, contracting, purchase-order integration and Field activation remain outside CIP-052.
- No deployment was performed.
