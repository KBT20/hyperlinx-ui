# CIP-045 — Commercial Estimate, Calibration, and Proposal Consolidation

## Outcome

Product #1 now has one customer-readable commercial path:

`Project Configuration → Construction / Quantity Calibration → Estimate Calibration → Commercial Price → Proposal Preview → Saved Proposal Revision → existing Commercial Release / Draft IOF / Engineering handoff`

The implementation reuses `TransparentEstimatingEngine`, the existing commercial pricing projection, Proposal Repository, Commercial Revision, Commercial Release Package, and Draft IOF handoff. It does not introduce a second estimator, pricing engine, repository, doctrine, ScopeVersion path, or persistence migration.

## Authority and Control Inventory

| Area | Field / control | Primary file / authority | Editable | Persisted | Duplicate disposition | Structural vs financial |
|---|---|---|---:|---:|---|---|
| Product configuration | duct count, diameter, material specification | `TransparentEstimateControls.projectConfiguration`; `TransparentEstimatingEngine.ts` | Yes | Frozen in saved Proposal Revision | Existing Explorer is primary | Physical configuration; no geometry rebuild |
| Product configuration | fiber count/type/placement/slack | same | Yes | Frozen in saved Proposal Revision | Existing Explorer is primary | Physical configuration; no geometry rebuild |
| ILA configuration | intermediate enable/count/spacing/profile | `IlaPlanningEngine.ts`; Explorer ILA panel | Yes | Frozen in saved Proposal Revision | Existing panel retained | Quantity/cost and optical planning |
| ILA configuration | bookend enable | `IlaPlanningEngine.ts` | Yes; default OFF | Frozen in saved Proposal Revision | Existing panel retained | Quantity/cost; zero when OFF |
| Route quantity | route feet/miles | active commercial route / `TransparentCorridorEstimate.physicalQuantities` | No | Existing route repository plus revision snapshot reference | Summary projections remain read-only | Structural input |
| Civil quantity | plow/dirt/rock/trench percentages and derived feet | constraint values in `TransparentEstimatingEngine.ts` | Yes; whole percentages | Working memory; frozen on revision save | Advanced Civil Mix group suppressed | Financial quantity fast path |
| Civil baseline | 82 / 12 / 0 / 6 | `EstimatorDefaults.ts` | Resettable | Baseline source, not globally mutated | One primary civil panel | Financial quantity fast path |
| Estimate line | quantity, rate, extended cost, source, authority | existing `TransparentEstimateLineItem` | Governed constraints | Working memory; frozen on revision save | New table is a presentation over existing lines | Financial estimate |
| Dirt rate | $15/route foot for new revisions | `CURRENT_PRODUCT1_DIRT_RATE_AUTHORITY` | Project-calibratable | Historical $11 records remain unchanged | Existing rate authority reused | Financial estimate |
| Commercial price | cost, overhead, markup, NRC, monthly O&M, margin | existing `TransparentFinancialModel` and selected pricing reconciliation | Yes | Frozen in saved Proposal Revision | Commercial Economics remains projection | Financial/proposal only |
| Proposal content | title, executive summary, customer pricing summary | Proposal Runtime UI | Yes through existing workflow | Frozen in saved Proposal Revision | Customer preview strips diagnostic detail | Proposal only |
| Proposal lifecycle | revision identity, parent, source hash, reason, actor/time | `proposal-drafts.js` in existing Proposal Repository | Save/derive actions | Yes, append-only snapshot array | Existing mutable `versions` retained for compatibility | Lifecycle authority |
| Approval | exact revision ID + exact proposal hash | Proposal approval endpoint | Customer reviewer | Yes | No approval inheritance | Approval authority |
| Handoff | approved saved revision → Commercial Revision/Release → Draft IOF | existing handoff endpoints | Governed | Existing repositories | No parallel handoff | Existing constitutional path |
| Advanced diagnostics | authority, provenance, audit, full estimate sections | Explorer advanced/details panels | Governed | Existing behavior | Collapsed by default | Diagnostics only |

Browser `localStorage` still stores only Explorer section-open preferences. Estimate working edits are React memory state. Server persistence remains JSON repositories under `server/data`; no browser storage was made authoritative.

## Consolidation Changes

- Civil calibration is visible in the primary workflow with editable whole-number Plow, Dirt, Rock, and Trench values and the 82/12/0/6 standard.
- The advanced authority list no longer repeats Civil Mix controls.
- Active Estimate Calibration projects baseline and calibrated quantity/rate/cost, delta, provenance, state, line reset, reset-all, and estimate revision capture from the existing estimate line model.
- Customer Proposal Preview presents product, route, configuration, construction mix, NRC, monthly O&M, term, and total contract value without authority hashes or diagnostic confidence details.
- The proposal action is now **Save Proposal Revision**. It freezes configuration, route references, quantities, active estimate and controls, doctrine/policy references, pricing, terms, proposal content, actor/time, and a deterministic SHA-256 hash.
- **Create New Revision** derives a `WORKING` child from a selectable basis identifier supported by the API. The original snapshot is retained unchanged.
- Revision comparison is computed from immutable snapshots and classifies changes as commercial-only, estimate/cost, physical configuration, or route.
- Customer approval is tied to both `proposalRevisionId` and `proposalHash`; it never transfers to a derived working revision. A later approval can mark an earlier approval with `supersededByRevisionId` while preserving it.
- Customer submission, approval, readiness, and Draft IOF exposure reject an unsaved active revision.

## Scenario Validation

| Scenario | Result |
|---|---|
| A — Open Product #1 and inspect primary flow | Existing Product Configuration and estimator reused; consolidated calibration and proposal actions visible |
| B — Standard civil mix | 82% plow, 12% dirt, 0% rock, 6% trench present and editable |
| C — Dirt-rate calibration | New baseline is $15; governed constraint calibration changes the active estimate only |
| D — Rock quantity/rate | Rock remains operational and cannot silently price an unresolved positive quantity |
| E — Fiber/material calibration | Existing material constraints remain project-calibratable |
| F — Markup and O&M | Existing financial fast path updates price/proposal without structural work |
| G — Save proposal | Exact active commercial state is frozen as an immutable, hashed revision |
| H — Derive revision | Child starts WORKING with parent ID/source hash and no inherited approval |
| I — Compare revisions | Deterministic field-level comparison uses immutable snapshots |
| J — Handoff | Only exact saved + approved revision can reach existing Commercial Release / Draft IOF / Engineering path |

## Performance and Constitutional Preservation

The CIP-044A dependency envelope is unchanged:

- Civil and rate edits do not rebuild geometry, spine, stationing, map, Engineering, or structural Draft IOF.
- Unsaved calibration causes no repository write.
- Markup and O&M remain financial/proposal-only.
- The existing explicit route-edit-session guard remains intact.
- The ten-mutation local fixture measured median `0.127 ms`, mean `0.322 ms`, p95/max `1.877 ms`; structural fingerprint stayed unchanged and all structural operation counts remained zero.

No data repositories were cleared or regenerated. No PostgreSQL/PostGIS migration, deployment, DAL1 change, production app change, Service Order form change, or ScopeVersion change was made.

## Validation Evidence

- CIP-045 focused validation: **84/84 passed**.
- CIP-044A.3: **25/25 passed**.
- CIP-044A.2: **30/30 passed**.
- CIP-044A: **41/41 passed**.
- CIP-044A.1 rehydration endpoints: all five returned **200**; focused suites **59/59 passed**.
- CIP-041: **30/30 passed**.
- CIP-042: **50/50 passed**.
- CIP-043: **45/45 passed**.
- CIP-025 shared Commercial Revision authority: passed after retaining its diagnostics labels.
- CIP-035A, CIP-038A, and CIP-039: passed.
- TypeScript: passed.
- Production build: passed (existing large-chunk warning only).

The real-browser CDP pass could not start in this environment: both newly launched headless Edge and Chrome exited before opening their requested debugging ports. No browser result is claimed. The previously supplied CIP-044A.3 browser probe remains present and its static coverage is validated.

One legacy regression remains outside this change: `cip029-commercial-engineering-handoff-validation.mjs` expects a literal direct `saveCommercialDraftIofPackage(draftSource, session)` call. The current governed implementation first calls `ensureCommercialLifecycleAuthorityForDraft(...)` and saves the returned authority package; all other CIP-029 checks passed (22/23). CIP-035A explicitly validates this newer sequencing helper. The handler was not weakened merely to satisfy the stale literal assertion.
