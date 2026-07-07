# CIP-016 Commercial to Engineering Repository Handoff Report

Date: 2026-07-07

## Objective

CIP-016 implements the constitutional handoff from Commercial Planning to Engineering Certification by creating a durable Engineering Repository boundary.

Commercial Planning no longer opens Engineering Certification directly. Commercial creates an immutable, reference-only Engineering Package. Engineering Certification lists and opens Engineering Repository packages, then resolves the referenced Commercial truth from the owning repositories.

## Engineering Repository

New repository storage:

- `server/data/engineering-packages/*.json`
- API route: `/api/engineering/packages`
- Server route: `server/routes/engineering-packages.js`
- Client API: `listEngineeringPackages`, `openEngineeringPackage`, `saveEngineeringPackage`
- Frontend repository facade: `EngineeringRepository`

Each Engineering Package contains references only:

- `engineeringPackageId`
- `opportunityId`
- `customerTwinId`
- `commercialProposalId`
- `commercialWorkbookId`
- `draftIofPackageId`
- `routeRepositoryId`
- `estimateId`
- `productDoctrineId`
- `submittedBy`
- `submittedDate`
- `status`

The package stores no route geometry, pricing workbook, proposal body, estimate body, or Draft IOF payload. Commercial data remains owned by Commercial repositories.

## Submit to Engineering

Commercial submission now performs:

1. Validate the Commercial Draft IOF Package.
2. Persist the locked Draft IOF Package.
3. Build the Engineering Package from references.
4. Validate reference integrity.
5. Persist the Engineering Package.
6. Persist the legacy Engineering Intake mirror for compatibility.
7. Update the Commercial Opportunity status to `SUBMITTED_TO_ENGINEERING`.
8. Return the Engineering Package ID to Commercial Planning.

If Engineering Package persistence fails, the Draft IOF Package write is rolled back.

## Reference Integrity

The Engineering Package save validates:

- Engineering Package ID exists.
- Commercial Opportunity resolves.
- Customer Twin reference exists.
- Draft IOF Package resolves.
- Route Repository resolves and contains geometry.
- Proposal resolves.
- Commercial Workbook reference resolves from the Opportunity or Draft IOF Package source.
- Commercial Estimate reference resolves from the Opportunity or Draft IOF Package source.
- Product Doctrine reference exists.

No route regeneration, estimate regeneration, workbook regeneration, proposal regeneration, or OSRM call occurs during restore.

## Commercial Status

Commercial Planning status changes to:

`SUBMITTED_TO_ENGINEERING`

Commercial remains the owner of:

- Opportunity
- Route Repository
- Proposal
- Workbook
- Estimate
- Draft IOF Package

Commercial UI now reports the Engineering Package ID and stays in Commercial Planning.

## Engineering Restore

Engineering Certification now uses this restore path:

1. List Engineering Repository packages.
2. Select Engineering Package.
3. Resolve Engineering Package references.
4. Restore Draft IOF Package.
5. Restore Route Repository.
6. Restore Workbook reference.
7. Restore Estimate reference.
8. Restore Proposal reference.
9. Begin station planning.

The Engineering landing screen displays:

- Engineering Package
- Customer
- Opportunity
- Draft IOF Package
- Commercial Status
- Submitted Date
- Engineering Status
- Route Length
- Estimated Cost
- Revenue
- Margin
- Engineering Confidence
- Ready for Station Planning

## Engineering Ownership

Engineering owns:

- Station planning status
- Station objects and assignments
- Engineering quantities
- Budget confirmation
- Certification
- Certified IOF Package

Certification updates the Engineering Package to `ENGINEERING_CERTIFIED` and sets `SERVICE_ORDER_READY`.

## No ScopeVersion

CIP-016 does not create ScopeVersion.

The workflow stops at:

Certified IOF Package

Service Order Ready

ScopeVersion remains blocked until:

- Service Order executed
- Customer signature received

## Files Modified

- `server/routes/_shared.js`
- `server/index.js`
- `server/routes/engineering-packages.js`
- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-certification.js`
- `src/api/teralinxRuntime.ts`
- `src/repositories/commercialRepositories.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `cip016-commercial-engineering-handoff-validation.mjs`
- `CIP_016_COMMERCIAL_ENGINEERING_HANDOFF_REPORT.md`

## Validation Results

Validation script:

`node cip016-commercial-engineering-handoff-validation.mjs`

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

Expected checks:

- Engineering Repository storage exists in runtime directory map.
- Express runtime exposes Engineering Package API.
- Engineering Package model contains canonical reference fields.
- Engineering Package validation resolves references without regeneration.
- Commercial submission creates Engineering Package and rolls back failed handoff.
- Commercial UI reports Engineering Package ID and does not open Engineering Certification.
- Engineering Certification queue loads Engineering Repository packages.
- Engineering open resolves references and begins station planning.
- Engineering certification updates Engineering Package to `ENGINEERING_CERTIFIED`.
- No ScopeVersion creation is added to CIP-016 handoff paths.

## Confirmation

Commercial to Engineering handoff now transfers authority through a repository object instead of direct UI activation.

Engineering Certification consumes Commercial truth by reference and begins Engineering work from the Engineering Repository.
