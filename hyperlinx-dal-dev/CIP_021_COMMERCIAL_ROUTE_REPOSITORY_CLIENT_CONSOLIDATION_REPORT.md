# CIP-021 Commercial Route Repository Client Consolidation Report

Date: 2026-07-07

## Objective

Eliminate duplicate Commercial Route Repository client implementations and ensure save, load, restore, verify, and list all traverse the same canonical runtime API client.

## Endpoint Occurrence Audit

Canonical endpoint:

`/api/commercial/routes`

Production endpoint literal ownership is now limited to:

- `src/api/teralinxRuntime.ts`
- `server/routes/commercial-routes.js`

No production `fetch('/api/commercial/routes...')` calls exist outside the canonical runtime client. Commercial Planning uses `RouteRepository`, which delegates to `src/api/teralinxRuntime.ts`.

Historical validation scripts and reports may still mention the endpoint as audit evidence, but they are not runtime clients.

## Canonical Runtime Client

The canonical client is:

`src/api/teralinxRuntime.ts`

All Commercial Route Repository operations now call:

`commercialRouteRepositoryRequest(...)`

Covered methods:

- `listCommercialRoutes`
- `loadCommercialRoute`
- `saveCommercialRoute`
- `verifyCommercialRoute`

The repository wrapper delegates to those methods:

- `RouteRepository.listRoutes`
- `RouteRepository.loadRoute`
- `RouteRepository.saveRoute`
- `RouteRepository.verifyRoute`

## Client Diagnostics

Every Commercial Route Repository request now emits:

- `clientMethod`
- `endpointUsed`
- `endpointSelected`
- `repositoryIdentifier`
- `persistenceResult`
- `restoreResult`
- `authoritySource`

The client sends:

- `X-Teralinx-Route-Client-Method`
- `X-Teralinx-Route-Endpoint`

The server echoes those values in `routeRepositoryDiagnostics`.

## Save, Verify, Restore

Generate Route:

`RouteRepository.saveRoute`
→ `saveCommercialRoute`
→ `commercialRouteRepositoryRequest`
→ `/api/commercial/routes`

Immediate verify:

`RouteRepository.verifyRoute`
→ `verifyCommercialRoute`
→ `commercialRouteRepositoryRequest`
→ `/api/commercial/routes/:routeRepositoryId`

Restore:

`RouteRepository.loadRoute`
→ `loadCommercialRoute`
→ `commercialRouteRepositoryRequest`
→ `/api/commercial/routes/:routeRepositoryId`

List:

`RouteRepository.listRoutes`
→ `listCommercialRoutes`
→ `commercialRouteRepositoryRequest`
→ `/api/commercial/routes`

## Proposal Authority

Proposal authority snapshot evaluation was moved from React render scope into:

`src/kernel/ProposalAuthorityState.ts`

Commercial Planning now consumes:

- `evaluateProposalAuthorityState`
- `proposalRepositoryReportsCommercialApproved`
- `proposalCustomerReviewStateFromRepository`
- `logProposalAuthorityStateHydration`

This keeps proposal authority evaluation in the state/kernel layer while the UI subscribes to the evaluated state.

## Validation Results

Validation script:

`node cip021-commercial-route-client-consolidation-validation.mjs`

Result:

`PASS`

Proof:

- no direct Route Repository endpoint fetch calls outside the runtime client
- runtime client has one route repository request helper
- list/load/save/verify all use the helper
- Commercial Planning uses `RouteRepository`
- save and verify diagnostics identify the initiating client method
- restore does not regenerate OSRM
- repeated restore leaves exactly one Route Repository record

Dynamic validation record:

- route repository: `CIP021-1783442299304-ROUTE-REPOSITORY`
- opportunity: `CIP021-1783442299304-OPPORTUNITY`
- geometry hash: `rg-bea0a9ba`
- matching Route Repository records after repeated restore: `1`

Additional checks:

`npx tsc --noEmit`

Result:

`PASS`

`npm run build`

Result:

`PASS`

`git diff --check`

Result:

`PASS`

Git reported CRLF normalization warnings only. No whitespace errors were reported.
