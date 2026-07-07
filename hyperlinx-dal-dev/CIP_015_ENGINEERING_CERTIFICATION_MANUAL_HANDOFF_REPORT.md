# CIP-015 Engineering Certification Manual Handoff Report

Date: 2026-07-06

## Objective

CIP-015 moves the approved Commercial Draft IOF Package into Engineering Certification for manual review. Engineering can now generate/assign stations, confirm object budgets, approve the Engineering budget, and certify a Certified IOF Package.

No ScopeVersion is created by this work.

## Workflow Implemented

Draft IOF Package -> Engineering Certification -> Display Package Objects -> Generate/Assign Stations -> Review Object Budget -> Approve Engineering Budget -> Certify IOF Package -> Service Order Ready -> Await Signature -> ScopeVersion Future

## Manual Station Plan

Engineering Certification now generates a basic station plan from the Draft IOF Package route projection:

- `stationPlanId`
- `draftIofPackageId`
- `opportunityId`
- `routeRepositoryId`
- station interval and route length
- station records
- object-to-station assignments
- reviewer and timestamp
- `noScopeVersionCreation: true`

The station plan is certification evidence only. It does not regenerate route geometry and does not create execution authority.

## Engineering Budget Review

Engineering Certification now displays object-level budget rows derived from the Draft IOF Package objects. Each row can be manually confirmed and assigned an Engineering-approved budget.

Certification is blocked until:

- station plan exists
- every object budget is confirmed
- Engineering budget is approved

The approved budget is persisted as `engineeringApprovedObjectBudget` and `engineeringApprovedBudgetTotal`.

## Certified IOF Package Record

The Certified IOF Package now references:

- Draft IOF Package ID
- Opportunity ID
- Route Repository ID
- Proposal ID
- Commercial estimate reference
- Engineering-approved object budget
- Station Plan ID and station plan
- Engineering reviewer
- Certification timestamp
- Certification revision
- Certification hash

The record also carries:

- `serviceOrderStatus: "SERVICE_ORDER_READY"`
- `signatureStatus: "AWAITING_CUSTOMER_SIGNATURE"`
- `scopeVersionStatus: "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER"`
- `scopeVersionFuture: true`
- `noScopeVersionCreation: true`

## Restore Behavior

Engineering Certification now lists and opens persisted Certified IOF Packages from `/api/engineering/certification/certified-packages`.

The restore panel displays the certified package ID, revision, hash, reviewer, timestamp, Service Order readiness, signature state, and ScopeVersion block.

## ScopeVersion Boundary

Certification remains an Engineering authority action only.

ScopeVersion promotion remains isolated to the existing Runtime authority endpoint:

`POST /api/engineering/certification/certified-packages/:certifiedPackageId/generate-scopeversion`

That route is still guarded by `scopeversion.authority` and expects signed Service Order / customer acceptance evidence. CIP-015 does not call it.

## Files Modified

- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/api/teralinxRuntime.ts`
- `server/routes/engineering-certification.js`
- `src/styles.css`
- `cip015-engineering-certification-manual-handoff-validation.mjs`
- `CIP_015_ENGINEERING_CERTIFICATION_MANUAL_HANDOFF_REPORT.md`

## Validation Results

Passed:

- `node hyperlinx-dal-dev\cip015-engineering-certification-manual-handoff-validation.mjs`
- `npx tsc --noEmit -p hyperlinx-dal-dev\tsconfig.json`
- `npm run build`

Build completed with Vite's existing large chunk warning.

## Confirmation

Commercial Draft IOF Package remains the single technical source before certification.

Certified IOF Package is Engineering-certified truth and Service Order-ready.

ScopeVersion remains future until customer signature / contract execution.
