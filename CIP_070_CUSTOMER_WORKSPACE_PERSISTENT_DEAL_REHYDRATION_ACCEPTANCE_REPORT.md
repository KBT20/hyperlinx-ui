# CIP-070 — Customer Workspace & Persistent Deal Rehydration Acceptance Report

Date: 2026-08-17  
Environment: DAL1 / `app.teralinx.net`  
Primary validation domain: `org-demo`

## Accepted outcome

Customer View is a first-class Commercial workspace. It begins with governed Account selection, resolves the canonical `CUSTOMER-TWIN-{accountId}` projection, discovers all persisted Opportunities for that Account, and renders the selected deal from exact repository lineage. It creates no lifecycle authority.

Accepted source checkpoint before the report commit: `7bab79c47c318746aaf18fc6bdf17497ec4a596e`.

## Root causes repaired

1. Existing Account IDs were lowercased by the Account list read projection. `ACCOUNT-DEMO-NORTHSTAR` became `account-demo-northstar`, which broke exact Account-to-Twin lookup. Existing governed Account identity is now preserved byte-for-byte; legacy normalization remains only for newly requested IDs.
2. Customer Twin route lineage required Proposal identity even for a persisted DRAFT Opportunity that constitutionally has no Proposal. Pre-Proposal deals now bind to exact persisted Opportunity route identity. Once a Proposal exists, the stricter Proposal Revision ID/hash and Proposal-bound route checks remain mandatory.

Neither repair rewrote an Account, Opportunity, Route, Proposal, Service Order, ScopeVersion, or Twin authority record.

## Navigation and rehydration

- Primary navigation: `Commercial → Customer View`.
- Entry: `Select Account → Account Customer Twin → lifecycle-grouped persisted Opportunities`.
- `+ New Opportunity` is separate from Account selection.
- Account and Opportunity IDs in the URL are navigation keys only. Every refresh, login, and restart re-queries server repositories.
- Successful `Submit Proposal to Customer` transitions directly to Customer View with the exact Account and Opportunity selected.
- Enrollment invitations carry the exact Opportunity deep-link target.
- Internal Customer View displays `INTERNAL CUSTOMER VIEW · NO CUSTOMER AUTHORITY` and imports no customer mutation API.
- External Viewer, Reviewer, and Signer continue to use the bounded CIP-062 Customer Portal and its existing server-side action predicates.
- Exact route mismatch produces `FAIL_CLOSED`; no Customer Twin baseline or alternate route is substituted.

## Accepted Northstar authority

- Account: `ACCOUNT-DEMO-NORTHSTAR`
- Customer Twin: `CUSTOMER-TWIN-ACCOUNT-DEMO-NORTHSTAR`
- Persisted Opportunity: `OPPORTUNITY-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Current state: `AUTHORIZED`
- Opportunity state version/hash: `3` / `daf84179cd0ac6bc67d7c4f0d4b81953b56a083b7ef8bef5c1210af7f21b980b`
- Route: `ROUTE-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Route revision: `1`
- Geometry ID: `ROUTE-DEMO-CIP067-NORTHSTAR-PERSISTENCE:GEOMETRY:v1`
- Geometry hash: `rg-64c0ada0`
- Route distance: `1 mile / 5,280 feet`
- Proposal R2: `PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE-revision-2`
- Proposal hash: `7e0fe9001045e2a5d4f98b0ea3bd9192a3024eef98a535fc7bc20f6d3e4a7a58`
- Engineering Package: `ENG-PKG-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Certified IOF: `CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Certification hash: `7c311a10f17114662f9d97946f65944e4c9b1c870824980c62fd6b73099361cc`
- Service Order: `SO-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE-R001`
- Service Order hash: `d9bc7fcf443e385f11ee447761a7d28f0e7bec1922e458034ab4fd22c663cce1`
- ScopeVersion: `ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`

Proposal R2 remains visible as historical accepted Proposal truth while the current deal remains AUTHORIZED. The Proposal and current Customer Twin resolve the same exact route identity and hashes.

## Pre-ScopeVersion acceptance

The initial inventory found no legitimate reusable pre-ScopeVersion deal: Blue Mesa and the legacy Demo Account had zero deals; Northstar had two AUTHORIZED deals. Under CIP-070 section 24, the minimum governed Demo workflow created one DRAFT using only canonical Commercial APIs:

- Account: `ACCOUNT-DEMO-BLUE-MESA`
- Opportunity: `OPPORTUNITY-DEMO-CIP070-BLUE-MESA-DRAFT`
- Opportunity state version/hash: `1` / `8c41e9ebbe15f6a385d75f92457cb604ca1238d47b1d1527d8a3af20b3aae81a`
- Route: `ROUTE-DEMO-CIP070-BLUE-MESA-DRAFT`
- Route revision: `1`
- Geometry ID: `ROUTE-DEMO-CIP070-BLUE-MESA-DRAFT:geometry:rg-758c1ee3`
- Geometry hash: `rg-758c1ee3`
- Distance: `2.4 miles / 12,672 feet`
- State: `DRAFT`
- Proposal created: no
- Customer review authority created: no
- ScopeVersion created: no
- Production eligible: no

The creation harness is idempotent. After PM2 restart it returned `created=false` with the same IDs and hashes.

## Internal/external parity and authority

For the accepted Northstar deal, internal and external Customer View returned identical Opportunity, Account, current state, Proposal, route, Engineering, Certified IOF, Service Order, and ScopeVersion references. Customer Viewer exposed no mutation action. A Demo Sales attempt to invoke customer acceptance through the Customer Portal was rejected `403`. Customer A could not see Northstar when projected through Customer B. Proposal and Service Order PDFs both returned `application/pdf`.

## Persistence and isolation

- PM2 restarted and remained online with zero unstable restarts.
- Fresh login after restart rehydrated the same Northstar and Blue Mesa identities, routes, hashes, and states.
- Public runtime and bundle served the accepted checkpoint and Customer Workspace chunk.
- Production pre-deployment manifest: 2,477 files.
- Production post-deployment manifest: 2,477 files, checksum-identical.
- Existing Northstar governed files were not modified.
- Demo mutations were exactly six files for the bounded Blue Mesa DRAFT: Commercial Route, Commercial Opportunity, runtime mirror, runtime history, and two transaction manifests.
- No CIP-070 Proposal, customer-review package, Service Order, certification, or ScopeVersion exists.
- Demo reset: zero.
- Chicago access: zero.
- Marketplace, Control, Field, Close, Redline, and Operational Twin mutation: zero.

## Validation

- TypeScript: PASS
- Production build: PASS
- CIP-065 Account Twin regression: PASS
- CIP-066 exact-map/fail-closed regression: PASS
- CIP-067 persistent Opportunity regression: PASS
- CIP-070 Customer Workspace regression: PASS
- DAL1 read-only acceptance before and after restart: PASS
- Public runtime/bundle reconciliation: PASS

The CIP-070 acceptance matrix passes. Customer Twin remains a read-only projection of persisted human and system evidence; machine reconstruction and duplicate lifecycle authority remain zero.
