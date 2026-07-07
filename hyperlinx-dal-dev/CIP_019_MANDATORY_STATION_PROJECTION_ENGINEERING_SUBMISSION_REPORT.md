# CIP-019 Mandatory Station Projection at Engineering Submission Report

Date: 2026-07-07

## Objective

Implement PD-002 Station Projection Doctrine so a Draft IOF Package is measured, stationed, projected, and persisted before Engineering Certification begins.

## Submission Transaction

Commercial submission now restores the Draft IOF Package and Route Repository, generates a measured centerline, creates a deterministic station graph, assigns Station Authority IDs, projects IOF objects onto station authority, persists station-indexed manifests on the Draft IOF Package, then creates the reference-only Engineering Package.

If station projection fails, submission aborts before Engineering Package creation and before Proposal state is updated to `ENGINEERING_SUBMITTED`.

## Engineering Package References

The Engineering Package remains reference-only and now carries:

- `engineeringPackageId`
- `draftIOFPackageId`
- `routeRepositoryId`
- `measuredCenterlineId`
- `stationGraphId`
- `stationAuthorityIds`
- `stationObjectManifestId`
- `projectedObjectManifestId`
- `proposalId`
- `estimateId`
- `workbookId`
- `customerId`
- `opportunityId`

It does not embed route geometry, station graph bodies, object manifests, proposal bodies, workbook bodies, or Draft IOF Package bodies.

## Engineering Certification UI

Engineering Certification now presents Station Review as the primary workflow. Stationing is restored from repository-backed projection artifacts. Manual station generation is no longer the primary operator action.

Readiness panel keys use composite keys so repeated readiness categories do not trigger duplicate React key warnings.

Reasoning remains advisory and displays:

`Reasoning OFFLINE. Using deterministic doctrine.`

## Object Movement

Engineering object moves now update station authority fields and recalculate projected coordinates from the target station. Object collections, station object attachments, and projected manifests are patched together.

## ScopeVersion

No ScopeVersion creation was added. ScopeVersion remains blocked until executed Service Order authority exists.

## Google DFW Route 12 Repository Result

Validation upgraded the existing Google DFW Route 12 submitted package in place:

- Draft IOF Package: `DRAFT-IOF-ACCEPTED-PROPOSAL-google-1783379652948`
- Engineering Package: `ENG-PKG-DRAFT-IOF-ACCEPTED-PROPOSAL-google-1783379652948`
- Route Repository: `ROUTE-REPO-OPP-GOOGLE-DFW-ROUTE-12-1783379466306-COMMERCIAL-OSRM-GOOGLE-INDEPENDENT-GRAPH-96-99780-32-74590-96-94890-32-81400`

The Draft IOF Package now persists the measured centerline, station graph, station authority, station object manifest, projected object manifest, and projection summary before Engineering Certification opens.

## Files Modified

- `server/routes/commercial-iof-packages.js`
- `server/routes/engineering-packages.js`
- `server/routes/engineering-certification.js`
- `src/api/teralinxRuntime.ts`
- `src/workspaces/EngineeringCertificationWorkspace.tsx`
- `PD_002_STATION_PROJECTION_DOCTRINE.md`
- `cip019-mandatory-station-projection-validation.mjs`
- `CIP_019_MANDATORY_STATION_PROJECTION_ENGINEERING_SUBMISSION_REPORT.md`

## Validation

Validation script:

`node cip019-mandatory-station-projection-validation.mjs`

Result:

`PASS`

Google DFW Route 12 validation result:

- stations: 9
- projected objects: 3
- measured route length: 39,125 feet
- Engineering Package payload: reference-only, 3.5 KB after reference integrity
- ScopeVersion: not created

Additional validation:

`npx tsc --noEmit -p tsconfig.json`

Result:

`PASS`

`npm run build`

Result:

`PASS`

`git diff --check`

Result:

`PASS`

Git reported existing LF to CRLF normalization warnings, but no whitespace errors.
