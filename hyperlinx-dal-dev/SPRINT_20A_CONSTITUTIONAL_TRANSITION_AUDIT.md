# SPRINT_20A_CONSTITUTIONAL_TRANSITION_AUDIT

Constitutional Principle CP-020A — Sales to Operations Transition

The Draft IOF Package is the final authoritative artifact of Commercial.

The Certified IOF Package is the first authoritative artifact of Operations.

ScopeVersion derives authority only from the Certified IOF Package.

No workspace downstream of Engineering may derive execution authority directly from Commercial.

## 1. Executive Summary

Sprint 20A establishes the first constitutional transition between Commercial authority and Engineering authority in the IOF lifecycle.

The transition is not a visual handoff, a workspace handoff, or a convenience API handoff. It is an authority handoff. Commercial is responsible for producing a Draft IOF Package that contains the commercial route, doctrine-derived artifacts, route length, initial graph, initial stationing, initial objects, assumptions, and validation state. Engineering is responsible for consuming that package as the constitutional artifact, projecting it into the Engineering Certification Workspace, applying constructability review, maintaining engineering station authority, recording redlines and constraints, and producing the Certified IOF Package.

The Draft IOF Package is now the constitutional artifact delivered from Commercial to Engineering. It is not a ScopeVersion. It must never create a ScopeVersion directly. ScopeVersion authority begins only after Engineering produces a Certified IOF Package and execution authority is explicitly transferred from Engineering Certification to ScopeVersion.

The audit confirms the target architecture:

```text
Commercial Proposal
        ↓
Commercial Draft IOF Package
        ↓
Engineering Certification Workspace
        ↓
Engineering Review
        ↓
Certified IOF Package
        ↓
ScopeVersion
        ↓
Service Order Form
        ↓
Control
        ↓
Marketplace
        ↓
Field
        ↓
Operational Twin
        ↓
Customer Twin
```
The Operational Twin represents Teralinx's certified operational view of the infrastructure.

The Customer Twin is a governed projection of the same certified infrastructure presented through customer roles and permissions.

Both twins derive authority from the same ScopeVersion lineage.

Neither twin establishes engineering truth.

They project certified truth.

The final constitutional recommendation is conditional approval: the Draft IOF Package can become the sole Commercial-origin constitutional predecessor to ScopeVersion only when ScopeVersion is derived from the Certified IOF Package, not from the draft itself.

## 2. Constitutional Findings

| Finding | Status | Constitutional Meaning |
| --- | --- | --- |
| Commercial produces the Draft IOF Package | Verified | Commercial owns proposal conversion into the Draft IOF artifact. |
| Commercial must not produce ScopeVersion | Verified as doctrine; enforcement must remain explicit | Commercial authority ends at Draft IOF Package submission. |
| Draft IOF Package persists canonical route geometry | Verified after Sprint 20A correction | Geometry is now a package artifact, not an Engineering reconstruction. |
| Engineering projects the Draft IOF Package | Verified | Engineering receives and renders Commercial-certified inputs through `EngineeringCertificationProjection`. |
| Engineering Certification does not depend on baseline graph discovery | Verified as architectural requirement | Baseline graphs are optional comparison layers only. |
| Engineering produces Certified IOF Package | Verified | Engineering becomes the authority for certified constructability and execution readiness. |
| ScopeVersion derives from Certified IOF Package | Verified in the Engineering Certification route | ScopeVersion authority is downstream of Engineering certification. |
| Downstream lifecycle gates remain constitutional work | Open | Business approval, legal approval, SOF, Control, Marketplace, Field, and Operational Twin need final authority contracts. |

## 3. Transition Findings

| Transition | Source of Truth | Authority | Lifecycle Owner | Inputs | Outputs | Persistence | Projection | Rendering | Certification Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Commercial Proposal -> Commercial Draft IOF Package | Commercial proposal record and product doctrine | Commercial | Commercial | Proposal, product doctrine, route request, OSRM route, commercial assumptions, pricing, quantities | Draft IOF Package | `iofPackages`, runtime mirror, package history | Commercial package assembly | Commercial review surfaces | Draft, not certified |
| Commercial Draft IOF Package -> Engineering Certification Workspace | Persisted Draft IOF Package | Commercial artifact transferred to Engineering intake | Commercial submits; Engineering receives | Frozen Draft IOF Package | Engineering intake record | Engineering intake persistence and package status update | Engineering loader reads the package | Engineering package queue and map workspace | Submitted to Engineering |
| Engineering Certification Workspace -> Engineering Review | Draft IOF Package projected into Engineering workspace | Engineering | Engineering | Draft package, projection, PD-001 compliance model | Active Engineering review session | Draft package status `UNDER_ENGINEERING_REVIEW` | `EngineeringCertificationProjection` | `MapKernel` in Engineering canvas | Under Engineering review |
| Engineering Review -> Certified IOF Package | Engineering-reviewed Draft IOF Package | Engineering | Engineering | Projected package, checklist, redlines, constraints, unit decisions, doctrine compliance | Certified IOF Package | Certified IOF package store, certificates, runtime mirrors, evidence | Certified package mirrors reviewed engineering state | Certification workspace and certified package views | Certified |
| Certified IOF Package -> ScopeVersion | Certified IOF Package | Execution authority derived from Engineering | Engineering-to-Execution transfer | Certified IOF Package and execution authorization certificate | ScopeVersion | ScopeVersion store, runtime mirror, certification evidence | ScopeVersion projection must use Certified IOF package | Future ScopeVersion consumers | Execution authorized only after certification |
| ScopeVersion -> Service Order Form | ScopeVersion | Business and contractual authority | Business / Legal / Customer approval | Certified scope, pricing, terms, contacts, schedule | Service Order Form | Future SOF persistence contract | SOF derives from immutable ScopeVersion | SOF workspace | Future gate |
| Service Order Form -> Control | Executed SOF and ScopeVersion | Control authority | Operations Control | Executed SOF, ScopeVersion, work controls | Control package / execution controls | Future Control persistence contract | Control projection from ScopeVersion and SOF | Control workspace | Future gate |
| Control -> Marketplace | Control package and ScopeVersion | Fulfillment authority | Marketplace / Procurement | Work packages, materials, labor, vendor scopes | Marketplace packages | Future Marketplace persistence contract | Fulfillment projection | Marketplace workspace | Future gate |
| Marketplace -> Field | Marketplace assignments and Control package | Field execution authority | Field Operations | Assigned work, materials, schedules, safety constraints | Field work packages and completion evidence | Future Field persistence contract | Field projection | Field workspace / mobile surfaces | Future gate |
| Field -> Operational Twin | Field completion evidence and Control state | Operational authority | Operations | As-built evidence, completed work, accepted changes | Operational Twin | Future Operational Twin persistence contract | As-built projection | Operational Twin | Future certified as-built state |

## 4. Projection Findings

The Engineering rendering pipeline must be:

```text
Draft IOF Package
        ↓
EngineeringCertificationProjection
        ↓
MapKernel
        ↓
Engineering Canvas
```

The audited geometry path is:

```text
Commercial route generation
        ↓
packageCenterline
        ↓
Draft IOF Package geometry / centerline / spine
        ↓
routeCoordinatesFromPackage()
        ↓
buildEngineeringCertificationProjection()
        ↓
renderCertificationSpec()
        ↓
MapKernel specs
        ↓
Engineering Certification Canvas
```

Geometry enters the constitutional package in `IOFPackageAssemblyEngine.ts` as `packageCenterline`. The package persists it as:

- `geometry: LineString`
- `geometryCoordinateCount`
- `centerline`
- `centerlineRoute`
- `spine`
- `osrmRoute`

Geometry enters Engineering through `routeCoordinatesFromPackage()` in `EngineeringCertificationProjection.ts`. The projection reads canonical package geometry first and then falls back through known package fields such as centerline, centerline route, OSRM route, spine, route segments, stations, geometry references, and graph-derived coordinates.

Geometry exits Engineering projection through `renderCertificationSpec()`, which emits map primitives for:

- Engineering certification centerline
- Spine
- Graph
- Stations
- Objects
- Constraints

The Engineering workspace passes the projection to the canvas as:

```tsx
<MapKernel specs={[projection.mapSpec]} />
```

### Baseline Graph Dependency

`/api/baseline-graphs` is not a constitutional dependency for Draft IOF review. Baseline graphs may be used as optional comparison or discovery layers, but the Draft IOF Package must render without them. A 404 from baseline graph discovery must not block Engineering Certification rendering.

### Route Length With Zero Geometry

If route length exists but geometry renders zero coordinates, the break is one of two constitutional failures:

1. Commercial persisted route length without persisting package geometry.
2. Engineering failed to deserialize or project the persisted geometry.

Sprint 20A closes the ambiguity by requiring PD-001 geometry to fail when projected geometry is absent. A route length is not sufficient proof of projected geometry.

### PD-001 Doctrine Validation Audit

A PD-001 PASS is constitutional only when the projected Engineering artifact exists. Counts, commercial summaries, route length, or package metadata may support review, but they are not sufficient by themselves.

| PD-001 Item | Current Projection Evidence | Certification Finding | False PASS Risk | Required Rule |
| --- | --- | --- | --- | --- |
| Geometry | `projection.routeCoordinates.length > 1` | Verified | Closed by Sprint 20A | PASS only when projected route coordinates exist. |
| Spine | Draft package `spine` object | Partially verified | A spine object could exist without projected spine coordinates | PASS only when a spine primitive or spine coordinate set is projected. |
| Stations | `projection.stations.length > 0` | Verified with coordinate caveat | Station count could be insufficient if stations lack coordinates | PASS only when projected station artifacts exist with coordinates. |
| Graph | Draft dependency graph node count | Partially verified | Graph nodes could exist without renderable graph geometry | PASS only when graph nodes or edges enter the Engineering projection. |
| Objects | `projection.objects.length > 0` | Verified with coordinate caveat | Object count could include non-renderable metadata-only objects | PASS only when package objects project into Engineering artifacts. |
| Structures | Structure assembly count or draft structure count | Partially verified | Structure count could PASS without projected structure artifacts | PASS only when structures project as objects or structure primitives. |
| Conduit | Conduit feet or conduit object type | Partially verified | Conduit length could PASS without projected conduit artifacts | PASS only when conduit is projected as an Engineering artifact. |
| Route Length | Geometry detail reports projected length | Verified as supporting metric | Route length must not independently PASS geometry | PASS only as a metric attached to projected geometry. |

The prior false PASS condition was:

```text
geometry
0 route coordinates projected
PASS
```

That condition is constitutionally invalid. The deterministic result must be:

```text
Geometry
Coordinates ............ 0
Projected .............. NO
FAIL
Reason: No geometry present in Draft IOF Package.
```

or:

```text
Geometry
Coordinates ............ 1,615
Projected .............. YES
PASS
```

## 5. Authority Findings

### Commercial Authority

Commercial owns:

- Product Doctrine selection and application for commercial package assembly
- Route generation
- Geometry
- Centerline
- Spine
- Initial stations
- Initial graph
- Objects
- Commercial quantities
- Commercial route length
- Commercial assumptions
- Commercial validation state

Commercial must never produce ScopeVersion. Commercial produces only the Draft IOF Package.

When the Draft IOF Package is submitted to Engineering, Commercial revision is locked. That lock is constitutionally important because it prevents Commercial from mutating the artifact after Engineering begins certification.

### Draft IOF Package Authority

The Draft IOF Package must persist:

- Geometry
- Centerline
- Spine
- Stations
- Graph
- Objects
- Constraints
- Route length
- Commercial assumptions
- Product doctrine
- Validation
- Engineering readiness

This package is the constitutional artifact delivered to Engineering.

### Engineering Authority

Engineering shall not regenerate Commercial. Engineering shall:

- Project the Draft IOF Package
- Render the package
- Evaluate constructability
- Apply doctrine
- Record constraints
- Create redlines
- Move objects
- Perform reroutes
- Regenerate stations only after approved reroutes
- Maintain station authority
- Review doctrine compliance
- Produce the Certified IOF Package

Engineering shall not recreate Commercial geometry. If Engineering performs an approved reroute, that reroute becomes an Engineering-authored change with its own stationing and audit history.

### ScopeVersion Authority

ScopeVersion shall derive authority only from the Certified IOF Package. The Certified IOF Package is the immediate constitutional predecessor to ScopeVersion.

The current Engineering Certification route contains a distinct `generateScopeVersion` flow that creates ScopeVersion from a Certified IOF Package and records canonical truth as `SCOPEVERSION_FROM_CERTIFIED_IOF_PACKAGE`. This is the correct authority boundary.

## 5A. Station Authority Doctrine

The certified route spine and stationing form the Engineering Canvas.

All engineering objects derive positional authority from stations located on the certified spine.

Engineering may:

- Move engineering objects to different stations.
- Add engineering objects.
- Remove engineering objects.
- Record constructability constraints.
- Create approved reroutes.
- Regenerate stationing after approved reroutes.

Engineering shall not arbitrarily modify station values.

Moving an object does not move a station.

Changing the certified route geometry regenerates stationing.

Field crews paint the certified engineering canvas by recording work against stations.

The Operational Twin validates completion against certified stations.

Stations remain the permanent reference system throughout the lifecycle.

## 6. Lifecycle Findings

The remaining lifecycle is:

```text
Commercial Proposal
        ↓
Commercial Draft IOF Package
        ↓
Engineering Certification
        ↓
Certified IOF Package
        ↓
ScopeVersion
        ↓
Business Approval
        ↓
Legal Approval
        ↓
Service Order Form
        ↓
Control
        ↓
Marketplace
        ↓
Field
        ↓
Operational Twin
        ↓
Customer Twin
```

ScopeVersion becomes the contractual baseline for every remaining workspace because it is the first artifact after Engineering Certification that combines:

- Certified geometry
- Certified quantities
- Certified constructability posture
- Certified doctrine compliance
- Engineering constraint history
- Execution authorization certificate
- Immutable source linkage to the Certified IOF Package

Business approval may approve commercial terms, but it must not alter certified engineering scope. Legal approval may approve contractual language, but it must not alter certified geometry or quantities without a change process. The Service Order Form must bind to ScopeVersion as the execution baseline. Control, Marketplace, Field, and the Operational Twin must consume ScopeVersion-derived authority rather than Commercial proposal authority.

## 7. Remaining Gaps

The following gaps remain before the transition can be considered fully closed as permanent IOF constitutional doctrine:

| Gap | Constitutional Risk | Required Closure |
| --- | --- | --- |
| Downstream lifecycle contracts are not yet fully formalized | ScopeVersion could become a data object without binding authority into SOF, Control, Marketplace, Field, and Operational Twin | Define persistence schemas and authority gates for each downstream workspace |
| ScopeVersion creation must remain fenced | Any legacy path that creates ScopeVersion from Commercial or draft data would violate the authority model | Enforce Certified IOF Package as the only IOF ScopeVersion source |
| Approved reroute station authority needs an explicit audit invariant | Engineering reroutes could become indistinguishable from Commercial geometry | Record reroute source, approval, regenerated stations, and station authority transfer |
| PD-001 must stay deterministic | False PASS conditions would certify absent artifacts | Require each PASS to prove a projected Engineering artifact exists |
| Baseline graph discovery must remain optional | Optional comparison data could be mistaken for required rendering data | Keep baseline graph failures non-blocking and outside certification readiness |
| Business/legal/SOF gates need immutable references | Contract artifacts could drift from certified scope | Bind approvals and SOF to ScopeVersion id and certified package lineage |

## 8. Required Corrections

The following corrections are required or already established by Sprint 20A to make the constitutional transition reliable:

1. Persist package geometry as a canonical Draft IOF Package artifact.
2. Persist `geometryCoordinateCount`, `centerline`, `centerlineRoute`, `spine`, and route length together.
3. Make PD-001 geometry PASS depend on projected coordinates, not route length alone.
4. Render Engineering Certification from `EngineeringCertificationProjection`, not from baseline graph discovery.
5. Treat `/api/baseline-graphs` as optional comparison discovery only.
6. Keep Commercial submission locking in place after Engineering intake.
7. Prevent Commercial from creating or mutating ScopeVersion.
8. Require ScopeVersion generation to use a Certified IOF Package.
9. Add explicit downstream authority gates for Business Approval, Legal Approval, SOF, Control, Marketplace, Field, and Operational Twin.
10. Add an approved-reroute audit trail that records when Engineering geometry supersedes Commercial geometry.

## 9. Constitutional Recommendation

Can the Draft IOF Package become the sole constitutional predecessor to ScopeVersion?

Yes, conditionally.

The Draft IOF Package can become the sole Commercial-origin constitutional predecessor to ScopeVersion, but it must not be the direct ScopeVersion source. The direct predecessor to ScopeVersion must be the Certified IOF Package.

The constitutional chain should be:

```text
Commercial Draft IOF Package
        ↓
Engineering Certified IOF Package
        ↓
ScopeVersion
```

Under this model, the Draft IOF Package is the only artifact Commercial is allowed to produce for Engineering. Engineering then certifies, modifies, constrains, redlines, reroutes, and station-authorizes the package into a Certified IOF Package. ScopeVersion derives authority only from that Certified IOF Package.

The remaining blockers are:

- Fence all IOF ScopeVersion creation so it can only derive from Certified IOF Package.
- Formalize downstream lifecycle contracts from ScopeVersion through Operational Twin.
- Make approved Engineering reroutes and regenerated stationing auditable authority events.
- Maintain deterministic PD-001 validation so no artifact can PASS unless it exists in the projected Engineering package.

With those blockers closed, Sprint 20A becomes a valid constitutional foundation for ScopeVersion authority and the permanent IOF architecture.

## Constitutional Execution Principle

Commercial proposes.

Engineering certifies.

ScopeVersion governs.

Business and Legal authorize.

The Service Order Form binds.

Control executes.

Marketplace fulfills.

Field paints.

The Operational Twin proves.

The Customer Twin observes.

All operational authority originates from the Certified IOF Package.