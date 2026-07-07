# Commercial Repository Architecture

Date: 2026-07-06

## Physical Storage

The Commercial repositories are JSON files on the Express server filesystem under `server/data`. They are not SQLite, browser localStorage, browser sessionStorage, or React-only state.

Shared persistence helpers live in `server/routes/_shared.js`:

- `DATA_ROOT`: `server/data`
- `recordPath(dir, id)`: `${encodeURIComponent(id)}.json`
- `listRecords(dir)`: reads all JSON files from a repository directory
- `loadRecord(dir, id)`: reads one JSON file
- `persistRecord(dir, id, record)`: writes formatted JSON

Repository storage:

| Repository | Physical storage | Format | Browser state role |
| --- | --- | --- | --- |
| Customer Repository | `server/data/accounts/*.json`, `server/data/contacts/*.json` | JSON files | Cached for display only |
| Customer Twin Repository | `server/data/runtime-inventories/*.json`, `server/data/runtime-objects/*.json`, `server/data/runtime-evidence/*.json` | JSON files | Projected into a render graph |
| Opportunity Repository | `server/data/commercial-opportunities/*.json` | JSON files | Cached and hydrated for current workspace |
| Route Repository | `server/data/commercial-routes/*.json` | JSON files | Owns commercial route geometry |
| Proposal Repository | `server/data/proposal-drafts/*.json` | JSON files | Cached for proposal/status display |
| Revision Repository | embedded in `commercial-opportunities/*.json#/revisionHistory` | JSON array inside Opportunity JSON | Append helper only |

## Repository Hierarchy

```text
Customer Repository
  -> Customer Twin Repository
  -> Opportunity Repository
  -> Route Repository
  -> Proposal Repository
  -> Revision Repository
```

Authority rule:

- Customer owns customer identity.
- Customer Twin owns existing network inventory projection.
- Opportunity owns commercial relationship references and commercial snapshot metadata.
- Route Repository owns route geometry, geometry hash, route length, and immutable route evidence.
- Proposal Repository owns Proposal runtime records.
- Revision Repository owns append-only Opportunity revision history.

## API Endpoints

Customer Repository:

- `GET /api/accounts`
- `POST /api/accounts`
- `GET /api/accounts/:accountId`
- `PUT /api/accounts/:accountId`
- `GET /api/accounts/contacts`
- `GET /api/accounts/:accountId/contacts`
- `POST /api/accounts/:accountId/contacts`
- `PUT /api/accounts/:accountId/contacts/:contactId`

Customer Twin Repository:

- `GET /api/runtime/inventories`
- `GET /api/runtime/objects`
- `POST /api/runtime/translation/commit`

Opportunity Repository:

- `GET /api/commercial/opportunities`
- `POST /api/commercial/opportunities`
- `GET /api/commercial/opportunities/:opportunityId`
- `POST /api/commercial/opportunities/:opportunityId/open`
- `POST /api/commercial/opportunities/:opportunityId/clone`
- `POST /api/commercial/opportunities/:opportunityId/archive`
- `POST /api/commercial/opportunities/:opportunityId/share`
- `POST /api/commercial/opportunities/:opportunityId/assign`

Route Repository:

- `GET /api/commercial/routes`
- `POST /api/commercial/routes`
- `GET /api/commercial/routes/:routeRepositoryId`
- `PUT /api/commercial/routes/:routeRepositoryId`

Proposal Repository:

- `GET /api/proposals`
- `POST /api/proposals`
- `GET /api/proposals/:proposalId`
- `POST /api/proposals/:proposalId/open`
- `POST /api/proposals/:proposalId/assign`
- `POST /api/proposals/:proposalId/submit-customer`
- `POST /api/proposals/:proposalId/revision`
- `POST /api/proposals/:proposalId/comment`
- `POST /api/proposals/:proposalId/upload-evidence`
- `POST /api/proposals/:proposalId/request-changes`
- `POST /api/proposals/:proposalId/approve`
- `POST /api/proposals/:proposalId/reject`
- `GET /api/proposals/:proposalId/readiness`

Revision Repository:

- No independent endpoint.
- `RevisionRepository.appendRevision()` appends to `Opportunity.revisionHistory`.

## Actual Persisted Record Schemas

These are observed persisted shapes, not TypeScript interfaces.

Customer record, `server/data/accounts/google.json`:

```json
{
  "accountId": "google",
  "customerId": "customer-google",
  "name": "Google",
  "accountType": "Hyperscaler",
  "status": "Active RFP",
  "salesOwner": "Kyle",
  "contacts": [],
  "contactIds": [],
  "activeOpportunities": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Customer Twin record source, `server/data/runtime-inventories/*.json`:

```json
{
  "inventoryId": "RUNTIME-INVENTORY-CUSTOMER-...",
  "inventoryType": "CUSTOMER",
  "customerId": "google",
  "name": "Google Customer Inventory",
  "objectIds": ["..."],
  "evidenceIds": ["..."],
  "lifecycleState": "ACTIVE",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Opportunity record, `server/data/commercial-opportunities/*.json` after repair:

```json
{
  "opportunityId": "OPP-GOOGLE-DFW-ROUTE-...",
  "accountId": "google",
  "customerId": "customer-google",
  "name": "Google DFW Route",
  "status": "SAVED",
  "routeRepositoryId": "ROUTE-REPO-...",
  "routeRepositoryRef": {
    "routeRepositoryId": "ROUTE-REPO-...",
    "routeSnapshotId": "ROUTE-REPO-...-v1",
    "routeId": "COMMERCIAL-OSRM-...",
    "routeName": "COMMERCIAL-OSRM-...",
    "repositoryType": "COMMERCIAL_ROUTE_REPOSITORY"
  },
  "proposalId": "PROP-GOOGLE-DFW-ROUTE-v1",
  "workbookId": "WORKBOOK-GOOGLE-DFW-ROUTE-v1",
  "estimate": {},
  "commercialWorkbook": {},
  "proposalPreview": {},
  "serviceOrderPreview": {},
  "importedEvidenceReferences": [],
  "revisionHistory": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Route Repository record, `server/data/commercial-routes/*.json`:

```json
{
  "routeRepositoryId": "ROUTE-REPO-...",
  "routeSnapshotId": "ROUTE-REPO-...-v1",
  "routeGeometryId": "ROUTE-REPO-...:geometry:rg-f2b59dd9",
  "geometryHash": "rg-f2b59dd9",
  "opportunityId": "OPP-GOOGLE-DFW-ROUTE-...",
  "accountId": "google",
  "customerId": "customer-google",
  "routeId": "COMMERCIAL-OSRM-...",
  "routeName": "COMMERCIAL-OSRM-...",
  "commercialGeometry": [[-97.318, 32.9756]],
  "convertedRuntimeGeometry": [[-97.318, 32.9756]],
  "simplifiedGeometry": [[-97.318, 32.9756]],
  "renderedGeometryCache": [[-97.318, 32.9756]],
  "routeFeet": 12345,
  "routeMiles": 2.34,
  "importedEvidence": [
    {
      "evidenceId": "EVIDENCE-...-OSRM",
      "type": "GENERATED_ROUTE_AUDIT",
      "source": "OSRM Generate Route",
      "checksum": "rg-f2b59dd9",
      "immutable": true
    }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Proposal record, `server/data/proposal-drafts/*.json`:

```json
{
  "proposalRecordId": "ACCEPTED-PROPOSAL-google-...",
  "proposalId": "ACCEPTED-PROPOSAL-google-...",
  "accountId": "google",
  "customerId": "google",
  "opportunityId": "OPP-GOOGLE-DFW-ROUTE-...",
  "status": "CUSTOMER_APPROVED",
  "approvalState": "APPROVED",
  "attachments": [],
  "historyIds": [],
  "createdAt": "...",
  "updatedAt": "..."
}
```

Revision record, embedded under Opportunity:

```json
{
  "revision": "v1",
  "event": "CREATE",
  "opportunityId": "OPP-GOOGLE-DFW-ROUTE-...",
  "routeRepositoryId": "ROUTE-REPO-...",
  "proposalId": "PROP-GOOGLE-DFW-ROUTE-v1",
  "workbookId": "WORKBOOK-GOOGLE-DFW-ROUTE-v1",
  "createdAt": "...",
  "actor": "..."
}
```

## Save Sequence

Generate Route:

1. `handleGenerateCommercialRoute()`
2. `buildCommercialRouteRequest()`
3. `routeCommercialCorridorWithOsrm(request)`
4. `buildCommercialCorridorDraft(...)`
5. `buildCommercialRouteRepositoryRecord(...)`
6. `RouteRepository.saveRoute(...)`
7. `RouteRepository.loadRoute(...)`
8. `requireRouteSnapshotIntegrity(...)`
9. `setGeneratedRouteRepositorySnapshot(...)`

Save Opportunity:

1. `handleSaveCommercialOpportunity()`
2. `buildCommercialOpportunityRecord(...)`
3. `upsertCommercialOpportunity(record)`
4. `routeSnapshotWithIntegrity(...)`
5. `RouteRepository.saveRoute(...)`
6. `RouteRepository.loadRoute(...)`
7. `validateOpportunityBeforeSave(...)`
8. `opportunityRecordForRepository(...)`
9. `OpportunityRepository.saveOpportunity(...)`
10. `verifySavedOpportunityTransaction(...)`
11. `OpportunityRepository.openOpportunity(...)`
12. `RouteRepository.loadRoute(...)`
13. hash comparison
14. local state commit

The Opportunity write now uses `opportunityRecordForRepository()`, which removes route geometry, embedded route repository snapshot, imported route snapshot, commercial draft geometry, and source file bodies before writing the Opportunity JSON.

## Restore Sequence

Open Opportunity:

1. `handleOpenCommercialOpportunity(opportunityId)`
2. `OpportunityRepository.openOpportunity(opportunityId)`
3. Read `routeRepositoryId` from Opportunity.
4. If missing, call `RouteRepository.listRoutes()` and find the newest route whose `opportunityId` matches.
5. Repair the Opportunity relationship with `OpportunityRepository.saveOpportunity(opportunityRecordForRepository(record))`.
6. `RouteRepository.loadRoute(routeRepositoryId)`
7. `hydrateOpportunityFromRouteRepository(record, routeSnapshot)`
8. `validateOpportunityRestoreRecord(record)`
9. Restore Map.
10. Restore Estimate.
11. Restore Workbook.
12. Restore Proposal.
13. Restore Proposal Preview.
14. Restore Service Order Preview.
15. Restore Attachments or Route Repository generated evidence.

No restore step calls OSRM, rebuilds geometry, regenerates estimates, or falls back to runtime memory.

## Root Cause Analysis

Observed disk evidence:

- `server/data/commercial-routes/ROUTE-REPO-OPP-GOOGLE-DFW-ROUTE-11KT-1783377586858-....json` exists.
- That route has `opportunityId: OPP-GOOGLE-DFW-ROUTE-11KT-1783377586858` and `commercialGeometry` with 653 vertices.
- `server/data/commercial-opportunities/OPP-GOOGLE-DFW-ROUTE-11KT-1783377586858.json` did not contain `routeRepositoryId`, `routeRepositoryRef`, route geometry, route repository snapshot, or evidence references.

Specific answer:

- `routeRepositoryId` was never written into that Opportunity record.
- The Route Repository record was committed.
- The relationship from Opportunity to Route Repository was not committed.
- Open was reading the Opportunity correctly; the Opportunity was missing the relationship.
- Geometry existed in Route Repository, not in Opportunity.
- Geometry should live only in Route Repository.
- Attachment warnings occurred because generated OSRM routes did not always have generated immutable route evidence on older route records.

## Repaired Architecture

Repairs implemented:

- Route Repository server normalizes `geometryHash`, `routeGeometryId`, and `GENERATED_ROUTE_AUDIT` evidence for generated routes.
- Generate Route now commits and reloads Route Repository before workspace route readiness.
- Opportunity save writes only route references, not route geometry ownership data.
- Opportunity open repairs missing `routeRepositoryId` by reading Route Repository records where `route.opportunityId === opportunity.opportunityId`.
- Restore validation accepts Route Repository evidence for generated OSRM routes.
- Runtime / Diagnostics now contains a collapsed Repository Browser showing each repository, storage path, relationships, and stored JSON.

## Dependency Diagram

```text
Account google
  server/data/accounts/google.json
    -> Customer Twin projection
       server/data/runtime-inventories/*.json
       server/data/runtime-objects/*.json
        -> Opportunity
           server/data/commercial-opportunities/OPP-....json
            -> Route Repository
               server/data/commercial-routes/ROUTE-REPO-....json
                -> Proposal
                   server/data/proposal-drafts/*.json
                    -> Revision
                       commercial-opportunities/*.json#/revisionHistory
```

## Persistence Verification

The developer inspector displays:

- Customer ID
- Twin ID
- Opportunity ID
- Route Repository ID
- Geometry Hash
- Proposal ID
- Workbook ID
- Estimate ID
- Revision ID through Repository Browser
- Attachment IDs
- Repository file path
- Created timestamp
- Modified timestamp

Validation command:

```bash
node hyperlinx-dal-dev/cip014e-commercial-repository-architecture-validation.mjs
```

The validation confirms physical storage, APIs, repository hierarchy, no browser storage, route relationship repair, no geometry duplication in Opportunity saves, generated route evidence, repository browser coverage, and actual disk records.
