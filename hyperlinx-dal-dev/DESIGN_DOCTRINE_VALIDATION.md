# Design Doctrine Validation

## Long Haul

Input:

- Network Class: `LONG_HAUL`
- Legacy protection: `DIVERSE`

Applied:

- Topology: `LINEAR`
- Protection: `PATH_PROTECTED`
- Doctrine: `DD-LONG-HAUL-V1`

Result:

The route remains a future linear backbone design. No ring, mesh, routing, stationing, or geometry is created.

## Middle Mile

Input:

- Network Class: `MIDDLE_MILE`
- Legacy protection: `LINEAR`

Applied:

- Topology: `LINEAR`
- Protection: `PATH_PROTECTED`
- Doctrine: `DD-MIDDLE-MILE-V1`

Result:

The doctrine emphasizes POP/community aggregation and lateral support.

## Metro

Input:

- Network Class: `METRO`
- Legacy protection: `RING`

Applied:

- Topology: `LINEAR`
- Protection: `RING_PROTECTED`
- Doctrine: `DD-METRO-V1`

Result:

The doctrine supports dense buildings, enterprise sites, carrier hotels, data centers, multiple entrances, and metro boundary awareness.

## Campus

Input:

- Network Class: `CAMPUS`

Applied:

- Topology: `MESH`
- Protection: `MESH_PROTECTED`
- Doctrine: `DD-CAMPUS-V1`

Result:

The doctrine supports short spans, multiple duct systems, multiple entrances, and redundant campus paths.

## MSA Fixture Classification

The MSA classifier is fixture-only. Austin to San Antonio is classified as cross-MSA and recommends `MIDDLE_MILE`.

No live GIS lookup occurs.

## Validation Boundaries

No routing, geometry creation, stationing, ScopeVersion creation, inventory mutation, persistence, API calls, Marketplace execution, Control, Field, Twin, or Operational Intelligence behavior is changed.
