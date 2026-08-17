# CIP-071A Customer Twin Artifact-State Projection & Demo Namespace Repair

Status: ACCEPTED on DAL1  
Accepted implementation checkpoint: `a308e2b`  
Date: 2026-08-17

## Result

Customer Twin lifecycle and governed artifact state are now independent projections.
The Customer Twin answers where the deal is now; each artifact surface answers what
happened to that exact persisted artifact.

Live Northstar evidence resolves as:

- Customer Twin / Deal: `AUTHORIZED`
- Proposal Revision 2: `ACCEPTED`
- Proposal Revision 3: `CURRENT` (not relabeled from the deal or Service Order)
- Engineering Package: `CERTIFIED`
- Certified IOF: `CERTIFIED`
- Service Order: `COUNTERSIGNED`; signature state `FULLY_SIGNED`
- ScopeVersion: `AUTHORIZED`

The internal Account Customer Twin, Customer Portal project, and external Customer
Twin return the same exact artifact projection.

## Root causes repaired

1. Customer UI surfaces used `currentState` as a Proposal display fallback. A later
   Service Order or ScopeVersion state could therefore relabel a historical Proposal.
2. Account projection initially selected the mutable Proposal repository head. The
   accepted lifecycle is bound to immutable Revision 2, while the repository currently
   also contains Revision 3. Projection now resolves the exact review/downstream
   revision ID and hash from persisted evidence rather than selecting `latest`.
3. New Demo Opportunity and Proposal IDs were generated from customer/opportunity
   names without the required Demo namespace token.
4. Route IDs inherited the unnamespaced Opportunity ID, and early route persistence
   lacked a Demo-namespaced transaction ID.
5. Customer Design Import IDs were generated before the authenticated Demo context
   was applied.
6. Proposal submit reused the incorrectly constructed Proposal ID. Its lifecycle
   predicates were legitimate and were not changed.

Server `DEMO_ID_NAMESPACE_REQUIRED` enforcement was not weakened.

## Exact Northstar lineage retained

- Opportunity: `OPPORTUNITY-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Proposal: `PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Accepted revision: `PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE-revision-2`
- Proposal hash: `7e0fe9001045e2a5d4f98b0ea3bd9192a3024eef98a535fc7bc20f6d3e4a7a58`
- Engineering Package: `ENG-PKG-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Certified IOF: `CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`
- Certification hash: `7c311a10f17114662f9d97946f65944e4c9b1c870824980c62fd6b73099361cc`
- Service Order: `SO-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE-R001`
- Document hash: `d9bc7fcf443e385f11ee447761a7d28f0e7bec1922e458034ab4fd22c663cce1`
- ScopeVersion: `ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE`

Byte comparison against the pre-deployment snapshot reported `NORTHSTAR_CHANGED=0`.
No ScopeVersion was regenerated.

## Demo namespace acceptance

A disposable Blue Mesa fixture exercised all repaired write paths:

- Customer Design Import: `CUSTOMER-DESIGN-IMPORT-DEMO-CIP071A-1786991513318`
- Commercial Route: `ROUTE-DEMO-CIP071A-1786991513318`
- Opportunity: `OPPORTUNITY-DEMO-CIP071A-1786991513318`
- Proposal: `PROPOSAL-DEMO-CIP071A-1786991513318`
- Proposal Revision: `PROPOSAL-DEMO-CIP071A-1786991513318-revision-1`
- Proposal hash: `86da1b7b87f842efb4161da8b3314b753ee8c67312f3f494e8b36708548c5948`

Opportunity, Route, Customer Design Import, Proposal save, and Proposal
submit-customer all persisted and reloaded without a namespace 409. The same IDs and
Proposal hash survived PM2 restart.

Negative requests with unnamespaced Demo IDs were then issued to all four repository
endpoints. Each returned `409 DEMO_ID_NAMESPACE_REQUIRED`; zero Demo or Production
files were written by those rejected requests.

## Customer acceptance authority

The same disposable Proposal was resumed from Customer Review. Demo Customer
Commercial Reviewer acceptance of the exact revision/hash persisted the acceptance
event and advanced both internal and external Customer Twin projections to `ACCEPTED`.
The Proposal remained `ACCEPTED`, the two views were identical, and Engineering
eligibility appeared from the persisted acceptance. Replaying acceptance after PM2
restart returned the same acceptance evidence ID, proving idempotency and persistence.

## Safety and isolation evidence

- Pre-change snapshot: `/home/ubuntu/hyperlinx-snapshots/cip071a-pre-b9e6c1d-20260817`
- Production repository writes during acceptance: `0`
- Northstar governed file changes: `0`
- Namespace-negative Demo writes: `0`
- Namespace-negative Production writes: `0`
- Disposable records: `environment=DEMO`, `organizationId=org-demo`,
  `productionEligible=false`
- Chicago was not accessed.

## Validation

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `node scripts/cip065-account-twin-validation.mjs`: PASS
- `node scripts/cip070-customer-workspace-validation.mjs`: PASS
- `node scripts/cip071a-artifact-state-validation.mjs`: PASS
- `CIP071A_REQUIRE_ARTIFACT_STATES=1 node scripts/cip071a-dal1-readonly-acceptance.mjs`: PASS
- Demo namespace positive, negative, restart, acceptance, parity, and idempotent replay: PASS
- Public runtime and bundle verification: PASS
