# CIP-048C — Engineering Approval Authority Reconciliation & Render Integrity Report

## Outcome

The real package now follows one server-authoritative approval path:

`Engineering Review COMPLETE → Human Approval READY → EngineeringApproval persisted → Human Approval APPROVED → IOF Certification READY`

The explicit approval was recorded for the exact active Engineering Revision. Certification was not invoked, and no downstream repository changed.

## Exact 409 before repair

Request:

- Engineering Package: `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Engineering Revision: `ENG-REV-ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2-000`
- Workspace revision hash: `engineering-revision-030bdbef`

Complete structured response:

```json
{
  "error": "Engineering Approval must reference the exact active Engineering Revision hash.",
  "code": "ENGINEERING_APPROVAL_REVISION_HASH_MISMATCH",
  "expectedEngineeringRevisionHash": "engineering-revision-29ac9a51d822ac4a",
  "receivedEngineeringRevisionHash": "engineering-revision-030bdbef"
}
```

The repository was unchanged by the rejected request. The original capture is preserved at `artifacts/cip048c/exact-approval-409-before-repair.json`.

## Root cause and predicate mismatch

The browser independently projected the Engineering Revision with `stableEngineeringHash`, a 32-bit FNV-derived presentation hash. The approval endpoint projected the governed revision with the repository/server SHA-256-derived hash. Both paths used the same revision ID and Engineering Change Sets, but produced different identity hashes.

| Predicate | UI before | Server before | Authority | Result |
|---|---|---|---|---|
| Package integrity | PASS | PASS | Engineering Package reference integrity | Match |
| Route authority | PASS | PASS | Commercial Route Repository | Match |
| Quantity reconciliation | PASS | PASS | Quantity Reconciliation | Match |
| Constitutional quantity | PASS | PASS | Constitutional Assembly | Match |
| Budget | APPROVED | APPROVED | Engineering Change Set | Match |
| Blocking conditions | 0 | 0 | Engineering Constraints | Match |
| Compliance | PASS | PASS | Product Doctrine compliance | Match |
| Revision ID | exact revision | exact revision | Engineering Revision | Match |
| Revision hash | `engineering-revision-030bdbef` | `engineering-revision-29ac9a51d822ac4a` | Engineering Revision | **Mismatch** |
| Review-summary hash | not projected | governed hash | Approval eligibility | **Missing in UI** |

The server's 409 was correct. The UI was wrong to advertise READY while submitting its independently manufactured hash.

## Canonical EngineeringApprovalEligibility contract

`GET /api/engineering/approvals?engineeringPackageId=...` now returns `approvalEligibility`, derived once by the server from governed repositories and projections. It includes:

- package, revision, revision hash, Draft IOF, proposal/commercial lineage, organization, tenant, customer, and opportunity identity
- package integrity, route authority, quantity reconciliation, constitutional quantity, budget approval, blocking conditions, and compliance
- `reviewSummaryHash`, `reviewComplete`, `approvalEligible`, and structured `blockers[]`
- `sourceAuthority: ENGINEERING_APPROVAL_ELIGIBILITY`
- `reasoningRequired: false`

The workspace projects this contract. The approval POST submits its exact revision ID, revision hash, and review-summary hash. The POST resolves the same contract again before persistence.

## Exact revision identity and review-summary behavior

Approved identity:

- Engineering Package: `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Engineering Revision: `ENG-REV-ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2-000`
- Revision hash: `engineering-revision-29ac9a51d822ac4a`
- Review-summary hash: `3c425f93cc927f7af8fc2c77a69e73b1cd0490e5fa17621f3df52bc2d2c47f53`
- Draft IOF Package: `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Proposal Revision: `PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`
- Commercial Revision: `COMM-REV-OPP-DEMO-OPPORTUNITY-3SWR-1786645604709-V1-PROP-DEMO-OPPORTUNITY-3SWR-v2-revision-1`
- Organization/Tenant: `org-teralinx`
- Customer: `customer-account-2`
- Opportunity: `OPP-DEMO-OPPORTUNITY-3SWR-1786645604709`

Any change to the governed summary changes `reviewSummaryHash`; approval then fails closed with `STALE_APPROVAL_ELIGIBILITY` and returns the current eligibility contract for refresh. It never silently retries against a new revision.

## Approval authority and stale-state behavior

Validated failures:

- stale revision hash → 409 `STALE_APPROVAL_ELIGIBILITY`
- stale review-summary hash → 409 `STALE_APPROVAL_ELIGIBILITY`
- revision ID mismatch → 409 `ENGINEERING_APPROVAL_REVISION_MISMATCH`
- customer/scope mismatch → 409 `ENGINEERING_APPROVAL_SCOPE_MISMATCH`
- revision-hash tamper without an eligibility token → 409 `ENGINEERING_APPROVAL_REVISION_HASH_MISMATCH`

All negative requests created zero records. Replaying the exact approved request returns HTTP 200 with `idempotentReplay: true` and the same approval ID.

## Approval error UX

A rejected modal now becomes **Approval Cannot Be Completed**, shows the actual predicate, expected and resolved values, and offers **Return to Review** and **Refresh Package State**. Error code and source authority remain under collapsed Technical Details. Refresh retrieves the current server contract; it does not retry approval.

## Real-package approval and reload

The explicit browser action returned HTTP 201 and persisted:

- Approval ID: `ENG-APPROVAL-ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2-29ac9a51d822ac4a-2bc2d2c47f53`
- Approval hash: `b22a98a39fdbf389733d96190b986024c9f4b9e9581dc487fab81c7133461f80`
- Approved by: Kyle
- Record size: 2,181 bytes, reference-only

After a full reload, the approval rehydrated from the Engineering Approval repository. The lifecycle shows Engineering Review COMPLETE, Human Approval APPROVED, and IOF Certification READY. The `Certify IOF Package` action remains separate and was not invoked.

## HH-001 and MapKernel render integrity

The governed object source contains one canonical `HH-001`. The remaining React duplicate was created after canonical projection: resolution-aware disclosure cloned selected `HH-001` into a label but retained the point primitive's `renderIdentity` and `ref.renderKey`.

| Field | Result |
|---|---|
| Source object | Projected Object Manifest `HH-001` |
| Canonical object ID | `HH-001` |
| Source projection | `ENGINEERING_CERTIFICATION_OBJECTS` |
| Secondary representation | Shared-map selected-feature label |
| Duplicated identity | canonical point render key |
| Cause | label clone inherited point identity |
| Fix | selected label receives `SHARED_MAP_SELECTED_LABELS` source authority and a newly normalized label render identity |

No array index was appended. One governed point remains one canonical rendered point; the response-only selected label is a distinct label representation. Clean reload validation reports MapKernel Render Authority PASS, Duplicate Keys 0, Duplicate Render Authorities 0, zero HH-001 warnings, and zero React duplicate-key warnings.

## Reasoning and console classification

- Actionable application defects: approval hash/readiness mismatch and selected-label identity inheritance — repaired.
- Non-blocking infrastructure: reasoning endpoint/circuit availability. `reasoningRequired` is explicitly false and readiness remained eligible while reasoning was offline.
- Development/browser information: React DevTools and lazy-image intervention — unchanged and outside workflow authority.

## Repository and downstream boundary

Only one Engineering Approval record was added. Negative tests, presentation navigation, idempotent replay, and reload caused no governed mutation. No Certification Ledger, Certified IOF Package, Service Order, ScopeVersion, Marketplace quote, Control work item, Field closure, or Customer/IOF Twin record was created or changed.

## Validation and performance

- CIP-048C focused suite: 30/30 assertions passed.
- CIP-047 authority suite: 45/45 assertions passed.
- CIP-048A classification/workflow suite: 29/29 assertions passed after approval, including 7,957 stations, 7,956 graph edges, and 433 unique projected objects/attachments.
- TypeScript: passed.
- Production build: passed.
- Node syntax and scoped diff checks: passed.
- Eligibility derivation/API response: 286–447 ms across recorded runs.
- Full browser acceptance/reload sequence: approximately 106 seconds, dominated by loading and rendering the large real package twice.

Evidence:

- `artifacts/cip048c/engineering-approval-reconciliation-validation.json`
- `artifacts/cip048c/engineering-approval-reconciliation-first-acceptance.json`
- `artifacts/cip048c/human-approval-approved-certification-ready.png`
- `artifacts/cip048c/approval-rehydrated-after-reload.png`
- `artifacts/cip048c/map-render-authority-after-reconciliation.png`

## Remaining gaps

No authority or workflow gap remains within CIP-048C. IOF Certification is intentionally pending explicit engineer action.
