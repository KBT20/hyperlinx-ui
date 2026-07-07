# CIP-020 Commercial Route Repository Endpoint Authority Report

Date: 2026-07-07

## Objective

Determine the canonical Commercial Route Repository API and repair DAL1 so Commercial Planning persists Route Repository truth without regeneration.

## Canonical Endpoint

The canonical Commercial Route Repository endpoint is:

`/api/commercial/routes`

The Route Repository did not move to `/api/route-repositories` or another path. The UI/DAL client was already calling `/api/commercial/routes`; the server route handler also used `/api/commercial/routes`.

## Express Startup Audit

No Express app.use registration exists in this runtime.

The DAL1 server is implemented with `node:http createServer` and a sequential route-handler array in `server/index.js`.

## Registered API Routes

The server now exposes startup route authority through `/api/routes` and `/health`.

Commercial Route Repository registration is reported as:

- endpoint selected: `/api/commercial/routes`
- endpoint registered: `true`
- repository identifier: `COMMERCIAL_ROUTE_REPOSITORY`
- authority source: `Commercial Route Repository`
- storage: `server/data/commercial-routes/*.json`

Representative registered routes include:

- `/api/proposals`
- `/api/commercial/opportunities`
- `/api/commercial/routes`
- `/api/commercial/iof-packages`
- `/api/engineering/packages`
- `/api/engineering/certification`
- `/api/service-orders`
- `/api/marketplace/quotes`

## Root Cause

`GET /api/commercial/routes` returning `404 Not Found` in DAL1 indicates a server registration/deployment mismatch, not a deprecated UI endpoint.

Local evidence:

- `server/routes/commercial-routes.js` defines `/api/commercial/routes`.
- `server/index.js` imports and calls `handleCommercialRoutes`.
- `src/api/teralinxRuntime.ts` calls `/api/commercial/routes`.

The missing piece was startup authority visibility. `/health` did not list `commercialRoutes`, and there was no route registry endpoint to prove whether the running DAL deployment had mounted the Commercial Route Repository handler.

## Repair

Implemented:

- Explicit Commercial Route Repository endpoint constant.
- Explicit Commercial Route Repository authority metadata.
- Structured diagnostics on authority, list, save, load, and not-found paths.
- `/api/routes` startup registry.
- `/health` registered route map with `commercialRoutes: true`.
- Client-side Commercial Route Repository diagnostics logging.

Deprecated routing was not recreated. The canonical endpoint remains `/api/commercial/routes`.

## Persistence Flow

Commercial route creation now reports:

1. endpoint selected
2. endpoint registered
3. repository identifier
4. persistence result
5. restore result
6. authority source

Save flow remains:

Generate Route
→ Create Route Repository
→ Save `/api/commercial/routes`
→ Reload `/api/commercial/routes/:routeRepositoryId`
→ Save Opportunity reference

## Restore Flow

Restore remains repository-first:

Open Opportunity
→ Resolve `routeRepositoryId`
→ Load `/api/commercial/routes/:routeRepositoryId`
→ Hydrate map and commercial state from persisted Route Repository geometry

No OSRM regeneration is used during restore.

## Validation Results

Validation script:

`node cip020-commercial-route-repository-endpoint-authority-validation.mjs`

Result:

`PASS`

Proof:

- canonical endpoint is `/api/commercial/routes`
- endpoint is registered in startup diagnostics
- route repository record is created
- opportunity references the route repository
- proposal saves without route duplication
- repeated opportunity restores keep exactly one route repository record
- restore path does not call OSRM

Dynamic validation record:

- route repository: `CIP020-1783436476215-ROUTE-REPOSITORY`
- opportunity: `CIP020-1783436476215-OPPORTUNITY`
- proposal: `CIP020-1783436476215-PROPOSAL`
- geometry hash: `rg-bea0a9ba`
- matching Route Repository records after repeated restore: `1`

Additional checks:

`npx tsc --noEmit -p tsconfig.json`

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
