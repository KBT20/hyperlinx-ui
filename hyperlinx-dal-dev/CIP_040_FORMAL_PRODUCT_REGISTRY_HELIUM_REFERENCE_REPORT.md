# CIP-040 — Formal Product Registry + Helium Reference Report

## Outcome

CIP-040 establishes `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER` as the first formal Product Registry entry and keeps the constitutional layers separate:

- Google Stillwater–Helium is project evidence and reference data.
- Point-to-Point Duct & Dark Fiber is a reusable Layer 1 product.
- `PD-001` / `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER` remains Product Doctrine.
- IOF assembly remains runtime behavior.
- Commercial creates a Draft IOF Package only.
- Engineering certifies the Draft IOF Package.
- No ScopeVersion or execution authorization is created by CIP-040.

The real reference package does not receive a fake PASS. Product, object, dependency, close, evidence, and payment gates pass; Quantity Reconciliation fails pending authority disposition, so Constitutional Assembly and Draft IOF Readiness remain blocked for the supplied revision.

## Files Changed

- `src/products/ProductRegistry.ts` — formal registry, product definition, profiles, quantity rules, object close sequences, and payment policy.
- `src/products/ProductDoctrineContracts.ts` — widened route-evidence source typing so customer KMZ and Commercial Route Repository geometry can enter doctrine assembly without pretending to be OSRM.
- `src/commercial/CommercialWorkbookEvidenceAdapter.ts` — generic XLSX extraction and normalization with per-value provenance.
- `src/commercial/CommercialKmzRouteEvidenceAdapter.ts` — generic KMZ/KML measured-centerline evidence adapter.
- `src/reference/helium/HeliumReferenceAssembly.ts` — isolated Google Stillwater–Helium reference adapter and Draft IOF reference assembly.
- `src/components/workspaces/GoogleRfpWorkspace.tsx` — Product Registry-driven selection and product/profile/readiness presentation.
- `src/components/commercial/ConstitutionalAssemblyReviewPanel.tsx` — explicit Quantity Reconciliation constitutional gate.
- `src/components/engineering/SpineObjectCatalogPanel.tsx` — actual instantiated-object detail for doctrine, quantity, states, close, evidence, payment, authority, source, notes, constraints, and audit state.
- `cip040-formal-product-registry-helium-reference-validation.mjs` — real-source CIP-040 validation.
- `cip036-osrm-completion-iof-assembly-commercial-map-projection-validation.mjs` — regression assertions updated for Product Registry resolution, the CIP-038 birth state, and the current layer-gated map structure.
- `CIP_040_FORMAL_PRODUCT_REGISTRY_HELIUM_REFERENCE_REPORT.md` — this report.

## Product Registry Design

`ProductRegistry` owns registered `ProductDefinition` plus resolved `ProductDoctrine`. Registration validates that the doctrine/product IDs agree. Commercial Planning obtains its active product options from `PRODUCT_REGISTRY.commercialOptions()` and resolves doctrine through `PRODUCT_REGISTRY.resolve(productId)`.

The definition is profile-based and can accept future products without editing Commercial Planning. No future products were registered in this CIP.

Every new project/reference artifact carries:

- `organizationId`
- `tenantId`
- `customerId`
- `opportunityId`
- `productId` / `productVersion`
- `doctrineId` / `doctrineVersion`
- `sourceAuthority` / `sourceHash`

## Registered Product

- Product: Point-to-Point Duct & Dark Fiber
- Product ID: `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER`
- Product family: `LAYER_1_DUCT_DARK_FIBER`
- Layer: `L1`
- Network classes: long haul, metro, lateral, regional
- Topologies: linear, point-to-point
- Optical transport included: false
- Engineering certification required: true
- Commercial ScopeVersion creation: false
- Status: active

The product resolves required services for route design, engineering, procurement, construction, conduit/fiber placement, splicing, testing, as-builts, and project management, with optional maintenance/O&M and restoration/locate capabilities.

## Doctrine and Object Classes

The existing point-to-point doctrine remains the execution doctrine. The registry formalizes required, optional, and conditional product object classes:

- Required: spine, route segment, conduit, fiber, termination point
- Conditional: handhole, splice case, marker post, crossing, ILA site, demarcation point
- Optional: manhole, vault

The Helium reference manifest instantiates evidenced conditions, including 334 handholes, 34 splice cases, two ILA sites, two termination points, and two demarcation points. Marker posts and crossings are not fabricated without source/engineering evidence.

## Workbook Adapter and Evidence Model

`CommercialWorkbookEvidenceAdapter` recognizes:

- Assumptions
- Materials_Labor_Units
- Route_ILA
- Rates_Authority
- Cost_Rollup
- Validation
- Executive_Dashboard
- Investor_One_Page

Lower-level sheets have priority over dashboard/presentation sheets. Extraction is label-based; source locations are recorded from actual cell addresses behind the adapter. Each normalized value retains the file, worksheet, cell, SHA-256 hash, authority description/mode, extraction time, and normalized field.

Supplied workbook SHA-256: `c3a093433571f75562f170b0fe0c3eb1de2c9f2042132ed3864d76ca72deaed3`.

Key normalized evidence:

- Route: 157.76 mi / 832,972.8 ft
- Conduit: 2,573,942 ft; inferred configured count 3; 1½-inch source description
- Fiber: 895,326 cable-ft; 864-count shielded fiber
- Handholes: 334
- Splice cases: 34
- ILA sites: 2 at mileposts 52.59 and 105.2
- Construction cost: $24,359,901
- NRC: $29,231,881
- MRC: $7,099/month
- Schedule: 547 days / 12 production crews
- Confidence: 44%
- Unknown constraints: 8

The workbook's own Validation sheet contains a lifecycle-revenue CHECK: calculated lifecycle revenue exceeds the displayed expected value by $1,448,196. This remains an unresolved source warning.

## Geometry Evidence and Measured Spine

`CommercialKmzRouteEvidenceAdapter` reads the longest valid KML LineString, calculates geodesic length, and records the customer-provided geometry hash and measured-centerline authority.

Supplied KMZ SHA-256: `a9dcfffced9841250d7a5cdc9e5d58e02161c75d00e3911852c1130d85c37ed8`.

- Coordinate points: 340
- Measured length: approximately 151.733 mi / 801,149 ft
- A: -98.4309945, 37.2536718
- Z: -97.0514721, 36.1671917
- One-mile station projection: 152 stations

The KMZ is geometry evidence, not Product Doctrine.

## Quantity Reconciliation

No mismatch is silently overwritten.

- Route feet: workbook 832,972.8 vs measured KMZ approximately 801,149 — `SOURCE_OVERRIDE_REQUIRES_AUTHORITY`.
- Conduit feet: workbook 2,573,942 vs measured route × 3 approximately 2,403,447 — `SOURCE_OVERRIDE_REQUIRES_AUTHORITY`.
- Fiber feet: workbook 895,326 vs current 1.05 placement/slack doctrine approximately 841,207 — `SOURCE_OVERRIDE_REQUIRES_AUTHORITY`.
- Handholes: workbook 334 vs preliminary spacing doctrine 76 — `SOURCE_OVERRIDE_REQUIRES_AUTHORITY`.
- Splice cases: workbook 34 — Engineering splice architecture is missing, so `MISSING_DOCTRINE`.
- ILA sites: workbook 2 — approved Engineering optical design is missing, so `MISSING_DOCTRINE`.

Engineering must disposition these as approved source authority, product-doctrine exception, or corrected evidence before Quantity Reconciliation can pass.

## Contract, Acceptance, and Maintenance Profiles

The generic `L1_DARK_FIBER_IRU_PROFILE` supports IRU + SOW concepts: NRC/IRU fee, recurring maintenance, term, route/map exhibit, fiber quantity, construction type, delivery, acceptance, SAN, and maintenance election. It does not copy or operationalize FiberLight legal text. Commercial/Legal approval remains mandatory.

The acceptance model is configurable: ATP → PASS → SAN → ACCEPTED. Evidence supports GPS/as-builts, installed quantities, conduit/fiber placement, splice completion, bidirectional 1550nm OTDR, end-to-end power/loss, inspection, as-built map, termination/ILA commissioning, and customer acceptance/SAN.

Maintenance is optional/recurring and supports routine maintenance, emergency restoration, locate services, and route marking.

## Close Sequences and Payment

The product defines independent close sequences for spine, route segment, conduit, fiber, handhole, manhole, vault, splice case, termination, marker post, crossing, ILA site, and demarcation point. Dependencies are explicit and are not treated as a global schedule.

Payment policy preserves `NO_CLOSE_NO_VALIDATION_NO_PAYMENT`. Object/payment eligibility depends on validated closes plus required evidence. Contract-defined milestones are required; the example 50/50 schedule from the reference SOW is not universalized.

## UI Changes

Commercial Planning now:

- sources product options from Product Registry;
- resolves doctrine without a concrete-product conditional;
- shows doctrine version, required services/assets, commercial, acceptance, maintenance, and contract profiles;
- shows doctrine applied, source evidence status, quantity reconciliation, object manifest, and Draft IOF readiness;
- continues to prohibit Commercial ScopeVersion creation.

Constitutional Assembly Review now treats formal Quantity Reconciliation as its own gate. Spine Object Catalog prioritizes real instantiated objects and exposes the requested station-aware product, doctrine, dependency, state, close, evidence, payment, authority, source, notes, constraints, and audit fields.

## Helium Reference Gate Results

- Product Doctrine: PASS
- Object Doctrine: PASS
- Quantity Reconciliation: FAIL
- Dependencies: PASS
- Close Sequences: PASS
- Evidence Requirements: PASS
- Payment Rules: PASS
- Constitutional Assembly: FAIL
- Draft IOF Readiness: BLOCKED

This is an earned result, not a forced flag. The implementation can return PASS only when every required gate is genuinely satisfied.

## Validation Results

- `node cip040-formal-product-registry-helium-reference-validation.mjs` — PASS
- `npx tsc --noEmit -p tsconfig.json` — PASS
- `npm run build` — PASS
- `git diff --check` — PASS
- CIP-035A Commercial Lifecycle Sequencing — PASS
- CIP-036 Kernel Reasoning Service — PASS
- CIP-036 OSRM / IOF Assembly / Commercial Map Projection — PASS
- CIP-037 Single Geometry Authority — PASS
- CIP-037 Commercial Projection Surface — PASS
- CIP-038 Constitutional State Authority — PASS
- CIP-038A Commercial Projection UI Restoration — PASS
- CIP-039 Constitutional Closure Engine — PASS

## Stop Boundary

CIP-040 stops at reusable Product Registry resolution, real evidence normalization, Draft IOF reference assembly, and constitutional review. It does not create or authorize Marketplace, Control, Field, Operational Twin, ScopeVersion, or execution state.
