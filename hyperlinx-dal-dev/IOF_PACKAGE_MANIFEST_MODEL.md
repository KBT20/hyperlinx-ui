# IOF Package Manifest Model

Status: Sprint 13.5 Runtime Model

The IOF Package Manifest is the reviewable spine of a Draft IOF Package.

It exists so Engineering can inspect what Commercial handed over without copying proposal, inventory, design, evidence, or geometry data into a private workspace artifact.

## Manifest Policy

- `duplicationPolicy`: `REFERENCE_ONLY_RUNTIME_OBJECTS`
- `noDuplicateObjects`: `true`
- Every entry carries runtime references.
- Every entry has authority and lifecycle metadata.
- The manifest is regenerated from the package model when the package is opened or saved.

## Manifest Sections

- Objects
- Relationships
- Inventory
- Geometry
- Stations
- Structures
- Dependencies
- Evidence
- Documents
- Commercial Assumptions
- Customer Requests
- Engineering Requirements

## Entry Shape

Each manifest entry includes:

- `manifestEntryId`
- `entryType`
- `objectId`
- `objectType`
- `label`
- `runtimeObjectIds`
- `source`
- `authority`
- `lifecycle`
- `duplicated`
- `metadata`

## Assembly Graph

The package also exposes a graph:

`Proposal -> Runtime Objects -> Relationships -> Units -> Evidence -> Geometry -> Draft IOF Package`

The graph is used for review, not execution. It lets Engineering verify lineage before certification.

