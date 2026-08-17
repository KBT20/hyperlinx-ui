# CIP-073 Opportunity Materiality and Customer Handoff Acceptance Report

Date: 2026-08-17  
Environment: DAL1, isolated `org-demo` authority  
Result: **PASS — stopped at legitimate Engineering handoff**

## Constitutional decision

The exact Opportunity v4 to v5 change is **NON_MATERIAL**. No customer-facing commercial, spatial, product, doctrine, quantity, pricing, specification, term, assumption, or delivery field changed. Proposal R2 therefore remained the correct immutable offer and no Proposal R3 was created.

The repair adds a materiality evaluation without changing either Opportunity version or hash. A stale binding can advance only when every changed field is explicitly classified as non-material. A material field requires a new Proposal Revision; an unknown field fails closed as `PROPOSAL_REVIEW_REQUIRED`.

## Exact v4 to v5 diff

| Field | v4 | v5 | Classification | Reason |
|---|---|---|---|---|
| `commercialStateVersion` | `4` | `5` | `SYSTEM_DERIVED` | Version metadata; does not alter the offer. |
| `commercialWorkingState.lastGovernedRevisionState` | missing | `PROPOSAL_REVISION_SAVED` | `SYSTEM_DERIVED` | Workflow projection created when R2 was saved. |
| `commercialWorkingState.proposalReferences.proposalHash` | R1 `9507d1a4ed7a3311ce6bf8209689aaa6d1a24cd8aa4f1762a35ef7d5adc93dd0` | R2 `3b6a99a518ad4e43f7030e1aa14cff46bf0e895bab62dc8ad5eea400d65e9673` | `SYSTEM_DERIVED` | Exact immutable Proposal linkage, not offer content. |
| `commercialWorkingState.proposalReferences.proposalRevisionId` | `...-revision-1` | `...-revision-2` | `SYSTEM_DERIVED` | Exact immutable Proposal linkage, not offer content. |
| `proposalHash` | R1 `9507d1a4ed7a3311ce6bf8209689aaa6d1a24cd8aa4f1762a35ef7d5adc93dd0` | R2 `3b6a99a518ad4e43f7030e1aa14cff46bf0e895bab62dc8ad5eea400d65e9673` | `SYSTEM_DERIVED` | Top-level projection of the exact saved Proposal. |
| `proposalRevisionId` | `...-revision-1` | `...-revision-2` | `SYSTEM_DERIVED` | Top-level projection of the exact saved Proposal. |

Material changes: none. Unknown changes: none. `materialCommercialState = UNCHANGED`. The system retains and exposes both bindings:

- Proposal-bound Opportunity: v4 / `b597eeab0ebb8c0407399bd31e7812a64be3e04aefbe5498980ffe7fcf163606`
- Audited current Opportunity: v5 / `8abe5dcdc77270e117f71da252f31c5f7ea96594ac1834ff05cc82ba34c50072`

## Immutable authority used

- Account: `ACCOUNT-DEMO-NORTHSTAR`
- Opportunity: `DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-1786992282335`
- Proposal: `DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-v1`
- Proposal Revision: `...-revision-2`, revision count remains exactly 2
- Proposal hash: `3b6a99a518ad4e43f7030e1aa14cff46bf0e895bab62dc8ad5eea400d65e9673`
- Product: `POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER`
- Doctrine: `DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER`, version `20C.1.0`
- Route repository: `ROUTE-REPO-DEMO-OPP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-1786992282335-COMMERCIAL-DRAFT-IMPORT-ROUTE-CHEYENNE-METRO-DUCT-SYSTEM-31-1`
- Route revision: `2`
- Geometry: `...:geometry:rg-503c4625`
- Geometry hash: `rg-503c4625`

R2 and its hash were unchanged before and after handoff. No R3 was manufactured and no `ScopeVersion` exists for this Cheyenne fixture.

## Governed evidence and lifecycle result

| Stage | Result / evidence |
|---|---|
| Internal Commercial Review | PASS; `INTERNAL-COMMERCIAL-APPROVAL-...-revision-2`; exact R2 hash, route authority, and NON_MATERIAL v4→v5 evaluation persisted. |
| Customer submission | PASS; `CUSTOMER-REVIEW-DEMO-...-revision-2`; Twin projected `CUSTOMER_REVIEW`, Proposal `SUBMITTED`, response `PENDING`, Engineering `NOT_ELIGIBLE`. |
| Automatic internal Customer View | PASS; submission handler selected `workspace=customerView` with exact account and Opportunity; public bundle contains the deployed customer-safe transition code. |
| Customer acceptance | PASS; `CUSTOMER-ACTION-DEMO-ACCEPT-1786997452462-22d5861ea88d`; actor `demo-principal`, persona `CUSTOMER_COMMERCIAL_REVIEWER`, exact R2 ID/hash. |
| Acceptance replay | PASS; returned idempotent replay and created no second acceptance authority. |
| Engineering eligibility | PASS; persisted acceptance advanced the Twin to `ACCEPTED`, Proposal `ACCEPTED`, response `COMPLETE`, Engineering `ELIGIBLE`. |
| Draft IOF | PASS; `DRAFT-IOF-DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-v1`. |
| Engineering handoff | PASS; `ENG-PKG-DRAFT-IOF-DEMO-PROP-NORTHSTAR-CLOUD-INFRASTRUCTURE-CHEYENNE-METRO-DUCT-SYSTEM-31-v1`. |
| Final bounded state | Account Twin `ENGINEERING`; Customer project artifact `ENGINEERING_SUBMITTED`; Proposal artifact remains `ACCEPTED`; Engineering `SUBMITTED`. |

The internal Account Twin and bounded Customer Viewer Twin matched for commercial, spatial, Engineering, contractual, artifact-state, map/spine, economics/specification, and customer-safe lineage projections. Customer B could not discover the Customer A Cheyenne deal. The customer route lineage check returned `PASS`.

## Rehydration and runtime evidence

- Refresh/read-after-write: PASS.
- Logout/login after Customer acceptance: PASS; the reauthenticated Demo session projected `ACCEPTED` before handoff.
- PM2 restart: PASS; the read-only verifier reloaded exact R2, two revisions, complete acceptance, Engineering package, and final `ENGINEERING` state.
- DAL1 PM2 status: `online`.
- Accepted implementation/runtime checkpoint: `4db7e639226c4bc52036c53319275544c230f8bd`.
- Acceptance-verifier source/runtime head: `2f01afaab84c609b5b1287e3cc462ff51bb89c26`.
- Public runtime: `2f01afaab84c` (CONNECTED before the report-only commit).
- Public frontend bundle: `/assets/index-CPrxSI_f.js`; Commercial lazy chunk `/assets/GoogleRfpWorkspace-ZuIF-4b2.js` contains the visible non-material Opportunity/Proposal messaging.

## Negative predicate results

| Test | Result |
|---|---|
| Wrong Opportunity state hash during Internal Review | `409` |
| Stale route revision during Internal Review | `409` |
| Wrong Proposal hash during Customer submission | `409` |
| Engineering assembly before customer acceptance, with Engineering authority | `409` |
| Customer Viewer attempts acceptance | `403` |
| Customer Reviewer submits stale Proposal hash | `409` |
| Customer invokes internal Send to Engineering | `403` |
| Customer attempts direct ScopeVersion access/mutation | `403` |
| Acceptance replay | `200`, idempotent |
| Material route-revision contract fixture | classified `MATERIAL`; new Proposal Revision required |
| Unclassified change contract fixture | `REVIEW_REQUIRED`; fails closed |

Demo namespace authority remained enforced: every created governed identifier is Demo-classified and all records remained under `server/data-demo`. No production namespace record was created.

## Persistence isolation and mutation inventory

Pre-mutation snapshot: `/home/ubuntu/hyperlinx-snapshots/cip073-pre-4db7e63-20260817`.

Production repository digest before and after:

`79ba5acef3628e28683c29dd3751a9505ba4b4a2f925121a1483cbdc7d84636e`

No file in `server/data` changed after the pre-mutation snapshot. No Production governed record was mutated. Chicago was not accessed.

Demo writes were confined to the resumed Cheyenne chain and its supporting evidence: Opportunity and Proposal workflow projections; Internal Review/runtime history; one current Customer Review package; Customer access/invitations; one acceptance action; Draft IOF, doctrine/object/station/quantity projections; Commercial release/revision; Engineering baseline/intake/package; runtime objects/workspace/history; and transaction manifests. The first acceptance attempt submitted the exact R2, then stopped on a test-harness persona mismatch before acceptance; this produced an additional set of three invitation records and submission history only. It created no customer acceptance or Engineering authority. The same fixture was then resumed with the correct Engineering probe authority.

No Engineering Approval, Certification, Service Order, signature, countersignature, ScopeVersion, Marketplace, Control, Field, Close, or operational Twin mutation was performed.

## Verification performed

- `node scripts/cip073-materiality-validation.mjs` — PASS
- `node scripts/cip072-contract-validation.mjs` — PASS
- TypeScript no-emit validation — PASS
- Production build — PASS
- `node scripts/cip073-dal1-acceptance.mjs` — PASS
- `node scripts/cip073-post-restart-validation.mjs` — PASS after PM2 restart

The constitutional outcome is established: Opportunity evolution remains immutable and auditable; Proposal advancement depends on governed commercial materiality. Material or unknown changes cannot bypass revision authority, while explicitly non-material workflow metadata does not manufacture an unnecessary Proposal Revision.
