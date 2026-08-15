# CIP-046C — Shared Opportunity Map Resolution-Aware Disclosure

## Outcome

CIP-046C is implemented as a post-projection presentation correction shared by Commercial Planner and Engineering Review. Governed route, geometry, station, object, package, doctrine, certification, and persistence authorities were not changed.

The validated fixture was `ENG-PKG-DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2`. Its governed Commercial Route remained revision `1`, geometry hash `rg-0d302bb0`, route length `795,574 ft`, and endpoints `[-98.43099449671928, 37.25367177953801]` to `[-97.05147205636051, 36.16719168339439]`. The referenced projected-object manifest still contains `433` projected objects and the package station summary still reports `7,957` governed stations.

## Existing behavior and exact cause

The shared projection was not the defect. The density defect occurred after projection:

- Engineering had a workspace-specific zoom predicate inside `MapKernel`; it did not define a reusable Planner/Engineering disclosure contract or independent label policy.
- Planner performed separate feature decisions and rendered Commercial object-address text directly. That address layer combined object identity, station address, and coordinates, bypassing the normal label/collision path.
- Feature presence and label presence were coupled in several rendering paths. The renderer therefore treated projected truth as an instruction to show text.
- Planner's large layer surface exposed projection, repository, lifecycle, and diagnostic layers as normal map controls.

During the first real-browser correction pass, the bypass was reproduced as `24` coordinate-bearing object-address labels at Engineering Overview even while the governed projected population remained unchanged. The final pass renders `0` coordinate labels at that scale.

## Shared presentation contract

`SharedMapDisclosurePolicy` now provides one deterministic contract consumed by both contexts:

`Shared Opportunity Map Projection → COMMERCIAL_PLANNER | ENGINEERING_REVIEW → semantic scale → feature eligibility → label eligibility → density cap → rendered map`

The policy executes after projection. It does not remove or regenerate governed objects.

| Semantic scale | Zoom backing | Routine stations | Routine objects | Label cap | Principal presentation |
|---|---:|---:|---:|---:|---|
| Regional | ≤ 8 | 0 | 0 | 4 | Route, A/Z, significant conditions |
| Route Overview | 9–10 | 0 | 0 | 8 | Route, A/Z, facilities, constraints |
| Engineering Overview | 11–12 | 12 | 24 | 12 | Sparse infrastructure and conditions |
| Engineering Detail | 13–14 | 80 | 160 | 28 | Stations and projected objects, restrained text |
| Close Engineering Detail | ≥ 15 | Full applicable population | Full applicable population | 64 | Active-context detail |

The existing renderer exposes zoom as its deterministic resolution signal, so semantic scales are defined once from that signal rather than by workspace-specific numbers.

### Priority and overrides

- Governed route, A/Z, and conditions are selected before facilities and routine infrastructure.
- Conditions remain eligible when routine objects are suppressed.
- Stable sampling supplies deterministic density protection.
- Selection, active condition, and active object IDs override normal density filtering and receive a selected label.
- Feature visibility and label visibility are separate decisions.
- Routine station labels begin only at Engineering Detail; routine object labels begin only at Close Engineering Detail.
- Coordinate strings, hashes, repository IDs, and authority diagnostics are excluded from normal map text. Inspector and diagnostics retain the technical detail.

## Workspace treatment

Engineering uses the shared post-projection policy directly in `MapKernel`. Its normal controls are now `Route | Conditions | Facilities | Stations | Objects`; the raw layer inventory remains available under collapsed Map diagnostics.

Planner consumes the same semantic levels, feature limits, feature-role decisions, and label decisions in its existing geographic renderer. Normal controls emphasize the opportunity route, constraints, facilities, stations, and objects. Commercial projection/lifecycle layers remain available in collapsed Advanced commercial layers / Map diagnostics. The object-address diagnostic overlay defaults off, is limited to Close Engineering Detail when explicitly enabled, and no longer prints coordinates or station addresses.

Planner and Engineering retain different eligible overlays, but the route/A-Z/density rules are shared.

## Real-browser disclosure evidence

Viewport: `1440 × 900`. The counts below are presentation-surface counts, not new authority counts. Planner's `437` projected-object surface includes its combined existing graph and Commercial IOF projections; the immutable manifest remains `433`. Engineering's `821` object primitives include the existing assembled overlay primitives and likewise do not change the manifest.

| Workspace / scale | Projected features | Projected stations | Projected objects | Rendered features | Rendered stations | Rendered objects | Rendered labels |
|---|---:|---:|---:|---:|---:|---:|---:|
| Engineering / Regional | 825 | 0 | 821 | 5 | 0 | 1 selected | 2 |
| Engineering / Engineering Overview | 825 | 0 | 821 | 29 | 0 | 25 | 2 |
| Engineering / Close Detail | 825 | 0 | 821 | 825 | 0 | 821 | 3 |
| Planner / Regional | 439 | 7,966 | 437 | 2 | 0 | 0 | 2 |
| Planner / Engineering Overview | 439 | 7,966 | 437 | 38 | 12 | 24 | 0 |
| Planner / Close Detail, sampled viewport | 439 | 7,966 | 437 | 2 | 0 | 0 | 0 |

The Close Detail Planner viewport was centered away from the L-shaped corridor after repeated zooming, so its in-viewport count correctly fell to zero routine objects. The full projected counts remained identical across every scale. Panning to corridor geometry exposes the applicable close-detail population without reprojection.

The selected Engineering handhole `HH-001` remained rendered at Regional scale while routine objects were suppressed (`1` selected object versus the normal Regional limit of `0`). Its technical station, coordinate, doctrine, construction, budget, condition, and provenance details remained in the Inspector.

## Interaction and mutation evidence

The browser traversed Regional → Engineering Overview → Close Detail in both workspaces using production wheel handling. The multi-gesture scale traversals completed without network work:

- Engineering: approximately `0.75 s` per multi-step semantic transition in the instrumented harness.
- Planner: approximately `7.4 s` and `9.7 s` for the two multi-step traversals while rendering its much larger `7,966`-station cached surface. These are complete automated traversal times, not single-wheel handler latency.
- Resource-entry deltas during each workspace's pan/zoom sweep: `0` total, `0` repository, `0` assembly/projection/reasoning, `0` mutations.
- Server-data hash changes during each sweep: none.
- Shared Engineering MapKernel browser viewport persistence changes during the sweep: none.

Thus pan/zoom performed presentation work only: no repository read/write, route or geometry rebuild, station/object reconstruction, doctrine/Draft IOF assembly, Engineering projection, Commercial estimate calculation, or reasoning request was triggered.

## Constitutional invariants

The validation hashed the full local `server/data` tree immediately before and after each workspace scale sweep. No persisted file changed. This covers the Commercial Route, Proposal, Draft IOF Package, Engineering Package, Engineering Baseline, Engineering Revision/change set, measured centerline, station/object manifests, certification state, Service Order, and ScopeVersion records.

No new authority or repository was created. No redline or change-impact behavior was added.

## Evidence files

- Machine-readable results: `artifacts/cip046c/shared-map-disclosure-validation.json`
- Engineering screenshots: `engineering-regional-1440x900.png`, `engineering-engineering-overview-1440x900.png`, `engineering-close-engineering-detail-1440x900.png`
- Planner screenshots: `commercial-planner-regional-1440x900.png`, `commercial-planner-engineering-overview-1440x900.png`, `commercial-planner-close-engineering-detail-1440x900.png`
- Re-runnable browser harness: `scripts/cip046c-shared-map-disclosure-validation.mjs`

TypeScript validation and the production Vite build both pass.
