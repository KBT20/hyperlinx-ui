# CIP-017 Kernel Constitutionalization Report

Date: 2026-07-07

## Objective

CIP-017 stops feature work and audits duplicate business authority.

The constitutional direction is:

Operator Intent -> Kernel action -> Repository transaction -> Decision trace -> Repository event -> Lens refresh

React workspaces are lenses. They may render state, raise operator intent, display decisions, and hold short-lived render caches. React workspaces must not own lifecycle authority.

This sprint does not build Marketplace, Control, Field, ScopeVersion, Future Inventory, or new Engineering functionality.

## Repository Authority Map

Proposal Repository is the sole proposal authority.

- Physical owner: `server/data/proposal-drafts`
- API owner: `server/routes/proposal-drafts.js`
- Canonical state: `status`, canonical approved value `COMMERCIAL_APPROVED`
- Canonical transitions today: save proposal, submit to customer, approve proposal, request changes, reject, create Draft IOF source
- React consumers: Commercial Proposal Dashboard, Proposal Preview, Commercial Workbook, Customer Review, Service Order Preview

Route Repository is the sole route geometry authority.

- Physical owner: `server/data/commercial-routes`
- API owner: `server/routes/commercial-routes.js`
- Canonical fields: `routeRepositoryId`, `routeGeometryId`, `geometryHash`, `commercialGeometry`
- React consumers: Commercial map, estimate sidebar, workbook route summary, Draft IOF Package reference, Engineering Package reference
- React caches allowed: `commercialRouteResult`, `commercialCorridorDraft`, `temporaryImportedRoute`, map render geometry

Engineering Repository is the sole engineering package authority.

- Physical owner: `server/data/engineering-packages`
- API owner: `server/routes/engineering-packages.js`
- Canonical fields: `engineeringPackageId`, `draftIOFPackageId`, `routeRepositoryId`, `proposalId`, `commercialWorkbookId`, `estimateId`, `engineeringStatus`
- React consumers: Commercial handoff card and Engineering Certification landing screen
- Engineering Certification must load by `EngineeringPackageId` only.

Commercial Opportunity Repository is the commercial container authority.

- Physical owner: `server/data/commercial-opportunities`
- API owner: `server/routes/commercial-opportunities.js`
- Canonical role: opportunity identity, customer/opportunity references, route repository reference, workbook/proposal/estimate references
- It must not own route geometry.

Draft IOF Package repository is the commercial package authority before Engineering submission.

- Physical owner: `server/data/iof-packages`
- API owner: `server/routes/commercial-iof-packages.js` and Engineering Certification read endpoints
- Canonical role: certified Commercial design package projection from Proposal Repository and Route Repository references
- It must not become a second Proposal Repository.

## Lifecycle State Machine Inventory

| State term | Canonical owner | Duplicate aliases found | Current disposition |
| --- | --- | --- | --- |
| `repositoryStatus` | Proposal Repository for proposals | dashboard status, customer review display | Safe display alias only |
| `approvalState` | Proposal Repository compatibility field | customer review state, accepted projection state | Keep temporarily for backward compatibility; remove from gating later |
| `customerReviewState` | Derived from Proposal Repository status | local `customerReviewStatus`, live session status | Display-only until removed |
| `commercialStatus` | Repository/kernel output per object | Engineering Package commercial status, dashboard status | Display-only outside owning repo |
| `engineeringStatus` | Engineering Repository / Engineering Certification | draft package status, projection status | Display-only in Commercial |
| `proposalStatus` | Proposal Repository status | dashboard status label | Display-only |
| `reviewState` | Domain-specific review engines | customer review status | Display-only unless inside owning kernel |
| `readiness` | Owning kernel/repository per transition | proposal readiness, engineering readiness, route readiness | Must become kernel result, not React gate |
| `lifecycleState` | Owning repository for each object | many workspace labels | Display-only in React |
| `nextAction` / `nextLifecycleAction` | Owning kernel recommendation | dashboard action buttons | Display-only until action kernel exists |

## Duplicate Proposal Authority Inventory

Canonical owner:

- Proposal Repository.

Places that write proposal state today:

- `server/routes/proposal-drafts.js`: canonical save, submit customer, approve, request changes, reject, archive, withdraw, create Draft IOF package.
- `src/components/workspaces/GoogleRfpWorkspace.tsx`: `handleSaveRuntimeProposal` raises save intent to Proposal Repository.
- `src/components/workspaces/GoogleRfpWorkspace.tsx`: `handleAcceptProposal` still writes an accepted-proposal projection and then updates the active Proposal Repository record.

Duplicate authority found:

- Accepted Proposal projection still exists for legacy rendering and Service Order preview.
- Local `customerReviewStatus` and `LiveCommercialSession.customerReviewStatus` still mirror Proposal Repository status.
- Proposal Preview and Commercial Workbook still render snapshots that can look authoritative.
- Customer Review card still exposes an `Accept Proposal` action that writes through a legacy projection path.

Cleanup guidance:

- Keep `Accept Proposal` only as a temporary compatibility operator intent.
- Move customer acceptance into ProposalKernel so it calls `POST /api/proposals/:proposalId/approve`.
- Remove accepted-proposal projection as an authority source after Service Order uses Proposal Repository references only.
- Dashboard engineering eligibility must continue to require Proposal Repository status `COMMERCIAL_APPROVED`.

## Duplicate Route Authority Inventory

Canonical owner:

- Route Repository.

Geometry storage and serialization locations found:

- `server/routes/commercial-routes.js`: canonical `commercialGeometry`, `geometryHash`, `routeGeometryId`.
- `src/components/workspaces/GoogleRfpWorkspace.tsx`: `commercialRouteResult` render/runtime route result.
- `src/components/workspaces/GoogleRfpWorkspace.tsx`: `commercialCorridorDraft` estimate and render cache.
- `src/components/workspaces/GoogleRfpWorkspace.tsx`: `temporaryImportedRoute` unsaved render state.
- `src/components/workspaces/GoogleRfpWorkspace.tsx`: `routeRepositorySnapshot` restore cache.
- `src/components/workspaces/GoogleRfpWorkspace.tsx`: `routeGeometry` is stripped before Opportunity Repository writes by `opportunityRecordForRepository`.
- `server/routes/engineering-certification.js`: Draft IOF assembly can still project geometry from proposal records for compatibility.
- `server/scopeversion-authority-engine.js` and `server/routes/scopeversions.js`: future execution geometry validation.

Safe aliases:

- React map geometry may exist only as render cache.
- `temporaryImportedRoute` may exist only before Save Imported Route.
- `routeRepositorySnapshot` may exist only as a restored cache, not Opportunity persistence authority.

Fields to remove later:

- Opportunity embedded `routeGeometry`.
- Proposal embedded geometry arrays.
- Draft IOF embedded route geometry where references can fully resolve.

## Duplicate Engineering Handoff Authority Inventory

Canonical owner:

- Engineering Repository.

Current safe flow:

- Commercial Planning validates references.
- Commercial Planning submits Draft IOF Package ID.
- `server/routes/engineering-packages.js` builds a reference-only Engineering Package.
- Engineering Certification restores by Engineering Package ID.

Cleanup completed in CIP-017:

- Removed visible direct `Enter Engineering Mode` buttons from Commercial Planning.
- Removed visible `Open In Engineering` action for imported routes.
- Removed direct `activateRouteEngineeringFromCommercialDraft` usage from `GoogleRfpWorkspace`.

Remaining aliases:

- Shared UI state may carry `submittedEngineeringPackageId`.
- Engineering Certification still renders resolved package data, but it must continue to load the package from Engineering Repository.

## Duplicate UI Action Inventory

Constitutional Commercial actions for the current platform:

- Save Proposal
- Submit to Customer
- Approve / Customer Accepted
- Create Draft IOF Package
- Submit to Engineering
- Open Engineering Certification after submission

Display-only actions:

- Customer Review view switch
- Repository Browser diagnostics
- Estimate/workbook section toggles
- Map layer toggles

Debug only:

- Repository Browser
- Route Persistence Inspector
- Restore logs

Legacy/remove:

- Enter Engineering Mode - removed from visible Commercial Planning surfaces in this sprint.
- Open In Engineering from imported route - removed from visible Commercial Planning surfaces in this sprint.
- Accepted Proposal projection as authority - keep temporarily, then replace with ProposalKernel approval action.

Future hidden:

- Marketplace adapter actions
- Control adapter actions
- Field adapter actions
- ScopeVersion creation before signed Service Order

## Duplicate Hydration Logic Inventory

Commercial Dashboard:

- Today: hydrates Proposal Repository record plus local accepted-proposal/session display state.
- Target: ProposalKernel restores status and next action; React renders the result.

Proposal Summary:

- Today: renders from active proposal runtime object and snapshot projections.
- Target: Proposal Repository restore response becomes the only authoritative summary source.

Workbook:

- Today: renders workbook snapshots and route/estimate projections.
- Target: CommercialPackageKernel resolves workbook references from Opportunity, Proposal, Estimate, and Route Repository.

Proposal Preview:

- Today: can render stored preview payloads or active proposal data.
- Target: ProposalKernel returns preview-ready projection from Proposal Repository.

Service Order Preview:

- Today: can consume accepted-proposal projection and certified package references.
- Target: ServiceOrderKernel reads Proposal Repository, Certified IOF Package, and Service Order Repository only.

Route/Map:

- Today: renders Route Repository geometry plus temporary/imported/generated route caches.
- Target: RouteKernel owns save/replace/discard; map renders Route Repository records or temporary pre-save state only.

Engineering Certification:

- Today: loads Engineering Package and resolves references; legacy Draft IOF package pathways still exist.
- Target: EngineeringCertificationKernel consumes Engineering Repository package IDs only.

## API Authority Cleanup Plan

Proposal endpoints:

- `POST /api/proposals` remains Proposal Repository save transaction.
- `POST /api/proposals/:proposalId/submit-customer` should become `ProposalKernel.submitToCustomer`.
- `POST /api/proposals/:proposalId/approve` already emits a decision trace from CIP-016F and should become `ProposalKernel.approve`.
- `POST /api/proposals/:proposalId/create-draft-iof-package` should become `CommercialPackageKernel.createDraftIofPackage`.

Route endpoints:

- `POST /api/commercial/routes` remains Route Repository save transaction.
- Add a future `RouteKernel.saveImportedRoute` action so React no longer performs route repository construction.

Draft IOF endpoints:

- `POST /api/commercial/iof-packages` remains package persistence.
- Future `CommercialPackageKernel` should own package creation from Proposal and Route Repository references.

Engineering Package endpoints:

- `POST /api/engineering/packages` remains Engineering Repository transaction.
- Existing reference-only serializer and transaction log should become `EngineeringHandoffKernel.submit`.

Engineering Certification endpoints:

- Keep Engineering-owned certification endpoints.
- Do not let Commercial call Engineering Certification with full objects.

ScopeVersion endpoints:

- Future `ScopeVersionKernel` only after signed Service Order.
- No ScopeVersion creation belongs in Commercial Planning, Proposal approval, or Engineering Package handoff.

## Kernel Authority Map

### ProposalKernel

- Repository owned: Proposal Repository
- Actions owned: save, submit customer, approve, reject, request changes, expose Draft IOF source readiness
- State machine owned: commercial draft -> customer review -> commercial approved -> Draft IOF eligible
- React lenses: Commercial Dashboard, Customer Review, Proposal Preview, Service Order Preview

### RouteKernel

- Repository owned: Route Repository
- Actions owned: generate route, save imported route, replace imported route, discard temporary route, verify geometry hash
- State machine owned: temporary route -> persisted route -> route reference ready
- React lenses: Map, route sidebar, estimate sidebar, workbook route section

### CommercialPackageKernel

- Repository owned: Draft IOF Package / Commercial package records
- Actions owned: create Draft IOF Package, validate package references, expose package for engineering submission
- State machine owned: proposal approved -> Draft IOF Package ready -> submitted to Engineering
- React lenses: Draft IOF Package panel, workbook, proposal progress

### EngineeringHandoffKernel

- Repository owned: Engineering Repository
- Actions owned: submit to Engineering, reference-only serializer, repository verification, Commercial status update
- State machine owned: not submitted -> `ENGINEERING_PENDING`
- React lenses: Commercial handoff card, Engineering Certification package browser

### EngineeringCertificationKernel

- Repository owned: Engineering Certification records, future Station Plan Repository, future Certified IOF Package Repository
- Actions owned: station planning, object placement, budget confirmation, certify IOF package
- State machine owned: pending -> station planning -> budget approved -> engineering certified
- React lenses: Engineering Certification workspace

### ScopeVersionKernel Future

- Repository owned: ScopeVersion Repository
- Actions owned: create ScopeVersion after executed Service Order only
- State machine owned: signed Service Order -> Order for Execution
- React lenses: ScopeVersion workspace, Marketplace, Control, Field

### InventoryKernel Future

- Repository owned: Future Inventory Manifest and Governed Inventory
- Actions owned: create inventory manifest after certification and execution authorization
- State machine owned: planned inventory -> governed inventory
- React lenses: Inventory, Operational Twin, Operational Intelligence

## Decision Trace Standard

Every lifecycle transition should emit:

- `action`
- `actor`
- `currentState`
- `requestedTransition`
- `prerequisites`
- `ruleResults`
- `decision`
- `denialReason`
- `repositoryWrites`
- `resultingState`
- `traceId`
- `timestamp`

Current coverage:

- Proposal approval emits `[ProposalApprovalDecisionTrace]` with ALLOW / DENY and structured 403 body.
- Engineering handoff emits `[EngineeringTransaction]` transaction steps for reference-only persistence.

Next cleanup:

- Normalize Engineering handoff transaction logs into the same `DecisionTrace` envelope while preserving the detailed transaction steps.
- Add decision traces for Submit to Customer and Create Draft IOF Package.

## Recommended Next Cleanup Sequence

1. Create `ProposalKernel` as a server-side module and move Proposal approval and submit-customer transition rules there.
2. Replace `handleAcceptProposal` in React with an operator intent that calls ProposalKernel approval only.
3. Remove Accepted Proposal projection from Commercial Dashboard gating.
4. Create `RouteKernel` server-side helpers for save imported route, replace imported route, and discard temporary route.
5. Remove Opportunity embedded geometry compatibility after all restore paths prove Route Repository references resolve.
6. Create `CommercialPackageKernel` for Draft IOF Package creation from references.
7. Wrap Engineering Package submission in `EngineeringHandoffKernel` with the decision trace standard.
8. Keep ScopeVersion blocked until signed Service Order.
9. Keep inventory creation blocked until Future Inventory Manifest sprint.

## Files Modified In CIP-017

- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `cip017-kernel-constitutionalization-validation.mjs`
- `CIP_017_KERNEL_CONSTITUTIONALIZATION_REPORT.md`

## Validation Results

Validation script:

`node cip017-kernel-constitutionalization-validation.mjs`

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
