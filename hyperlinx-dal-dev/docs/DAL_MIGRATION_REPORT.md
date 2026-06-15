# DAL Migration Report

Date: 2026-06-14

## Summary

Implemented a DAL-only platform migration pass inside `hyperlinx-dal-dev/`. Root production UI and root server files were not modified.

## What Was Migrated

- DAL navigation now includes Translate, Inventory Graphs, Graph Viewer, Design, Prism, Marketplace, Control, Field, Twin, and Operational Intelligence.
- Translate flow now parses CSV, KML, KMZ, and GeoJSON into DAL `InventoryGraph`.
- Inventory Graphs can list, load full graph payloads, delete local fallback records, open Graph Viewer, and send graph context to Prism.
- Graph Viewer renders graph routes/stations/edges/nodes with viewport filtering and sampling.
- Prism creates Opportunity Seeds from selected inventory graph proximity.
- Marketplace creates deterministic DAL v1 quotes.
- Control creates and updates work items.
- Field creates station/segment closure events.
- Twin visualizes state without mutating graph data.
- Operational Intelligence summarizes DAL readiness.

## What Was Rewritten

- Data models were rewritten as DAL-only types in `src/types/dal.ts`.
- API access was rewritten as `src/api/dalClient.ts`.
- ScopeVersion utilities were rewritten as DAL-safe v1 helpers in `src/scopeversion/scopeVersionUtils.ts`.
- Graph rendering was rewritten as a DAL-local canvas component in `src/components/GraphMap.tsx`.
- Production Design/Prism/Marketplace/Control/Field/Twin code was not imported.

## What Remains Placeholder

- Design remains a DAL placeholder workspace.
- DAL ScopeVersion canonical truth is v1 and not production IOF parity.
- Graph Viewer is a canvas v1, not a production-grade map/tile renderer.
- Operational Intelligence is a lightweight summary layer.
- Pricing formulas are deterministic development formulas, not production pricing.

## Local Fallback Only

`src/api/dalClient.ts` uses localStorage fallback if DAL endpoints are unavailable. This is temporary and marked by console warnings:

```text
DAL LOCAL FALLBACK ACTIVE
```

Fallback collections:

- `hyperlinx-dal-dev.inventoryGraphs`
- `hyperlinx-dal-dev.scopeVersions`
- `hyperlinx-dal-dev.opportunities`
- `hyperlinx-dal-dev.quotes`
- `hyperlinx-dal-dev.workItems`
- `hyperlinx-dal-dev.closures`

## APIs Needed Next

- `GET /api/inventory-graphs`
- `POST /api/inventory-graphs`
- `GET /api/inventory-graphs/:inventoryId`
- `POST /api/scopeversions`
- `GET /api/scopeversions`
- `GET /api/scopeversions/:scopeVersionId`
- `POST /api/prism/opportunities`
- `GET /api/prism/opportunities`
- `POST /api/marketplace/quotes`
- `GET /api/marketplace/quotes`
- `POST /api/control/work-items`
- `GET /api/control/work-items`
- `POST /api/field/closures`
- `GET /api/field/closures`
- `GET /api/twin/state`

## Ready For DAL1 Deployment

- DAL app shell and navigation.
- DAL Translate v1.
- Inventory Graph fallback flow.
- Graph Viewer v1.
- Prism/Marketplace/Control/Field/Twin/Operational Intelligence v1 workspaces.
- DAL build output: `dist-dal`.

## Should Not Be Promoted To Chicago Yet

- Local fallback persistence.
- DAL ScopeVersion v1 canonical truth.
- Deterministic Marketplace quote formulas.
- Canvas Graph Viewer as production rendering replacement.
- DAL work item and closure schemas until backend contracts are finalized.

## Verification

- `npm install`: passed.
- `npx tsc --noEmit -p tsconfig.json`: passed.
- `npm run build`: passed.
- Source scan found no root `src/` imports in DAL.
- Source scan found no `CHICAGO_API` imports in DAL.
- Source scan found no `IOF_API` imports in DAL.
- Source scan found no root `server` imports in DAL.
- Production import scan found no root production imports of DAL workspace code.

## Safety Confirmation

- Root production code modified: no.
- Chicago API references added: no.
- DAL isolation preserved: yes.
- Build passed: yes.
- Typecheck passed: yes.

