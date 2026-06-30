# Sprint 12.7 - Ingestion Lane Separation

Status: implemented and validated locally
Commit status: no commit created

## Doctrine

StellaOS now treats ingestion as two separate runtime lanes:

1. Existing Inventory
   - Answers: what infrastructure already exists?
   - Creates Runtime Inventory, Runtime Objects, Evidence, Relationships, Validation, History, and Customer Twin source data.
   - Feeds Customer Twin.

2. Customer Design Request
   - Answers: what is the customer asking us to build?
   - Creates Customer Design Import, design intent, candidate ScopeVersion, proposed-network runtime objects, and Customer Design Library entries.
   - Does not create Runtime Inventory and does not feed Customer Twin as operational truth.

Raw files remain evidence. Runtime Objects carry authority. Existing Inventory is the only lane that creates Customer Twin inventory authority.

## Files Changed For 12.7

- `src/runtime/RuntimeObjectModel.ts`
- `src/runtime/UniversalTranslatorFramework.ts`
- `src/scopeversion/scopeVersionUtils.ts`
- `src/types/dal.ts`
- `src/translate/CustomerDesignImport.ts`
- `src/workspaces/TranslateWorkspace.tsx`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/commercial/CommercialMapLayerManager.ts`
- `src/styles.css`

This sprint builds on the prior authenticated runtime and Commercial Planning recovery files already in the working tree.

## Existing Inventory Lane

Commercial Planning now has an explicit Existing Inventory section with:

- Import Existing Network
- Select Existing Inventory through runtime-backed Customer Twin state
- Refresh Inventory / Reload Customer Inventory
- Inventory Authority
- Inventory Status
- Customer Twin summary

Supported import contracts:

- KMZ
- KML
- GeoJSON
- CSV
- Runtime Inventory JSON
- Shapefile future-ready interface

Existing Inventory KMZ/KML/GeoJSON/CSV parsing may reuse the shared parser, but it no longer stages or persists a `CustomerDesignImport`. The runtime commit path is `buildRuntimeCommitFromExistingInventoryImport()`, and committed objects carry:

- `inventoryId`
- `inventoryAuthorityType`
- `sourceType`
- `sourceFilename`
- `customerId`
- `organizationId`
- `workspaceId`
- `ownerUserId`
- `classification`
- `confidence`
- `validationStatus`
- `lifecycleState`
- `evidenceIds`
- `relationshipIds`
- `runtimeObjectIds`

## Customer Design Request Lane

Translate is now labeled as the Customer Design Request lane, with a separate Existing Inventory card that routes existing-network ingestion back to Commercial Planning.

Customer Design Request commits now:

- Stage Customer Design Library records.
- Create or load candidate ScopeVersion records via `createScopeVersionFromCustomerDesignImport()`.
- Commit `DESIGN_REQUEST`, `PROPOSED_ROUTE`, and `PROPOSED_SEGMENT` runtime objects.
- Carry `designImportId`, `customerId`, `sourceType`, `sourceFilename`, `requestedBy`, `organizationId`, `workspaceId`, `designIntent`, `scopeVersionId`, `proposedGeometry`, `evidenceIds`, and `relationshipIds`.
- Do not create Runtime Inventory records.

## Map Layer Separation

The Commercial map layer model now labels distinct lanes:

- Existing Inventory
- Customer Design Request
- Commercial Opportunity
- Engineering Draft
- Accepted Design
- Field Certified
- Operational

Existing Inventory layers remain locked Customer Twin source layers. Customer Design Request layers render as proposed/requested build context and do not visually merge with Existing Inventory.

## Opportunity Modes

Commercial Planning keeps two explicit opportunity modes:

- Extend Existing Network: requires Existing Inventory / Customer Twin and can snap A/Z to existing route, POP, station, or object.
- Create Greenfield Corridor: does not require Existing Inventory; requires A and Z locations and creates an OSRM-backed corridor seed/commercial draft path.

Customer Design Requests can also be selected from the Customer Design Library as proposed-network input.

## Validation

Commands run:

- `npx tsc --noEmit -p tsconfig.json`
- `npm.cmd run build`
- Temporary runtime endpoint validation with isolated `DAL_DATA_ROOT`
- Source scan for `localhost`, `127.0.0.1`, hardcoded ports, and `http://`

Runtime validation results:

- Runtime health returned OK.
- Unauthenticated `/api/runtime/commit` returned `401`.
- Ryan, Fran, and Kyle logged into independent workspaces.
- Existing Inventory KMZ-shaped commit persisted as `sourceWorkspace = CommercialPlanning`.
- Existing Inventory commit created `1` Runtime Inventory.
- Existing Inventory object persisted with lane `EXISTING_INVENTORY`.
- Customer Design Request KMZ-shaped commit persisted as `sourceWorkspace = CustomerDesignRequest`.
- Customer Design Request commit created `0` Runtime Inventories.
- Customer Design Request runtime objects persisted with lane `CUSTOMER_DESIGN_REQUEST`.
- Candidate ScopeVersion `SV-CDR-VALIDATION` persisted.
- Runtime Inventory library count remained `1`, proving the design request did not mutate inventory.
- The app source scan returned no localhost or hardcoded-port references; remaining `http://` strings are KML/XML namespace literals.

Build note:

- Vite build succeeded.
- The existing large-chunk warning remains.

## Remaining Risks

- Browser-level KMZ/KML import interaction was validated by TypeScript/build and endpoint lane persistence, not by a Playwright file-upload run.
- Shapefile remains a future-ready interface requiring conversion to GeoJSON or Runtime Inventory JSON.
- The app still has a large monolithic bundle warning unrelated to the lane separation.
