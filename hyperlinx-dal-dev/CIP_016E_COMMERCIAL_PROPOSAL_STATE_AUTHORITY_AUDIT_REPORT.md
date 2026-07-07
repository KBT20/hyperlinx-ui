# CIP-016E Commercial Proposal State Authority Audit Report

Date: 2026-07-07

## Objective

Audit the Commercial Proposal lifecycle and establish the Proposal Repository as the single authority for Commercial proposal state.

CIP-016E does not modify Engineering, ScopeVersion, Marketplace, Control, Field, or repository schemas.

## Root Cause

Commercial approval state was duplicated.

The UI had a legacy `acceptedProposal` projection and local `customerReviewStatus` state in addition to governed Proposal Repository records. A customer acceptance could be represented by an `ACCEPTED_PROPOSAL` projection while the opportunity-linked proposal record still restored as customer review. On reload, the Commercial Dashboard could hydrate from the opportunity-linked review record and report:

`Proposal is not approved`

even though a separate accepted projection previously made the UI look approved.

## Unexpected Status Change

Observed transition:

`CUSTOMER_APPROVED`

to:

`CUSTOMER_REVIEW`

The audit found the state did not necessarily change inside one record. Instead, the dashboard could switch records:

1. Before reload, local accepted-proposal projection made the dashboard appear approved.
2. After reload, active proposal selection could choose the opportunity-linked Proposal Repository record.
3. That record could still be in customer review.
4. Engineering eligibility then failed because the active repository proposal was not approved.

## Proposal Repository Authority

The Proposal Repository now canonicalizes approved Commercial proposal state as:

`COMMERCIAL_APPROVED`

Legacy `CUSTOMER_APPROVED` records still restore as approved, but the repository API reports the canonical state:

`COMMERCIAL_APPROVED`

Engineering submission eligibility now depends on the active Proposal Repository record reporting `COMMERCIAL_APPROVED`.

## State Transition Report

### Proposal Save

Instrumentation logs:

- `proposalId`
- value written to Proposal Repository
- repository status
- approval state
- customer review state
- commercial status
- dashboard status
- engineering eligibility

Log source:

`[ProposalStateAuthority] Proposal save input`

### Proposal Repository Write

Instrumentation logs the persisted repository state after save.

Log source:

`[ProposalStateAuthority] Proposal Repository write`

### Proposal Restore

Instrumentation compares raw stored status with normalized restored status.

Log sources:

- `Proposal Repository restore:list`
- `Proposal Repository restore:get`
- `Proposal Repository restore:open`

### UI Hydration

The Commercial Dashboard logs the rendered proposal state derived from the active Proposal Repository record.

Log source:

`[ProposalStateAuthority:UI] Commercial Dashboard hydration`

## Repaired Commercial Rule

Before:

Engineering handoff could be enabled from a mix of local customer review state, accepted proposal projections, and proposal runtime state.

After:

Engineering handoff requires:

`activeProposalRuntime.status === "COMMERCIAL_APPROVED"`

where `activeProposalRuntime` is restored from the Proposal Repository.

## Gated Pipeline Recommendation

The suggested future workflow model is sound and aligns with deterministic authority transfer:

```text
✓ Commercial Planning
      │
✓ Customer Review
      │
✓ Commercial Approval
      │
✓ Draft IOF Package
      │
► Engineering Certification
      │
□ Service Order
      │
□ Customer Signature
      │
□ ScopeVersion Created
      │
□ Marketplace
      │
□ Control
      │
□ Field
      │
□ Operational Twin
```

Each stage should eventually render from repository-owned state, not local UI state. CIP-016E does not implement this UI replacement; it documents the recommendation for a later Commercial workflow decomposition.

## Files Modified

- `server/routes/proposal-drafts.js`
- `src/api/teralinxRuntime.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `cip016e-commercial-proposal-state-authority-validation.mjs`
- `CIP_016E_COMMERCIAL_PROPOSAL_STATE_AUTHORITY_AUDIT_REPORT.md`

## Validation Results

Validation script:

`node cip016e-commercial-proposal-state-authority-validation.mjs`

Result:

`PASS`

TypeScript:

`npx tsc --noEmit -p tsconfig.json`

Result:

`PASS`

Production build:

`npm run build`

Result:

`PASS`

Diff whitespace:

`git diff --check`

Result:

`PASS`

Note: Git reported existing CRLF normalization warnings in the working copy, but no whitespace errors.
