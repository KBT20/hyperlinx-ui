# CIP-046A — Engineering Workspace Sanitization + Shared Opportunity Map Adoption

## Result

The Engineering Certification workspace is now canvas-first and organized for human visual review. This change only reorganizes presentation and introduces a response-only shared map projection boundary. Engineering engines, Commercial engines, repositories, persistence, projections, constitutional gates, certification handlers, Service Order behavior, ScopeVersion behavior, and human authority remain unchanged.

The validated package was:

- Engineering Package: `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Draft IOF Package: `DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`
- Viewport: `1375 × 780`

## Shared Opportunity Map authority trace

### Commercial

`Opportunity` → `routeRepositorySnapshot / generatedRouteRepositorySnapshot` → `sharedOpportunityMapProjectionFromRouteRepository` → governed route coordinates + A/Z endpoints + revision/orientation/geometry identity → `commercialOpportunityOverlay` → existing `ProposedNetworkMapPanel`

### Engineering

`Engineering Package open` → `resolveEngineeringPackageReferences` → `Commercial Route Repository` → response-only `sharedOpportunityMapProjection` → `sharedOpportunityMapProjectionFromDraft` → `renderSharedOpportunityMapProjection` → existing `MapKernel`

Engineering overlays are still projected from the existing Engineering Package. Route primitives from the Engineering overlay spec are removed before rendering, so Engineering cannot display a fallback route reconstructed from package fields when the governed Commercial Route Repository projection is missing. A missing governed projection is shown as a blocker instead.

The shared projection carries:

- `routeRepositoryId`
- `routeRevision`
- `routeGeometryId`
- `geometryHash`
- Commercial A→Z orientation
- governed route coordinates
- governed A/Z endpoint coordinates and coordinate-source metadata
- `COMMERCIAL_ROUTE_REPOSITORY` authority
- response-only / no-persistence / no-regeneration flags

No new route repository, geometry authority, route engine, or persisted snapshot was introduced.

## Sanitized screen hierarchy

1. Compact Engineering Review header
   - package, opportunity/customer context, governed route, route length, status, readiness, package switcher
2. Visible certification blocker strip
3. Primary workspace
   - Review Navigator
   - Opportunity Map
   - contextual Inspector
4. Progressive workflow sections
   - Conditions
   - Stations
   - Quantities
   - Budget
   - Final Review
5. Collapsed `Diagnostics / Package Integrity`
6. Persistent decision footer
   - blockers
   - Commercial revision reason
   - Request Commercial Revision
   - Certify IOF Package

## Existing functions preserved

The workspace reuses the existing handlers for:

- opening Station Review
- adding an Engineering constraint
- moving an Engineering object by station authority
- recording an Engineering route redline
- recording a doctrine exception
- quantity reconciliation
- object-budget confirmation and Engineering budget approval
- requesting a Commercial revision
- certifying the Draft IOF Package
- restoring a Certified IOF Package
- focusing a constitutional spine object

No map interaction invokes these handlers. Pan, zoom, selection, map-detail controls, and discipline lenses are presentation state only.

## Progressive disclosure

The Engineering MapKernel now has an opt-in `engineeringReview` presentation profile:

- route overview: governed route, endpoints, constraints, and major facilities
- intermediate view: facilities and major stations
- detailed view: all projected Engineering objects and stations
- selected feature: retained at every zoom level

The projection and underlying counts are not changed by disclosure. Render filtering happens after the existing cached map projection is produced.

## Diagnostics disposition

The following are preserved under one collapsed `Diagnostics / Package Integrity` surface:

- Engineering repository/readiness validation
- geometry authority diagnostics
- doctrine projection diagnostics
- full object/spine catalog
- constitutional assembly review
- baseline and revision hashes
- Engineering Change Set state and patch counts
- projection timing
- shared map authority
- reasoning status
- pointer to the existing global runtime/cache diagnostics

Blocking failures remain visible in the primary blocker strip and Final Review even while diagnostics are collapsed.

## Validation evidence

### Automated

- `npm.cmd run typecheck` — PASS
- `npm.cmd run build` — PASS
- live browser visual validation — PASS
- governed route ID before/after zoom and lens change — unchanged
- discipline lens changed to OSP — presentation state only
- Diagnostics remained collapsed — PASS
- Engineering mutation requests during map/lens interaction — `0`
- navigator, canvas, inspector, footer present — PASS
- body height after sanitization — `3,997 px`

The earlier audit measured the same package’s debug-oriented body at `11,970 px`, with the Engineering Canvas beginning near `y=5,634`. The sanitized canvas now starts in the first working viewport.

Artifacts:

- [After screenshot, 1375×780](artifacts/cip046a/engineering-workspace-after-1375x780.png)
- [Live visual validation data](artifacts/cip046a/visual-validation.json)

## Acceptance status

| Requirement | Status | Evidence |
| --- | --- | --- |
| Engineering opens into visual review | PASS | Opportunity Map is the primary workspace after the compact package header |
| Map is dominant | PASS | Three-column Navigator / Map / Inspector layout |
| Commercial and Engineering use the governed route | PASS | Shared Route Repository projection boundary |
| A/Z, revision, orientation, geometry identity retained | PASS | Shared projection contract and route metadata |
| No Engineering route reconstruction fallback | PASS | Route primitives removed from Engineering overlay; missing shared route blocks map |
| Progressive disclosure | PASS | Opt-in zoom-based Engineering review presentation profile |
| Selected item retained | PASS | Selected feature bypasses disclosure filtering |
| Contextual inspector | PASS | Route, station, object, and constraint selection states; quantity/budget/final are navigator contexts |
| Diagnostics collapsed | PASS | Single native collapsed details surface |
| Blocking failures visible | PASS | Persistent blocker strip, Final Review, and decision footer |
| Existing actions preserved | PASS | Existing handlers reused without authority changes |
| Map interactions do not write | PASS | Zero mutation endpoint calls during live pan/zoom/lens validation |
| Certification gates unchanged | PASS | Existing `manualCertificationReady` and certification handler retained |
| No deploy | PASS | Local workspace only |

## Contracts reported without redesign

1. `GET /api/engineering/certification/draft-packages/:id` currently performs pre-existing intake/status persistence while opening a package. CIP-046A did not change that behavior. Map pan, zoom, selection, and lens changes do not call this endpoint or write state.
2. Commercial and Engineering intentionally retain different renderers because Commercial’s existing map has sales/import/edit overlays that Engineering must not inherit. The shared boundary is the governed Opportunity Map projection, not a replacement renderer.
3. Discipline lenses have no existing discipline-specific projection/filter authority. They therefore remain explicitly labeled view context and do not suppress governed data or change certification logic.
4. Distinct station, object, facility, constraint, compliance, and quantity counts were preserved. They were not forced to reconcile because they represent different projections.
5. A literal pre-change screenshot was not captured before the live Vite surface hot-reloaded. The before-state evidence is the recorded viewport audit (panel positions, 11,970 px body height, and canvas y-position); the after-state has a captured 1375×780 image. No synthetic “before” image was created.
