# CIP-074 Human Commercial / Customer View Operating Acceptance Report

Date: 2026-08-17  
Environment: DAL1, `org-demo`  
Outcome: **STOPPED AT A GENUINE GOVERNED PREDICATE — NOT FULLY ACCEPTED**

## Deployed contract

- Final deployed Git SHA: `734110c77c95fd7c629af93b8fb71c880c9f1844`
- PM2 process: `hyperlinx-dal-api`, online after final restart
- Public browser runtime: commit `734110c77c95`
- Production file-authority checksum before and after: `79ba5acef3628e28683c29dd3751a9505ba4b4a2f925121a1483cbdc7d84636e`
- Production governed writes: **ZERO**
- ScopeVersion creation: **ZERO**
- Chicago access: **ZERO**

## Delivered operating surface

Customer View is a first-class, account-centric Deal Room with:

- Account-to-deal discovery grouped by each Opportunity's own lifecycle state.
- Compact Deal, Proposal, Customer, Engineering, Service Order, and ScopeVersion authority header.
- Governed lifecycle rail derived from persisted evidence.
- Exact governed route/spine as the primary visual surface, with adjacent economics.
- Overview, Proposal, Engineering, Service Order, Documents, and Activity views.
- Technical identifiers and hashes collapsed under Technical Details / Lineage.
- Internal mode explicitly labeled `INTERNAL CUSTOMER VIEW · NO CUSTOMER AUTHORITY`.
- Demo customer perspectives entering the existing bounded Customer Portal.
- Persisted, actor-attributed internal activity and a separately filtered customer-safe timeline.
- Human-readable stale Proposal, customer-acceptance, route-lineage, and Product Doctrine messages while preserving server predicates.
- Customer View `Continue Commercial` navigation that carries Account and Opportunity context into the existing Commercial repository restore path.

No UI surface was made authoritative. Customer View, Commercial, and Customer Portal continue to project server-side governed evidence.

## Primary Cheyenne fixture — PASS

Account: `ACCOUNT-DEMO-NORTHSTAR`  
Opportunity: `DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-1786992282335`

The existing fixture was not restarted, regenerated, or advanced.

| Evidence | Exact result |
|---|---|
| Customer Twin / Deal | `ENGINEERING` |
| Proposal Revision | `DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-v1-revision-2` |
| Proposal hash | `3b6a99a518ad4e43f7030e1aa14cff46bf0e895bab62dc8ad5eea400d65e9673` |
| Proposal artifact state | `ACCEPTED` |
| Customer Review | `COMPLETE` |
| Customer Acceptance | `COMPLETE` |
| Engineering | `SUBMITTED` |
| Service Order | `NOT_CREATED` |
| ScopeVersion | `NOT_AUTHORIZED` |
| Route revision | `2` |
| Geometry hash | `rg-503c4625` |
| Route length | `31.05 miles` |
| NRC | `$4,082,311` |
| MRC | `$3,105` |
| Term | `240 months` |
| TCV | `$4,827,511` |

Internal Customer View and external Customer Portal resolved the same commercial, spatial, engineering, contractual, artifact-state, and customer-safe projections. The external lens excluded Internal Commercial Review evidence.

Persisted activity remained:

- Opportunity created by Demo User at `2026-08-17T18:44:42.335Z`.
- Proposal R1 saved by `demo-principal` at `2026-08-17T18:45:17.657Z`.
- Proposal R2 saved by `demo-principal` at `2026-08-17T18:49:47.973Z`.
- Internal Commercial Review approved by `demo-principal` at `2026-08-17T20:10:05.998Z`.
- Proposal submitted to Customer by `demo-principal` at `2026-08-17T20:10:51.963Z`.
- Proposal accepted by `demo-principal` at `2026-08-17T20:10:52.462Z`.
- Engineering initiated by System at `2026-08-17T20:10:53.240Z`.

## Human-style browser evidence — PASS for existing fixture

Microsoft Edge headless was driven through rendered controls against `https://app.teralinx.net`. It validated:

- Direct Customer View deep link to Northstar/Cheyenne.
- Deal `ENGINEERING`, Proposal R2 `ACCEPTED`, customer `ACCEPTED`, Engineering `SUBMITTED`.
- Governed route, economics, Proposal view/PDF affordance, and persisted Activity.
- Customer Viewer and Customer Commercial Reviewer perspectives.
- Reviewer has no acceptance control after the deal is already in Engineering.
- Return to Sales/Internal Customer View.
- Refresh and logout/login rehydration.
- Identical state after PM2 restart.

Screenshots are in `hyperlinx-dal-dev/artifacts/cip074/`:

- `01-internal-cheyenne-overview.png`
- `02-internal-proposal-r2.png`
- `03-internal-governed-activity.png`
- `04-customer-viewer-cheyenne.png`
- `05-customer-reviewer-engineering-readonly.png`
- `06-logout-login-rehydration.png`

Legacy object-valued summaries were normalized at projection time. No persisted governed record was rewritten for presentation.

## Bounded pre-Engineering fixture — STOPPED

The first candidate, `DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-OPPORTUNITY-1786992435632`, was rejected as unsuitable. Its pre-CIP persisted top-level Proposal references already pointed to `PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`. Any accidental browser writes to that prior authorized proposal were captured and selectively restored byte-for-byte from the CIP-074 pre-mutation snapshot. This was not a Demo reset; only files changed after the snapshot were restored or moved into recoverable audit storage.

The second existing candidate was used:

- Opportunity: `DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-OPPORTUNITY-3-1786992269237`
- Proposal: `DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-OPPORTUNITY-3-v1`
- Saved revision: `DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-OPPORTUNITY-3-v1-revision-1`
- Immutable proposal hash: `a7c5d2e34a16c8b6aef65cee3b474c39d8ebbecdd85c9abf3378edb319c81f67`
- Revision state after restart: `SAVED`
- Approval state after restart: `NOT_SUBMITTED`
- Approvals: none
- Customer Twin deal state after restart: `DRAFT`

Visible controls successfully performed Customer View → Continue Commercial → exact Opportunity repository restore → Proposal Builder → Save Proposal Revision. Internal Commercial Review did not complete, and Submit to Customer remained disabled.

The persisted predicate evidence is exact:

- `routeRepositoryId` is empty.
- `routeGeometryId` is empty.
- `geometryHash` is empty.
- Route length is `0` and the restored route is `No draft`.
- The Proposal correctly remains `SAVED` with no internal approval.

This fixture therefore cannot legitimately pass Internal Commercial Review or enter Customer Review. Per the CIP stop rule, no Customer acceptance, Engineering handoff, or downstream artifact was manufactured. The saved R1 state survived PM2 restart and remains available for a governed resume after route authority is established.

## Negative and isolation evidence

| Check | Result |
|---|---|
| Customer Viewer accepts Proposal | `403`, PASS |
| Customer persona sends to Engineering | `403`, PASS |
| Direct ScopeVersion creation | `403`, PASS |
| Customer B discovers Customer A Cheyenne | Rejected/absent, PASS |
| Internal/customer governed projection parity | PASS |
| Customer-safe activity filtering | PASS |
| Demo mutation crosses into Production | No; checksum identical, PASS |
| Stale Proposal / stale route / wrong hash browser cases | Not re-mutated in this run; server predicates retained |
| Production identity enters Demo simulation | No Production identity used |

## Acceptance matrix

| Criterion | Result |
|---|---|
| Customer View first-class workspace | PASS |
| Account → Deal discovery | PASS |
| Exact Opportunity rehydration | PASS |
| Exact Cheyenne route/spine | PASS |
| Economics parity | PASS |
| Artifact-state parity | PASS |
| Lifecycle rail | PASS |
| Proposal view/PDF | PASS |
| Internal Customer View | PASS |
| Customer Viewer | PASS |
| Customer Commercial Reviewer | PASS |
| Activity projection | PASS |
| Human-readable predicates | PASS |
| Deep link | PASS |
| Refresh persistence | PASS |
| Logout/login persistence | PASS |
| PM2 restart persistence | PASS |
| Customer A/B isolation | PASS |
| Demo/Production isolation | PASS |
| Production governed writes | ZERO |
| ScopeVersion creation | ZERO |
| Chicago access | ZERO |
| Fresh Submit → Customer View transition | BLOCKED: no governed route on bounded fixture |
| Fresh customer acceptance | NOT REACHED |
| Fresh CUSTOMER REVIEW → ACCEPTED | NOT REACHED |
| Fresh Engineering eligibility | NOT REACHED |
| Fresh Send to Engineering | NOT REACHED |
| Fresh ACCEPTED → ENGINEERING | NOT REACHED |

## Demo mutation inventory

Legitimate retained mutations are limited to the bounded Opportunity 3 working set:

- One immutable Proposal R1 and its Commercial Revision.
- Updated Opportunity/runtime-object references to that exact Proposal R1.
- Opportunity open/save and Proposal revision-saved runtime-history records.
- Associated Demo-only activity and transaction-manifest records.

No customer-review package, customer acceptance, Engineering package, Service Order, signature, ScopeVersion, Marketplace, Control, Field, Close, or Twin transition was created for this fixture.

Recoverable audit captures of the rejected fixture attempts are stored on DAL1 under:

- `/home/ubuntu/hyperlinx-snapshots/cip074-accidental-20260817-2052`
- `/home/ubuntu/hyperlinx-snapshots/cip074-accidental-20260817-2056`

## Governing conclusion

The Customer View/Deal Room operating surface and the existing Cheyenne projection are accepted at commit `734110c77c95fd7c629af93b8fb71c880c9f1844`. Full CIP-074 operating acceptance is **not** claimed because the available bounded pre-Engineering fixture lacks governed route authority and correctly failed closed before customer submission. The next legitimate resume point is to establish or select a governed Route Repository for Opportunity 3, create a new exact Proposal Revision if material state changes, and continue from Internal Commercial Review—without changing the accepted Cheyenne fixture.
