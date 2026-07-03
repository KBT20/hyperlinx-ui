# SPRINT_24A_PD002A_OBJECT_ADDRESSING_REPORT

## Executive Summary

Sprint 24A creates PD-002A Object Addressing Doctrine.

PD-002A defines how every Draft IOF physical object receives a Station Address or Station Address Range on the Measured Spine. Geometry remains visualization. Station Address is the operational identity of where an object belongs.

No ScopeVersion, Service Order, Marketplace, Control, Field, or Operational Twin workflow was created.

## Constitutional Principle

Stationing is the canonical address system of IOF.

Every physical Spine Object shall possess an address.

Point objects receive one Station Address.

Linear and range objects receive From Station Address and To Station Address.

Constraint and review objects may initially remain `UNASSIGNED` or `PENDING_REVIEW`, but they must be visible, reviewable, and addressable by Engineering before certification.

## Doctrine Files

Added:

- `src/doctrine/pd002/addressing/PD002AObjectAddressingDoctrine.ts`
- `src/doctrine/pd002/addressing/PD002AAddressingContracts.ts`
- `src/doctrine/pd002/addressing/PD002AObjectAddressingEngine.ts`
- `src/doctrine/pd002/addressing/PD002AAddressValidationEngine.ts`
- `src/doctrine/pd002/addressing/PD002AConstraintAddressingEngine.ts`

## Station Address Model

`StationAddress` now represents a station as an addressable authority record:

- station address id
- station id
- station label
- measure feet
- coordinate
- lat/lng
- geometry hash
- authority
- source
- confidence
- address status

The Draft IOF Package persists `stationAddressRegistry`, including station lookup by id and label.

## Object Address Model

`ObjectAddress` now supports:

- `POINT`
- `RANGE`
- `SPINE_WIDE`
- `PACKAGE_LEVEL`
- `UNASSIGNED_REVIEW`

Point objects receive `stationAddress`.

Range objects receive `fromStationAddress`, `toStationAddress`, and `addressRange`.

Package-level authority objects are marked `PACKAGE_LEVEL`, not left missing.

## Audit-Derived Addressing

PD-002A uses the Commercial Audit as the initial object manifest.

Implemented behavior:

- Handholes/manholes are generated as point addresses from audit count and default spacing.
- Splice cases attach to the nearest valid generated handhole/manhole/vault and inherit that parent address.
- ILA objects receive station addresses or remain reviewable when no station exists.
- Plow, bore, open trench, conduit, and fiber quantities receive station address ranges.
- Duct-only products exclude fiber addressing.
- Duct plus dark fiber products include conduit and fiber ranges.

## Constraint And Review Objects

Unknown constraints become visible review objects:

- railroad crossing unknown
- water crossing unknown
- DOT/highway crossing unknown
- utility conflict unknown
- environmental impact unknown
- bridge attachment unknown
- rock percentage unknown
- restoration review unknown

Blocking unknowns fail address validation until Engineering addresses, accepts, or disposes them. Non-blocking pending review objects produce warnings.

## Engineering Address Assignment

Added:

- `assignReviewObjectAddress()`

The function:

- accepts a clicked coordinate or station label
- snaps clicked coordinate to nearest Measured Spine station
- assigns point or range Station Address
- marks the review object `ENGINEERING_ASSIGNED`
- records an immutable Engineering Address Assignment event
- preserves the original unassigned review record
- does not mutate the Commercial Baseline
- can mark `requiresEngineeringDelta`

## Draft IOF Persistence

Draft IOF Package assembly now persists:

- `objectAddressingDoctrine`
- `stationAddressRegistry`
- `objectAddresses`
- `unassignedReviewObjects`
- `addressedReviewObjects`
- `addressValidation`
- `addressAssignmentEvents`
- `addressProjectionSummary`
- `objectAddressingMapLayers`

The Commercial package API now validates that these PD-002A artifacts are present before handoff. It does not require Commercial to resolve Engineering review constraints.

## Map Projection Behavior

Engineering Certification projection now exposes PD-002A map layers:

- Handholes / Manholes
- Vaults
- Splice Cases
- ILAs
- Civil Ranges
- Conduit
- Fiber
- Crossings
- Pending Review Objects
- Addressed Review Objects
- Engineering Deltas

Point objects render at their Station Address coordinate.

Range objects render from From Station Address to To Station Address.

Pending review objects without coordinates are not faked onto the map. They remain visible as pending review records with the label:

```text
UNASSIGNED - needs Engineering address
```

## PD-002 Certification Integration

Engineering compliance now includes `object addressing`.

Certification can fail when:

- required physical object lacks address
- range object lacks from/to address
- range object has invalid measure ordering
- contained object lacks valid parent address
- blocking unknown review object is unaddressed
- address references invalid station

Certification can warn when:

- non-blocking review object remains pending
- constraint is accepted as downstream review
- cost impact is expected to be covered by contingency

## Validation Results

Commands run:

- `npx tsc --noEmit`: PASS
- `node sprint20d-product-configurator-validation.mjs`: PASS, 41 checks
- `node sprint20f-spine-audit-projection-validation.mjs`: PASS, 45 checks
- `node sprint21-kernel-execution-graph-validation.mjs`: PASS, 75 checks
- `node sprint22-constitutional-closure-engine-validation.mjs`: PASS, 104 checks
- `node sprint23-constitutional-assembly-review-validation.mjs`: PASS, 94 checks
- `node sprint24a-pd002a-object-addressing-validation.mjs`: PASS, 83 checks
- `npm run build`: PASS

Build note: Vite reported the existing large chunk warning after a successful build.

## Remaining Gaps Before PD-002B

PD-002A establishes where each object belongs.

PD-002B still needs to certify whether each addressed object is placed correctly according to hierarchy, engineering placement rules, dependency rules, constructability, and certification workflow.

Remaining gaps:

- Object hierarchy certification beyond address inheritance
- Placement-rule doctrine for each object class
- Engineering delta workflow for accepted address changes
- Certification UI for assigning review objects from the map
- Formal PD-002B placement certification report

## Constitutional Result

Every physical object can now answer where it belongs.

Point objects have Station Addresses.

Linear objects have Station Address Ranges.

Package-level objects are explicitly classified.

Pending constraints remain visible and reviewable.

Engineering can assign a pending review object to the Measured Spine without mutating the Commercial Baseline.

PD-002A creates the addressing foundation required before Object Placement Certification.
