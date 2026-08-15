# CIP-056 — Governed Object × Place × Time × Discipline Map Interaction Model

## Status

Architecture and current-state audit only. This CIP defines a normalization boundary; it does not modify MapKernel, discipline engines, repositories, persistence, transition rules, or user interfaces.

## Governing doctrine

> **The Hyperlinx Map is a governed spatial-temporal interaction lens through which an authorized discipline may inspect, define, and take permitted action upon a governed object at a place and time. Map presentation does not create object authority, spatial authority, temporal authority, or action authority.**

The Map is not a GIS database and is not a source of truth. It projects existing governed evidence and gives a discipline a spatial interaction surface. An action originating from a map selection becomes governed only after the owning discipline and its server-side authority validate and record it through the appropriate IOF, closure, lifecycle, certification, or other constitutional path.

## Constitutional interaction equation

```text
Governed Object
      ×
Place
      ×
Time / State
      ×
Discipline
      ×
Actor Authority
      ↓
Permitted Projection
      ↓
Permitted Actions
      ↓
Governed Action
      ↓
State Transition
      ↓
Twin
```

This sequence is directional. A rendered primitive or visible button cannot reverse the direction by declaring authority over its source object.

## Relationship to CIP-054 / CIP-055

CIP-054/055 remains the correct read-side implementation for applicable linear infrastructure:

```text
Governed Objects
      ↓
Object / Place / Time Context
      ↓
Discipline Authority
      ↓
CIP-054/055 Spatial Index
      ↓
Bounded Viewport Projection
      ↓
Map
      ↓
Selection
      ↓
Permitted Actions
```

The 32-entry response cache, progressive disclosure, station index, attachment index, display-only geometry simplification, normalized selection, and measured sub-6-ms 3SWR projection remain unchanged.

> **The governed spine is the preferred spatial reference and navigation index for applicable linear infrastructure. It is not universal Map authority.**

For a linear route, Place normally resolves as:

```text
Route → Spine → Station / Station Range → Coordinate
```

That is one Place resolver. It must not be imposed on a parcel, building, site, equipment location, polygon, region, or logical location that has a different governed spatial relationship.

## Required context dimensions

### Governed Object

An interaction target must carry a canonical object reference and the authority from which it was projected. Current Map feature kinds already include ScopeVersion, IOF package, route, station, node, edge, object, site, attachment, lateral, constraint, production unit, and geographic references. The type list is a presentation vocabulary; it does not confer domain authority.

Required identity:

- canonical object type and identifier;
- source authority and source revision/hash;
- parent/relationship references without substituting those references for object identity;
- tenant/customer boundary where applicable.

### Place

Place is a governed relationship, not necessarily a coordinate and not necessarily a spine measure. The contract must allow:

- route, spine, station, station range, or segment;
- site or point;
- polygon or multipolygon;
- parcel;
- facility or building;
- region or administrative area;
- node, edge, attachment, or equipment location;
- logical location;
- another governed spatial relationship with explicit source authority.

A Place reference may include a display coordinate, but that coordinate does not supersede the referenced place authority.

### Time / State

Time context consists of both lifecycle state and effective/version time. The normalized time vocabulary is:

```text
PROPOSED
CERTIFIED
AUTHORIZED
PLANNED
RELEASED
IN_PROGRESS
COMPLETED
OPERATING
SUPERSEDED
```

These are interaction-level categories over existing authoritative states; they do not replace the current lifecycle registries. Effective timestamp, source revision, revision hash, certification time, authorization time, and `asOf` time must be retained where available.

Future temporal views are orthogonal to discipline and Place:

```text
Current | Proposed | Authorized | As-Built | Historical
```

`MapSelection.selectedAt` is only the time of the UI selection. It is not the selected object's effective time and must not be used as such.

### Discipline

Discipline selects the authority resolver, not merely a color scheme or disclosure lens.

| Discipline | Representative permitted actions |
|---|---|
| Planner / Commercial | Inspect, define opportunity, import or propose route, configure, prepare governed handoff |
| Engineering | Inspect, identify/disposition condition, move object, redline route, propose change, record exception, approve/certify through existing gates |
| Marketplace | Inspect authorized demand, solicit, compare, allocate, award |
| Control | Inspect authorized scope, create/hold/release/sequence work |
| Field | Inspect assignment, install, test, close, record evidence |
| Customer | Inspect bounded customer projection, review, comment, accept or sign only where expressly authorized |
| Prism | Inspect opportunity/serviceability/constraint context, propose and certify through the existing decision authorities |
| Operations | Inspect operating state, incident, maintenance, restoration, and governed operational transitions |
| Twin | Inspect current and historical governed projections; Twin projection itself does not authorize upstream mutation |

### Actor authority

Discipline is not sufficient authorization. The same Engineering view can be read-only for one actor and actionable for another. Resolution must include authenticated actor, organization/tenant, roles/permissions, relevant assignment, and any object-specific participation rule.

UI action visibility is informative only. Every governed command must be revalidated at the authoritative API/engine boundary against current object revision and state.

## Contract boundary

The Map Kernel may:

- render a permitted bounded projection;
- manage viewport, resolution, layer disclosure, highlighting, and selection;
- normalize the selected object and Place references;
- emit interaction intent such as a selected object, clicked location, or proposed display geometry;
- present action descriptors supplied by the active discipline.

The Map Kernel must not:

- decide which constitutional actions are permitted;
- infer actor authority from presentation context or lens;
- write repositories or persistence;
- execute lifecycle, certification, closure, commercial, marketplace, control, field, customer, or operational transitions;
- turn an edited display geometry into governed geometry;
- treat a coordinate, station, or visible primitive as authority merely because it is selectable;
- make reasoning a prerequisite for action.

Route vertex dragging currently supported by MapKernel is therefore a gesture adapter. Its callback is a proposal to the owning workspace; certification or persistence remains outside MapKernel.

## Proposed contract shape for a later implementation CIP

The following is normative structure, not an instruction to create a new repository or engine in this phase.

```ts
type GovernedMapInteractionContext = {
  object: GovernedObjectRef;
  place: GovernedPlaceRef;
  time: GovernedTimeContext;
  discipline: Discipline;
  actor: ActorAuthorityRef;
  selection: MapSelection;
};

type PermittedMapAction = {
  actionId: string;
  label: string;
  owningAuthority: string;
  targetObjectId: string;
  enabled: boolean;
  blockedReasons: string[];
  requiredEvidence: string[];
  expectedRevision?: string;
};
```

The active discipline owns a resolver conceptually equivalent to:

```text
resolvePermittedActions(context) → read-side action descriptors
invoke(action, context hash, inputs) → existing authoritative API/engine
```

The resolver may compose existing permission checks, lifecycle guards, assignment rules, transition registries, and object gates. It must not duplicate or weaken them. The command boundary rechecks actor, object, Place relationship, time/state, expected revision, and evidence before recording the governed action.

## Current implementation audit

### Shared MapKernel

Current selection includes feature kind/reference, canonical ID, route, station/range, coordinate, source authority, lens, and selection timestamp. Presentation contexts cover Commercial, Engineering, Customer, Marketplace, Control, Field, Twin, Prism, and Operational Intelligence.

Findings:

- **Sound boundary:** MapKernel does not call domain mutation APIs or repositories.
- **Sound optimization:** CIP-054/055 indexing and projection are read-side only.
- **Gap:** selection has no effective revision/time-state context.
- **Gap:** `presentationContext` and `mapLens` affect disclosure, not discipline authorization.
- **Gap:** shared-context projection currently requires a governed route spine. Non-linear Place needs resolver dispatch rather than a forced spine.
- **Gap:** no common discipline action descriptor or stale-context hash exists.

### Planner / Commercial

Current path:

```text
Commercial/ProposedNetwork selection
  → workspace selection state and inspector
  → route/object/site forms
  → Commercial engines/repositories/APIs
  → Draft IOF / proposal / Engineering handoff
```

The custom Proposed Network map selects edges, nodes, stations, objects, IOF objects, and spans. Station-aware review uses MapKernel selection to choose station context; add/move/remove actions remain owned by the Commercial review component and its commercial engines.

Assessment: **partially aligned**. Selection and action ownership are separate, but the Planner/Commercial surface uses multiple selection models and sometimes an Engineering presentation context. It lacks a common actor/time/action resolution contract.

### Engineering

Current path:

```text
MapKernel selection
  → Engineering reviewSelection
  → contextual inspector
  → canWrite + package/readiness/object gates
  → Engineering API/change-set/certification authority
  → Engineering revision / certification ledger / return to Commercial
```

Mapped actions include identify and disposition condition, move object, route redline, doctrine exception, quantity reconciliation, budget approval, Commercial revision request, Engineering approval, and IOF certification. The workspace uses authenticated permissions and server-authoritative approval/certification endpoints.

Assessment: **strongest existing model**. It already demonstrates the desired separation: the map selects context; Engineering decides and executes actions. Normalization should wrap these gates, not replace them.

### Marketplace

Current path:

```text
Authorized ScopeVersion projection → read-only Marketplace map
Marketplace package/response selection → allocation/award APIs
```

The Marketplace map currently has no selection callback. Capacity offers, material responses, allocations, and awards are selected from package/response lists. Sessions are passed to Marketplace APIs, and awards explicitly do not create Control or Field execution.

Assessment: **authority is separate but spatial interaction is disconnected**. Later normalization can bind selected station ranges, segments, objects, and constraints to the existing allocation command without moving allocation authority into MapKernel.

### Control

Current path:

```text
Authorized ScopeVersion → read-only Control map/focus
Work queue selection → control lifecycle gates
  → create/activate/hold/complete/cancel work
```

The map follows the selected work item's station but does not produce work selection. `canControlCreateWork`, activation gates, ScopeVersion state, and Control persistence remain outside the map.

Assessment: **authority separation is sound; contextual linkage is one-way**. A later action resolver should expose only actions valid for the selected work/object/Place and current Control state.

### Field

Current path:

```text
MapKernel station/object selection
  → Field station/object work context
  → field execution gate + allowed transition
  → ClosureAuthorityEngine
  → server-persisted ScopeVersion closure
  → Field/Twin projection refresh
```

Object, station, and station-range transitions remain outside MapKernel. Allowed transitions come from the field view/closure authority. The map selection synchronizes the active station or object.

Assessment: **strongly aligned structurally**. Important audit risk: actor name and closure authority are user-selectable in the current Field UI. A later normalization must resolve these from authenticated actor/assignment authority and preserve server-side validation; it must not trust the selected UI value.

### Customer

`CUSTOMER_PORTAL` disclosure policy exists, but there is no active customer MapKernel interaction surface. Customer acceptance currently occurs through proposal/service-order workflows; Twin verifies an authorized customer signer ID before signature. No customer action is derived from map selection.

Assessment: **contract reserved, implementation absent**. Customer projection must be tenant-bounded and read-only by default. Comment, acceptance, or signature should appear only when the exact customer participant and revision are authorized by the owning workflow.

### Prism

Current path:

```text
MapKernel selection → station/object inspector
Map gesture/proposed route geometry → Prism workspace state
Prism evidence/certification controls → existing route/snap/ScopeVersion authorities
```

Map selection is presently inspect-only. An optional editable route callback captures a geometry proposal; snap certification, route certification/rejection, child ScopeVersion creation, and quote generation remain workspace actions.

Assessment: **mostly aligned**. The editable callback must remain explicitly non-authoritative until Prism's existing certification path accepts it. Prism also needs explicit authenticated actor-action resolution in a later CIP.

### Twin / ScopeVersion

Certified and authorized maps are read-only. Twin materialization and ScopeVersion projection originate from existing certified/authorized records. Service Order generation/signature and exports are adjacent workflow actions, not map-selection actions.

Assessment: **aligned**. Twin is the downstream projection target, not a general-purpose authority for rewriting its sources.

### Operations / Operational Intelligence

Operational Intelligence currently consumes MapKernel render specifications for metrics but does not expose a shared interactive map action surface. Object and ScopeVersion lifecycle registries already include operational, maintained, modified, retired, completion, and supersede concepts.

Assessment: **authority foundations exist; interaction layer is absent**. Incident, maintenance, restoration, and historical-view actions must compose the existing lifecycle/closure authorities rather than invent Map-specific transitions.

## Cross-discipline findings

| Concern | Current state | Required normalization |
|---|---|---|
| Object identity | Canonical IDs and source authority mostly available | Add explicit source revision/hash and tenant boundary to interaction context |
| Place | Strong linear spine/station implementation | Add governed Place union and resolver dispatch for non-linear locations |
| Time/state | Present in payloads and lifecycle engines | Add explicit effective state/revision/as-of context; do not use selection time |
| Discipline | Presentation contexts and workspace ownership exist | Introduce discipline action-provider boundary distinct from map lens |
| Actor | Engineering and customer paths use explicit auth; other paths vary | Resolve authenticated actor, role, assignment, tenant, and permission consistently |
| Permitted actions | Hard-coded in each workspace | Project descriptors from the owning discipline's existing gates |
| Command validation | Existing APIs/engines usually revalidate | Require expected revision/context hash and server revalidation everywhere |
| Twin transition | Existing closure/certification/materialization paths | Preserve those paths as the only way an action affects Twin state |

## Normalization sequence for a future implementation CIP

1. Define shared read-only references for governed object, Place, time/state, discipline, actor, and interaction context.
2. Extend selection context with source revision/effective state without adding actions to MapKernel.
3. Introduce Place resolver dispatch. Keep the current spine resolver unchanged for linear infrastructure and add other resolvers only when a governed source requires them.
4. Adapt Engineering first because its selection-to-authority separation is already mature.
5. Adapt Field next, resolving actor and closure authority from authenticated assignment rather than editable UI fields.
6. Connect Marketplace and Control selections to their existing package/work authorities.
7. Add Customer and Operations surfaces only after tenant, participant, assignment, temporal, and server-command contracts are explicit.
8. Add stale-context and cross-discipline negative tests before consolidating contextual action presentation.

## Required validation for implementation

- The same object/place/revision produces different permitted action sets for different disciplines and actors.
- The same actor receives different actions when authoritative state changes.
- A stale selection cannot execute against a newer revision without re-resolution.
- A map coordinate cannot replace parcel, facility, route, or other Place authority.
- A non-linear object can project and select without a route spine.
- Customer and vendor actors cannot see or act outside their tenant/package boundary.
- Hidden UI actions remain rejected when called directly without authority.
- MapKernel performs no repository write or state transition.
- Route editing emits a proposal only; governed geometry changes only through the owning authority.
- Historical/as-built views cannot mutate past revisions.
- The existing 3SWR progressive disclosure, bounded cache, station navigation, and performance envelope remain unchanged.

## Stop gate

No runtime normalization should begin until the object/place/time reference vocabulary and the discipline-owned action-provider boundary are accepted. In particular, do not create a universal Map action engine, Map repository, navigation repository, or Map-owned lifecycle state machine.
