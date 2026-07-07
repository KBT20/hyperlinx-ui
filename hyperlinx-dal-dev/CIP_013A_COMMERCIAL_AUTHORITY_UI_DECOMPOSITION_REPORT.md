# CIP-013A Commercial Authority UI Decomposition Report

Date: 2026-07-06

## Objective

CIP-013A decomposes the Product 1 commercial lifecycle into focused authority workspaces:

Fulfillment Request / Evidence Intake -> Commercial Planning -> Commercial Design -> Engineering Certification -> Proposal Readiness -> Customer Acceptance -> Service Order -> Signature-ready Service Order.

CIP-013A does not create ScopeVersion. ScopeVersion remains the future Order for Execution and belongs to CIP-014 after executed Service Order authority exists.

## Workspace Changes

### Commercial Planning

- Removed the mounted `StationAwareObjectReviewPanel`.
- Removed the mounted `ConstitutionalAssemblyReviewPanel`.
- Retained only lightweight Draft IOF readiness evaluation for the commercial gate.
- Commercial Planning remains focused on customer/opportunity/product, route intake, commercial draft package preparation, proposal actions, customer design library, readiness, and recent activity.
- No Engineering Certification map, station movement tool, engineering object table, dependency validator, or field/execution preview is mounted in Commercial Planning.

### Commercial Design

- Renamed the workspace to `Commercial Design`.
- Kept it commercial-only: doctrine, design inputs, route/proposal handoff actions, and Draft IOF source placeholder.
- Added visible `Create Proposal` and `Create Draft IOF Source` actions without adding Engineering map or execution behavior.
- Discovery, Prism, Site Decision, Candidate Sites, Network Affinity, and Network Preview are not required for Product 1 Proposal -> Service Order readiness.

### Engineering Certification

- Engineering Certification now owns:
  - Constitutional Assembly Review
  - Station-Aware Object Review
  - Engineering Canvas map
  - object selection and station movement
  - constraints, doctrine exceptions, redlines, evidence/dependency/close sequence review
- Added discipline lenses over the same Draft IOF Package:
  - Sales Engineer
  - OSP
  - Fiber
  - Supply Chain
  - Final Engineering
- The lenses are filters over one Draft IOF Package and do not duplicate engineering truth.
- Engineering Certification still mounts exactly one heavy map renderer.

### Proposal Readiness

- Renamed from `Preliminary Proposal` to `Proposal Readiness`.
- Customer Acceptance is explicit.
- Proposal remains a commercial projection and does not mount map/station editing.
- Customer changes loop back to Draft IOF Package revision and Engineering re-certification.

### Service Order

Added a new `ServiceOrderWorkspace` and `/api/service-orders` runtime route.

The Service Order is generated from:

- accepted Proposal
- Customer Acceptance
- Certified Draft IOF Package
- commercial terms placeholder

The Service Order references technical content from the Certified Draft IOF Package through summaries and IDs. It does not recreate engineering objects, does not persist engineering object arrays, and does not create ScopeVersion.

Actions implemented:

- Generate Service Order
- Preview Service Order
- Print Service Order
- Export PDF Placeholder
- Mark Ready for Signature
- Record Signature Placeholder

The signature placeholder intentionally uses `PLACEHOLDER_ONLY_NOT_EXECUTED`, so it is not treated as signed/executed Service Order authority.

## Navigation

Active navigation now follows the CIP-013A authority model:

- Evidence Intake: Translate, Route Intake
- Commercial: Commercial Planning, Commercial Design, Proposal Readiness, Service Order
- Engineering: Engineering Certification
- Constitutional Truth: ScopeVersion
- Execution: Marketplace, Control, Field
- Operations: Twin, Operational Intelligence
- System: Inventory, Inventory Recovery, Graph Viewer, Graph Extensions

Discovery/Decision/preview surfaces are collapsed under `Preview / Future / Advanced`.

## Runtime Diagnostics

Runtime Diagnostics is collapsed by default and only mounts when the disclosure is opened.

## ScopeVersion Boundary

CIP-013A does not add ScopeVersion creation to Commercial Planning, Commercial Design, Proposal Readiness, Service Order, or the Service Order route.

Runtime promotion remains blocked until signed/executed Service Order evidence exists:

- No signed Service Order.
- No ScopeVersion.
- No ScopeVersion.
- No execution.

## Validation

New validation:

```bash
node hyperlinx-dal-dev\cip013a-commercial-authority-validation.mjs
```

Result:

```text
CIP-013A Commercial Authority UI decomposition validation passed.
```

The validation proves:

- Commercial Planning does not import or render Station-Aware Object Review.
- Commercial Planning does not mount Constitutional Assembly Review.
- Commercial Design does not mount Engineering map/station review.
- Engineering Certification owns Constitutional Assembly Review and Station-Aware Object Review.
- Engineering Certification has exactly one heavy map renderer.
- Service Order workspace and route do not call ScopeVersion generation.
- Service Order route requires accepted Proposal, Customer Acceptance, and Certified Draft IOF Package.
- Service Order route marks `noScopeVersionCreation`, `noEngineeringRecreation`, and `noEngineeringObjectsPersisted`.
- Product 1 Service Order path does not depend on Prism, Candidate Sites, Network Affinity, or Site Decision.
- ScopeVersion promotion remains blocked until signed/executed Service Order evidence exists.

## Files Added

- `server/routes/service-orders.js`
- `src/workspaces/ServiceOrderWorkspace.tsx`
- `cip013a-commercial-authority-validation.mjs`
- `CIP_013A_COMMERCIAL_AUTHORITY_UI_DECOMPOSITION_REPORT.md`

## Files Updated

- `server/index.js`
- `server/routes/_shared.js`
- `src/api/teralinxRuntime.ts`
- `src/dal/DALApp.tsx`
- `src/dal/DALNavigation.tsx`
- `src/dal/DALState.tsx`
- `src/identity/teralinxIdentity.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/components/workspaces/DesignWorkspace.tsx`
- `src/components/workspaces/PreliminaryProposalWorkspace.tsx`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `src/styles.css`

## Next CIP Boundary

CIP-014 should handle:

- executed Service Order capture
- Runtime promotion
- ScopeVersion creation
- execution readiness

CIP-013A ends at signature-ready Service Order authority.
