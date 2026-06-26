# Design Session Model

A Design Launch Session is a read-only orchestration object.

It contains:

- `launchId`
- `customerId`
- `opportunityId`
- `siteList`
- `networkIntent`
- `protection`
- `primaryProduct`
- `estimatedMileage`
- `estimatedNodeCount`
- `estimatedMetrics`
- `diagnostics`
- `nextWorkspace`

The only supported `nextWorkspace` for Phase 6.9B is:

```text
DESIGN
```

## Status

Supported statuses:

- `READY`
- `BLOCKED`

`READY` means the intake is complete enough to enter the existing Design workspace. It does not mean a design has been generated.

`BLOCKED` means the session is missing required launch inputs.

## Estimated Metrics

Estimated miles, node count, stations, segments, and objects are placeholders only. They support sales discussion and handoff framing. They do not represent geometry, routing, stationing, or inventory truth.
