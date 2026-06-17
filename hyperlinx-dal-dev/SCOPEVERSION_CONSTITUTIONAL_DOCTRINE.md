# ScopeVersion Constitutional Doctrine

## Definition

A ScopeVersion is the constitutional truth object for Hyperlinx and IOF. It is the canonical execution truth that defines a network state, candidate extension, field closure result, inventory basis, or as-built result at a bounded point in time.

ScopeVersion truth is deterministic, replayable, and human-governed. Machine outputs, reasoning summaries, and runtime recommendations are non-authoritative until converted into a candidate ScopeVersion and validated by certification or a validated closure event.

## Authoritative Infrastructure Truth

A ScopeVersion is the authoritative representation of infrastructure truth.

A ScopeVersion may originate from:

- Existing Inventory
- Design Synthesis
- Graph Extension
- Field Closure
- As-Built Certification

All infrastructure within IOF is represented as ScopeVersions.

- Inventory creates ScopeVersions.
- Design creates ScopeVersions.
- Closure creates ScopeVersions.
- Maps render ScopeVersions.
- IOF Packages execute ScopeVersions.
- Twin visualizes ScopeVersion lineage.
- Reasoning operates against ScopeVersions.

## Layer Separation

```text
Constitutional Layer
  ScopeVersion

Execution Layer
  IOF Package / Close / Work Package

Runtime Layer
  Prism / Affinity / Twin / Marketplace / Control / Field / AI Reasoning
```

Canonical authority resides only in ScopeVersions.

## Immutability Rules

Certified ScopeVersions are immutable closure artifacts.

After certification:

- A ScopeVersion may be referenced.
- A ScopeVersion may be extended by a child ScopeVersion.
- A ScopeVersion may be superseded by a child ScopeVersion.
- A ScopeVersion may be closed through a validated closure event that creates a child ScopeVersion.
- A ScopeVersion may not be modified in place.
- A ScopeVersion may not be deleted as an authoritative record.

Rejected ScopeVersions are non-authoritative and cannot be promoted in place. Corrected truth must be represented as a child ScopeVersion.

## Parent And Child Lineage

Every ScopeVersion has a lineage relationship:

- `ROOT` begins a constitutional chain.
- `AMENDMENT` changes non-graph truth.
- `GRAPH_EXTENSION` extends inventory graph truth.
- `LATERAL_EXTENSION` adds lateral service geometry.
- `REDESIGN` replaces design assumptions.
- `FIELD_CLOSURE` records validated closure truth.
- `AS_BUILT` records final constructed truth.
- `SUPERSEDES` replaces a prior constitutional record.

Any change to certified truth creates ScopeVersion B. ScopeVersion B references ScopeVersion A through `parentScopeVersionId` and preserves replayability through `rootScopeVersionId`.

## Closure Event Authority

Validated closure events are constitutional inputs. A close does not mutate a certified ScopeVersion. A close authorizes creation of a child ScopeVersion whose `closureEventId` references the validated closure artifact.

This preserves deterministic execution, immutable closure artifacts, and replayable audit history.

## IOF Package Relationship

IOF Packages describe work required to realize, amend, validate, or close a ScopeVersion.

IOF Packages are execution-layer artifacts. They do not replace ScopeVersion truth and cannot independently mutate constitutional truth. If package execution produces validated new truth, that truth is captured by a child ScopeVersion.

## Map Kernel Relationship

Maps render ScopeVersions.

The Map Kernel does not own truth, generate authoritative geometry, or create independent constitutional records. Workspace maps must consume ScopeVersion or IOF Package truth through the shared renderers.

The Map Kernel shall support both Topological Truth and Geographic Truth. Topological Truth describes network relationships. Geographic Truth describes the physical location of those relationships. Human certification of construction geometry requires Geographic Truth.

## Route Generation Authority

A generated route is never authoritative. A route becomes authoritative only after human review and certification. Child ScopeVersions may only be created from certified route geometry.

Generated lateral geometry may support analysis, visualization, and engineering review, but it remains advisory until an engineer records certification name, timestamp, notes, route certification ID, and certified geometry snapshot. Draft routes and rejected routes cannot create child ScopeVersions.

## Certification Authority

Route certification state is owned by the Certification Authority.

No workspace, quote surface, ScopeVersion preview, package gate, or child ScopeVersion creator may independently promote route state to `CERTIFIED_ROUTE`.

`CERTIFIED_ROUTE` requires:

- Current constraint evidence.
- Matching route geometry hash.
- 100% constraint completeness.
- All required reference layers present.
- Certification readiness `READY`.
- No blocking constraints.
- Engineer approval with notes, name, and timestamp.

If constraint evidence is current but incomplete, missing layers, or review-required, the only allowed states are `ENGINEER_REVIEW_REQUIRED` or `PROVISIONALLY_CERTIFIED`. `PROVISIONALLY_CERTIFIED` requires engineer notes and may support child ScopeVersion creation, but it must not be presented as full route certification or package-ready truth.

Quotes generated from incomplete evidence must be labeled as preliminary incomplete-evidence quotes. Package progression remains blocked until the Certification Authority returns `CERTIFIED_ROUTE`.

The authoritative sequence is:

```text
Route Geometry
  -> ConstraintEvidencePackage
  -> CertificationAuthority
  -> Shared CertificationAuthorityStrip
  -> Quote / ScopeVersion Preview / Child ScopeVersion Gate
```

Display rule:

```text
CERTIFIED_ROUTE
  only if CertificationAuthority.state = CERTIFIED_ROUTE

PROVISIONALLY_CERTIFIED
  if current incomplete evidence has explicit engineer notes

ENGINEER_REVIEW_REQUIRED
  for incomplete, unknown, missing, stale, or unapproved evidence
```

## Geographic Reference And Attachment Authority

Network Truth consists of certified ScopeVersions, inventory geometry, stations, nodes, edges, and certified attachment points.

Geographic Reference consists of streets, buildings, parcels, railroads, water features, terrain, and future utility corridors.

Reference layers provide engineering context. Reference layers do not establish network authority, attachment authority, or ScopeVersion authority.

Attachment authority may originate only from certified inventory geometry, certified ScopeVersions, or certified attachment points. It may not originate from street centerlines, building footprints, parcels, railroads, water features, terrain, or other reference layers.

The engineering review sequence is:

```text
Candidate
  -> Geocode Certification
  -> Attachment Authority
  -> Geographic Reference Review
  -> Serviceability
  -> Route Engineering
```

Street snap evidence may support visual engineering review, but it does not create attachment authority. Shortest-path routing, routing graph traversal, geo-diverse routing, and AI route generation remain non-authoritative future capabilities until they anchor to certified attachment authority and produce certifiable geometry.

## Attachment-Aware Routing And Constraint Analysis

Attachment Authority determines route origin.

Constraint Analysis determines constructability.

Reference Layers influence routing decisions but do not establish network truth.

A proposed route must begin from a certified attachment point and must be evaluated against visible geographic reference constraints before human certification.

A route may not be certified unless constraint evidence is visible to the engineer. A `BLOCKED` route cannot be certified. A `REVIEW_REQUIRED` route may be certified only when the engineer records notes explaining why the unresolved constraints are acceptable.

Attachment-aware routes may use direct, dogleg, or reference-assisted geometry until a true road/ROW routing graph exists. These routing modes are engineering aids, not authoritative road-network shortest paths.

## Constructability-Aware Attachment Snapping

Attachment Authority determines where a route may originate.

Constructability-aware snapping determines where a route should originate.

Reference layers and constraint evidence influence attachment selection, but they do not establish network authority, attachment authority, or ScopeVersion authority.

The constructability snap sequence is:

```text
Candidate
  -> Attachment Authority
  -> Candidate Attachment Analysis
  -> Constraint Evidence
  -> Constructability Score
  -> Snap Certification
  -> Route Generation
```

The engine may evaluate nearest station, nearest node, nearest edge, nearest route segment, and certified attachment candidates. It may produce `LOWEST_DISTANCE`, `LOWEST_CONFLICT`, `LOWEST_COST`, and `ENGINEER_PREFERRED` alternatives.

Only `CERTIFIED_SNAP` may be used to generate route geometry. The selected snap evidence, attachment coordinate, candidate alternatives, constructability score, and attachment corridor evidence must be preserved in child ScopeVersion lineage.

## Constraint Evidence Authority

Constraint evidence is a first-class engineering evidence package.

The authoritative sequence is:

```text
Route Geometry
  -> ConstraintAnalysisEngine
  -> ConstraintEvidencePackage
  -> Decision Evidence
  -> Route Engineering
  -> Quote
  -> Route Certification
  -> Child ScopeVersion
```

Only `ConstraintAnalysisEngine` may compute water crossings, road crossings, railroad crossings, parcel crossings, building conflicts, terrain flags, constructability score, certification readiness, unresolved constraints, or route constraint diagnostics.

Decision workspaces, route engineering panels, quote engines, certification snapshots, and ScopeVersion previews may display, pass, persist, or request recalculation from the engine. They may not independently compute executable constraint truth.

Every `ConstraintEvidencePackage` must include:

- Evidence ID
- Route geometry hash
- Route geometry source
- Source ScopeVersion ID
- Generated timestamp
- Generating engine
- Constraint summary
- Constraint list
- Constructability score
- Certification readiness
- Reference layer diagnostics

Route certification must persist the exact `ConstraintEvidencePackage` used for review. Child ScopeVersions inherit that same package. Child ScopeVersions must not recompute constraint evidence during creation.

If current route geometry no longer matches the package route geometry hash, the evidence is stale and cannot support route certification. If two panels display different route hashes, the UI must report route geometry drift rather than reconciling counts silently.

Constraint counts must be traceable to authoritative geometry.

Unknown is preferable to incorrect.

Reference-layer absence must never silently become zero crossings.

Every certified route must carry auditable constraint provenance. If required reference geometry is unavailable, route certification readiness is `UNKNOWN` and child ScopeVersion truth may proceed only when the engineer records explicit incomplete-evidence notes.

## Constraint Geometry Registry

The Constraint Geometry Registry is the canonical record of geographic reference availability.

The registry distinguishes:

- Known constraint
- Known absence
- Unknown because reference geometry is unavailable

The default required registry layers for route certification are:

- Streets
- Water
- Railroads
- Parcels
- Buildings

Terrain is advisory unless explicitly required by a future certification policy.

Every `ConstraintEvidencePackage` must preserve a `constraintRegistrySnapshot` containing:

- Registered reference layers
- Layer status
- Authority
- Certification use
- Feature counts
- Coverage
- Constraint completeness score

If required layers are missing, constraint evidence is incomplete. The UI must display `INCOMPLETE_CONSTRAINT_EVIDENCE`, list missing layers, and require engineer notes before certification may proceed. This does not silently certify known absence; it records that the engineer certified the route with incomplete reference geometry.

Missing reference geometry must never become a zero crossing count. It remains `UNKNOWN` until a usable reference layer is loaded or an engineer explicitly certifies with incomplete evidence notes.

## Render Identity

A rendered object is not identified solely by its object ID.

Render identity is the combination of:

- Source Layer
- ScopeVersion
- Object Type
- Object Identifier
- Render Type

The same station, node, edge, route, attachment, lateral, candidate, or certified geometry may appear in multiple visual contexts. Inventory geometry, child geometry, certified geometry, editable geometry, and IOF Package work overlays are separate render authorities. This guarantees that multiple certified truths may coexist visually without React key collisions, selection drift, or highlight ambiguity.

## Affinity Relationship

Affinity compares ScopeVersions and candidate ScopeVersions. Affinity may rank, explain, or recommend, but its output is bounded synthesis and remains advisory until certification.

## Twin Lineage Relationship

Twin visualizes ScopeVersion lineage, execution state, and replay history. Twin is a runtime lens. It does not mutate constitutional truth.

## AI And Reasoning Authority

Mistral, vLLM, and other AI systems may propose, summarize, classify, or compare. Their outputs are non-authoritative until validated.

AI cannot mutate ScopeVersion truth. AI may propose candidate ScopeVersions. Only validated closure events and certification can make a ScopeVersion authoritative.
