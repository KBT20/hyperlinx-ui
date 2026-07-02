# Sprint 21 - ScopeVersion Authority Report

## Architecture

Sprint 21 creates the constitutional ScopeVersion authority layer immediately after Engineering Certification.

The lifecycle is now:

```text
Commercial Proposal
        ->
Commercial Draft IOF Package
        ->
Engineering Certification
        ->
Certified IOF Package
        ->
ScopeVersion
        ->
Business Approval
        ->
Legal Approval
        ->
Service Order Form
        ->
Control
        ->
Marketplace
        ->
Field
        ->
Operational Twin
```

ScopeVersion is the first immutable operational artifact. It is created only from a Certified IOF Package and becomes the baseline for all downstream workspaces.

## Authority Model

Commercial authority ends at the Draft IOF Package.

Engineering authority ends at the Certified IOF Package.

ScopeVersion authority begins when the Certified IOF Package is promoted through Engineering Certification.

The ScopeVersion records:

- Parent Certified Package ID
- Revision and revision label
- Creation timestamp
- Engineering authority
- Customer, account, opportunity, and product context
- Product doctrine and engineering doctrine snapshots
- Certified geometry
- Certified spine
- Certified stations
- Certified graph
- Certified objects
- Facility inventory
- Construction quantities
- Route length
- Constraint history
- Redline history
- Engineering notes
- Doctrine compliance snapshot
- Validation snapshot
- Digital certification metadata

Commercial cannot create ScopeVersion. The generic ScopeVersion create route rejects Commercial-origin creation and rejects overwrite creation.

## Lifecycle

After ScopeVersion creation:

- The Certified IOF Package is marked as promoted.
- Engineering Certification is locked read-only for that package.
- The source Draft IOF Package records the ScopeVersion ID and read-only promotion state.
- ScopeVersion becomes the operational baseline.
- Downstream workspaces remain pending.

Initial readiness is:

| Workspace | Status |
| --- | --- |
| Engineering | PASS |
| Business | PENDING |
| Legal | PENDING |
| Service Order | PENDING |
| Control | PENDING |
| Marketplace | PENDING |
| Field | PENDING |
| Operational Twin | PENDING |

## Revision Model

Sprint 21 implements immutable revision lineage:

```text
ScopeVersion-0001
        ->
ScopeVersion-0002
        ->
ScopeVersion-0003
```

Each revision carries:

- `parentScopeVersionId`
- `rootScopeVersionId`
- `previousRevision`
- `changeSummary`
- `engineeringReason`
- `approvedBy`
- `approvedTimestamp`

An Engineering Revision must produce a new Certified IOF Package, and that new certified package promotes into a new ScopeVersion. Existing ScopeVersions are never overwritten.

## Workspace

Added the `ScopeVersion` workspace.

The workspace displays:

- ScopeVersion ID
- Status
- Revision
- Customer
- Opportunity
- Product
- Authority
- Certification date
- Engineering summary
- Certified route
- Certified stations
- Certified objects
- Certified quantities
- Engineering notes
- Doctrine compliance snapshot
- Constraint snapshot
- Redline history
- Revision history
- Graph summary
- Route length
- Geometry count
- Spine
- Station count
- Object count
- Facility count
- Validation status

The workspace can promote a Certified IOF Package through the Engineering Certification promotion endpoint. It does not create ScopeVersion from Commercial, Proposal, Product Doctrine, Business, Legal, Control, Marketplace, Field, or Customer workspace data.

## Rendering

ScopeVersion rendering is read-only.

The map projection path is:

```text
ScopeVersion canonical truth
        ->
renderScopeVersion()
        ->
MapKernelRenderSpec
        ->
MapKernel
```

The renderer consumes certified geometry from ScopeVersion canonical truth, including `geographicBasis.routeGeometry`. It does not reroute, regenerate stations, or call baseline graph discovery.

## Validation

Added:

```text
sprint21-scopeversion-authority-validation.mjs
```

Validation asserts:

- Commercial cannot create ScopeVersion.
- Engineering can promote a Certified IOF Package.
- ScopeVersion contains geometry, spine, stations, graph, objects, constraints, route length, doctrine, and validation snapshots.
- ScopeVersion carries digital certification metadata.
- ScopeVersion renders from canonical route geometry without regeneration.
- Engineering becomes read-only after promotion.
- Revision lineage works.
- Initial readiness is Engineering PASS and all downstream lifecycle stages PENDING.

Passed:

```text
node sprint21-scopeversion-authority-validation.mjs
npx tsc --noEmit
npm run build
```

## Remaining Blockers

Sprint 21 intentionally does not implement:

- Business Approval
- Legal Approval
- Service Order Form
- Control execution
- Marketplace fulfillment
- Field execution
- Customer workspace
- Operational Twin proof

Those downstream workspaces must consume ScopeVersion authority without mutating engineering truth.

The next constitutional work is to formalize Business and Legal authorization against immutable ScopeVersion, then bind Service Order Form authority to that approved ScopeVersion.

## Constitutional Principle

Commercial proposes.

Engineering certifies.

ScopeVersion governs.

Business authorizes.

Legal authorizes.

The Service Order Form binds.

Control executes.

Marketplace fulfills.

Field paints.

The Operational Twin proves.

All operational authority originates from ScopeVersion, and ScopeVersion derives its authority exclusively from the Certified IOF Package.
