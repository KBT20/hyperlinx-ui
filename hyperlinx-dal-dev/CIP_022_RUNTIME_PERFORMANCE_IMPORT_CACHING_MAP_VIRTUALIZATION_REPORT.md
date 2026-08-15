# CIP-022 Runtime Performance, Import Caching, Map Virtualization Report

Date: 2026-07-07

## Objective

Improve Commercial Planning runtime performance without changing commercial authority, repository truth, lifecycle behavior, pricing logic, route generation, Engineering, ScopeVersion, Marketplace, Control, Field, or Operational Intelligence.

## Import Caching

Added an in-memory Customer Twin inventory projection cache keyed by:

- `customerTwinId`
- `customerId`
- `inventorySourceId`
- `importHash`
- `routeCount`
- `lastModified`

Commercial Planning now restores a cached Customer Twin projection immediately when available, then refreshes the repository-backed Customer Twin in the background.

## Async Import Execution

KMZ/KML/GeoJSON/CSV parsing now runs through an async wrapper with progress states:

- Importing KMZ
- Parsing
- Normalizing
- Building Geometry Index
- Caching
- Ready

The repository import path remains authoritative. Existing Network imports still commit through the Customer Twin repository.

## Import Deduplication

Added import hash and coordinate hash utilities that deduplicate imported design records by route identity, folder path, placemark name, coordinate hash, and import hash. Duplicate imports reuse cached import identity instead of creating extra parsing work.

## Map Virtualization

Added viewport and zoom-based map rendering helpers:

- Low, medium, and high level-of-detail rendering.
- Viewport clipping for route geometry.
- Geometry simplification before SVG path rendering.
- Station/object label gating by zoom.

The Route Repository geometry is never mutated. Virtualization affects only rendered geometry.

## Incremental Execution

Added explicit workbook recalculation domains and ILA memoization:

- Route calculation
- Estimate calculation
- Workbook display
- ILA planning
- Proposal generation
- Engineering summary

ILA planning now memoizes by estimate, route, route length, geometry signature, and ILA controls.

## Runtime Performance Panel

Commercial Planning diagnostics now include a collapsed Runtime Performance panel showing:

- Initial render timing
- Workspace restore timing
- Inventory import timing
- KMZ parse timing
- Normalization timing
- Geometry build timing
- Workbook recalculation timing
- ILA recalculation timing
- Frame/render counts
- Visible routes, stations, and objects
- Cache entries and import hashes

## Diagnostics

Commercial route repository, route persistence, proposal authority, and performance diagnostics now use debug-gated runtime diagnostics. Frontend diagnostic logging is controlled by `VITE_DEBUG_RUNTIME_DIAGNOSTICS=true` or `DEBUG_RUNTIME_DIAGNOSTICS=true` and throttled to avoid console spam.

## Repository Authority

No Commercial Route Repository authority changed.

Route save, load, verify, and restore still use the canonical runtime API client from `src/api/teralinxRuntime.ts`.

No direct `/api/commercial/routes` callers were added outside the canonical runtime client.

## Files Modified

- `src/api/teralinxRuntime.ts`
- `src/commercial/IlaPlanningEngine.ts`
- `src/commercial/TransparentEstimatingEngine.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx`
- `src/kernel/ProposalAuthorityState.ts`
- `src/repositories/commercialRepositories.ts`
- `src/performance/AsyncCustomerDesignImport.ts`
- `src/performance/InventoryImportCache.ts`
- `src/performance/MapVirtualization.ts`
- `src/performance/RuntimeDiagnostics.ts`
- `src/performance/RuntimePerformanceInstrumentation.ts`
- `src/performance/WorkbookRecalculationDomains.ts`
- `cip022-runtime-performance-validation.mjs`
- `CIP_022_RUNTIME_PERFORMANCE_IMPORT_CACHING_MAP_VIRTUALIZATION_REPORT.md`

## Validation Results

Validation script:

`node cip022-runtime-performance-validation.mjs`

Result:

PASS

TypeScript:

`npx tsc --noEmit -p tsconfig.json`

Result:

PASS

Production build:

`npm run build`

Result:

PASS

Diff whitespace:

`git diff --check`

Result:

PASS

## Confirmation

CIP-022 is performance-only. It does not create ScopeVersion, inventory authority, Marketplace execution, Control work, Field work, or Operational Intelligence behavior.
