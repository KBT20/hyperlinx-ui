# Hyperlinx DAL Doctrine Audit

Date: 2026-06-28
Scope: Pre-commit doctrine, authority, lineage, financial, and boundary audit for the current `hyperlinx-dal-dev` milestone.

Status legend:

- PASS: Current implementation follows the doctrine for the audited scope.
- WARNING: Directionally aligned, but there is technical debt, partial coverage, or a production-hardening gap.
- FAIL: Current implementation appears to violate the doctrine.

## Executive Finding

No direct FAIL finding was identified in this pass. The current milestone is broadly aligned with Hyperlinx / IOF doctrine, especially around keeping customer evidence, commercial planning, ILA planning, and route engineering drafts separate from production ScopeVersion, Twin, Control, Field, and OI authority.

The principal warnings are:

1. ScopeVersion lifecycle authority is split between older lifecycle guard code and newer close-event lifecycle doctrine.
2. Several commercial authority operations still live in UI workspace code.
3. Customer design persistence is local DAL storage, not yet a server-backed source of record.
4. ILA planning is now station-object-based, but some route engineering optical/spacing assumptions remain separate.

## Doctrine Matrix

| Doctrine | Status | Relevant files | Notes | Remediation |
| --- | --- | --- | --- | --- |
| ScopeVersion doctrine | WARNING | `src/scope/ScopeVersionLifecycle.ts`, `src/scope/ScopeVersionLifecycleGuard.ts`, `src/scope/ScopeVersionTransitionAuthorityEngine.ts`, `src/workspaces/RouteEngineeringWorkspace.tsx` | ScopeVersion truth is still protected, but two lifecycle vocabularies coexist. Route Engineering approval uses the older guard path while close-event doctrine exists separately. | Converge all ScopeVersion transitions onto the close-event transition authority model. |
| Kernel authority | PASS | `src/mapkernel/MapKernel.tsx`, `src/kernel/*`, map consumers | Current commercial and ILA planning work renders map overlays but does not treat the Map Kernel as a mutation authority. Kernel files are dirty in the working tree from prior work, but this audit pass did not modify Kernel code. | Keep Map Kernel as projection/rendering authority only; add regression tests around commercial overlay inputs. |
| Customer evidence doctrine | PASS | `src/translate/CustomerDesignImport.ts`, `src/translate/CustomerDesignImportEngine.ts`, `src/api/customerDesignLibrary.ts`, `src/workspaces/TranslateWorkspace.tsx` | Imported customer designs carry provenance, audit events, and explicit no-ScopeVersion/no-inventory-mutation flags. | Server-back the Customer Design Library and preserve the same evidence flags. |
| Commercial authority | PASS | `src/components/workspaces/GoogleRfpWorkspace.tsx`, `src/commercial/CommercialCorridorDraftEngine.ts`, `src/commercial/TransparentEstimatingEngine.ts`, `src/commercial/CommercialFinancialAuthority.ts` | Commercial planning produces advisory drafts, estimates, and handoff requests without directly mutating ScopeVersion or production inventory. | Extract authority mutations from UI into commercial engines to reduce review surface. |
| Engineering authority | WARNING | `src/workspaces/RouteEngineeringWorkspace.tsx`, `src/engineering/RouteEngineeringDraft.ts`, `src/engineering/RouteEngineeringDraftEngine.ts`, `src/engineering/CorridorCandidateEngine.ts` | Engineering drafts, revisions, and accepted candidates are modeled, but final approval should be reconciled with close-event transition authority. | Align route engineering approval with close-event requirements and ensure revision acceptance is durable and auditable. |
| Certified route authority | WARNING | `src/workspaces/RouteEngineeringWorkspace.tsx`, `src/certification/*`, `src/scope/*` | Approval checks require certified/provisional route state and stationing evidence before ScopeVersion advancement. The guard is useful but not yet fully merged with newer lifecycle doctrine. | Make Certified Route approval a close-backed transition with explicit evidence references. |
| Financial authority | WARNING | `src/commercial/CommercialFinancialAuthority.ts`, `src/commercial/TransparentEstimatingEngine.ts`, `src/components/workspaces/googleRfp/*` | Canonical financial authority exists and covers cost, sell, margin, NRC/MRC, lifecycle revenue, cost/foot, cost/mile, revenue/mile, and margin/mile. Some UI cards still perform local formatting or local derived calculations. | Assert all cards read from `CommercialFinancialAuthority` output; add tests for per-mile/per-foot metrics after estimate edits and ILA changes. |
| Station object authority | PASS | `src/commercial/IlaPlanningEngine.ts`, `src/commercial/TransparentEstimatingEngine.ts`, `src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx`, `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx` | ILA planning now creates station objects with station, GPS, milepost, route ID, lineage, profile, cost, and optical span data. Stations remain planning objects and do not silently become production route stations. | Next pass should add explicit recommendation approval for engineering revision changes. |
| Inventory graph authority | WARNING | `src/inventory/*`, `src/dal/DALState.tsx`, `src/api/dalStorage.ts`, `src/translate/*` | Customer Twin and inventory graph are not directly mutated by imports or commercial planning. Some local/fallback graph and storage paths still coexist with server authority patterns. | Identify the canonical inventory graph write path and document all fallback-only paths as non-authoritative. |
| Twin authority | PASS | `src/customerTwin/*`, `src/twin/*`, `src/components/workspaces/GoogleRfpWorkspace.tsx` | Commercial planning reads customer/twin context as evidence and projection; no inspected workflow mutated Twin authority. | Keep commercial attachments and customer evidence as references until close-backed promotion is available. |
| Marketplace / Control / Field / OI boundaries | PASS | `src/marketplace/*`, `src/control/*`, `src/field/*`, `src/oi/*`, commercial and route engineering callers | The current milestone does not give Sales Engineering, ILA planning, or estimate authoring execution authority over Marketplace, Control, Field, or OI. | Preserve these boundaries when adding handoff automation. |
| AI authority containment | PASS | `src/scope/ScopeVersionTransitionAuthorityEngine.ts`, reasoning/candidate modules | Transition authority rejects advisory AI as a lifecycle mutation actor. Candidate generation and reasoning remain advisory. | Add structured AI provenance to every AI-generated recommendation before promotion workflows expand. |

## Required Code Audit Areas

| Audit area | Status | Finding |
| --- | --- | --- |
| Duplicate pricing calculations | WARNING | `CommercialFinancialAuthority` is the canonical financial surface, and ILA totals come from `IlaPlanningEngine`. Remaining risk is UI-side summary math and route engineering preview assumptions that should be unified. |
| UI-owned business logic | WARNING | `GoogleRfpWorkspace` still owns civil mix balancing, transparent estimate update orchestration, and some audit construction. |
| Geometry copies without lineage | PASS | Customer design imports, commercial drafts, route engineering drafts, and ILA stations carry route IDs, provenance, geometry hashes, or lineage references. |
| Imported customer design state not persisted | WARNING | Customer design imports persist through DAL storage, but not yet through a server-backed repository. |
| Engineering revisions disconnected from commercial drafts | WARNING | Handoff and selected draft state exist. Full commercial-to-engineering lineage should be persisted as a first-class handoff record. |
| Estimate values not sourced from financial authority | WARNING | Canonical authority exists; every card and summary should still be tested to prevent local recomputation drift. |
| ILA totals hardcoded instead of derived from engine | PASS | The inspected Phase 9 path derives ILA station totals and route total from `IlaPlanningEngine` facility profiles and controls. |
| Hidden auto-load behavior | WARNING | `DALStateProvider` auto-loads customer design imports and selects the first record if none is selected. Commercial workspace also restores local opportunity/session state. |
| Map layers rendering stale geometry | WARNING | ILA station overlays and selected station synchronization are reactive, but broader commercial map layers need stale-geometry regression tests. |
| Accidental mutation of forbidden authorities | PASS | No inspected commercial, estimate, customer import, or ILA planning workflow directly mutated Customer Twin, Kernel authority, ScopeVersion truth, Marketplace, Control, Field, or OI. |

## Commit Readiness Assessment

There are no doctrine FAIL findings from this audit. The milestone is reasonable to commit after validation passes if the team accepts the documented WARNINGS as stabilization backlog rather than pre-commit blockers.

The most important remediation before production use is lifecycle convergence: ScopeVersion truth should advance through a single close-event transition authority.
