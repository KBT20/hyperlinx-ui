# CIP-043 Commercial Pricing Catalog + Configuration Report

## Outcome

CIP-043 establishes a catalog-backed Commercial pricing boundary for Point-to-Point Duct & Dark Fiber. Project Configuration starts at a mutable `3 x 1.25-inch` commercial default; Construction Capability separately resolves physical package feasibility and required ream class; Rate Catalog prices labor, equipment, professional services, and other services; Material Catalog resolves vendor-backed material records; project calibration creates an immutable estimate revision; Commercial Policy establishes customer price after cost.

No CIP-043 code creates a ScopeVersion or mutates Product Doctrine, Engineering certification, a source quote, or a catalog revision.

## Pricing architecture before CIP-043

Phase 0 inspection found the following active or historical pricing paths:

| Path | Previous authority/location | Finding and disposition |
| --- | --- | --- |
| Product Doctrine | `pointToPointLongHaulDoctrine.ts`, `ProductDoctrineContracts.ts` | CIP-042 had already removed final pricing; `pricingSummary` remains unresolved until estimating. Preserved. |
| Project Configuration | `DuctDarkFiberProjectConfiguration.ts`, `TransparentEstimatingEngine.ts`, `PointToPointConfigurator.ts` | Configuration was revisable, but defaults were inconsistent (`3x1.5` in estimating and `4x2` in configurator). Consolidated to configurable `3x1.25`. |
| Transparent Estimating Engine | `TransparentEstimatingEngine.ts` | Still contains `WORKBOOK_RATES`, workbook source labels, material unit prices, labor rates, contingency, markup, NRC, MRC, and O&M projection. Preserved for backward compatibility; the new catalog baseline is the CIP-043 authority for new catalog-backed estimates. |
| Production/rate engine | `doctrine/pd003/ProductionProfileLibrary.ts` | Production profiles contain labor/material rate fields derived from prior audit assumptions. They remain legacy estimating-doctrine inputs and are not promoted into the new catalogs automatically. |
| Material engine | `TransparentEstimatingEngine.ts`, `UnitCostLibrary.ts`, `CivilMixProfile.ts` | Material prices were workbook/default values embedded beside calculation logic. New vendor-backed resolution is isolated in `MaterialCatalog`; legacy paths remain for historical reproducibility. |
| Labor engine | `TransparentEstimatingEngine.ts`, `ProductionProfileLibrary.ts`, `CivilMixEngine.ts` | Multiple hardcoded labor paths exist. The supplied underground card is now modeled as a source-backed Rate Profile; old values remain explicitly legacy. |
| Equipment | `TransparentEstimatingEngine.ts`, ILA facility profiles | Equipment and ILA capital were projected in the monolith. New Rate Catalog supports generic `EQUIPMENT`; ILA behavior remains governed by the CIP-042 planning engine. |
| Professional services | engineering/permitting and PM lines in `TransparentEstimatingEngine.ts` | Previously workbook/default driven. Rate Catalog now supports `PROFESSIONAL_SERVICE` without new engine branches. |
| ILA facilities/equipment | `IlaPlanningEngine.ts`, `IlaRegenPricing.ts`, `TransparentEstimatingEngine.ts` | Preserved. `OFF` remains zero; `INTERMEDIATE_ONLY` and `BOOKENDED` behavior is unchanged. Catalog baseline records the resolved ILA quantity/cost provenance. |
| Contingency | categorized controls in `TransparentEstimatingEngine.ts`; older `CivilMixEngine.ts` percent | Duplicate projections exist. They remain visible for historical behavior. New project estimate calibration is revision-only and Commercial Policy remains separate. |
| Markup/margin | `TransparentEstimatingEngine.ts`, `CostPlusPricingModel.ts`, older civil fixtures | Multiple policy projections existed. CIP-043 formalizes `applyCommercialPolicy` after estimate cost and keeps markup/margin out of Product Doctrine. |
| NRC/MRC/O&M | `TransparentEstimatingEngine.ts`, `CommercialFinancialAuthority.ts`, `FiberRoutePricingSummary.ts` | Existing proposal projections are preserved. New policy result explicitly records policy ID/revision and estimate ID. |
| Estimate Audit | `TransparentEstimatingEngine.ts`, `TransparentEstimateExplorer.tsx` | CIP-042 added authority layer and cost lineage. CIP-043 adds `RATE_CATALOG`, `MATERIAL_CATALOG`, and `HUMAN_CALIBRATION`, plus Rate Profile, Material Quote, and override provenance on catalog estimate lines. |
| Executive Summary | estimate sections and proposal summary panels | Some values are rollups of the same cost. Catalog totals count only `PRIMARY` ledger lines; rollup/reference rows cannot double count. |
| Commercial Revision | client repository + `server/routes/commercial-revisions.js` | Immutable reference artifact. Preserved. |
| Commercial Release Package | `commercial-revisions.js`, `commercialRepositories.ts` | Release persistence already existed in current changes. Dashboard status did not require its ID for automatic assembly PASS; repaired. |
| Draft IOF assembly/save | `IOFPackageAssemblyEngine.ts`, `commercial-iof-packages.js`, workspace effect | Governed repository save existed and consumed release authority. UI sequencing is now consistent with the repository path. |

Duplicate or weak-authority values remain in `WORKBOOK_RATES`, `ProductionProfileLibrary`, `UnitCostLibrary`, `CivilMixProfile`, old fixtures, and Google-specific reference pricing. They were documented rather than deleted because historical estimates and regressions still depend on them. New catalog resolution does not silently treat those values as approved catalog authority.

## Files changed

- `src/commercial/CommercialPricingArchitecture.ts` — Rate Catalog, Material Catalog, construction capability, source fixtures, estimate revision/calibration, Commercial Policy, and lifecycle validation.
- `src/products/DuctDarkFiberProjectConfiguration.ts` — configurable `3x1.25` default, initial configuration factory, append-only revision helper.
- `src/products/ProductRegistry.ts` — exposes project configuration defaults as configurable product metadata.
- `src/products/PointToPointConfigurator.ts` — consumes the project default and optional commercial selections instead of hardcoded `4x2`.
- `src/commercial/DuctDarkFiberAuthorityLayers.ts` — catalog and human-calibration authority layers and explicit boundaries.
- `src/commercial/TransparentEstimatingEngine.ts` — aligns visible default to `3x1.25` and expands audit authority layers.
- `src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx` — displays governed capability/ream/profile summary and collapses advanced audit/provenance detail.
- `src/components/workspaces/GoogleRfpWorkspace.tsx` — lifecycle PASS repair and collapsed Advanced / Diagnostics label.
- `cip043-commercial-pricing-catalog-configuration-validation.mjs` — 45-point executable validation.
- `CIP_043_COMMERCIAL_PRICING_CATALOG_CONFIGURATION_REPORT.md` — this report.

## Rate Catalog model

`RateCatalog` registers extensible category strings and immutable `RateProfile` revisions. Initial categories are `LABOR`, `EQUIPMENT`, `PROFESSIONAL_SERVICE`, and `OTHER_SERVICE`; adding another category does not change estimate-engine code. `RateItem` carries ID, profile, category/subcategory, description, unit, rate, currency, `FIXED|TABLE|FORMULA|ADDER`, authority, source document, effective/expiration dates, applicability, capacity bounds, conditions, formula, approver, revision, and active state.

Resolution enforces artifact scope, effective dates, capacity, conditions, and revision. The supplied underground card is represented as profile `UNDERGROUND-RATE-CARD-R1`, including plow, trench, drilling table, rock adders, excavation, fiber installation, splicing, and testing examples. `TERALINX-STANDARD-BORE-R1` coexists as a formula profile.

## Material Catalog model

`MaterialCatalog` and `MaterialVendorQuote` are independent from Rate Catalog. Material records retain category, specification, manufacturer/vendor/SKU, unit price, quoted quantity, quote dates, source document/hash, freight/tax treatment, scope, revision, and quote status.

Quote `223377-00` is represented with its cited duct, 864F cable, tracer wire, tape, marker, splice case, tray, and accessory lines. Status supports `ACTIVE`, `EXPIRED`, `SUPERSEDED`, `APPROVED_PROJECT_SOURCE`, and `REFERENCE_ONLY`. Supplier/raw-material adjustment risk is explicit.

The source extract did not provide the actual quote date, validity dates, shipping/tax wording, or binary document bytes. The fixture therefore uses clearly identifiable reference metadata and a non-cryptographic placeholder source-hash label. Production ingestion must replace those fields from the actual quote document before approval.

## Construction Capability model

The capability model maps a physical duct package and construction method to capability class, required ream class, plow feasibility, prerip, equipment class, review conditions, source, and revision. Ream size is selected by governed mapping; nominal duct diameters are never summed.

- `3x1.25` directional bore → `STANDARD`, governed 6-inch ream class.
- `6x1.25` directional bore → `REAM_8`, governed 8-inch ream class.
- `3x1.5` directional bore → governed 8-inch ream class.
- Plow uses independent count/diameter rules and never consumes bore OD logic.

Future Engineering refinement changes the capability mapping revision without changing the Teralinx commercial formula.

## Bore capacity and Teralinx pricing

The Teralinx formula is:

`$15 base + ($10 x each governed 2-inch ream increment above standard) + geology + special condition + project calibration`

The contractor profile instead selects the matching source table row. These behaviors coexist without product-specific conditionals in Product Doctrine.

## Rock adders

Geology is an additive estimate line. `NORMAL`, `COBBLE_SOFT_ROCK`, and `HARD_ROCK` are initially supported, but the condition field accepts future governed values. The selected Rate Profile supplies the applicable adder. Base bore cost and geology cost remain independently attributable.

## Plow pricing

Plow resolution uses base rate, additional conduit count, depth increments, prerip, geology, and project calibration. Capability determines whether plowing is allowed and whether prerip/review is required. No bore/ream calculation participates.

## Material resolution

Product Doctrine identifies required asset class; Project Configuration supplies diameter/count/fiber specification; quantity derivation supplies feet/count; Material Catalog resolves the matching vendor record; estimate lines retain quote and material IDs. Vendor SKU never enters Product Doctrine.

## Add Category / Add Estimate Item

`registerCategory` permits new rate categories through data. `addEstimateItem` accepts `LABOR`, `MATERIAL`, `EQUIPMENT`, `PROFESSIONAL_SERVICE`, or `OTHER`, then creates a new immutable project-estimate revision. Items without approved authority stay `HUMAN_ASSUMPTION` or `UNRESOLVED`; they are not added to global catalogs.

## Human calibration

`calibrateEstimate` records baseline, human value, delta, financial impact, reason, approver, and revision on the affected line. It returns a new project estimate and retains the prior estimate ID. Tests compare catalog snapshots before and after calibration to prove no Rate Catalog or Material Catalog mutation. Automatic promotion is prohibited.

## Estimate Audit

Catalog estimate lines expose quantity, unit, authority mode/layer, source, formula, revision, impact, ledger ID, contribution mode, Rate Profile/rate IDs, Material Quote/material IDs, and human override. Totals sum only `PRIMARY` rows, preventing component/reference/rollup duplication.

## Commercial Policy

`applyCommercialPolicy` consumes approved estimate cost and a separate policy revision. It supports markup or target margin, NRC adjustment, MRC/O&M, term, and other terms. The result references both estimate and policy and explicitly reports no Product Doctrine mutation.

## Commercial UI cleanup

The main estimate surface now leads with Project Configuration and a concise product/package/capability/ream/rate-authority summary. Calibration, Commercial readiness, civil mix, and ILA configuration remain actionable. Estimate revisions, full audit, source provenance, and diagnostics are secondary collapsed panels. Runtime/developer diagnostics are labeled `Advanced / Diagnostics` and default closed. Blocking lifecycle errors remain in the primary workflow with reason and repair guidance.

## Commercial Release Package root cause and repair

The repository path already created and persisted Commercial Revision, froze Commercial Release Package, attached `commercialReleasePackageId`, and saved the reference-only Draft IOF afterward. The inconsistent PASS was a projection/UI bug: Automatic IOF Assembly checked only draft package ID and route repository match. It now also requires Commercial Revision ID, Commercial Release Package ID on the draft, and the resolved Commercial authority diagnostic release ID. A downstream stage therefore cannot display PASS while its prerequisite is FAIL.

## Draft IOF save repair

The existing `saveCommercialDraftIofPackage` repository action remains the authority path. Automatic assembly first resolves/persists revision and release, injects both IDs into the draft/reference summary, then saves the Draft IOF repository artifact. No synthetic PASS flag was introduced.

## Explicit scenario results

| Scenario | Result |
| --- | --- |
| `3x1.25` bore, 100,000 route-ft | Standard/6-inch governed class; $15/ft; $1,500,000 base bore. |
| `6x1.25`, governed 8-inch ream, 100,000 route-ft | One additional governed 2-inch increment; $25/ft; $2,500,000 base bore. |
| Hard-rock adder, 20,000 of 100,000 ft, Teralinx fixture | Base $1,500,000 plus $18/ft x 20,000 = $360,000; total $1,860,000 before other categories. |
| Plow/additional conduit, `3x1.25`, 1,000 ft | $4.50 base + 2 x $1.05 additional conduit = $6.60/ft; $6,600. |
| Quote 223377-00 `1.5-inch` duct | 100,000 route-ft x 3 ducts = 300,000 unit-ft x $0.625 = $187,500. |
| Quote 223377-00 `864F G.657A1` | 100,000 ft x $7.475 = $747,500. |
| ILA OFF | Zero ILA quantity, equipment cost, and ILA line contribution. |
| Commercial proposal price | A calibrated estimate plus explicit Commercial Policy produces NRC/MRC/term; policy does not alter estimate or doctrine. |
| Commercial Release Package | Immutable release artifact follows Commercial Revision and supplies `commercialReleasePackageId`. |
| Draft IOF save | Governed reference artifact saves only after required release authority; Engineering remains next authority. |

## Happy path

The validated path is Product Registry → mutable Project Configuration → route/quantity authority → Construction Capability → Rate/Material resolution → deterministic estimate → human calibration revision → Estimate Audit → Commercial Policy/proposal → Commercial Revision → Commercial Release Package → Draft IOF assembly/save → Engineering. Diagnostics are not required for normal completion.

## Tenant behavior

All new artifacts carry organization, tenant, customer, opportunity, and configuration revision. Project/customer artifacts reject cross-scope resolution. Explicit `GLOBAL` sharing is supported for deliberately shared catalog fixtures only; negotiated quotes and calibrations remain scoped.

## Validation and regression results

- `node cip043-commercial-pricing-catalog-configuration-validation.mjs`: PASS, 45/45.
- `npx tsc --noEmit -p tsconfig.json`: PASS after implementation.
- `npm run build`: PASS (Vite production build, 379 modules transformed).
- `git diff --check`: PASS; only pre-existing Windows LF/CRLF conversion warnings were emitted.
- CIP-035A: PASS.
- CIP-036 Kernel Reasoning: PASS.
- CIP-036 OSRM / IOF Assembly / Commercial Map Projection: PASS.
- CIP-037 Commercial Projection Surface: PASS.
- CIP-037 Single Geometry Authority: PASS.
- CIP-038 Constitutional State Authority: PASS.
- CIP-038A Commercial Projection UI Restoration: PASS.
- CIP-039 Constitutional Closure Engine: PASS.
- CIP-040 Product Registry / reference assembly: PASS.
- CIP-041 Engineering Quantity Reconciliation: PASS, 30/30.
- CIP-042 Duct & Dark Fiber Product Doctrine: PASS, 50/50.

## Remaining unresolved items

1. The actual contractor card and Quote 223377-00 documents were not present as binary/source attachments in this workspace. Production source hashes, exact dates, validity wording, freight, and tax terms must be ingested from the originals before catalog approval.
2. Legacy `WORKBOOK_RATES`, `ProductionProfileLibrary`, `UnitCostLibrary`, and civil fixtures remain for historical reproducibility. They should be migrated through explicit catalog revisions in a later governed data migration, not deleted here.
3. The capability mapping is a Commercial planning revision, not Engineering-certified bundle geometry. Engineering may publish a later mapping revision without altering the `$10 / governed 2-inch increment` policy.
4. Catalog persistence APIs/admin promotion are intentionally outside this sprint. No calibration is automatically promoted.
5. Platform performance optimization and Marketplace/Control/Field/Twin expansion were not started.
