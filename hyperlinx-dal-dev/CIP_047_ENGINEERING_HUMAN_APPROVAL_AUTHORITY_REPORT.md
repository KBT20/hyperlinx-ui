# CIP-047 — Engineering Human Approval Authority Report

## 1. Existing authority audit

The Engineering Package, Baseline, Revision, Change Set, readiness projection, certification handler, Certification Ledger, Certified IOF projection, authenticated actor model, and file-repository conventions were traced before implementation. None persisted the proposition “this authorized human approved this exact Engineering Revision before certification.” Existing readiness strings are projections; Certification Ledger entries are the later certification event. A bounded new `engineering-approvals` authority is therefore justified.

## 2. Why Certification Ledger is not sufficient

The Certification Ledger proves certification, not the distinct prior human decision. Reusing it would collapse Human Approval and IOF Certification into one event and violate the required two-action lifecycle. The existing ledger remains authoritative for certification and now references the preceding approval.

## 3. Final EngineeringApproval contract

The immutable record contains scope IDs, Engineering Package/Baseline/Revision IDs, exact revision hash, Draft IOF and Commercial/Proposal lineage references and hashes, `decision: APPROVED`, authenticated approver identity and time, bounded review summary/hash, approval hash, and explicit reference-only/no-auto-certification markers. It embeds no route, geometry, station, manifest, package, proposal, doctrine, twin, or evidence payload.

## 4. Repository implementation

`server/routes/engineering-approvals.js` implements permission-scoped GET/POST, create, fetch-by-ID, exact-revision lookup, integrity validation, scope validation, and idempotent replay using the established local file-repository convention. The route is registered as `/api/engineering/approvals`. The production repository was not cleared, migrated, or seeded.

## 5. Exact revision binding

Resolution requires exact matches for `engineeringPackageId`, `engineeringRevisionId`, `engineeringRevisionHash`, and `reviewSummaryHash`. R1 authority cannot satisfy R2 and no unqualified “latest approval” lookup is used.

## 6. Review Complete derivation

Review Complete remains computed from existing governed sources: package and immutable-reference integrity, route authority, quantity reconciliation, constitutional quantity, approved Engineering budget Change Set, blocking conditions, compliance/doctrine results, and existing readiness prerequisites. No REVIEW_COMPLETE record was introduced and the client cannot override server eligibility.

## 7. Review summary hashing

The server canonicalizes the bounded review result and computes deterministic SHA-256 `reviewSummaryHash`. Existing immutable identities are referenced rather than rehashing large structures.

## 8. Approval hashing

The server canonicalizes the approval identity and computes deterministic SHA-256 `approvalHash`. Integrity validation recomputes both hashes and fails closed on altered approval or review content.

## 9. Actor authority

The approver is resolved exclusively from the authenticated bearer session and existing `workspace.engineering.write` permission. Arbitrary actor input is neither exposed nor trusted.

## 10. Scope isolation

Creation and certification dereference enforce organization, tenant, customer, opportunity, package, revision, and revision-hash scope. Cross-scope authority returns no qualifying approval.

## 11. Idempotency

Replaying approval for the same exact package/revision/hash/review-summary returns the existing immutable authority with `idempotentReplay: true`; double-clicks do not create duplicates.

## 12. Revision supersession behavior

A new governed revision requires a new approval. The R1 record remains immutable and historical. Supersession metadata is not required for validity and was intentionally not made into mutable “current approval” truth.

## 13. Certification dependency

The existing certification handler independently resolves the active Engineering Revision and now requires one exact valid approval before continuing through all existing certification gates. Missing, mismatched, scoped-out, or tampered authority produces structured 409 errors. Approval never invokes certification.

## 14. Certification Ledger lineage

Successful new certification records only `engineeringApprovalId` and `engineeringApprovalHash` in the existing Certification Ledger. Both fields participate in the certification identity. Legacy ledger validation remains backward-compatible.

## 15. Certified IOF lineage

The Certified IOF projection carries the same two approval references, yielding Engineering Revision → Engineering Approval → Certification Ledger → Certified IOF Package without embedding the approval record.

## 16. Reload and rehydration

The Engineering workspace queries repository authority for the exact active revision. Human Approval and Certification state therefore rehydrate from persisted records, not React state or browser storage. Legacy certified packages without approval display `LEGACY / NOT RECORDED`; no historical authority is fabricated.

## 17. Real package status

`ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2` remains truthfully unresolved:

- Route authority: PASS
- Quantity reconciliation: INCOMPLETE
- Constitutional quantity: INCOMPLETE
- Engineering budget: APPROVED
- Blocking conditions: 0
- Compliance failures: 6
- Package integrity: PASS
- Engineering Review Complete: false
- Human Approval: BLOCKED
- IOF Certification: BLOCKED

The real approval POST was rejected with HTTP 409 `ENGINEERING_APPROVAL_NOT_READY` and the three missing requirement groups. No real approval record was created.

## 18. Controlled fixture status

Because the real gates cannot truthfully be forced closed, a controlled isolated repository fixture validated the successful path. It created a 1,673-byte reference-only R1 approval, replayed it idempotently, restored it after reload, rejected scope/revision/hash/tamper mismatches, created a distinct R2 approval without changing R1, and carried the exact R1 reference into ledger and Certified IOF projections. The fixture created neither Service Order nor ScopeVersion.

## 19. Before/after Engineering UX

Before CIP-047, the UI exposed an authority gap between readiness and certification. It now presents four explicit stages: Package Received, Engineering Review, Human Approval, and IOF Certification. Unresolved review hides approval controls. A ready revision exposes a formal confirmation naming the exact revision and package. Approved state shows actor, time, and approval ID, then exposes a separate Certify IOF Package action. Certified state displays approval and ledger lineage plus Service Order as next/not created and ScopeVersion as future after signed Service Order.

At 1375 × 780, real-package State A was validated with `3 REMAINING`, Human Approval blocked, Certification blocked, no premature buttons, and Diagnostics hidden. States B–D were not fabricated against the unresolved real package; their authority transitions were exercised using the controlled fixture and their UI branches are implemented.

## 20. Performance

Real rejected approval validation completed in 194.46 ms. Isolated approval persistence completed in 18.536 ms. The operation reads governed readiness, validates exact identity, writes/reuses one small metadata record, and refreshes approval projection. It does not rebuild route, geometry, stations, object manifest, doctrine, Draft IOF, Engineering Package, map, Customer Twin, or reasoning. CIP-044A.2 remains 30/30; its ten-run mutation fixture stayed below 500 ms with zero structural/map/Engineering rebuilds.

## 21. Regression results

- CIP-047 focused authority: 45/45 passed.
- CIP-047 real browser State A: passed.
- CIP-045C.1: 35/35 passed.
- CIP-045C, CIP-045B (88/88), CIP-045A (58/58), CIP-045 (84/84), CIP-041 (30/30), and CIP-035A: passed.
- CIP-044A.2: 30/30 passed.
- CIP-046D/E substantive UI, preservation, navigation, and no-downstream-artifact checks passed. Their single literal `humanApprovalAuthorityGapReported` assertion is stale by design because CIP-047 replaces the gap message with governed Human Approval state.
- CIP-046A standalone browser runner reloaded the page but timed out at 60 seconds; current CIP-047 browser evidence covers its relevant sanitized-workspace invariants.
- TypeScript, Node syntax checks, production build, and scoped `git diff --check` passed. The build retains the pre-existing large-chunk advisory.

## 22. Architectural gaps discovered

No blocking architectural gap was found. The authenticated actor, stable exact revision identity, deterministic readiness derivation, bounded authority persistence, and Certification Ledger reference path all exist. The real 3SWR data still has legitimate governed work outstanding; that is operational state, not an approval-architecture defect.

## Evidence

- `artifacts/cip047/engineering-human-approval-authority-validation.json`
- `artifacts/cip047/engineering-approval-browser-validation.json`
- `artifacts/cip047/state-a-real-package-unresolved-1375x780.png`
- `artifacts/cip047/state-a-real-package-final-review-1375x780.png`

No deployment, DAL1 push, production mutation, Commercial authority change, Product Doctrine change, Service Order creation, or ScopeVersion creation occurred.
