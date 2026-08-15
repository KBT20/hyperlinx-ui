# CIP-038A Commercial Projection UI Restoration Report

Date: 2026-07-09

## Objective

Restore every Commercial projection panel, layer, diagnostic, and hover payload that existed before the CIP-037 geometry merge.

This sprint preserves CIP-037 Geometry Authority. Projected spans still render by clipping the measured centerline and do not carry independent geometry.

## Restored Commercial Layers

Commercial map layer controls now include:

- Measured Spine
- Projected Spans
- Projected Objects
- Station Graph
- Object Address

Projected Objects, Projected Spans, Station Graph, and Object Address overlays render independently.

## Restored Diagnostics

Commercial now shows:

- Geometry Authority diagnostics
- Commercial Projection Diagnostics
- Commercial Doctrine Diagnostics

Projection Diagnostics include measured centerline, station projection, station graph, projected object manifest, projected object/spans counts, object address counts, object attachments, and linear attachments.

Doctrine Diagnostics remain fully visible with math gates, object type rows, quantity source, route feet, station count, object count, nominal interval, calculated stations, resolved coordinates, placement authority, and projection result.

## Restored Hover Payloads

Commercial projected object and span hover cards include:

- doctrine
- quantity source
- station
- measure
- lifecycle state
- execution sequence
- labor template
- material template
- evidence template
- dependencies
- payment sequence
- close sequence

The selected feature inspector preserves the same payload after click selection.

## Geometry Authority Regression Guard

CIP-038A does not regress CIP-037:

- measured spine remains visible
- projected spans still use `renderSpan(measuredCenterline, span)`
- Geometry Authority diagnostics remain visible
- projected span geometry remains measure-referenced

## Files Modified

- `src/components/workspaces/proposednetwork/ProposedNetworkMapPanel.tsx`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/styles.css`
- `cip037-commercial-projection-surface-validation.mjs`
- `cip037-single-geometry-authority-validation.mjs`
- `cip038a-commercial-projection-ui-restoration-validation.mjs`
- `CIP_037_SINGLE_GEOMETRY_AUTHORITY_REPORT.md`
- `CIP_038A_COMMERCIAL_PROJECTION_UI_RESTORATION_REPORT.md`

## Validation Results

Validation script:

`node cip038a-commercial-projection-ui-restoration-validation.mjs`

Result:

`PASS`

Commercial projection surface validation:

`node cip037-commercial-projection-surface-validation.mjs`

Result:

`PASS`

Geometry Authority regression:

`node cip037-single-geometry-authority-validation.mjs`

Result:

`PASS`

TypeScript:

`npx tsc --noEmit -p tsconfig.json`

Result:

`PASS`

Production build:

`npm run build`

Result:

`PASS`

Diff whitespace:

`git diff --check`

Result:

`PASS`

Note: Git reported existing CRLF normalization warnings in the working copy, but no whitespace errors.
