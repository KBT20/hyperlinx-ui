# CIP-041 Engineering Quantity Reconciliation + Authority Disposition Report

## Outcome

CIP-041 is operational through Engineering Quantity Reconciliation, governed human disposition, Constitutional Assembly recalculation, and Certified IOF / Service Order readiness. It does not create a ScopeVersion or authorize execution.

The real Google Stillwater–Helium reference reconciliation remains `FAIL`. Validation resolves only isolated test copies.

## Files changed

- `src/engineering/quantity/QuantityReconciliationContracts.ts`
- `src/engineering/quantity/QuantityReconciliationEngine.ts`
- `src/engineering/quantity/QuantityReconciliationRepository.ts`
- `src/engineering/quantity/QuantityReconciliationDraftAdapter.ts`
- `src/engineering/quantity/index.ts`
- `src/components/engineering/EngineeringQuantityReconciliationPanel.tsx`
- `src/components/commercial/ConstitutionalAssemblyReviewPanel.tsx`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/reference/helium/HeliumReferenceAssembly.ts`
- `src/api/teralinxRuntime.ts`
- `server/routes/engineering-certification.js`
- `cip041-engineering-quantity-reconciliation-authority-validation.mjs`
- `CIP_041_ENGINEERING_QUANTITY_RECONCILIATION_AUTHORITY_REPORT.md`

## Reconciliation architecture

The new model keeps observed source facts and independently derived facts as separate candidates. Each item carries tenant/customer/package/product/doctrine identity, provenance, absolute and percentage deltas, status, revision/source/decision hashes, and audit state. Required items compute `PASS` only when they are `MATCH` or evidence-backed `RESOLVED` with attributable Engineering authority.

The append-only repository retains reconciliation revisions, disposition audit events, source-correction records, project doctrine exceptions, and Commercial impact events under a key containing organization, tenant, customer, opportunity, and package identity. Retrieval repeats exact scope checks and rejects cross-tenant persistence.

## Authority model and dispositions

Authority precedence is formalized as:

1. `CERTIFIED_ENGINEERING`
2. `APPROVED_PROJECT_EXCEPTION`
3. `APPROVED_SOURCE_EVIDENCE`
4. `MEASURED_GEOMETRY`
5. `PRODUCT_DOCTRINE_DERIVATION`
6. `COMMERCIAL_ASSUMPTION`
7. `UNKNOWN`

Precedence never auto-selects a value. Supported governed actions are `ACCEPT_SOURCE`, `ACCEPT_DERIVED`, `CORRECT_SOURCE`, `APPROVE_DOCTRINE_EXCEPTION`, `REQUEST_COMMERCIAL_REVISION`, `REQUIRE_ADDITIONAL_EVIDENCE`, `DEFINE_SPLICE_ARCHITECTURE`, and `BIND_OPTICAL_DESIGN`.

Every action requires a reviewer, Engineering authority, reason, timestamp, and attributable evidence with a source hash. Optical-design binding additionally captures ILA station, milepost, span length, optical loss, facility class, power requirement/evidence, and design evidence.

## Helium live reconciliation

| Item | Source | Derived | Current state |
|---|---:|---:|---|
| Route length | 832,972.8 ft | approximately 801,149 ft measured KMZ | `SOURCE_OVERRIDE_REQUIRES_AUTHORITY` |
| Conduit | 2,573,942 conduit-ft | approximately 2,403,447 conduit-ft (`measured route × 3`) | `SOURCE_OVERRIDE_REQUIRES_AUTHORITY` |
| Fiber | 895,326 cable-ft | approximately 841,207 cable-ft (`measured route × 1.05`) | `SOURCE_OVERRIDE_REQUIRES_AUTHORITY` |
| Handholes | 334 | 76 preliminary doctrine | `SOURCE_OVERRIDE_REQUIRES_AUTHORITY` |
| Splice cases | 34 | Engineering splice architecture missing | `MISSING_DOCTRINE` |
| ILA sites | 2, with source evidence near MP 52.59 and MP 105.2 | approved optical design missing | `MISSING_DOCTRINE` |

No production disposition was made for any item. No number was changed to obtain a pass.

## UI and derivation evidence

Engineering now contains a generic Quantity Reconciliation panel with total, matched, review-required, exception, resolved, and blocked summaries. Each discrepancy exposes source provenance beside derived quantity, formula, doctrine and geometry authority, delta, status, disposition controls, evidence, notes, and reviewer. Derivation visualization uses item data rather than Helium constants.

The compact readiness view reports product, doctrine, route/workbook evidence, reconciliation progress, exceptions, constraints, assembly status, Engineering certification, Service Order readiness, and `ScopeVersion: FUTURE AFTER SIGNATURE`.

## Doctrine exceptions, immutability, and audit

Doctrine exceptions are project/package artifacts and explicitly carry `globalDoctrineMutation: false`. Source corrections create correction evidence with `sourceMutation: false`; no XLSX, KMZ, KML, BOM, customer, or contract source is edited.

Every disposition creates an immutable event recording actor, action, time, previous/new state, source and derived values, approved authority/value, reason, evidence, package revision, and deterministic hash. Certified IOF payloads retain the full reconciliation items, source and derived facts, dispositions, decision hashes, exception records, source hashes, and approved-quantity summaries.

## Commercial impact behavior

Financially relevant approved quantity changes emit `ENGINEERING_QUANTITY_IMPACT` with previous/approved values, delta, unit, reason, and `commercialReviewRequired`. Pricing mutation remains false; NRC and MRC are never recalculated by Engineering. `REQUEST_COMMERCIAL_REVISION` returns through the existing Commercial Revision / Release authority flow.

The workbook Lifecycle Revenue discrepancy of $1,448,196 is surfaced as a `COMMERCIAL_SOURCE_WARNING`; it is not silently repaired or treated as an Engineering quantity decision.

## Constitutional and certification gates

Quantity reconciliation status is calculated. Constitutional Assembly is then recalculated from all current gates rather than assigned a pass or allowed to trust stale persisted readiness. Certification is blocked unless required quantity items pass and Constitutional Assembly passes.

Certification binds product/doctrine versions, Commercial and Engineering revisions, measured/station/object authorities already carried by the certification flow, full approved quantity evidence, exceptions, constraints, source hashes, and deterministic hashes. The result is only:

- `CERTIFIED IOF PACKAGE`
- `SERVICE_ORDER_READY`
- `AWAITING_CUSTOMER_SIGNATURE`
- `ScopeVersion: BLOCKED_UNTIL_SIGNED_SERVICE_ORDER`

No Marketplace, Control, Field, Twin, ScopeVersion creation, or execution behavior was added.

## Validation results

- CIP-041 validation: **30/30 PASS**
- TypeScript: **PASS** (`npx tsc --noEmit -p tsconfig.json`)
- Production build: **PASS** (`npm run build`)
- Diff whitespace check: **PASS** (`git diff --check`; line-ending notices only)
- CIP-035A Commercial lifecycle sequencing: **PASS**
- CIP-036 Kernel reasoning: **PASS**
- CIP-036 OSRM/IOF assembly projection: **PASS**
- CIP-037 Commercial projection surface: **PASS**
- CIP-037 single geometry authority: **PASS**
- CIP-038 constitutional state authority: **PASS**
- CIP-038A Commercial projection restoration: **PASS**
- CIP-039 closure engine: **PASS**
- CIP-040 Product Registry / Helium reference: **PASS**

## Remaining unresolved items

All six real Helium quantity items remain unresolved pending actual Engineering review. The Lifecycle Revenue warning remains pending Commercial review. Consequently the real Helium quantity gate and Constitutional Assembly remain `FAIL`, Engineering certification remains blocked, the Service Order is not ready, and ScopeVersion remains future after customer signature.
