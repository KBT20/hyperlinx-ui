# CIP-042 — Duct & Dark Fiber Product Doctrine 1.0 Report

## Outcome

PD-001 now defines product requirements without inventing project configuration, engineering quantities, estimating rates, or commercial pricing. The change stops at Draft IOF / Engineering-certification behavior. It does not create a ScopeVersion and does not invoke Marketplace, Control, Field, Closure, or Twin execution.

**Product:** Point-to-Point Duct & Dark Fiber
**Product ID:** `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER`
**Doctrine ID:** `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER`
**Previous version:** `19B.1.0`
**New version:** `20C.1.0`

The migration reason is persisted as: separate Product Doctrine requirements from Project Configuration, source evidence, estimating assumptions, Commercial Policy, and Engineering authority; remove mileage-generated infrastructure. Historical package snapshots retain their prior doctrine reference. New or rebuilt package revisions may carry an explicit, auditable migration record; prior revisions are not mutated.

## Files changed for CIP-042

- `src/products/ProductDoctrineContracts.ts`
- `src/products/DuctDarkFiberProjectConfiguration.ts` (new)
- `src/products/ProductDoctrineVersionRegistry.ts` (new)
- `src/products/pointToPointLongHaulDoctrine.ts`
- `src/products/ProductRegistry.ts`
- `src/products/PointToPointConfigurator.ts`
- `src/commercial/DuctDarkFiberAuthorityLayers.ts` (new)
- `src/commercial/IlaPlanningEngine.ts`
- `src/commercial/TransparentEstimatingEngine.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx`
- `src/reference/helium/HeliumReferenceAssembly.ts`
- `src/engineering/quantity/QuantityReconciliationDraftAdapter.ts`
- `cip042-duct-dark-fiber-product-doctrine-v1-validation.mjs` (new)
- `CIP_042_DUCT_DARK_FIBER_PRODUCT_DOCTRINE_V1_REPORT.md` (new)

The repository contained unrelated pre-existing changes; those changes were preserved.

## Removed synthetic assumptions

The active doctrine no longer derives final infrastructure from route mileage:

- handholes: removed `ceil(routeMiles / 2)`
- vaults: removed `ceil(routeMiles / 10)`
- splice cases: removed `ceil(routeMiles / 15)`
- ILAs: removed `floor(routeMiles / 60)`
- regeneration: removed `floor(routeMiles / 80)`
- fiber placement: removed hidden fixed `1.05`
- physical defaults: removed doctrine-level `4 ducts / 2-inch / 864-count`
- pricing: removed `routeFeet × 42` and `budgetCost × 1.35`

Unknown structure, splice, crossing, restoration, rock, and other constraint facts remain gaps or planning-only assumptions. They are not fabricated as infrastructure.

## Authority-layer model

### Product Doctrine

Requires an authoritative measurable route, explicit project configuration, attributable fiber placement policy, governed structure and splice decisions, applicable-constraint evaluation, and Engineering certification. It asks the Engineering questions; it does not supply the answers.

### Project Configuration

Tenant-scoped, revisioned configuration now carries duct count, diameter, material/specification, fiber count, cable type, placement policy, slack policy, structure-plan authority, splice-architecture authority, ILA configuration, and termination configuration. Revision creation is immutable and retains the preceding configuration.

### Project evidence and route authority

PD-001 requires `AUTHORITATIVE_ROUTE_CENTERLINE`, not OSRM. Accepted governed provenance includes customer KMZ/KML, GIS, engineered geometry, commercially drawn route, approved route revision, OSRM-assisted route, and other governed sources. Route source, authority, revision, hash, and measurement authority remain attributable. The legacy `osrmRoute` projection is retained only for caller/persisted-package compatibility; the canonical contract and assembly expose `authoritativeRoute`.

### Estimating Doctrine

`ED-L1-DUCT-DARK-FIBER-1.0` owns production rates, labor/material/equipment rates, crew and engineering assumptions, allowances, confidence, formulas, revision, approval, and effective-date metadata. Commercial structure/splice spacing can exist only as a visibly classified `COMMERCIAL_ASSUMPTION`; it is not certified design.

### Commercial Policy

`CP-L1-DUCT-DARK-FIBER-1.0` owns markup, margin, NRC/MRC, O&M, term, ROI/IRR/payback, and commercial contingency policy. With no selected pricing authority, doctrine pricing is zero-valued and `UNRESOLVED`; it is never presented as doctrine truth.

### Engineering

Engineering retains final structure, splice, optical, ILA, power, facility, and certifiability authority. Planning results are not Engineering certification. CIP-041 `BIND_OPTICAL_DESIGN` remains the governed optical-design mechanism.

## Stationing

The measured spine declares `CONTINUOUS` station authority. Infrastructure may carry point station or start/end stations at arbitrary measured positions. Periodic markers are explicitly `DISPLAY_INDEX` and `constitutionalResolution: false`; they support navigation and rendering but do not define infrastructure resolution.

## Structure and splice behavior

Structure and splice quantities instantiate only when provided by governed source/configuration. Supported authority states include source-defined, commercial assumption, Engineering-defined, and unknown. Unknown values create requirement gaps. Product Registry quantity authority classifies conduit/fiber as Project Configuration and structures as governed source/Engineering design.

## Governed ILA planning

The three active modes are:

- `OFF`: no proposed ILA facilities, equipment, labor, schedule, lifecycle cost, or dependencies.
- `INTERMEDIATE_ONLY`: proposes only governed intermediate planning objects; A and Z remain endpoints and are not ILA facilities.
- `BOOKENDED`: creates explicit A and Z facility objects plus any governed intermediate planning objects.

The model uses explicit roles (`A_BOOKEND`, `INTERMEDIATE`, `Z_BOOKEND`) and does not prevent future independent A-only or Z-only endpoint controls. Every active facility exposes station/milepost, planning authority, planning state, Engineering state, power state, evidence state, facility profile, capital, and schedule impact.

Planning authority supports Engineering-defined, loss-budget, max-span-distance, and source-defined inputs. Max-span planning is labeled `COMMERCIAL_SCENARIO`; every proposed station remains `ENGINEERING_REQUIRED` until governed validation/certification occurs.

### Deselect bug and cache behavior

Root cause: the prior boolean controlled bookend seed creation but did not constitutionally disable intermediate recommendations, facility/equipment projections, or memoized results. Consequently, removing bookends could leave route-generated intermediate costs and a stale cached estimate.

The engine now normalizes legacy `useBookendIlas: false` to `ilaMode: OFF`. Mode, planning authority, tenant scope, and configuration revision are part of the memo key. A mode/configuration change increments the configuration revision, explicitly invalidates the ILA estimate cache, and rebuilds the projection. Prior commercial revisions remain available for audit; history is not mutated.

### Required 80-mile scenarios

| Scenario | New facilities | Authority/state | Cost and schedule result |
|---|---:|---|---|
| 80 miles / `OFF` | 0 | `NOT_SELECTED` | facility capital 0; equipment 0; labor 0; lifecycle 0; schedule 0; dependencies none |
| 80 miles / `INTERMEDIATE_ONLY`, max span 60 | 1 intermediate; no A/Z facilities | `MAX_SPAN_DISTANCE` / `COMMERCIAL_SCENARIO`; Engineering required | one governed planning facility profile contributes; no endpoint facility contribution |
| 80 miles / `BOOKENDED`, max span 60 | A + 1 intermediate + Z | explicit roles; `COMMERCIAL_SCENARIO`; Engineering required; power/evidence required | three governed facility profiles contribute; each contribution is individually attributable |
| 80 miles / `OFF`, existing ROADM evidence | 0 | ROADM remains source evidence | no new ILA is priced |

**ROUTE LENGTH ALONE DOES NOT CREATE ILA.** It also does not create regeneration.

## Estimate Audit

Audit rows retain item, value, unit, authority mode, source, confidence, cost/schedule impact, formula, approver, and notes. They now also expose `authorityLayer`, `costLedgerId`, and `costContributionMode`.

Authority layers distinguish Product Doctrine, Project Configuration, Source Evidence, Estimating Doctrine, Commercial Policy, Engineering, and Unknown. Cost lineage classifies entries as primary, component, reference-only, or rollup. ILA equipment shown as an explanatory projection is `REFERENCE_ONLY`; the facility ledger is counted once. Validation confirms duplicate display projections do not double-count financial totals.

## Helium before/after comparison

The Helium fixture was reevaluated as a new doctrine revision without applying any Engineering disposition:

| Concern | Previous behavior | `20C.1.0` behavior |
|---|---|---|
| Route | KMZ geometry flowed through an OSRM-named doctrine contract | measured KMZ is an authoritative governed route with explicit source, authority, revision, hash, and measurement authority |
| Conduit | physical selection could be confused with doctrine defaults | explicit project configuration: 3 ducts and source-defined diameter; measured route multiplication remains reconcilable |
| Fiber | hidden/general 5% doctrine multiplier | explicit attributable 5% project placement policy; still requires reconciliation |
| Handholes | source 334 conflicted with synthetic mileage result 76 | source 334 remains evidence; governed structure plan is unknown and requires Engineering review |
| Splices | source 34 could be compared to a mileage formula | source 34 remains evidence; Engineering splice architecture is unresolved |
| ILAs | route mileage could add facilities | two source-defined sites are preserved pending optical validation; no additional mileage-generated sites |

The real six-item Engineering reconciliation was not auto-resolved. No source value, historical reconciliation, or authority disposition was changed.

## CIP-041 and tenant compatibility

CIP-041 continues to reconcile immutable source and derived quantities and to require authorized dispositions. Corrected doctrine removes invalid synthetic comparison values from new revisions while preserving historical records. Every new project configuration, doctrine migration, estimating authority, ILA plan, and audit artifact carries organization/tenant/customer/opportunity scope; cache keys include tenant scope and no shared mutable customer state was added.

Commercial still cannot certify Engineering or create ScopeVersion. Engineering certification still certifies the Draft IOF Package only. No signed Service Order or ScopeVersion behavior was introduced.

## Validation and regressions

- CIP-042 doctrine validation: **50/50 passed**
- TypeScript: **passed** — `npx tsc --noEmit -p tsconfig.json`
- Production build: **passed** — `npm run build`
- CIP-035A: **passed**
- CIP-036 OSRM/IOF projection: **passed**
- CIP-036 reasoning service: **passed**
- CIP-037 geometry authority: **passed**
- CIP-037 commercial projection surface: **passed**
- CIP-038 constitutional state authority: **passed**
- CIP-038A UI restoration: **passed**
- CIP-039 closure engine: **passed**
- CIP-040 Product Registry/Helium: **passed**
- CIP-041 Engineering reconciliation: **30/30 passed**

## Unresolved items

- Helium Engineering reconciliation remains unresolved by design; Engineering must disposition the six governed items.
- Helium structure quantity, splice architecture, and optical design remain pending their respective governed authorities.
- Unknown crossings, rock, restoration, jurisdictional constraints, and related impacts remain unresolved until evidence or Engineering supplies them.
- Pricing remains `UNRESOLVED` when no explicit Estimating Doctrine/rate authority and Commercial Policy are selected.
- Planning ILAs remain commercial/source scenarios until Engineering validates and certifies the optical design.

These unresolved states are the intended constitutional result: the Draft IOF can assemble known objects and visible gaps without inventing Engineering facts.
