# Product Doctrine Inventory Report

Date: 2026-07-08

## Scope

This is a discovery-only inventory. No source, server, repository, runtime, Commercial, Engineering, ScopeVersion, Marketplace, Control, Field, Twin, or Operational Intelligence behavior was changed.

Search focus:

- product doctrine / `ProductDoctrine`
- Point-to-Point, long-haul, conduit, duct, dark fiber, fiber, Layer 1
- IOF Package, Engineering Certification, ScopeVersion readiness
- required services, required assets, engineering objects, evidence, certification

## Executive Finding

The current canonical product doctrine exists in TypeScript, not Markdown or external config:

`src/products/pointToPointLongHaulDoctrine.ts`

Canonical product:

`POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER`

Canonical doctrine:

`DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER`

Current version:

`19B.1.0`

Commercial actively uses this doctrine through:

- `src/products/PointToPointConfigurator.ts`
- `src/runtime/ConstitutionalAssemblyScheduler.ts`
- `src/commercial/IOFPackageAssemblyEngine.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`

Engineering Certification consumes doctrine outputs and references, especially `productDoctrineAssembly`, `doctrineId`, and `productDoctrineVersion`, but does not currently load a separate Product Doctrine repository/config file.

ScopeVersion readiness expects a product doctrine snapshot on the Certified IOF/Certified Draft IOF package, but there is no independent active ScopeVersion product doctrine file. The ScopeVersion path consumes the snapshot/reference it receives.

## Canonical Doctrine

| Field | Value |
|---|---|
| Canonical file | `src/products/pointToPointLongHaulDoctrine.ts` |
| Contract file | `src/products/ProductDoctrineContracts.ts` |
| Doctrine name | Point-to-Point Long Haul Conduit & Fiber Doctrine |
| Doctrine ID | `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER` |
| Product covered | Point-to-Point Long Haul Conduit & Fiber / Point-to-Point Duct & Dark Fiber |
| Product ID | `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER` |
| Layer | Layer 1 |
| Network class | `LONG_HAUL` |
| Topology | `LINEAR` |
| Optical transport | `false` |
| Commercial ScopeVersion creation | blocked |
| Engineering certification | required |
| Status | Active, canonical, hardcoded TypeScript doctrine |

## Relevant File Inventory

| File path | Doctrine name | Product covered | Services defined | Assets defined | Engineering objects defined | Evidence requirements | Certification rules | Gaps / missing sections | Status |
|---|---|---|---|---|---|---|---|---|---|
| `src/products/ProductDoctrineContracts.ts` | Product Doctrine contracts | Generic Layer 1/2/3 products | None as service SKUs; defines product rules shape | Conduit assembly, fiber assembly, structure assembly, crossing assembly, quantity summary | `SPINE`, `ROUTE_SEGMENT`, `CONDUIT`, `FIBER`, `STRUCTURE`, `CROSSING` | Validation summary shape only | Contract includes `engineeringCertificationRequired` and `scopeVersionCreationAllowedFromCommercial` | No repository schema, no evidence manifest model, no service catalog, no external config binding | Active contract |
| `src/products/pointToPointLongHaulDoctrine.ts` | Point-to-Point Long Haul Conduit & Fiber | `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER` | Implicit Layer 1 dark fiber/conduit commercial product; no separate service list | Long-haul spine, centerline, stations, route segments, conduit, fiber, structures, crossings, quantity/pricing summaries | Generates spine, route segment, conduit, fiber, structure, crossing objects | Requires account/customer, A/Z, OSRM centerline, route geometry, pricing summary; creates validation summary and engineering manifest | Blocks commercial ScopeVersion; requires Engineering certification; validates product, doctrine, route geometry, spine, stations, objects, quantity, pricing | Hardcoded in TS; no external doctrine registry; crossing and structure formulas are preliminary; no formal required-services or required-assets list | Active canonical doctrine |
| `src/products/PointToPointConfigurator.ts` | Product Invocation Authority / PD-001 invocation | Point-to-Point Duct & Dark Fiber using long-haul conduit/fiber doctrine | No separate services; wraps the product into Commercial Design and Draft IOF Package | Route geometry, measured spine, station authority, engineering objects, Draft IOF package | Carries doctrine-generated engineering objects into Draft IOF package | Validation checks customer, product, PD-001 loaded, A/Z, route, measured spine, station authority, engineering objects, quantities, Draft IOF, Commercial Review | Rejects unsupported products; does not create ScopeVersion | Product name differs from doctrine product name; embeds `engineeringObjects` and `commercialDesign`; no external configurator registry | Active Commercial product entry point |
| `src/runtime/ConstitutionalAssemblyScheduler.ts` | Product Doctrine Assembly scheduler | Generic, currently Point-to-Point Long Haul via wrapper | None | Runtime artifact wrapper for Product Doctrine Assembly | None directly | Tracks doctrine versions and dependencies | Caches immutable Product Doctrine Assembly and Draft IOF Assembly; Engineering Projection consumes Draft IOF | Scheduler names `PD001_PRODUCT_DOCTRINE`; not a doctrine source | Active runtime orchestration |
| `src/commercial/IOFPackageAssemblyEngine.ts` | Draft IOF Package assembly with Product Doctrine inputs | Draft IOF package for Point-to-Point Duct & Dark Fiber / long-haul conduit fiber | No explicit service catalog; packages commercial proposal into Engineering review | Uses doctrine centerline, spine, stations, route segments, conduit/fiber/structure/crossing assemblies, quantities, pricing | Consumes doctrine objects; builds station/object attachment, audit object manifest, production artifacts, kernel graph | Uses runtime evidence IDs, customer design references, geometry references, audit projection, object manifest, spine object evidence requirements | Adds validation rows for Product Doctrine Assembly, commercial ScopeVersion block, and Engineering certification requirement | Large package still may carry snapshots; no separate product doctrine repository; evidence requirements are generated downstream rather than defined in doctrine source | Active Commercial Draft IOF consumer |
| `src/components/workspaces/GoogleRfpWorkspace.tsx` | Commercial UI product doctrine usage | Point-to-Point Duct & Dark Fiber | Layer 1 product option only | Product selector, doctrine assembly, construction mix, assumptions, Draft IOF preview | Displays/generated object counts and passes doctrine to Draft IOF assembly | Shows doctrine validation/status; no independent evidence model | Drives Commercial product selection and handoff; does not create ScopeVersion | Product list is hardcoded to one option; product assumptions are UI/workbook level, not canonical doctrine config | Active Commercial UI |
| `server/routes/product-fulfillment.js` | Product fulfillment registry | Point-to-Point Long Haul Conduit & Fiber | Product tags: long haul, linear topology, conduit, fiber, point-to-point | Runtime product record/fulfillment plan references | None | None | No certification logic | Registry product ID duplicates doctrine product ID but is not the doctrine source | Active runtime registry / lightweight endpoint |
| `server/routes/proposal-drafts.js` | Proposal projection with doctrine reference | Commercial proposal/Draft IOF source | None | Carries/derives `productDoctrineId` | None | None | Falls back to `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER` | Not a doctrine source; duplicate fallback definition | Active Proposal consumer |
| `server/routes/commercial-revisions.js` | Commercial Revision product doctrine reference | Commercial Revision | None | Reference-only `productDoctrineId` | None | None | Falls back to `PD-001` | Uses abbreviated fallback conflicting with canonical doctrine ID | Active Commercial reference consumer |
| `server/routes/commercial-iof-packages.js` | Commercial Draft IOF / submit-engineering doctrine reference | Draft IOF handoff | None | Restores route repository and station projection; carries production doctrine ID | Projects station graph and object manifests during handoff | Station projection decision trace; route repository evidence; production artifacts | Requires route repository for station projection; carries `noScopeVersionCreation`; adds production doctrine defaults | Fallback doctrine ID exists here; hydration can inject production artifacts not defined in canonical Product Doctrine file | Active handoff consumer |
| `server/routes/engineering-baselines.js` | Engineering Baseline reference-only intake | Engineering Baseline | None | Baseline references Draft IOF, Commercial Release, Route Repository, station projection, object manifest, proposal, estimate, workbook, product doctrine | None directly; validates reference integrity | Requires `productDoctrineId`; immutable/reference-only baseline | No Product Doctrine repository resolution; fallback `PD-001` if missing | Active Engineering intake authority |
| `server/routes/engineering-packages.js` | Engineering Package derivation | Engineering Package | None | Carries `productDoctrineId` from baseline/draft | None | Reference integrity check includes product doctrine presence | Does not resolve doctrine content | Active Engineering package consumer |
| `server/routes/engineering-certification.js` | Engineering certification endpoint | Engineering Certification / Certified IOF Package | None | Certifies Draft/Engineering Revision package objects; carries doctrine ID/version | Uses checklist, constraints, doctrine exceptions, validation failures | Blocks certification when Proposed IOF units are uncertified, checklist incomplete, constraints unresolved, or PD-001 validation failures lack approved exceptions | Certification references `PD-001` string; no central doctrine registry; current code has evolved beyond older docs | Active Engineering certification consumer |
| `src/engineering/EngineeringCertificationProjection.ts` | PD-001 projection/compliance | Engineering Certification projection | None | Projects route geometry, measured spine, stations, objects, structures, conduit, fiber, crossings, quantities, pricing | Compliance rows validate geometry, spine, stationing, graph, object addressing/attachment, audit projection, constraints | `engineeringCertificationReady` fails on PD-001 compliance failures or unresolved constraints; ScopeVersion promotion remains false | Does not import canonical `ProductDoctrine`; it infers from Draft IOF package fields/snapshots | Active Engineering projection consumer |
| `src/workspaces/EngineeringCertificationWorkspace.tsx` | Engineering UI doctrine display | Engineering Certification workspace | None | Displays package, product, doctrine ID/version, PD-001 compliance | Shows compliance rows and readiness report | Certification UI uses projection/checklist and Certification Ledger flow | UI label still says Draft IOF Package Summary in places; doctrine not loaded as config | Active Engineering UI |
| `src/spine/SpineAuditProjectionEngine.ts` | PD-001 audit projection fallback | Product Doctrine-derived audit projection | None | Creates audit entries from route feet, conduit feet, fiber feet, structures, crossings, budget, Layer 1 lifecycle | Audit records for route, conduit, fiber, structures, crossing review, budget, lifecycle | Not certification authority, but supports audit/projection inputs | Fallback audit evidence is derived from quantity/pricing summaries rather than canonical evidence requirements in doctrine | Active projection helper |
| `server/scopeversion-authority-engine.js` | ScopeVersion product doctrine snapshot consumer | ScopeVersion promotion | None | Consumes product doctrine snapshot, route geometry, certified objects/stations | Requires product doctrine snapshot as part of canonical truth validation | ScopeVersion is Order for Execution; requires signed Service Order and Certified IOF package inputs | No independent doctrine loader; still refers to certified package snapshots; older naming says Certified Draft IOF in places | Active ScopeVersion readiness consumer |
| `src/api/teralinxRuntime.ts` | Runtime DTOs/API client | Commercial/Engineering handoff records | None | Types include product doctrine IDs/versions across Draft IOF, Engineering Baseline, Engineering Package, Certification Ledger | None | No ScopeVersion creation | Type-only/client serialization; not doctrine source | Active API types/client |
| `src/components/commercial/ConstitutionalAssemblyReviewPanel.tsx` | Doctrine display/reference | Commercial review panel | None | Displays doctrine ID/version from Draft IOF | Shows constitutional assembly review | None direct | Display-only | Active UI consumer |
| `src/kernel/ExecutionNode.ts`, `src/kernel/ExecutionGraphContracts.ts`, `src/runtime/RuntimeContracts.ts`, `src/runtime/ConstitutionalProjectionCache.ts` | Runtime/kernel doctrine references | Runtime artifact lineage | None | Doctrine versions and runtime dependency metadata | None | None | Metadata only | Active infrastructure reference |
| `src/mapkernel/MapLayerRegistry.ts`, `src/mapkernel/MapRenderer.ts` | Map/projection doctrine metadata | Rendering | None | Render layer metadata can carry doctrine/source attributes | None | None | Not doctrine authority | Active projection/rendering reference |
| `src/spine/manifest/AuditObjectManifestContracts.ts` | Manifest doctrine reference | Audit Object Manifest | None | Source doctrine fields in manifest contracts | Manifest/evidence metadata | None | Not product-specific | Active contract |
| `src/spine/catalog/SpineObjectDoctrine.ts` | Spine object doctrine defaults | Spine object catalog | None | Required doctrine list includes `PD-001`, `PD-002A`, precursor | None | None | Separate spine/object doctrine, not product doctrine | Active adjacent doctrine |
| `src/doctrine/pd003/*` | Production doctrine | Production profiles/schedules/cost/payment | None | Production profile artifacts | Production validation artifacts | Not product doctrine; downstream production doctrine | Adjacent doctrine; should stay separate from Product Doctrine | Active adjacent doctrine |

## Documentation And Historical Doctrine Files

| File path | Doctrine name | Product covered | Services defined | Assets defined | Engineering objects defined | Evidence requirements | Certification rules | Gaps / missing sections | Status |
|---|---|---|---|---|---|---|---|---|---|
| `SPRINT_19B_PRODUCT_DOCTRINE_GOLDEN_PATH_REPORT.md` | Sprint 19B Product Doctrine Golden Path | `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER` | No services list | Spine, stations, route segments, conduit, fiber, structures, crossings | Yes, via doctrine compiler summary | Required inputs and validation summary | Commercial ScopeVersion blocked; Engineering certification required | Historical report; states direct Draft IOF to Engineering flow from older lifecycle | Historical but accurately documents current canonical doctrine file |
| `SPRINT_20D_PRODUCT_CONFIGURATOR_REPORT.md` | Product Invocation Authority | Point-to-Point Duct & Dark Fiber | No service list | Measured spine, station authority, engineering objects, Draft IOF | Yes, through configurator | Product invocation trail and validation checks | Engineering remains certification authority; no ScopeVersion | Historical report but still matches active Product Configurator | Historical/active reference |
| `LAYER_1_DESIGN_DOCTRINE_ENGINE.md` | Layer 1 Design Doctrine Engine | Generic Layer 1 network classes | None | Design doctrine fields on ProposedGraph | None | None | Does not certify or create ScopeVersion | Advisory design doctrine, not current Product Doctrine | Legacy/advisory doctrine |
| `PRODUCT_COMMERCIAL_MODEL.md` | Product Commercial Model | Duct sale, maintenance, dark fiber IRU, managed fiber, transport, wave, AI interconnect, residual capacity, route operations | Lists commercial service/product families | Dependencies such as conduit, fiber, splice, handoff, operations | None | None | Engineering approval / Marketplace Budget Lock required | Advisory commercial product taxonomy; not wired as active product doctrine | Documentation-only/advisory |
| `IOF_PACKAGE_ASSEMBLY_ENGINE.md` | IOF Package Assembly Engine | Draft IOF Package workflow | None | Proposal/customer/opportunity/inventory/design/geometry references | Proposed IOF units | Runtime object, relationship, evidence references | Draft IOF assembly does not create ScopeVersion | Older runtime endpoint docs; predates Commercial Revision/Release and Engineering Baseline doctrine | Historical/partially stale |
| `IOF_PACKAGE_MANIFEST_MODEL.md` | IOF Package Manifest Model | Draft IOF Package manifest | None | Manifest entries for objects, relationships, inventory, geometry, stations, structures, dependencies, evidence | Manifest only | Reference-only runtime object policy | Review model only | No current Commercial Release/Engineering Baseline mapping | Historical but compatible reference-only doctrine |
| `ENGINEERING_CERTIFICATION_MODEL.md` | Engineering Certification Model | Engineering certification | None | Proposed IOF units | Unit certification model | Checklist and certification evidence | Requires all units certified, checklist complete, confidence > 0; no ScopeVersion | Constitutionally stale: says Engineering certifies Draft IOF directly, while newer model uses Engineering Baseline/Revision/Certification Ledger | Legacy/stale |
| `CERTIFIED_IOF_PACKAGE_MODEL.md` | Certified Draft IOF Package Model | Certified IOF / Certified Draft IOF | None | Certified package references | Certified IOF units if present | Runtime history/evidence references | Certification does not create ScopeVersion/Service Order/execution authorization | Now partially superseded by Certification Ledger doctrine; still useful for no-ScopeVersion boundary | Active constitutional model with legacy naming |
| `PD_006_ENGINEERING_BASELINE_DOCTRINE.md` | Engineering Baseline Doctrine | Engineering intake | None | Reference-only baseline refs | None | Baseline validation references | Baseline immutable; Draft IOF unchanged | Not product-specific; consumes productDoctrineId only | Active adjacent doctrine |
| `PD_006_ENGINEERING_CHANGE_SET_DOCTRINE.md` | Engineering Change Set Doctrine | Engineering Revision | None | Engineering patches/revision projection | Engineering patch model | Patch validation | Certification consumes Engineering Revision | Not product-specific | Active adjacent doctrine |
| `PD_007_CERTIFICATION_LEDGER_DOCTRINE.md` | Certification Ledger Doctrine | Certification Ledger | None | Certification ledger refs | Certified IOF projection refs | Certification evidence manifest refs | Ledger is immutable Engineering truth | Not product-specific; consumes product doctrine refs through certification package | Active adjacent doctrine |
| `SPRINT_20A_ENGINEERING_CERTIFICATION_TWIN_REPORT.md` | Engineering Certification Twin / PD-001 Compliance | Engineering Certification | None | Route/spine/stations/objects | PD-001 compliance categories | PD-001 checks and exceptions | Server blocks certification on unresolved constraints / PD-001 failures | Historical; newer Engineering Baseline/Revision/Ledger doctrine has evolved | Historical but important PD-001 compliance reference |
| `SPRINT_20B_SPINE_STATION_AUTHORITY_REPORT.md` | Spine + Station Authority | Engineering Certification station authority | None | Measured spine, station authority, station-indexed graph | Object attachment authority | Station/object authority evidence | PD-001 no longer accepts geometry-only rendering | Adjacent to product doctrine, not product source | Historical/active adjacent doctrine |
| `SPRINT_20F_SPINE_AUDIT_PROJECTION_REPORT.md` | Spine Audit Projection | Audit projection | None | Audit projection fallback from PD-001 quantities/pricing | Audit projection records | Audit records from quantities/pricing | Not certification source alone | Adjacent projection doctrine | Historical/active adjacent doctrine |
| `SPRINT_24C_PD003_PRODUCTION_DOCTRINE_REPORT.md` | PD-003 Production Doctrine | Production doctrine | None | Production profiles/schedules/cost/payment | Spine production objects | Production validation | Downstream production validation | Separate from product doctrine | Active adjacent doctrine |
| `CONSTITUTIONAL_FOUNDATION_V1_0_REVIEW.md` | Constitutional foundation review | Product doctrine concept | None | None | None | None | Notes PD-001 exists | High-level review only | Documentation-only |
| `ASSEMBLY_SCHEDULER_DESIGN.md` | Assembly scheduler design | Product Doctrine Assembly | None | Artifact orchestration | None | None | Scheduler should persist artifacts later | Design doc; current implementation exists in scheduler TS | Documentation-only |

## Validation And Fixture References

These files reference Product Doctrine or PD-001 for validation/fixtures. They do not define canonical doctrine.

| File path | Reference type | Status |
|---|---|---|
| `sprint19b-product-doctrine-golden-path-validation.mjs` | Validates canonical product ID, doctrine ID, doctrine rules, assembly outputs, Commercial UI propagation | Active validation |
| `sprint20d-product-configurator-validation.mjs` | Validates Product Configurator invokes PD-001 and produces Draft IOF package | Active validation |
| `sprint20a-engineering-projection-rendering-validation.mjs` | Validates PD-001 projection compliance geometry behavior | Active validation |
| `sprint20b-engineering-intake-validation.mjs` | Validates Engineering UI exposes PD-001 compliance | Historical validation |
| `sprint20b-spine-station-authority-validation.mjs` | Validates station authority and PD-001 compliance | Active adjacent validation |
| `sprint20f-spine-audit-projection-validation.mjs` | Validates PD-001 audit projection support | Active adjacent validation |
| `sprint21-scopeversion-authority-validation.mjs` | Validates ScopeVersion contains product doctrine snapshot; uses `PD-001` fixture values | Historical/current ScopeVersion validation |
| `cip016*`, `cip027*` validation scripts | Use `productDoctrineId`, often with `PD-001` fixture fallback | Fixture/reference only |
| `server/data/**` JSON records | Persisted opportunity, route, proposal, runtime, Draft IOF records containing product IDs/doctrine IDs | Data records, not doctrine source |

## Current Commercial Usage

Commercial currently uses Product Doctrine in four places:

1. Product selection is hardcoded to a single Layer 1 product in `GoogleRfpWorkspace.tsx`.
2. `PointToPointConfigurator.ts` is the product invocation authority and calls `assemblePointToPointLongHaulDoctrine`.
3. `ConstitutionalAssemblyScheduler.ts` caches the Product Doctrine Assembly artifact.
4. `IOFPackageAssemblyEngine.ts` consumes `productDoctrine` and `productDoctrineAssembly` to build Draft IOF package validation, objects, station/object projections, audit manifests, quantity summaries, pricing summaries, and Engineering requirements.

Commercial-visible doctrine status includes:

- Doctrine ID/version
- Doctrine validation status
- Quantity summary
- Object/station counts
- Product doctrine assumptions / commercial override rows
- Draft IOF package doctrine metadata

## Current Engineering Certification Usage

Engineering Certification currently uses Product Doctrine as restored package truth, not as a loaded config:

1. `EngineeringCertificationProjection.ts` reads `productDoctrineAssembly` from the Draft IOF/Engineering package when present.
2. It falls back to package fields such as route geometry, measured spine, station authority, route segments, conduit/fiber assemblies, quantity summary, pricing summary, and audit projection.
3. PD-001 compliance rows include geometry, spine, stationing, station-to-coordinate, graph, objects, object addressing, object attachment, structures, conduit, fiber, facilities, crossings, quantities, pricing, audit projection, O&M, constraints, and engineering readiness.
4. `engineering-certification.js` blocks package certification when validation failures are not covered by approved doctrine exceptions.
5. Engineering Baseline and Engineering Package repositories carry `productDoctrineId` as a required reference, but do not resolve or validate the canonical doctrine object.

## ScopeVersion Readiness Usage

ScopeVersion readiness consumes product doctrine as part of the certified package snapshot:

- `server/scopeversion-authority-engine.js` builds `canonicalTruth.productDoctrine`.
- It requires a non-empty product doctrine snapshot.
- It does not import `src/products/pointToPointLongHaulDoctrine.ts`.
- ScopeVersion remains downstream of signed Service Order / customer signature; product doctrine does not authorize execution by itself.

## Duplicate Or Conflicting Doctrine Definitions

| Conflict / duplicate | Evidence | Impact |
|---|---|---|
| `PD-001` shorthand vs canonical doctrine ID | Server and validation files often fall back to `PD-001`; canonical file exports `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER` | Can make reports/UI/records look like different doctrines even when they mean the same thing |
| Product name mismatch | Canonical doctrine product name is `Point-to-Point Long Haul Conduit & Fiber`; configurator product name is `Point-to-Point Duct & Dark Fiber` | Likely intentional business label vs technical doctrine label, but should be explicitly mapped |
| Product ID mismatch in fixtures | Some older validation/data references use `POINT_TO_POINT_DARK_FIBER` | Legacy fixtures may not match active canonical product |
| Historical Engineering Certification docs | `ENGINEERING_CERTIFICATION_MODEL.md` says Engineering certifies Draft IOF directly | Superseded by Engineering Baseline / Engineering Revision / Certification Ledger doctrine |
| Product commercial taxonomy vs active product doctrine | `PRODUCT_COMMERCIAL_MODEL.md` lists many products including Duct Sale and Dark Fiber IRU | Advisory only; not wired to active Product Doctrine assembly |
| Product fulfillment registry duplicates product metadata | `server/routes/product-fulfillment.js` hardcodes product ID/name/tags | Lightweight registry, not canonical doctrine; could drift from TS doctrine |
| ScopeVersion validation fixtures use `PD-001` values | `sprint21-scopeversion-authority-validation.mjs` uses fixture doctrine ID/version | Validates snapshot presence, not canonical doctrine equivalence |

## Hardcoded Doctrine Inside TypeScript / JavaScript

Hardcoded active doctrine:

- `src/products/pointToPointLongHaulDoctrine.ts`
- `src/products/PointToPointConfigurator.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx` product option list
- `server/routes/product-fulfillment.js` product registry row

Hardcoded doctrine fallbacks/references:

- `server/routes/proposal-drafts.js`
- `server/routes/commercial-revisions.js`
- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-baselines.js`
- `server/routes/engineering-packages.js`
- `server/routes/engineering-certification.js`
- `server/routes/service-orders.js`
- `server/scopeversion-authority-engine.js`
- `src/engineering/EngineeringCertificationProjection.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/components/commercial/ConstitutionalAssemblyReviewPanel.tsx`
- validation scripts listed above

## Required Services / Required Assets Finding

No active canonical Product Doctrine file currently has explicit `requiredServices` or `requiredAssets` sections.

Closest equivalents:

- `ProductDoctrine.requiredInputs`
- `ProductDoctrine.assembledArtifacts`
- `ProductDoctrine.readinessChecks`
- `ProductDoctrineEngineeringManifest.objectIds`
- `ProductDoctrineEngineeringManifest.stationIds`
- `PRODUCT_COMMERCIAL_MODEL.md` advisory dependencies
- Marketplace/bid package fixtures for conduit/fiber capability/product dependencies

Gap:

The canonical doctrine should eventually distinguish:

- commercial product/service definition
- required physical assets
- required engineering objects
- required evidence
- certification gates
- downstream ScopeVersion readiness inputs

That separation does not yet exist in one active doctrine artifact.

## Evidence Requirements Finding

The canonical Product Doctrine defines validation inputs and creates an Engineering manifest, but does not explicitly define a structured evidence requirement list.

Evidence is currently generated/handled downstream by:

- Draft IOF manifest and runtime evidence references
- Spine audit projection
- Audit object manifest
- Kernel execution graph expectations
- Spine object evidence requirements
- Certification checklist and doctrine exceptions
- Certification Ledger evidence manifest

Gap:

Evidence requirements are distributed and generated during package assembly/projection instead of declared in Product Doctrine.

## Certification Rules Finding

The canonical Product Doctrine has high-level rules:

- `scopeVersionCreationAllowedFromCommercial: false`
- `engineeringCertificationRequired: true`

Detailed certification rules live outside Product Doctrine:

- Draft IOF validation rows in `IOFPackageAssemblyEngine.ts`
- PD-001 projection compliance in `EngineeringCertificationProjection.ts`
- Certification blocking in `server/routes/engineering-certification.js`
- Certification Ledger doctrine / routes
- ScopeVersion layer integrity and authority engine

Gap:

Certification rules are active, but they are distributed across assembly, projection, certification, and ScopeVersion layers rather than declared in the Product Doctrine artifact.

## Active vs Legacy Summary

| Category | Files |
|---|---|
| Canonical active Product Doctrine | `src/products/ProductDoctrineContracts.ts`, `src/products/pointToPointLongHaulDoctrine.ts` |
| Active product invocation | `src/products/PointToPointConfigurator.ts`, `src/components/workspaces/GoogleRfpWorkspace.tsx` |
| Active Commercial consumers | `src/runtime/ConstitutionalAssemblyScheduler.ts`, `src/commercial/IOFPackageAssemblyEngine.ts`, `server/routes/proposal-drafts.js`, `server/routes/commercial-iof-packages.js`, `server/routes/commercial-revisions.js` |
| Active Engineering consumers | `server/routes/engineering-baselines.js`, `server/routes/engineering-packages.js`, `server/routes/engineering-certification.js`, `src/engineering/EngineeringCertificationProjection.ts`, `src/workspaces/EngineeringCertificationWorkspace.tsx` |
| Active ScopeVersion consumer | `server/scopeversion-authority-engine.js` |
| Historical / partially stale docs | `ENGINEERING_CERTIFICATION_MODEL.md`, `IOF_PACKAGE_ASSEMBLY_ENGINE.md`, `SPRINT_19B_PRODUCT_DOCTRINE_GOLDEN_PATH_REPORT.md`, `SPRINT_20A_ENGINEERING_CERTIFICATION_TWIN_REPORT.md` |
| Adjacent doctrine, not product doctrine | `PD_006_*`, `PD_007_*`, `src/doctrine/pd003/*`, `src/spine/catalog/SpineObjectDoctrine.ts`, `src/doctrine/pd002/*` |
| Fixture-only / validation references | `sprint*.mjs`, `cip*.mjs`, `server/data/**` JSON |

## Final Answer To Key Questions

### Canonical current product doctrine file

`src/products/pointToPointLongHaulDoctrine.ts`

Contract:

`src/products/ProductDoctrineContracts.ts`

### Duplicate or conflicting doctrine definitions

- `PD-001` shorthand conflicts with the canonical doctrine ID.
- `Point-to-Point Duct & Dark Fiber` business product name coexists with `Point-to-Point Long Haul Conduit & Fiber` doctrine name.
- Legacy `POINT_TO_POINT_DARK_FIBER` appears in older validation/data records.
- Advisory `PRODUCT_COMMERCIAL_MODEL.md` includes products not implemented as active Product Doctrine.
- Older Engineering Certification docs conflict with newer Engineering Baseline/Revision/Ledger doctrine.

### Doctrine hardcoded inside TypeScript instead of markdown/config

Yes. The active Product Doctrine is hardcoded in:

- `src/products/pointToPointLongHaulDoctrine.ts`
- `src/products/PointToPointConfigurator.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `server/routes/product-fulfillment.js`

### Doctrine currently used by Commercial

Yes. Commercial actively invokes and consumes Product Doctrine through the Product Configurator, Product Doctrine Assembly scheduler, Draft IOF Package assembly, and Commercial Planning UI.

### Doctrine currently used by Engineering Certification

Yes, but as package/restored projection truth rather than as an imported canonical doctrine file. Engineering Certification reads doctrine snapshots, IDs, quantities, assemblies, and PD-001 compliance evidence from Draft IOF / Engineering Package state.

### Doctrine currently used by ScopeVersion readiness

Yes, as a required product doctrine snapshot/reference on the certified package consumed by ScopeVersion authority. ScopeVersion does not currently resolve the canonical doctrine file directly.

## Recommended Follow-up

Do not create a new doctrine yet.

Before implementation, decide whether Product Doctrine should remain TypeScript-owned or move to a versioned repository/config artifact. The inventory suggests the next clean step would be a Product Doctrine Registry that maps:

- canonical doctrine ID
- shorthand alias (`PD-001`)
- business product name
- technical product name
- product ID
- required services
- required assets
- required engineering objects
- evidence requirements
- certification rules
- ScopeVersion readiness references
