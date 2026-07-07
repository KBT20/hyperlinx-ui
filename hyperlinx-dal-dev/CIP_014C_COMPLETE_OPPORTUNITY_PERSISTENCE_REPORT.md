# CIP-014C Complete Opportunity Persistence Report

Date: 2026-07-06

## Scope

CIP-014C makes the Opportunity Repository the restore authority for complete Commercial Planning snapshots and adds a Commercial Route Repository for saved route geometry. This is a persistence and restore stability change only.

No ScopeVersion creation, Engineering handoff behavior, Marketplace, Control, Field, Operational Twin, Operational Intelligence, pricing engine, routing engine, graph engine, or doctrine engine behavior was changed.

## Commercial Route Repository

Implemented a governed route snapshot path at `/api/commercial/routes`.

Each route record preserves:

- route repository id and route snapshot id
- source opportunity, account, customer, product, and route ids
- immutable imported evidence references
- converted runtime geometry
- working commercial geometry
- simplified geometry and rendered geometry cache
- bounding box
- route feet and miles
- A and Z route locations
- commercial draft snapshot
- selected imported route snapshot
- source import snapshot

The repository record carries `authority: COMMERCIAL_ROUTE_REPOSITORY`, `immutableImportedEvidence: true`, `noScopeVersionCreation: true`, and `noInventoryMutation: true`.

## Opportunity Snapshot Authority

Saving an Opportunity now persists the route snapshot first, then writes the Opportunity snapshot with the saved Route Repository reference.

The Opportunity snapshot now captures:

- metadata, ownership, status, revision, workspace, and visibility
- customer snapshot and Customer Twin reference
- product and doctrine version
- route repository reference and embedded route repository snapshot
- commercial geometry and route length
- estimate snapshot
- workbook snapshot
- proposal id and proposal preview snapshot
- Service Order preview snapshot
- commercial overrides
- construction mix snapshot
- risks and notes
- imported evidence references
- attachments and attachment metadata
- complete commercial snapshot marker `CIP-014C`

## Immutable Evidence vs Working Geometry

Imported files remain evidence. Commercial Planning stores imported evidence metadata separately from the working commercial geometry used by Sales and Sales Engineering.

The working geometry can be saved as the Commercial Route Repository snapshot without mutating Customer Twin inventory or creating execution authority.

## Restore Flow

Opening an Opportunity now follows this path:

1. Load Opportunity Repository record.
2. Load Commercial Route Repository record.
3. Hydrate the Opportunity from the saved route repository snapshot.
4. Validate Map, Estimate, Workbook, Proposal, Proposal Preview, Service Order Preview, and Attachments.
5. Restore each component with warnings instead of crashes.
6. Render the workspace only after restore completes.

If the Route Repository cannot be loaded but the Opportunity contains an embedded route repository snapshot, restore continues with a warning.

## No Regeneration on Open

Opening an Opportunity does not rebuild route geometry, doctrine, estimate, workbook, proposal preview, or Service Order preview. The workspace renders persisted snapshots.

If a preview is missing, the UI shows:

- `Proposal Preview not generated. Generate Preview`
- `Service Order Preview not generated. Generate Preview`

Missing previews are restore warnings, not fatal errors.

## Files Changed

- `server/routes/_shared.js`
- `server/routes/commercial-routes.js`
- `server/index.js`
- `src/api/teralinxRuntime.ts`
- `src/repositories/commercialRepositories.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `cip014c-complete-opportunity-persistence-validation.mjs`

## Validation

Run:

```bash
node hyperlinx-dal-dev/cip014c-complete-opportunity-persistence-validation.mjs
npx tsc --noEmit -p hyperlinx-dal-dev/tsconfig.json
npm run build
```

The CIP-014C validation confirms route repository storage, server routing, API client methods, repository contracts, route snapshot construction, save-before-opportunity ordering, route repository restore-before-validation ordering, saved preview rendering, missing-preview warnings, collapsed diagnostics, and no ScopeVersion creation.
