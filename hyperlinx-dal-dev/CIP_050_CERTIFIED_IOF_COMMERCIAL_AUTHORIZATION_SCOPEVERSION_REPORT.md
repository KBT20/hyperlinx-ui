# CIP-050 — Certified IOF Commercial Authorization, Digital SOW & Atomic ScopeVersion

## Result

CIP-050 is implemented and exercised locally through the final authorized ScopeVersion. Teralinx countersignature is the sole public ScopeVersion creation event. Customer acceptance alone does not create execution authority.

No deployment, DAL1, marketplace, Control, Field, Product Doctrine, Engineering authority, certification gate, Certified IOF technical-basis mutation, or persistence migration was performed.

## Governed lifecycle exercised

| Stage | Persisted result | Authority |
|---|---|---|
| Certified IOF/Twin | `CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2` / logical Twin `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2:IOF-PACKAGE-TWIN` | Certification Ledger |
| Service Order generated | `SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001` | Commercial draft |
| Service Order issued | Revision 1 locked to document hash | Issued commercial document |
| Customer signed | Google Customer / `google-participant-001` | Immutable authenticated customer-signature evidence |
| Teralinx countersigned | Kyle / `teralinx-user-kyle` | Teralinx authorization countersignature |
| Atomic transaction | `COMMERCIAL-AUTHORIZATION-SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001-44d9a14a00cd9945` = `COMMITTED` | Commercial authorization transaction |
| ScopeVersion created | `ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2` | Order for Execution |
| Twin advanced | Same logical Twin, state `AUTHORIZED` | Countersignature transaction |

## Exact evidence

- Service Order document hash: `44d9a14a00cd9945784844ea4e226e8d490431c0870cdf7d60e09da83f8d9389`
- Customer signature: `CUSTOMER-SIGNATURE-SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001-32ac6e8dbadcf344`
- Customer signature hash: `32ac6e8dbadcf34417a374019a4b1e938bef6bc29e31fcf7dbfbd8c896ca558e`
- Teralinx countersignature: `TERALINX-COUNTERSIGNATURE-SO-PROP-DEMO-OPPORTUNITY-3SWR-v2-R001-31f5e569c999a55b`
- Countersignature hash: `31f5e569c999a55b12f808abcb90cbf94dac4951fc85b11ee25c2902d0af8939`
- Certification hash retained: `aaa450430fa23eb42fa6ccaceb491024497a92c37abe265c5b0a97a7ea49f022`
- Route geometry hash retained: `rg-0d302bb0`

The Service Order presents Google, Point-to-Point Fiber Infrastructure, 150.68 route miles, $26,334,426 NRC, $15,068 monthly, and a 240-month term. Technical content is reference-only and bound to the exact certification, engineering revision/approval, route, proposal, commercial revision, terms, and document hashes.

## Atomicity and fail-closed behavior

The countersign endpoint prevalidates the Certified IOF, Certification Ledger hash, exact issued Service Order revision/hash/terms, immutable customer signature, customer signer assignment, exact Certified Twin, ScopeVersion collision, and authenticated Teralinx actor before writing.

The write unit is:

1. Immutable Teralinx countersignature.
2. ScopeVersion.
3. Authorized state of the same logical Twin.
4. Countersigned Service Order projection.
5. Committed authorization transaction.

If any write fails, newly written transaction artifacts are deleted and the prior Service Order projection is restored. Exact committed replay is idempotent. The former Engineering `generate-scopeversion` endpoint now fails with 409, eliminating the alternative customer-signature-only promotion path.

## Certified basis preservation

The ScopeVersion materialized the existing certified basis without rerunning Engineering:

- 150.68 miles; 340 governed route geometry points.
- 7,957 stations.
- 433 placed route objects in the ScopeVersion projection.
- Certified Twin still reports the complete governed basis: 437 objects, 436 spans, and 1,308 work segments.
- The pre-existing assembler's repeated station/object response views were normalized by stable governed identity; source evidence was not altered.
- Certified IOF Package and Certification Ledger timestamps remained `2026-08-14 11:31:05 AM`; neither record was rewritten.

## Validation

| Check | Result |
|---|---|
| Generate Service Order | PASS — 22 ms |
| Issue immutable revision | PASS — 7 ms |
| Teralinx user attempts customer signature | PASS — blocked 403 |
| Assigned Google participant signs | PASS — 12 ms |
| Google participant attempts Teralinx countersignature | PASS — blocked 403 |
| Customer signature creates ScopeVersion | PASS — zero ScopeVersions created |
| Wrong document hash countersignature | PASS — blocked 409 |
| Legacy direct promotion | PASS — blocked 409 |
| Atomic countersign + ScopeVersion + Twin | PASS — 2,374 ms |
| Exact replay | PASS — idempotent; same document and transaction |
| Server restart / repository reload | PASS — Twin remained `AUTHORIZED` with ScopeVersion loaded |
| Browser reload | PASS — 2,779 ms to full authorization surface |
| Browser console/runtime | PASS — 0 exceptions, 0 console errors, 0 failed requests, 0 integrity failures |
| TypeScript | PASS — `tsc --noEmit -p tsconfig.json` |
| Production build | PASS — Vite, 387 modules |

Validation script: `cip050-commercial-authorization-browser-validation.mjs`.

## UI

The Certified IOF Twin now exposes a primary `Commercial Authorization` surface with:

- readable customer, product, route, price, monthly charge, term, and SOW summary;
- collapsed full terms and governed references;
- issue ceremony;
- customer-signature ceremony restricted to the Proposal's assigned customer participant;
- Teralinx countersignature acknowledgment;
- final Service Order, execution, Twin, and ScopeVersion status.

Technical hashes and lineage remain available without dominating the customer-facing document.

## Mutation audit

Expected new runtime records only:

- one Service Order revision;
- one immutable customer-signature evidence record;
- one immutable Teralinx countersignature record;
- one committed commercial-authorization transaction;
- one ScopeVersion;
- one append-only `AUTHORIZED` state for the existing logical Twin.

Marketplace quotes: 0. Control work items: 0. Field closures: 0. No downstream execution object was created.
