# CIP-054 / CIP-055 — Spine-Driven Map Kernel Implementation Report

## Outcome

The shared geographic map now resolves a bounded read-side response projection from the existing governed route spine. It no longer sends the complete station/object population into the visible SVG tree at every scale. The existing Esri/OSM tile provider, constitutional sources, repositories, certification rules, and persistence remain unchanged.

The same implementation also supplies the CIP-055 navigation contract: governed station lookup, station-range navigation, normalized selection, lens-aware disclosure, compact layer controls, map summaries, and collapsed integrity diagnostics.

## Read-side architecture

```text
Governed ScopeVersion / IOF render spec
  -> existing MapRenderer authority projection
  -> governed-spine selection
  -> cumulative spine/station index
  -> canonical attachment index
  -> settled viewport + resolution + lens + selection
  -> bounded response projection
  -> display-only geometry simplification
  -> MapKernel SVG assembly
  -> summary / selection / diagnostics
```

`SpineSpatialIndex` is an in-memory read index. Attachments retain references to existing primitives and canonical identifiers; the index does not copy authority, create a repository, or write data. A bounded 32-entry response cache is keyed by route/revision, viewport, resolution, lens, selected identifiers, and enabled layers.

## Resolution policy

| Resolution | Presentation |
|---|---|
| REGIONAL | Simplified governed spine, endpoints, material conditions, and facilities; no station population |
| CORRIDOR | Corridor geometry and selected high-level indexed context |
| SEGMENT | Viewport stations, objects, conditions, and sparse labels |
| LOCAL | Exact visible spine and local attachments |
| OBJECT | Exact selected-object context and nearby governed attachments |

Viewport culling occurs before visible primitive construction. Simplification changes display geometry only; stationing and attachment lookup continue to use the full governed spine.

## Navigation and shared UX

- Added `Go to Station` for a single station or range, including inputs such as `4320+00 - 4385+00`.
- Added shared zoom, Fit Route, and Fit Selection controls.
- Added normalized route/station/object/facility/condition selection with canonical ID, route, station, coordinate, source authority, and lens.
- Added compact Infrastructure, Context, and Project layer groups. Controls disclose when closer resolution is required.
- Added route, viewport, and selection map summaries.
- Moved timings, source integrity, layer state, and Render Authority evidence into collapsed `Diagnostics / Package Integrity`.
- Added Commercial, Engineering, Customer, Marketplace, Control, Field, Twin, Prism, and Operational Intelligence lens/context contracts. Customer disclosure remains restricted by the existing map policy.

Shared read-only consumers adopted in this change include Engineering, Marketplace, Twin/ScopeVersion, Control, Field, Inventory Recovery, station-aware review, and Prism. Specialized route-authoring/serviceability maps retain their existing interaction surfaces; they were not forced through a read-only projection that would remove editing behavior.

## Certified Route cleanup

The ScopeVersion Certified Route surface is now map-first with compact Route, Infrastructure, Conditions, and History tabs. Raw quantities, doctrine, redline, revision, and graph payloads remain available under Technical Details rather than occupying the normal route-review workflow.

## Render Authority failure

The reproduced 3SWR failure contained 41 apparent duplicate render-authority groups even though duplicate render keys were zero. The cause was identity normalization: for an `Object`, `stationId` was selected before `objectId`. Multiple legitimate governed objects attached at the same station were therefore audited as competing representations of one object.

The repair resolves identity according to feature kind (`objectId` for Object, `stationId` for Station, and equivalent own IDs for Route, Node, and Edge). Parent station/route identifiers remain lineage only. Exact repeated persisted object aliases are defensively normalized first-wins in the renderer, preserving its previous deterministic visible result. The read-projection cache contract was versioned so a stale pre-repair audit cannot be reused.

Final result: `Render Authority: PASS`, duplicate keys `0`, duplicate render authorities `0`.

## Existing-record compatibility

The 3SWR record contains legacy `stationFeet` metadata whose values exceed the 150.68-mile governed route. The read index treats only out-of-route values as legacy display metadata and derives their station from the governed coordinate/spine. No persisted record is migrated or rewritten.

## Measured 3SWR acceptance

Dataset: 150.68 miles, 7,957 stations, 433 governed objects, including 19 facilities.

| Sample | Resolution | Visible features | Stations | Routine objects | Projection |
|---|---:|---:|---:|---:|---:|
| Fit Route | REGIONAL | 20 | 0 | 0 | 2.5 ms |
| Corridor | CORRIDOR | 20 | 0 | 0 | 5.9 ms |
| Segment | SEGMENT | 795 | 753 | 40 | 5.8 ms |
| Local | LOCAL | 133 | 124 | 8 | 3.1 ms |
| Station range | LOCAL | 159 | 149 | 9 | 2.7 ms |

Representative stage contributions:

- Regional: spine 0.1 ms, station lookup 0.5 ms, attachment lookup 0.2 ms, assembly 1.2 ms, primitive creation 0.1 ms.
- Local: spine 0.1 ms, station lookup 0.0 ms, attachment lookup 0.2 ms, assembly 2.3 ms, primitive creation 0.1 ms.
- Station range: attachment lookup 0.2 ms, assembly 2.1 ms, primitive creation 0.1 ms.

All measured response projections were below 6 ms in the final acceptance run, comfortably inside the 100 ms envelope and the preferred 50 ms target. The existing provider was retained because the measured bottleneck was response assembly/disclosure, not base-map rendering.

## Regression evidence

The browser acceptance confirms:

- all 7,957 stations and all 433 governed objects remain addressable;
- regional mode does not render the full station or object populations;
- progressive disclosure, station-range navigation, and selection summaries work;
- no repository, assembly/reasoning, or mutation request occurs during navigation;
- no file under `server/data` changed;
- Render Authority passes at every tested resolution.

Validation artifacts:

- `artifacts/cip054/spine-map-kernel-validation.json`
- `scripts/cip054-spine-map-kernel-validation.mjs`

Commands passed:

```text
npm.cmd run typecheck
npm.cmd run build
node scripts\cip054-spine-map-kernel-validation.mjs
```

The production build retains its pre-existing large-chunk advisory; it does not fail the build.
