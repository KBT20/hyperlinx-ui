# CIP-044A.1 Narrow Runtime / ILA / Estimate Testability Report

Date: 2026-08-13
Scope: local `hyperlinx-dal-dev` only. No deploy, DAL1 access, production access, persistence migration, repository clearing, or customer-data regeneration was performed.

## Outcome

The ILA Planning crash is repaired with an immutable legacy-record presentation adapter, intermediate and bookend ILAs are independent and default OFF, the active new-revision dirt baseline resolves through the approved $15/ft estimating authority and governed package capability, positive rock quantity can no longer silently appear as $0 when its rate is unresolved, all four civil-mix values are consumed and must total 100%, and CIP-044A dependency-aware recomputation remains intact.

The focused validator passes 59/59. TypeScript, production build, `git diff --check`, and CIP-041 through CIP-044A regressions pass.

## Files changed for this repair

- `src/commercial/IlaPlanningEngine.ts`
- `src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/routeEdit/RouteEditProjection.ts`
- `src/products/DuctDarkFiberProjectConfiguration.ts`
- `src/commercial/TransparentEstimatingEngine.ts`
- `src/commercial/CommercialPricingArchitecture.ts`
- `src/performance/CommercialMutationRuntime.ts`
- `cip044a1-narrow-runtime-ila-estimate-testability-validation.mjs`
- `CIP_044A1_NARROW_RUNTIME_ILA_ESTIMATE_TESTABILITY_REPORT.md`

The worktree contained unrelated prior changes before this repair. They were preserved.

## Exact ILA failure and root cause

The exception came from the ILA table expression that directly invoked `.replaceAll("_", " ")` on four station properties: `station.role`, `station.planningAuthority`, `station.engineeringState`, and `station.powerState`. The first undefined value on affected records was normally `station.role`.

A read-only scan of local persisted JSON found 148 station-like records; 124 lacked each of those four newer presentation/planning fields. These are legacy records created before the current `IlaStationObject` UI shape. The defect was therefore a persisted-schema/UI-projection mismatch, not an ILA OFF calculation failure. No persisted record was changed.

`normalizeIlaPlanningResultForPresentation` now clones the plan and stations. It derives a display role only when station type proves it (`A_BOOKEND`, `Z_BOOKEND`, or `INTERMEDIATE`) and leaves required missing fields visibly `UNRESOLVED` or `MISSING_EVIDENCE`. `optionalPlanningDisplay` is the final string-operation guard. It does not fabricate constitutional validity.

The ILA region is wrapped in `SecondaryEstimatePanelBoundary`. A panel exception is logged with the original error and React component stack and is visibly contained without taking down Commercial Planning.

## ILA model and cost behavior

Before this repair, the compatibility default was effectively bookended. New Product #1 configurations now set:

- `intermediateIlaEnabled = false`
- `bookendIlaEnabled = false`
- `bookendIlaCount = 0`
- bookend active cost = $0

Legacy `OFF`, `INTERMEDIATE_ONLY`, `BOOKENDED`, and `useBookendIlas` records normalize compatibly. Intermediate placement always uses the actual A/Z route interval; bookends are additive and never counted as intermediate facilities. Route-edit bookend patches also update the new independent flag.

An 80-mile, 30-mile-max-span fixture produced:

| State | Intermediate | Bookends | Total | Active ILA cost | Spans (mi) |
|---|---:|---:|---:|---:|---|
| Both OFF | 0 | 0 | 0 | $0 | 80.00 |
| Intermediate ON, bookends OFF | 2 | 0 | 2 | $3,745,200 | 26.67 / 26.66 / 26.67 |
| Intermediate OFF, bookends ON | 0 | 2 | 2 | $3,745,200 | endpoint bookends plus 80.00 A/Z interval |
| Both ON | 2 | 2 | 4 | $7,490,400 | bookends additive to the same intermediate plan |

Turning either group OFF reconstructs the active plan from current controls, so its quantity, equipment/facility contribution, and dependencies do not survive as stale cost. Historical revisions remain immutable.

## Standard Dirt trace and repair

The active $11 value came from `WORKBOOK_RATES.dirtBoreLaborPerFoot: 11` in `TransparentEstimatingEngine.ts`. That constant populated the active `labor.dirtBoreLaborPerFoot` constraint and dirt estimate line. Additional $11 references exist in `ProductionProfileLibrary.ts` as historical/audit production data and in rough legacy corridor formulas; they are not the new active estimate-line authority and were not rewritten.

For new revisions, the transparent estimate now starts from `ESTIMATOR_DEFAULTS.construction.baseDirtBorePerFoot = 15`, resolves the selected duct package through Construction Capability, and applies the CIP-043 Teralinx bore rate rule. Results are $15/ft for 3x1.25 and $25/ft for governed 8-inch ream packages (3x1.5 and 6x1.25). This is Estimating/Rate authority, not Product Doctrine.

An existing saved `labor.dirtBoreLaborPerFoot` constraint still overrides the new default, so a historical $11 revision remains $11. A human-approved project value such as $14.50 creates/retains the project calibration and audit trail without mutating the $15 global baseline. The dirt estimate row now exposes the same rate authority that is calibrated.

## Rock $0 trace and repair

Rock originally appeared as $0 for two distinct reasons:

1. The standard civil mix intentionally starts at 0% rock, so calculated rock footage is zero.
2. When rock was positive but rate authority was missing, the estimator substituted a fallback adder and the UI could not distinguish unresolved rate state from zero-value state. The estimate row also exposed the percentage authority instead of its active rate authority.

Rock now has independent percentage, derived footage, adder/rate, and extended-cost paths. With a valid authority, cost is `rock feet × (dirt rate + rock adder)`. A human-approved rock percentage or adder flows through the existing constraint/audit path. With positive quantity and no valid rate authority, unit and extended cost are `UNKNOWN` with `UNRESOLVED RATE`; they are not coerced to $0. Zero remains valid when rock quantity is zero or when an explicit authoritative rate is truly zero.

## Duct, plow, civil mix, and authority alignment

- Duct count and diameter remain Project Configuration. The 3x1.25, 3x1.5, and 6x1.25 fixtures resolve Construction Capability to 6-, 8-, and 8-inch ream classes and reach estimate rates of $15, $25, and $25 respectively.
- Bore/ream capability remains separate from the Teralinx Rate Profile; nominal conduit diameters are not summed.
- The catalog estimate now passes the existing additional-depth and project-calibration arguments through `plowRate`; additional conduit and capability-required prerip remain active. The validation fixture resolves $8.44/ft: $4.50 base + two $1.05 conduit adders + two $0.67 depth adders + $0.50 project calibration.
- `calculateCivilMixFastPath` consumes plow, dirt, rock, and trench explicitly. Non-finite/negative values or a total other than 100% produce a visible validation error. Deterministic whole-foot rounding reconciles to the largest mix component.
- Current active line authorities are now rate authorities for dirt, plow, rock, and trench. Fiber and conduit remain Material Catalog lines that can be project-calibrated. ILA remains Project Configuration/optical planning. Contingency and overhead remain estimating controls, markup/margin remains Commercial Policy, and O&M remains Commercial Policy.

Competing paths retained for CIP-045 inventory: the transparent estimator, the CIP-043 catalog estimator, historical production profiles, and rough legacy corridor estimating formulas coexist. They were not broadly consolidated here because they do not all drive the active estimate revision. CIP-045 should remove the remaining presentation/control duplication.

## Reasoning, duplicate design diagnostics, and earlier 500s

Reasoning endpoint failure remains non-blocking. `ReasoningServiceManager` records DEGRADED/OFFLINE state and opens its bounded circuit; the deterministic estimator, ILA planner, Product Doctrine, and proposal projection do not import or depend on the reasoning manager. No network repair or retry increase was made.

The duplicated Design diagnostic sequence is React development `StrictMode` evaluation/logging. `DesignLaunchEngine` builds a read-only session with `noPersistence: true`, `noScopeVersionCreation: true`, and `noInventoryMutation: true`; it does not write a governed artifact. No engine redesign was warranted.

The earlier Current Session, Customer Twin, and Proposal Runtime Library 500s were not caused by this ILA presentation mismatch and were not modified in this CIP.

## Performance evidence

Real UI before baseline supplied for CIP-044A: **241.3 ms** for `CIVIL_MIX_CHANGE`, 4 invalidated, 12 preserved, structural IOF cache hit, geometry cache hit, map not invoked, Engineering not invoked.

No browser automation surface was available in this execution, so a defensible real-UI after timing was not captured and is not fabricated. The same live mutation implementation and dependency registry remain in place. The post-change CIP-044A kernel benchmark was **0.000088 ms/change** for the arithmetic/dependency fixture; this is not represented as UI latency.

The current `CIVIL_MIX_CHANGE` code path records:

| Operation | Count |
|---|---:|
| route rebuilds | 0 |
| station rebuilds | 0 |
| object-manifest rebuilds | 0 |
| Product Doctrine evaluations | 0 |
| structural IOF assemblies | 0 (cache hit/preserved) |
| Engineering projections | 0 |
| map rebuilds | 0 |
| quantity recalculations | 1 |
| estimate recalculations | 1 |
| financial projections | 1 |
| proposal projections | 1 |
| React state commits | 3 |

Invalidated: QUANTITY, ESTIMATE, COMMERCIAL_FINANCIALS, PROPOSAL. Preserved: GEOMETRY, SPINE, STATIONING, OBJECT_MANIFEST, PRODUCT_DOCTRINE, PROJECT_CONFIGURATION, CONSTRUCTION_CAPABILITY, RATE_RESOLUTION, MATERIAL_RESOLUTION, DRAFT_IOF, ENGINEERING, MAP.

Rock changes use the civil/quantity path without geometry. Dirt-rate calibration uses RATE_RESOLUTION/ESTIMATE/FINANCIALS/PROPOSAL. Material-rate changes use MATERIAL_RESOLUTION/ESTIMATE/FINANCIALS/PROPOSAL. Bookend toggles use Project Configuration/quantity/estimate/financial/proposal/Draft IOF; direct visible map bookend edits retain the existing affected-span map impact path.

## Required Product #1 scenarios

Pricing scenarios use a 1,000-route-foot fixture unless stated otherwise. ILA scenarios use the 80-mile planning fixture above. `G=0` and `E=0` denote geometry rebuild and Engineering projection counts.

| Scenario | Quantity | Baseline / calibrated rate | Extended cost | Authority/source | Invalidations | G / E |
|---|---:|---:|---:|---|---|---:|
| A. 3x1.25 + no ILA | 1,000 bore ft; 0 ILA | $15/ft | $15,000 bore; $0 ILA | Rate Catalog / approved Product #1 estimating baseline; ILA OFF | config as applicable; estimate | 0 / 0 |
| B. 3x1.25 + intermediate, no bookends | 2 intermediate ILAs over 80 mi | $1,872,600/facility | $3,745,200 ILA | Project Configuration / optical planning | PROJECT_CONFIGURATION, QUANTITY, ESTIMATE, FINANCIALS, PROPOSAL, DRAFT_IOF | 0 / 0 |
| C. 3x1.25 + bookends only | exactly 2 bookends | $1,872,600/facility | $3,745,200 ILA | Explicit Project Configuration | same ILA dependencies | 0 / 0 |
| D. 3x1.5 | 1,000 bore ft; 8-inch ream class | $25/ft | $25,000 | Construction Capability + Teralinx Rate Profile | configuration, capability, quantity/material/rate, estimate, financial, proposal, Draft IOF | 0 / 0 |
| E. 6x1.25 | 1,000 bore ft; 8-inch ream class | $25/ft | $25,000 | Construction Capability + Teralinx Rate Profile | same as D | 0 / 0 |
| F. dirt baseline | 1,000 dirt ft | $15/ft | $15,000 | approved new-revision estimating authority | RATE_RESOLUTION, ESTIMATE, FINANCIALS, PROPOSAL | 0 / 0 |
| G. dirt calibrated | 1,000 dirt ft | $15 baseline / $14.50 calibrated | $14,500 | HUMAN_CALIBRATION over preserved baseline | RATE_RESOLUTION, ESTIMATE, FINANCIALS, PROPOSAL | 0 / 0 |
| H. rock + valid rate | 100 rock ft | $15 dirt + $30 rock adder = $45/ft | $4,500 | active dirt-rate authority + rock-adder authority | QUANTITY, ESTIMATE, FINANCIALS, PROPOSAL | 0 / 0 |
| I. rock + unresolved rate | 100 rock ft | UNRESOLVED RATE | UNKNOWN, never $0 | unresolved rate authority / human review required | QUANTITY, ESTIMATE, FINANCIALS, PROPOSAL | 0 / 0 |
| J. plow + additional conduit | 1,000 plow ft, 3 conduits, 2 depth increments | $4.50 base + $2.10 conduit + $1.34 depth + $0.50 calibration = $8.44/ft | $8,440 | Rate Profile + Project Configuration calibration | RATE_RESOLUTION, ESTIMATE, FINANCIALS, PROPOSAL | 0 / 0 |

## Validation results

- Focused CIP-044A.1: 59/59 passed.
- CIP-041: 30/30 passed.
- CIP-042: 50/50 passed.
- CIP-043: 45/45 passed.
- CIP-044A: 41/41 passed.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npm run build`: passed (existing Vite chunk-size warning only).
- `git diff --check`: passed (line-ending notices only).

## Remaining issues / stop condition

- Capture a comparable real-browser post-change `CIVIL_MIX_CHANGE` timing in the normal UI instrumentation when an interactive browser run is available.
- The earlier local 500 investigation remains separately bounded.
- Full Estimate/Calibration/Proposal control consolidation and removal of retained competing legacy presentations belongs to CIP-045.

No Product #2, Metro doctrine, Middle-Mile doctrine, PostgreSQL/PostGIS migration, deployment, DAL1 push, or production modification was started.
