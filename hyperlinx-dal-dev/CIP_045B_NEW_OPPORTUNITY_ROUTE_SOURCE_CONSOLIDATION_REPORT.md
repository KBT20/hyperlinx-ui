# CIP-045B — New Opportunity Route Source Consolidation

## Outcome

New Opportunity now presents Create / Draw Route, Import Route File, and Existing Route as peer route-source choices. All three feed the existing governed Commercial Route repository and downstream estimate/proposal workflow.

An imported route no longer requires A/Z to exist first. A valid single selected centerline derives endpoint candidates from its original start and end coordinates. Multi-line imports stop at route selection before any endpoint is derived.

## Endpoint authority

Imported endpoint records persist:

- `coordinateSource = IMPORTED_ROUTE`
- source file hash
- source geometry ID
- route revision
- governed geometry hash
- original source endpoint (`START` or `END`)

The user can accept source start as A or reverse the commercial A/Z orientation. Reversal creates an oriented copy for the governed route; it does not mutate the imported source geometry or its original start/end evidence.

Site name, customer site ID, address, city, state, facility type, and notes can be added without changing the imported coordinate.

## Existing architecture and root cause

The governed import path already existed:

`ImportRepository.parseRouteImport` -> asynchronous Customer Design import -> existing Translate parser -> normalized route geometry -> Commercial Route Repository.

That parser currently accepts KMZ, KML, GeoJSON/JSON, and CSV. Shapefile is not exposed because the existing parser only reports it as future-ready. The authoritative downstream path remains Commercial Route Repository -> geometry authority -> constitutional Product Doctrine assembly -> spine/stations/object manifest -> estimate/proposal.

The separation was in the UI and staging logic: New Opportunity exposed only the A/Z configurator, while file import lived in a separate header action and automatically chose the first priceable line. The repair puts all three sources in New Opportunity and adds an explicit multi-line selection gate. No parser or route engine was duplicated.

## Files changed for CIP-045B

- `src/components/workspaces/GoogleRfpWorkspace.tsx`: unified route-source workflow, candidate selection, endpoint comparison/orientation/enrichment, governed save/replacement, and Opportunity/Proposal bindings.
- `src/commercial/CommercialRouteEndpointAuthority.ts`: endpoint derivation, comparison, immutable orientation, and enrichment rules.
- `src/performance/AsyncCustomerDesignImport.ts` and `src/translate/CustomerDesignImport.ts`: asynchronous SHA-256 source identity and parser metadata.
- `src/repositories/commercialRepositories.ts`: backward-compatible route provenance, revision lineage, and endpoint authority fields.
- `src/runtime/ConstitutionalAssemblyScheduler.ts`: includes governed route revision/hash in the existing Product Doctrine cache fingerprint.
- `server/routes/proposal-drafts.js`: immutable Proposal Revision snapshot allowlist retains the route revision/hash and endpoint sites.
- focused and real-browser validators plus this report.

## Existing A/Z behavior

When A/Z are absent, imported candidates populate them automatically. When either endpoint already exists, import retains the entered values and displays `MATCH`, `NEAR`, `MISMATCH`, or `UNRESOLVED`. Imported coordinates replace existing values only after explicit confirmation.

## Revision and proposal binding

Route replacement/reuse creates a new repository identity and revision with a parent repository reference; the source record remains intact. Opportunity and immutable Proposal Revision snapshots retain the route repository ID, route revision, route geometry ID, geometry hash, and A/Z endpoint authority.

The Product Doctrine assembly receives the accepted Commercial Route geometry as `COMMERCIAL_ROUTE_REPOSITORY` authority, including its revision and hash. The existing scheduler and doctrine implementation build the linear spine, stations, objects, quantities, and Engineering manifest; imported geometry does not use a KMZ-specific assembly branch.

## Performance

The source file is parsed and normalized once. Civil mix, material, and markup mutations consume the recalculated draft over persisted normalized geometry. They do not call the import parser or traverse the source file. The real-browser run recorded one request for the KMZ fixture across import plus subsequent calibration, and the final CIP-044A.2 ten-run fixture retained an idle worker after completion with a 0.189 ms median mutation lifecycle.

## Real new-opportunity workflow

Validated locally on 2026-08-13 using a newly created, non-migrated Google opportunity and the actual `MUS 07162024.kmz` fixture:

- the file parsed through the existing KMZ engine and exposed 63 candidate centerlines;
- no A/Z was entered before import;
- selecting `NW` derived A and Z from its two endpoints;
- route preview reported 391 feet / 0.07 miles and a $64,036 temporary estimate;
- source SHA-256 was `14307e9ec50a9fb57e665fd1e6bacbf23adea1f7557ca2defb73446fff2ab284`;
- reversing A/Z changed the governed geometry hash while preserving source start/end and source hash;
- A was enriched as `CIP-045B Imported A Site` without changing its coordinate;
- the saved governed route has revision 1 and geometry hash `rg-1e8e0319`;
- Product Doctrine displayed PASS and the object manifest displayed ASSEMBLED;
- live calibration produced 80% plow / 13% dirt / 1% rock / 6% trench, changed conduit material from $0.65 to $0.66, and changed markup to 22%, with the KMZ request count remaining 1;
- Proposal Revision 1 saved with hash `92f16cb6aa23225d05c0bdd140537815404a90435699f41e9cc67f3ff1fc902d`;
- its persisted snapshot binds route revision 1, route geometry ID, and geometry hash `rg-1e8e0319`.

All artifacts stayed under `server/data` in the local runtime. No deployment or production endpoint was used.

## Scope boundaries

No alternate parser, route repository, geometry engine, estimate engine, Service Order workflow, ScopeVersion workflow, deployment path, or production DAL surface was introduced. The existing KMZ/KML/GeoJSON/CSV import engine remains authoritative. Shapefile remains future-facing and is not represented as operational support.

## Validation

Run:

```powershell
node cip045b-new-opportunity-route-source-consolidation-validation.mjs
```

The focused suite verifies route-source consolidation, single/multi-route endpoint derivation, provenance, orientation immutability, enrichment coordinate safety, existing-A/Z comparison and confirmation, route revision lineage, Product Doctrine/spine inputs, and Proposal Revision bindings. It passed 88/88 checks. TypeScript, production build, CIP-045B, CIP-045A, CIP-045, CIP-044A.2, CIP-044A.3, CIP-036, both CIP-037 suites, CIP-038, and CIP-040 were also run.
