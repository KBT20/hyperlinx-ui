# CIP-062 — Demo Customer Portal Acceptance Report

Date: 2026-08-16  
Implementation checkpoint: `6fa7bdd902406b65726fce95ac3ac1241c74c6a2`  
Portal rehydration repair: `ed0759e914ae30c8e0174064230201f9fa3e4855`  
Accepted deployed runtime: `25966c9524de421758969cc694ccac703fb2615f`  
Environment: DAL1 / common Hyperlinx runtime / isolated Demo authority

## Outcome

The bounded Demo Customer Portal and Demo Persona experience are deployed in the common runtime. Customer Portal acceptance passed through exact Proposal R3 acceptance and persisted across PM2 restart. The controlled lifecycle then stopped at the existing Engineering Package reference predicate. No ScopeVersion was created.

Stop result:

`STOPPED_AT_GENUINE_ENGINEERING_HANDOFF_PREDICATE`

Missing governed Engineering references:

- `closureLedger`
- `iofPackageTwin`
- `executionGraph`
- `lifecycleGraph`
- `commercialAudit`
- `constitutionalState`

The predicate was not weakened, bypassed, fabricated, or repaired under CIP-062.

## Implemented contract

- Two fictional Demo customer organizations: Northstar Cloud Infrastructure and Blue Mesa Digital Systems.
- Six durable named external principals with Viewer, Commercial Reviewer, and Authorized Signer roles.
- Organization membership plus explicit project access.
- Opaque 256-bit invitation tokens, SHA-256 token storage, expiration, revocation, single-use enrollment, and durable authentication.
- Bounded Customer Portal navigation: Projects, Documents, Account; Overview, Map, Proposal, Activity.
- Shared MapKernel projection using the exact Commercial Route Repository identity and geometry hash.
- Customer-safe Proposal, Engineering status, Service Order, ScopeVersion, document, and activity projections.
- Server-authorized comment, question, change request, accept, decline, and Service Order signature commands.
- Exact Proposal Revision ID/hash and exact Service Order document hash predicates.
- Customer Proposal decisions and Service Order signatures removed from internal workflow surfaces and rejected at their direct internal API endpoints.
- Demo Persona Switcher with Sales, Engineering, Customer Viewer, Customer Commercial Reviewer, Customer Authorized Signer, and Executive perspectives. The authenticated actor remains `demo-principal`; governed Demo actions record `demoPersona`.
- Customer-lens sessions are globally denied access to internal APIs outside the bounded portal, authentication, runtime metadata, and governed export surfaces.
- Presentation-ready Demo reset with approved scenario selection.

## Controlled fixture

- Scenario: `DEMO-SCENARIO-DCI`
- Customer organization: `org-demo-customer-a`
- Opportunity: `OPPORTUNITY-DEMO-CIP062-NORTHSTAR`
- Route: `ROUTE-DEMO-CIP062-NORTHSTAR`
- Proposal: `PROPOSAL-DEMO-CIP062-NORTHSTAR`
- R2: `PROPOSAL-DEMO-CIP062-NORTHSTAR-revision-2`
- R2 hash: `09691d4e1556954c8c02575082af7fd2c92e428ee82186dda52bc7904b979211`
- R3: `PROPOSAL-DEMO-CIP062-NORTHSTAR-revision-3`
- R3 hash: `0b6ad2866098cc520cc1c92d34c5fd089a79735c17a58cef4a0ff5a34b7eaf5f`

## Acceptance evidence

Passed:

- Demo reset to approved DCI scenario.
- Opportunity, governed route, Proposal R1, clone/revise R2, and immutable R2 save.
- Exact R2 submission to named Northstar recipients.
- Customer B could not see Customer A's project.
- Viewer could read the bounded project but could not accept.
- Wrong Proposal hash rejected with 409.
- Direct internal Proposal acceptance rejected with 403.
- Customer question and exact R2 change request persisted.
- R2 identity/hash remained unchanged.
- Sales cloned R2 to immutable R3 and submitted exact R3.
- Superseded R2 invitation rejected.
- Named external reviewer enrolled and logged in.
- One-time invitation replay rejected.
- External customer Product Doctrine, Engineering workbench, and direct ScopeVersion access rejected.
- External organization header substitution did not change the authenticated customer's organization scope.
- Customer View accepted exact R3 with `actorPrincipalId=demo-principal` and `demoPersona=CUSTOMER_COMMERCIAL_REVIEWER`.
- Repeated exact acceptance returned an idempotent replay.
- Browser refresh/logout-login authority is server-side; no governed portal authority is stored in browser state.
- PM2 restart retained R3 identity/hash, customer acceptance, and Customer A/B isolation.
- Public `app.teralinx.net` returned the current bundle with Customer Portal and Demo Persona contracts.

Observed and repaired during validation:

- Initial Customer project rehydration returned 500 because pre-ScopeVersion `null` was not handled by the status projection. The actual exception was `Cannot read properties of null (reading 'scopeVersionId')`. The narrow repair made pending Service Order/ScopeVersion projection null-safe without changing lifecycle authority.

## Preservation and isolation

- Pre-deployment private snapshot: `/home/ubuntu/cip062-pre-6fa7bdd-20260816`
- Snapshot includes runtime/config evidence, compressed Production/Demo file authority, and per-file SHA-256 manifests.
- Production file repository before: 2,461 files.
- Production file repository after: 2,461 files.
- Pre/post Production SHA-256 manifests: byte-for-byte identical.
- Demo artifacts remain `environment=DEMO`, `authorityClass=DEMO`, `productionEligible=false`.
- Production governed records were not modified.
- Production credentials were not rotated or impersonated.
- PostgreSQL authority cutover was not performed.
- Chicago access: zero.
- Marketplace, Control, Field, Close, Redline, and operational Twin actions: not attempted.

## Stop boundary

The controlled chain cannot legally proceed to Engineering Review, Approval, Certification, Service Order, customer signature, executive countersignature, or ScopeVersion until the six required Engineering Package references resolve through their existing authorities. CIP-062 acceptance therefore stops at Commercial-to-Engineering handoff in accordance with the required fail-closed rule.
