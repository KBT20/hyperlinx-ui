# CIP-029 Commercial Engineering Handoff Report

Date: 2026-07-08

## Objective

Complete the Commercial to Engineering constitutional handoff and simplify the operator workflow without redesigning the application.

This sprint does not modify ScopeVersion, Marketplace, Control, Field, Twin, Operational Intelligence, pricing formulas, repository truth, Commercial Change Set doctrine, or Engineering Change Set doctrine.

## Final Commercial Workflow

The normal Commercial operator path is now:

1. Create or open Commercial Opportunity.
2. Generate Route through the Commercial Route Repository.
3. Save Proposal.
4. Customer accepts the Proposal.
5. Use one visible `Submit to Engineering` action.
6. Commercial locks and Engineering Certification opens from the Engineering Repository package.

The operator no longer has to find separate handoff buttons in the Proposal Dashboard, Commercial Review panel, or right inspector.

## Engineering Handoff Sequence

The canonical handoff action performs:

1. Validate Proposal, Estimate, Workbook, Draft IOF Package, Commercial Revision, Commercial Release Package, and Route Repository readiness.
2. Save the Draft IOF Package before submitting.
3. Submit through `/api/commercial/iof-packages/:packageId/submit-engineering`.
4. Create Engineering Baseline.
5. Create Engineering Package.
6. Verify the Engineering Package reloads from the Engineering Repository.
7. Update Commercial status to `SUBMITTED_TO_ENGINEERING`.
8. Lock Commercial Revision.
9. Select the Engineering Package and open Engineering Certification.

ScopeVersion remains blocked until signed Service Order.

## Lifecycle Ribbon

Added a compact lifecycle ribbon:

`Opportunity -> Commercial Revision -> Commercial Release Package -> Proposal -> Customer Accepted -> Engineering -> Certified IOF -> Service Order -> ScopeVersion`

The ribbon marks completed, current, next, and locked stages. It is status-only and creates no new authority.

## Removed Legacy Actions

Removed or replaced visible legacy action surfaces:

- `Activate Corridor Draft`
- `Lock Site`
- `Save Snapshot`

These are replaced by Generate Route, Commercial Change Sets, and Save Revision.

## Developer Mode Relocations

Moved normal-operator noise behind `commercialDeveloperMode`:

- Repository Browser
- Runtime Diagnostics
- Runtime Performance
- Route Persistence Inspector
- Raw Draft IOF Package JSON preview
- Refresh Proposals
- Reload Twin
- Reload Customer Inventory

## Remaining Operator Actions

Remaining Commercial operator actions include:

- New Opportunity
- Open Opportunity
- Save / Save As Opportunity
- Import Existing Network
- Import Route
- Generate Route
- Route Edit Session actions
- Save Revision / Compare Revision / Restore Original / Discard Revision
- Save Proposal
- Submit to Customer
- Customer comment / evidence / request changes / approve
- Save Draft / Validate Commercial Review
- Submit to Engineering
- Open Engineering Certification after handoff

## Validation Results

Validation script:

`node cip029-commercial-engineering-handoff-validation.mjs`

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
