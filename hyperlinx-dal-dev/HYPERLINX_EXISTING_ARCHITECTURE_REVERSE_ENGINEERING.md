# Hyperlinx Existing Architecture Reverse Engineering

Status: Current-state architecture audit before Sprint 19

Scope: This document reverse engineers the implementation already present in this repository. It does not redesign Hyperlinx, refactor it, or propose new features.

Primary evidence reviewed:

- `server/index.js`
- `server/routes/_shared.js`
- `server/routes/runtime-foundation.js`
- `server/routes/runtime-workspace-session.js`
- `server/routes/runtime-lifecycle-bridge.js`
- `server/routes/scopeversions.js`
- `server/routes/product-fulfillment.js`
- `server/routes/engineering-certification.js`
- `server/routes/twin-state.js`
- `src/api/teralinxRuntime.ts`
- `src/components/workspaces/GoogleRfpWorkspace.tsx`
- `src/dal/DALApp.tsx`
- `src/dal/DALState.tsx`
- `src/kernel/*`
- `src/scopeversion/*`
- `src/commercial/*`
- `src/runtime/*`
- Existing Sprint 14 through Sprint 19 reports and validations where they describe implemented behavior.

## 1. Executive Summary

Hyperlinx already behaves like a governed infrastructure operating platform assembled from four main layers:

1. A React DAL shell and workspace layer.
2. A set of client-side engines for commercial reasoning, routing, translation, ScopeVersion helpers, Kernel projection, and visual workspaces.
3. A Node HTTP route layer that owns runtime persistence, authority-gated mutations, and server-side lifecycle transitions.
4. A file-backed JSON persistence model under `server/data`, with domain collections and Runtime collections persisted side by side.

The strongest implemented architectural centers are:

- Runtime as continuity and rehydration layer.
- ScopeVersion as constitutional execution truth after certification.
- Kernel as invariant/completion/readiness projection logic, not as a state-mutating execution engine.
- Engineering Certification as the gate from commercial/proposal artifacts into Certified IOF Package and ScopeVersion.
- Twin as a derived projection over Runtime, ScopeVersion, Control, and Field state.
- Product Fulfillment as a carrier-neutral policy-like runtime bridge between Product definitions and Fulfillment Plans.

The current implementation is not a single monolith, but it does have one very large orchestration surface: `GoogleRfpWorkspace.tsx`. That workspace composes account/contact libraries, customer inputs, routing, proposal runtime, product fulfillment, runtime lifecycle bridge calls, and engineering certification operations. Much of the actual computation is delegated to engines and server routes, but the operator sequence is still heavily coordinated in the workspace.

The architecture is more mature than a prototype because it already enforces several constitutional boundaries:

- Proposal can create Draft IOF readiness and packages, but does not directly create executable ScopeVersion authority.
- Engineering Certification imports `persistScopeVersion` and is the implemented path to execution authority.
- ScopeVersion certified records are treated as immutable and produce child versions for certain changes.
- Runtime rehydration restores domain objects from persisted IDs instead of fabricating UI defaults.
- Twin projection reads governed state and reports violations, but does not mutate authority.

The main architectural ambiguity before Sprint 19 is not whether the platform has a foundation. It does. The ambiguity is the pre-certification design authority layer: customer input, intent validation, design candidate, approved design, stationing, and Spine commit are distributed across UI, commercial engines, routing, proposal records, and doctrine documents. The implementation already points toward that architecture, but the single implemented authoritative object boundary is clearer after Engineering Certification than before it.

## 2. Current Architecture Diagram

Implemented high-level flow:

```text
Operator
  |
  v
React DAL Shell
  - src/dal/DALState.tsx
  - src/dal/DALApp.tsx
  - workspace components
  |
  +--> Client engines
  |      - commercial engines
  |      - translate/runtime object model
  |      - route/routing engines
  |      - scopeversion helpers
  |      - kernel completion/invariants
  |
  +--> API client
         - src/api/teralinxRuntime.ts
         |
         v
Node HTTP server
  - server/index.js route dispatcher
  |
  +--> Auth and workspace routes
  +--> Domain collection routes
  +--> Runtime lifecycle bridge
  +--> Runtime workspace session and rehydration
  +--> Runtime foundation collections
  +--> Product fulfillment
  +--> Proposal runtime
  +--> Engineering certification
  +--> ScopeVersion authority
  +--> Twin projection
         |
         v
File-backed persistence
  - server/data/accounts
  - server/data/contacts
  - server/data/commercial-opportunities
  - server/data/proposal-drafts
  - server/data/iof-packages
  - server/data/certified-iof-packages
  - server/data/scopeversions
  - server/data/runtime-objects
  - server/data/runtime-relationships
  - server/data/runtime-history
  - server/data/runtime-workspace-sessions
  - other domain collections
```

Runtime and authority route order in `server/index.js`:

```text
handleAuth
handleRuntime
handleAccounts
handleActivity
handleGeocode
handleCertifiedRoutes
handleScopeVersions
handleCustomerDesignImports
handleCommercialOpportunities
handleEngineeringDrafts
handleEngineeringCertification
handleProposalDrafts
handleProductFulfillment
handleRuntimeLifecycleBridge
handleRuntimeWorkspaceSession
handleRuntimeFoundation
handleCandidateSites
handleOpportunitySeeds
handleInventoryGraphs
handleMarketplaceQuotes
handleIofPackages
handleCloseEvents
handleControlWorkItems
handleFieldClosures
handleTwinState
```

Important observation: specific runtime handlers now run before `handleRuntimeFoundation`, so `/api/runtime/rehydrate` is owned by `runtime-workspace-session.js`, not the generic foundation route.

## 3. Domain Map

| Domain | Location | Implemented role |
|---|---|---|
| DAL shell | `src/dal` | Workspace selection, auth/session context, navigation, runtime info, reasoning shell prompts. |
| Workspaces | `src/workspaces`, `src/components/workspaces` | Operator surfaces for commercial planning, translate, graph, design, proposed network, proposal, route engineering, marketplace, control, field, twin, operations. |
| API client | `src/api/teralinxRuntime.ts` | Browser-to-server contract for Runtime, proposal, engineering, product, accounts, and ScopeVersion operations. |
| Runtime | `server/routes/runtime-foundation.js`, `server/routes/runtime-workspace-session.js`, `server/routes/runtime-lifecycle-bridge.js`, `src/runtime` | Runtime objects, relationships, evidence, history, workspace sessions, rehydration, lifecycle bridge artifacts. |
| ScopeVersion | `server/routes/scopeversions.js`, `src/scopeversion` | Constitutional infrastructure truth, lifecycle guards, transition authority, certified immutability, close application. |
| Kernel | `src/kernel`, `server/kernel` | Invariants, state normalization, completion projection, readiness/completion diagnostics. |
| Commercial | `src/commercial`, `src/components/workspaces/GoogleRfpWorkspace.tsx` | Opportunity scout, A/Z resolution, routing orchestration, estimating, proposal preparation, Google RFP workflow. |
| Product/Fulfillment | `server/routes/product-fulfillment.js` | Product definitions, ownership classes, Fulfillment Plans, runtime mirrors, carrier-neutral fulfillment doctrine. |
| Proposal | `server/routes/proposal-drafts.js`, `src/proposal`, workspace code | Proposal runtime object actions, customer review actions, readiness for Draft IOF. |
| Engineering Certification | `server/routes/engineering-certification.js` | Draft IOF Package, engineering queue, unit certification, Certified IOF Package, execution certificate, ScopeVersion creation. |
| Twin | `server/routes/twin-state.js`, `src/workspaces/TwinWorkspace.tsx`, `src/scopeversion/ScopeVersionTwinProjection.ts` | Read projection from Runtime/ScopeVersion/Control/Field into operational state. |
| Translate/Import | `src/translate`, `src/import`, `server/routes/customer-design-imports.js`, `src/runtime/RuntimeObjectModel.ts` | Customer design parsing, translation commits, runtime object/evidence/relationship generation from imports. |
| Graph/Spatial/Route | `src/graph`, `src/routing`, `src/routeGeneration`, `src/spatial`, `src/gis`, `src/mapkernel` | Inventory graph, route generation, spatial helpers, map kernel behavior. |
| Marketplace | `src/marketplace`, `server/routes/marketplace-quotes.js` | Marketplace quote/package concepts and route-backed marketplace records. |
| Control | `src/control`, `server/routes/control-work-items.js` | Control work item records and readiness/activation surfaces. |
| Field | `src/field`, `server/routes/field-closures.js` | Field closure records and closure-related UI. |
| Operations | `src/operations`, `src/workspaces/OperationalIntelligenceWorkspace.tsx` | Operational readiness and completion projections. |
| Prism/Affinity/Portfolio | `src/prism`, `src/affinity`, `src/portfolio` | Advisory scoring, recommendation, site decision, portfolio views. |

## 4. Module Ownership

| Module group | Owns | Does not own |
|---|---|---|
| `server/routes/_shared.js` | File-backed collection utilities, data root, directory registry, JSON request/response helpers. | Domain semantics beyond generic persistence mechanics. |
| `server/index.js` | HTTP route dispatch order, static app serving, health/API routing. | Business logic for individual domains. |
| Runtime Foundation | Generic runtime collections: evidence, inventories, objects, relationships, validations, history, connectors. | Specific lifecycle routes such as rehydration and lifecycle bridge. |
| Runtime Workspace Session | WorkspaceSession persistence, runtime session mirror, session history, rehydration response. | Domain object creation except session/mirror/history. |
| Runtime Lifecycle Bridge | Lifecycle event orchestration across opportunity, product, proposal, Draft IOF, customer twin, relationships, evidence, history. | Engineering certification authority and ScopeVersion certification. |
| ScopeVersion route | ScopeVersion persistence, certification, close application, lifecycle merge, certified immutability, child version creation. | Proposal generation and workspace UI state. |
| Product Fulfillment route | Product definitions, ownership classes, Fulfillment Plan normalization, runtime mirrors/history. | Full design compiler or proposal pricing engine. |
| Engineering Certification route | Draft IOF Package, engineering review queue, Certified IOF Package, execution certificates, ScopeVersion generation. | Customer approval authority and commercial proposal editing. |
| Twin route | Projection over ScopeVersion, work items, closures, runtime objects, lifecycle violations. | Runtime or ScopeVersion mutation. |
| DAL State/App | Workspace selection, auth, user-visible shell, reasoning panel context. | Domain authority and persistence rules. |
| Google RFP workspace | Operator orchestration for the Google commercial path. | Final ScopeVersion authority; it calls routes for persistence and certification. |
| Kernel | Invariant checks, status normalization, completion projection. | Persistence, HTTP routing, domain object creation, certification. |

## 5. Runtime Architecture

Runtime is implemented as both:

- A generic object library (`runtime-objects`, `runtime-relationships`, `runtime-evidence`, `runtime-history`, etc.).
- A continuity layer (`runtime-workspace-sessions`) that stores resume pointers for the current operator workspace.

### Persistence Boundary

The server uses `DATA_ROOT`, defaulting to `server/data`, with optional override through `DAL_DATA_ROOT`. Runtime directories include:

```text
runtime-workspaces
runtime-evidence
runtime-inventories
runtime-objects
runtime-relationships
runtime-validation
runtime-history
runtime-connectors
runtime-workspace-sessions
translation-commits
```

Domain data lives beside Runtime data:

```text
accounts
contacts
commercial-opportunities
proposal-drafts
iof-packages
certified-iof-packages
execution-authorization-certificates
scopeversions
control-work-items
field-closures
marketplace-quotes
products
fulfillment-plans
```

### WorkspaceSession

`runtime-workspace-session.js` normalizes session records with:

- `sessionId` / `workspaceSessionId`
- `runtimeObjectId`
- `userId`
- `workspaceId`
- `accountId`
- `customerId`
- `opportunityId`
- `productId`
- `fulfillmentPlanId`
- `proposalId`
- `scopeVersionId`
- selected graph, route, customer design, inventory, package, proposal revision, and engineering revision IDs
- `currentAuthority`
- `currentLifecycleStage`
- map and panel resume metadata
- `noWorkspaceOwnedLifecycleState: true`
- `runtimeIsSingleSourceOfTruth: true`

The important architectural pattern is that WorkspaceSession is a resume pointer object. It restores the currently relevant objects, but it is not meant to duplicate domain truth.

### Runtime Rehydration

`GET /api/runtime/rehydrate`:

1. Requires bearer authentication.
2. Loads the current or latest WorkspaceSession.
3. Resolves related persisted records by ID:
   - account
   - contacts
   - opportunity
   - product
   - fulfillment plan
   - proposal
   - Draft IOF Package
   - Certified IOF Package
   - ScopeVersion
4. Returns runtime objects and runtime history.
5. Returns `twinRestore` metadata for workspace restoration.

Rehydration restores existing objects. It is not implemented as a creator of replacement domain records.

### Runtime Object Relationship Diagram

```text
WorkspaceSession
  -> Account
  -> Contacts
  -> CommercialOpportunity
  -> Product
  -> FulfillmentPlan
  -> Proposal
  -> DraftIofPackage
  -> CertifiedIofPackage
  -> ScopeVersion
  -> RuntimeObjects
  -> RuntimeHistory
  -> TwinRestore metadata

RuntimeObject
  -> RuntimeEvidence
  -> RuntimeRelationship
  -> RuntimeValidation
  -> RuntimeHistory

RuntimeRelationship
  -> fromRuntimeId or fromObjectId
  -> toRuntimeId or toObjectId
```

### Runtime Synchronization

Runtime synchronization is implemented through route-level mirrors and history events:

- Product and Fulfillment Plan save paths mirror records into `runtime-objects`.
- WorkspaceSession persistence mirrors a `WORKSPACE_SESSION` runtime object.
- Runtime Lifecycle Bridge writes relationships, evidence, and history idempotently where possible.
- Proposal, Draft IOF, Certified IOF, and ScopeVersion state is rehydrated from domain collections rather than collapsed into a single Runtime record.

### Persisted, Projection, Transient

| Kind | Examples | Current behavior |
|---|---|---|
| Persisted domain records | Account, Contact, Opportunity, Proposal, Draft IOF Package, Certified IOF Package, ScopeVersion, Product, Fulfillment Plan | Stored in domain directories under `server/data`. |
| Persisted runtime records | RuntimeObject, RuntimeRelationship, RuntimeEvidence, RuntimeHistory, RuntimeWorkspaceSession | Stored in runtime directories under `server/data`. |
| Projection | Twin state, completion metrics, readiness summaries, lifecycle violations | Computed from persisted records. |
| Transient UI state | open panels, selected tabs, form draft values, routing pending state, prompt state | Lives in React state unless explicitly saved through a route. |

## 6. Kernel Architecture

The Kernel currently behaves as a constitutional validator, invariant engine, readiness/completion projection engine, and state-normalization helper. It does not currently behave as the central execution engine or persistence owner.

### Kernel Public API

Client-side Kernel API:

```text
src/kernel/KernelInvariantEngine.ts
  checkKernelInvariants(context)

src/kernel/CompletionEngine.ts
  calculateCompletionProjection(input)

src/kernel/KernelStateRegistry.ts
  normalizeKernelState(value, domain)
  normalizeControlWorkStatus(value)
  normalizeRouteAuthorityState(value)
  isKernelAlias(value, domain)
  kernelAliasTarget(value, domain)
  logKernelFallbackActive(input)
```

Server-side Kernel API:

```text
server/kernel/completion-engine.js
  calculateCompletionProjection({ scopeVersion, workItems, closures })
```

Related but owned under ScopeVersion:

```text
src/scopeversion/ClosureAuthorityEngine.ts
src/scopeversion/ScopeVersionTransitionAuthorityEngine.ts
src/scopeversion/ScopeVersionLifecycleGuard.ts
```

These modules share constitutional responsibilities with Kernel logic, but they are not physically inside `src/kernel`.

### What Calls the Kernel

| Caller | Kernel dependency | Purpose |
|---|---|---|
| `server/routes/scopeversions.js` | server completion engine | Recalculate completion/progress after closure application. |
| `server/routes/twin-state.js` | server completion engine | Compute Twin metrics from ScopeVersion, work items, and closures. |
| `src/scopeversion/ScopeVersionTwinProjection.ts` | client completion engine | Build client-side ScopeVersion Twin projection. |
| `src/scopeversion/ClosureAuthorityEngine.ts` | client completion engine | Evaluate close/completion impact. |
| `src/workspaces/OperationalIntelligenceWorkspace.tsx` | client completion engine | Display operational completion projections. |
| `src/api/dalClient.ts` | client completion engine | Local/fallback completion projection. |
| Sprint 19 validation | Kernel files directly | Confirms public API and dependency boundaries. |

### What the Kernel Calls

```text
KernelInvariantEngine
  -> ScopeVersionLifecycleGuard
  -> CompletionEngine
  -> KernelStateRegistry

CompletionEngine
  -> ScopeVersion-like input objects
  -> ControlWorkItem-like input objects
  -> Closure-like input objects

KernelStateRegistry
  -> no persistence dependency
```

### Kernel Call Graph

```text
ScopeVersion route closure mutation
  -> server/kernel/completion-engine.js
  -> progress/completion fields
  -> persisted ScopeVersion

Twin route GET projection
  -> server/kernel/completion-engine.js
  -> Twin metrics/timeline/violations
  -> JSON response only

Client Twin / OI / validation surfaces
  -> src/kernel/CompletionEngine.ts
  -> derived projections

Validation/audit surfaces
  -> src/kernel/KernelInvariantEngine.ts
  -> findings
```

### Kernel Responsibility Diagram

```text
Owns
  - invariants
  - completion math
  - canonical state aliases
  - warnings/blockers
  - derived readiness/completion projection

Does not own
  - HTTP routing
  - file persistence
  - operator UI state
  - Product definitions
  - proposal lifecycle actions
  - engineering certification
  - ScopeVersion mutation authority
  - Twin persistence
```

### Kernel Behavior Classification

| Behavior | Current status | Evidence |
|---|---|---|
| Execution engine | Not primary | Kernel does not execute lifecycle mutations or persist records. |
| Constitutional validator | Yes | `checkKernelInvariants` reports blocking/warning/info invariants. |
| Eligibility engine | Partial | Invariants and completion readiness help determine eligibility but do not own action dispatch. |
| Readiness engine | Yes | Completion projection and invariant findings drive readiness diagnostics. |
| Replay engine | Not implemented as Kernel responsibility | Runtime history exists, but Kernel does not replay transitions. |
| Invariant engine | Yes | Kernel invariant engine explicitly checks lifecycle, authority, Twin isolation, completion, fallback, aliases. |

## 7. ScopeVersion Architecture

ScopeVersion is the clearest constitutional truth object in the implementation. It is created through several helper paths, but the server authority route and Engineering Certification path are the strongest implemented production boundaries.

### How ScopeVersion Is Created

Implemented creation paths include:

- `server/routes/scopeversions.js` base POST for ScopeVersion persistence.
- `server/routes/engineering-certification.js`, which imports `persistScopeVersion` and uses Engineering Certification to produce a ScopeVersion from certified package state.
- Client helpers in `src/scopeversion/scopeVersionUtils.ts` that can create candidate ScopeVersions from inventory graphs, customer design imports, opportunities, graph extensions, opportunity seeds, site decisions, or field closures.

Architectural distinction:

- Client helpers create candidates or local records.
- Server route persistence owns actual stored records.
- Engineering Certification is the implemented authority bridge into execution-ready ScopeVersion.

### How ScopeVersion Changes

`server/routes/scopeversions.js` implements:

- normalization of lifecycle and `canonicalTruth.lifecycleState`
- lifecycle merge without regression
- certification
- close application
- progress calculation through server Kernel completion
- certified immutability checks
- child version creation when updating certified immutable records
- delete rejection for certified immutable records

Closure changes are guarded by:

- `scopeVersionId` match
- duplicate closure rejection
- close authority requirements
- station/object existence checks
- station/object transition tables
- active ControlWorkItem requirement for close application

### Who May Mutate ScopeVersion

Server routes use permission gates such as `requireAnyPermission`, including `scopeversion.authority` for authoritative changes. Engineering Certification also uses authority checks for package certification paths.

Implemented mutation boundary:

```text
UI/client request
  -> API route
  -> permission check
  -> normalization/validation
  -> persistRecord(DIRS.scopeVersions, ...)
```

### Who Consumes ScopeVersion

| Consumer | Use |
|---|---|
| Twin route | Projection metrics, timeline, graph context, lifecycle violations. |
| ScopeVersion route | Certification, close application, lifecycle merge. |
| Engineering Certification route | Creates/persists ScopeVersion after package certification. |
| Control/Field domains | Work and closures reference ScopeVersion IDs. |
| Operational Intelligence workspace | Completion projections. |
| Client Twin projection | ScopeVersion-derived Twin projection. |
| Marketplace/control/field doctrines and validations | Readiness and post-certification handoff. |

### Relationship to Runtime

Runtime stores mirrors, relationships, history, and WorkspaceSession pointers. ScopeVersion stores the canonical infrastructure truth. WorkspaceSession can point to `scopeVersionId`; Runtime rehydration loads the ScopeVersion by that ID.

### Relationship to Kernel

ScopeVersion route calls the server completion engine during closure/progress calculations. Kernel invariant logic also evaluates ScopeVersion lifecycle, certification references, immutable evidence changes, and completion integrity.

### Relationship to Twin

Twin consumes ScopeVersion as truth. Twin projection may flag lifecycle violations, but it does not mutate ScopeVersion.

### Relationship to Engineering Certification

Engineering Certification is the implemented bridge from commercial/proposal package into executable scope:

```text
Approved Proposal
  -> Draft IOF Package
  -> engineering checklist/unit review
  -> Certified IOF Package
  -> execution authorization certificate
  -> ScopeVersion
```

## 8. Product Architecture

Product architecture is implemented primarily in `server/routes/product-fulfillment.js`.

### Where Product Definitions Exist

`product-fulfillment.js` defines `LAYER_1_PRODUCTS`, including:

- `PRODUCT-L1-PROTECTED-DARK-FIBER-IRU`
- Unprotected Dark Fiber IRU
- Dark Fiber Lease
- Conduit
- Multi-Duct
- Lateral
- Long-haul
- Metro Backbone
- Data Center Interconnect
- Campus Interconnect
- ILA
- Regeneration
- Meet-Me
- POP

`defaultProductDefinition` produces product records with commercial, engineering, construction, runtime, operations, and doctrine fields.

### Where Fulfillment Plans Exist

Fulfillment Plans are normalized and persisted in:

```text
server/data/fulfillment-plans
```

They are also mirrored into Runtime Objects using `persistRuntimeMirror`.

### Where Product Policy Currently Exists

Product policy is currently distributed across:

- `server/routes/product-fulfillment.js` product definition defaults
- `GoogleRfpWorkspace.tsx` Layer 1 product selection/options
- Commercial pricing and estimating engines
- Proposal runtime shape
- Engineering package fields copied from proposal/product/fulfillment records

The server product definition already contains policy-like fields, but there is not yet one separate Product Policy Registry module in the implementation.

### Ownership Classes

Product Fulfillment implements ownership as metadata through classes:

| Class | Meaning |
|---|---|
| `TERALINX_OWNED` | Teralinx-owned or controlled inventory. |
| `CUSTOMER_OWNED` | Customer-owned infrastructure. |
| `PARTNER_OWNED` | Partner/carrier/utility/municipal inventory. |
| `MARKETPLACE` | Marketplace-discovered inventory. |
| `NEW_CONSTRUCTION` | Infrastructure to be constructed. |

Fulfillment Plans carry:

- `noInventoryOwnershipConstraint: true`
- `ownershipIsMetadata: true`
- ownership classes
- fulfillment mix
- existing/customer/partner/marketplace/new construction references

### Product Influence by Domain

| Domain | Current Product influence |
|---|---|
| Commercial | Product selection affects proposal fields, terms, protected flag, commercial summaries, and product display. |
| Design | Product influences design indirectly through workspace options, fulfillment plan, pricing assumptions, and route requirements. A single compiler boundary is not yet implemented. |
| Proposal | Proposal runtime records include product ID/name, term, protected status, fulfillment strategy, fulfillment mix, and product-derived summaries. |
| Engineering | Draft IOF Packages carry product ID/name, fulfillment plan ID, fulfillment strategy, fulfillment mix, and commercial summary into certification. |
| Marketplace | Marketplace concepts exist and can consume product/scope context, but implemented product-to-marketplace execution is not the primary route. |
| Control | Control readiness is downstream of ScopeVersion, not directly controlled by Product. Product context can remain in scope/runtime metadata. |
| Twin | Twin can display commercial runtime objects and ScopeVersion context; Product appears through runtime/proposal/package relationships rather than direct Twin mutation. |

### Does Product Behave Like a Policy Engine?

Partially. Product definitions already contain policy-like attributes and Fulfillment Plans express governed fulfillment constraints. However, the current implementation does not yet centralize all design, pricing, deliverable, and transition gates behind one standalone product policy engine.

## 9. Design Architecture

Design responsibilities are distributed. There is no single implemented `DesignCompilerEngine` module yet. The implemented system already contains many design-compiler ingredients.

### Where Candidate Generation Lives

| Responsibility | Current location |
|---|---|
| Opportunity candidate from click/address/lat-lng/A-Z/browser | `src/commercial/OpportunityScoutEngine.ts` |
| Deterministic address resolution fallback | `OpportunityScoutEngine.ts` |
| Commercial attachment resolution | `src/commercial/CommercialAttachmentEngine.ts` |
| Proposed graph and network work | `src/proposedGraph`, `src/components/workspaces/ProposedNetworkWorkspace.tsx`, `src/components/workspaces/proposednetwork/*` |
| Corridor/reference architecture concepts | `src/corridor`, doctrine docs, validations |
| ScopeVersion candidates from opportunity/import/graph/site decision | `src/scopeversion/scopeVersionUtils.ts` |

### Where Routing Lives

Routing is present in:

- `src/commercial/CommercialOsrmRoutingEngine.ts`
- `src/routeGeneration`
- `src/routing`
- Teralinx route workspace and route engineering workspace
- Server geocode route for geocoding support

In the Google commercial path, routing is orchestrated from `GoogleRfpWorkspace.tsx` and delegated to commercial/routing engines.

### Where Geometry Lives

Geometry appears in several object shapes:

- customer design imports
- runtime object/evidence generation
- route candidates
- proposal geometry references
- Draft IOF Package geometry references
- ScopeVersion `geometry`, `canonicalTruth.geographicBasis`, and engineering basis snapshots
- Twin graph context

The current architecture preserves geometry through references and snapshots rather than one single geometry service.

### Where Stationing Lives

Stationing and station state logic appears in:

- `src/scopeversion/StationStateEngine.ts`
- ScopeVersion canonical truth stations
- ScopeVersion close application route
- field/control/closure models
- route/corridor doctrine and validation files

Stationing is most authoritative once inside ScopeVersion canonical truth.

### Where Pricing Begins

Pricing begins in commercial modules:

- `src/commercial/PreliminaryQuoteEngine.ts`
- `src/commercial/SelectedScopePricingSummary.ts`
- `src/commercial/TransparentEstimatingEngine.ts`
- `src/commercial/UnitCostLibrary.ts`
- `src/commercial/quoteEngine.ts`
- Google-specific reference profiles and pricing fixtures

Pricing then flows into proposal runtime records and Draft IOF Package summaries.

### Where Product Influences Design

Product influence currently enters through:

- selected product ID/options in `GoogleRfpWorkspace.tsx`
- server Product/Fulfillment Plan records
- proposal summary fields
- fulfillment mix and strategy
- engineering package carried metadata
- pricing/term/protection fields

It is implemented as a distributed influence, not yet as one compiler input contract.

### Where UI Still Participates

`GoogleRfpWorkspace.tsx` participates in:

- selecting Product
- setting A/Z text and resolved locations
- orchestrating route generation
- selecting/locking candidates
- staging imports
- saving proposal snapshots/runtime proposals
- triggering runtime lifecycle bridge actions
- triggering Draft IOF assembly and certification actions

Important distinction: the UI participates in orchestration, but authority-bearing persistence generally goes through server routes.

### Design Compiler Dependency Graph

Current implemented dependency graph:

```text
GoogleRfpWorkspace
  -> OpportunityScoutEngine
       -> deterministic geocode
       -> resolved locations
       -> opportunity scout candidate
       -> quick quote/site decision advisory output
  -> CommercialAttachmentEngine
       -> customer twin / inventory adjacency
  -> CommercialOsrmRoutingEngine
       -> route geometry
       -> route metrics
  -> TransparentEstimatingEngine / PreliminaryQuote / pricing helpers
       -> quantities
       -> costs
       -> assumptions
  -> Product/Fulfillment API
       -> Product
       -> FulfillmentPlan
  -> Proposal API
       -> Proposal runtime object
  -> Engineering Certification API
       -> Draft IOF Package
       -> Certified IOF Package
       -> ScopeVersion
```

## 10. Commercial Architecture

The Google commercial path is implemented as an operator workflow centered in `GoogleRfpWorkspace.tsx`, with server routes owning persistence and runtime lifecycle transitions.

### One Google Opportunity Trace

```text
Account / Contact
  -> server/routes/accounts.js
  -> server/data/accounts
  -> server/data/contacts
  -> Runtime history and workspace session references

Customer Inputs
  -> UI input state in GoogleRfpWorkspace
  -> OpportunityScoutEngine for A/Z, address, lat/lng, browser candidates
  -> Customer design import routes for imported design files
  -> RuntimeObjectModel for runtime evidence/object generation from imports

Opportunity
  -> server/routes/commercial-opportunities.js
  -> server/data/commercial-opportunities
  -> Runtime lifecycle bridge relationships/history when advanced

Product Selection
  -> server/routes/product-fulfillment.js
  -> Product record
  -> FulfillmentPlan record
  -> runtime object mirrors

Proposal
  -> server/routes/proposal-drafts.js
  -> proposal runtime actions
  -> proposal-drafts persistence
  -> runtime history

Customer Review
  -> proposal runtime actions
  -> submit/comment/evidence/change/approve/reject actions
  -> approval state and readiness changes

Draft IOF
  -> engineering certification route
  -> Draft IOF Package from approved Proposal
  -> engineering review queue

Engineering
  -> unit certification and package certification
  -> Certified IOF Package
  -> execution authorization certificate

ScopeVersion
  -> persistScopeVersion
  -> scopeversions directory
  -> Runtime workspace session update
  -> Twin can project it
```

### Commercial Sequence Diagram

```text
Operator
  -> GoogleRfpWorkspace: select/create account
  -> Accounts route: persist account/contact
  -> Runtime history: account/contact events

Operator
  -> GoogleRfpWorkspace: select product
  -> Product Fulfillment route: ensure Product + FulfillmentPlan
  -> Runtime Objects: mirror Product + FulfillmentPlan
  -> Runtime History: product/fulfillment events

Operator
  -> GoogleRfpWorkspace: enter A/Z or import customer design
  -> OpportunityScoutEngine: resolve candidate/advisory route context
  -> Customer Design Import route: persist import when committed
  -> Runtime Object Model: evidence/object/relationship projection from import

Operator
  -> GoogleRfpWorkspace: save/generate/submit proposal
  -> Proposal route: persist Proposal runtime object
  -> Runtime Lifecycle Bridge: relationships/evidence/history/session as needed

Customer/Operator
  -> Proposal route: approve or request changes
  -> Proposal record: approval state/readiness

Operator/Engineer
  -> Engineering Certification route: assemble Draft IOF
  -> Engineering Certification route: certify units/package
  -> ScopeVersion route helper: persist ScopeVersion
```

### Commercial Ownership

Commercial owns the pre-engineering operator experience and advisory/price/design packaging. It does not own final execution truth. That boundary is already visible in the UI text and route behavior: accepted proposals are not ScopeVersions, SOFs, Marketplace executions, Control work, Field closures, Twin truth, or Operational Intelligence authority.

## 11. Twin Architecture

Twin is implemented as a projection, not an authority owner.

### How Twin Is Generated

`server/routes/twin-state.js` generates Twin state by reading:

- ScopeVersion records
- ControlWorkItem records
- FieldClosure records
- RuntimeObject records

When `scopeVersionId` is provided, it builds a selected projection:

- graph context
- route authority
- lifecycle state
- completion metrics from the server Kernel completion engine
- work item status
- closure status
- timeline
- lifecycle violations

Without a selected `scopeVersionId`, it returns aggregate metrics and commercial runtime objects.

### What Twin Consumes

```text
ScopeVersion
  -> canonical truth
  -> lifecycle
  -> stations/objects/closures
  -> graph context

ControlWorkItem
  -> execution/control status

FieldClosure
  -> field completion evidence

RuntimeObject
  -> commercial/runtime context

Kernel completion engine
  -> completion metrics
```

### Does Twin Mutate Anything?

No implemented Twin route mutation was identified. Twin produces a JSON projection. It does not persist ScopeVersion, Runtime, Control, or Field changes.

### Twin vs Runtime

Runtime stores objects, relationships, evidence, history, inventories, and WorkspaceSession resume pointers. Twin reads Runtime and domain objects to project operational state.

### Twin vs ScopeVersion

ScopeVersion is constitutional truth. Twin is a read model over ScopeVersion and related records.

### Twin Dependency Graph

```text
Twin route
  -> DIRS.scopeVersions
  -> DIRS.controlWorkItems
  -> DIRS.fieldClosures
  -> DIRS.runtimeObjects
  -> server/kernel/completion-engine.js
  -> JSON projection
```

## 12. Workspace Responsibilities

| Workspace | Location | Current responsibility | Delegated correctly | Logic that remains in workspace |
|---|---|---|---|---|
| Google RFP / Commercial Planning | `src/components/workspaces/GoogleRfpWorkspace.tsx` | Main Google commercial/account/product/proposal/engineering operator flow. | Calls commercial engines, API client, Runtime, Product, Proposal, Engineering routes. | Large amount of orchestration, view state, A/Z handling, runtime/proposal/package sequencing. |
| Teralinx Route | `src/components/workspaces/TeralinxRouteWorkspace.tsx` | Route intake/design oriented surface. | Uses route/design models. | Workspace-level operator flow. |
| Design | `src/components/workspaces/DesignWorkspace.tsx` | Design surface. | Delegates some model/engine work. | Product/design UX state. |
| Proposed Network | `src/components/workspaces/ProposedNetworkWorkspace.tsx` | Proposed network visualization/review. | Uses proposed network components. | View composition and selection. |
| Preliminary Proposal | `src/components/workspaces/PreliminaryProposalWorkspace.tsx` | Preliminary proposal display/workflow. | Uses proposal/commercial structures. | Proposal-specific UI state. |
| Translate | `src/workspaces/TranslateWorkspace.tsx` | Upload/parse/validate/commit translation workflow. | Uses translate parsers and runtime object model. | Upload and stage UI state. |
| Graph Viewer | `src/workspaces/GraphViewerWorkspace.tsx` | Inventory graph inspection. | Uses graph/domain models. | Graph selection/view state. |
| Graph Extensions | `src/workspaces/GraphExtensionWorkspace.tsx` | Graph extension workflow. | Uses graph extension models. | Extension selection/interaction. |
| Inventory | `src/workspaces/DALInventoryWorkspace.tsx` | Inventory display/interaction. | Uses inventory models. | View filters/selections. |
| Inventory Recovery | `src/workspaces/InventoryRecoveryWorkspace.tsx` | Recovery/sync inspection. | Uses inventory/runtime APIs. | Recovery UI state. |
| Prism | `src/workspaces/PrismWorkspace.tsx` | Scoring/recommendation surface. | Uses Prism engines/fixtures. | Scenario/display state. |
| Prism Site Decision | `src/workspaces/PrismSiteDecisionWorkspace.tsx` | Site decision advisory surface. | Uses Prism/site decision logic. | Decision scenario UI. |
| Route Engineering | `src/workspaces/RouteEngineeringWorkspace.tsx` | Route engineering review. | Uses route/scope/certification models. | Engineering view state. |
| Candidate Sites | `src/workspaces/CandidateSitesWorkspace.tsx` | Candidate site management. | Uses candidate site routes/models. | Site selection and display. |
| Network Affinity | `src/workspaces/NetworkAffinityWorkspace.tsx` | Affinity analysis surface. | Uses affinity models. | Analysis view state. |
| Portfolio | `src/workspaces/PortfolioWorkspace.tsx` | Portfolio rollup view. | Uses portfolio/domain state. | Filtering and portfolio display. |
| Marketplace | `src/workspaces/MarketplaceWorkspace.tsx` | Marketplace quotes/packages view. | Uses marketplace models/routes. | Marketplace UI state. |
| Control | `src/workspaces/ControlWorkspace.tsx` | Control work item/readiness surface. | Uses Control routes/models. | Control dashboard state. |
| Field | `src/workspaces/FieldWorkspace.tsx` | Field closure/work surface. | Uses Field routes/models. | Field operator interaction state. |
| Twin | `src/workspaces/TwinWorkspace.tsx` | Twin projection display. | Uses ScopeVersion Twin projection and Twin route. | Projection selection/view state. |
| Operational Intelligence | `src/workspaces/OperationalIntelligenceWorkspace.tsx` | Completion/operations readiness view. | Uses Kernel completion projection. | Portfolio/ops display state. |

Workspace architecture pattern:

```text
DALApp selects workspace
  -> Workspace composes UI
  -> Engines compute advisory/deterministic outputs
  -> API client calls server routes for persistence/authority
  -> Runtime rehydration restores durable context
```

## 13. Dependency Graphs

### Commercial

```text
GoogleRfpWorkspace
  -> DAL auth/session
  -> Account/contact API
  -> Opportunity API
  -> Product Fulfillment API
  -> Proposal API
  -> Runtime Lifecycle Bridge API
  -> Runtime Rehydration API
  -> Engineering Certification API
  -> OpportunityScoutEngine
  -> CommercialAttachmentEngine
  -> CommercialOsrmRoutingEngine
  -> Commercial pricing/estimating engines
  -> Customer inventory/twin data
```

### Translate

```text
TranslateWorkspace
  -> translate parsers
  -> customer design import records
  -> RuntimeObjectModel
  -> runtime evidence
  -> runtime objects
  -> runtime relationships
  -> translation commits
```

### Design

```text
Design surfaces
  -> OpportunityScoutEngine
  -> routing / routeGeneration
  -> graph / proposedGraph
  -> commercial estimation
  -> product selection / fulfillment metadata
  -> proposal and engineering handoff
  -> ScopeVersion helpers after authority
```

### Kernel

```text
KernelInvariantEngine
  -> ScopeVersionLifecycleGuard
  -> CompletionEngine
  -> KernelStateRegistry

CompletionEngine
  -> ScopeVersion-shaped data
  -> ControlWorkItem-shaped data
  -> Closure-shaped data

Server completion engine
  -> ScopeVersion route
  -> Twin route
```

### Runtime

```text
Runtime Foundation
  -> runtime collection directories
  -> generic JSON collection handler

Runtime Workspace Session
  -> accounts
  -> contacts
  -> opportunities
  -> products
  -> fulfillment plans
  -> proposals
  -> IOF packages
  -> certified packages
  -> scopeversions
  -> runtime objects
  -> runtime history

Runtime Lifecycle Bridge
  -> opportunities
  -> proposals
  -> product fulfillment
  -> engineering certification
  -> runtime relationships
  -> runtime evidence
  -> runtime history
  -> runtime workspace session
```

### ScopeVersion

```text
ScopeVersion route
  -> authority permissions
  -> server/data/scopeversions
  -> server/data/control-work-items
  -> server kernel completion
  -> close records
  -> child ScopeVersion creation

Client ScopeVersion helpers
  -> inventory graph
  -> customer design imports
  -> opportunities
  -> graph extensions
  -> site decisions
  -> field closures
```

### Marketplace

```text
MarketplaceWorkspace
  -> marketplace domain models
  -> marketplace quote route
  -> marketplace quote records
  -> product/scope context when available
```

### Control

```text
ControlWorkspace
  -> control work item route
  -> ScopeVersion references
  -> ControlWorkItem records
  -> Twin projection consumers
  -> Field closure prerequisites
```

### Field

```text
FieldWorkspace
  -> field closure route
  -> ScopeVersion close authority
  -> ControlWorkItem prerequisites
  -> FieldClosure records
  -> Twin and completion projection
```

### Twin

```text
Twin route / TwinWorkspace
  -> ScopeVersion
  -> RuntimeObject
  -> ControlWorkItem
  -> FieldClosure
  -> Kernel completion projection
```

### Operational Intelligence

```text
OperationalIntelligenceWorkspace
  -> ScopeVersion records
  -> ControlWorkItem records
  -> closure records
  -> client Kernel CompletionEngine
  -> operations readiness display
```

## 14. Runtime Object Inventory

| Object | Persisted? | Primary persistence | Runtime mirror/projection | Parent/relationship IDs |
|---|---|---|---|---|
| Account | Yes | `server/data/accounts` | Can be referenced by WorkspaceSession/history. | `accountId`, `customerId`, organization/workspace IDs. |
| Contact | Yes | `server/data/contacts` | Used by proposal/customer review/approval/SOF recipient flows. | `contactId`, `accountId`. |
| Commercial Opportunity | Yes | `server/data/commercial-opportunities` | Runtime lifecycle bridge can relate/history it. | `opportunityId`, `accountId`, `customerId`, product/proposal refs. |
| Product | Yes | `server/data/products` | Mirrored as `PRODUCT` RuntimeObject. | `productId`, runtimeObjectId. |
| Fulfillment Plan | Yes | `server/data/fulfillment-plans` | Mirrored as `FULFILLMENT_PLAN` RuntimeObject. | `fulfillmentPlanId`, `productId`, `accountId`, `opportunityId`, `proposalId`. |
| Customer Design Import | Yes | `server/data/customer-design-imports` | Converted to runtime objects/evidence/relationships by runtime object model. | `designId`, account/customer refs, evidence refs. |
| Runtime Inventory | Yes | `server/data/runtime-inventories` | Native runtime inventory collection. | `inventoryId`, object/relationship/evidence IDs. |
| Runtime Object | Yes | `server/data/runtime-objects` | Primary runtime object library. | `runtimeId`, `objectId`, objectType, relationship/evidence links. |
| Runtime Relationship | Yes | `server/data/runtime-relationships` | Primary runtime relationship graph. | `relationshipId`, from/to runtime/object IDs. |
| Runtime Evidence | Yes | `server/data/runtime-evidence` | Evidence library. | `evidenceId`, source metadata. |
| Runtime Validation | Yes | `server/data/runtime-validation` | Validation records. | `validationId`, checks. |
| Runtime History | Yes | `server/data/runtime-history` | Runtime audit trail. | `historyId`, objectId, eventType, actor, metadata IDs. |
| WorkspaceSession | Yes | `server/data/runtime-workspace-sessions` | Mirrored as `WORKSPACE_SESSION` RuntimeObject. | `sessionId`, user/workspace/account/opportunity/product/proposal/scope IDs. |
| Proposal | Yes | `server/data/proposal-drafts` | Proposal runtime object shape is loaded into workspace and bridge. | `proposalId`, account/opportunity/product/fulfillment/contact refs. |
| Draft IOF Package | Yes | `server/data/iof-packages` | Loaded by engineering queue and rehydration. | `packageId`, `proposalId`, account/opportunity/product/fulfillment refs. |
| Certified IOF Package | Yes | `server/data/certified-iof-packages` | Loaded by rehydration and used for ScopeVersion generation. | `certifiedPackageId`, `packageId`, `proposalId`, `scopeVersionId`. |
| Execution Authorization Certificate | Yes | `server/data/execution-authorization-certificates` | Certification evidence. | certificate ID, package/scope/proposal refs. |
| ScopeVersion | Yes | `server/data/scopeversions` | Referenced by WorkspaceSession and Twin. | `scopeVersionId`, parent/child refs, route/certification refs. |
| ControlWorkItem | Yes | `server/data/control-work-items` | Twin consumes it. | `workItemId`, `scopeVersionId`. |
| FieldClosure | Yes | `server/data/field-closures` | Twin and completion consume it. | `closureId`, `scopeVersionId`, `workItemId`, station/object refs. |
| MarketplaceQuote | Yes | `server/data/marketplace-quotes` | Marketplace surface consumes it. | quote/package/vendor/scope refs where present. |
| TwinProjection | No as independent truth | Computed by `server/routes/twin-state.js` or client projection helpers. | Derived projection only. | Depends on selected ScopeVersion/runtime/work/closure IDs. |
| CompletionProjection | No as independent truth | Computed by Kernel completion engine. | Derived metrics only. | Depends on ScopeVersion/work/closure inputs. |
| UI form draft | No | React state. | Transient. | None until save action. |
| Open tab/panel/scroll state | Generally no | React state or session UI hints only. | Transient, not governed runtime. | None. |

## 15. Existing Architectural Principles

Only principles supported by current implementation are listed here.

1. Runtime owns continuity, not all domain truth.
   WorkspaceSession stores pointers and rehydration context. Domain records remain in domain collections.

2. ScopeVersion owns execution truth after certification.
   Certified IOF and Engineering Certification feed ScopeVersion. Twin and downstream work consume ScopeVersion rather than proposals as execution truth.

3. Kernel validates and projects.
   Kernel computes invariants, aliases, completion, and readiness diagnostics. It does not persist or execute authority transitions.

4. Twin is a projection.
   Twin reads Runtime, ScopeVersion, Control, and Field records. It does not mutate them.

5. Product fulfillment is carrier-neutral.
   Ownership is metadata in Fulfillment Plans. Fulfillment is not constrained to Teralinx-owned assets.

6. Engineering Certification is an authority boundary.
   Draft IOF Package and engineering checklist/unit certification produce Certified IOF Package, certificate, and ScopeVersion.

7. Runtime history is an audit trail for governed transitions.
   Runtime routes append history events for lifecycle and session changes.

8. UI-only state is not automatically runtime.
   React state is extensive, but persistence occurs through explicit save/advance/certify calls.

9. Certified ScopeVersion state resists direct mutation.
   Certified immutable records create child versions for certain changes and reject direct deletion.

10. AI/reasoning surfaces are advisory.
   DAL reasoning prompts exist, Prism is advisory, and authority mutations require explicit routes/human actions.

## 16. Existing Design Patterns

| Pattern | Where seen | Description |
|---|---|---|
| Normalize -> persist -> mirror -> history | Product fulfillment, workspace session, runtime lifecycle bridge | Routes normalize records, persist domain state, mirror runtime objects where needed, append history. |
| File-backed JSON collections | `_shared.js` and route modules | Domain objects are stored as JSON records under `server/data`. |
| Route-specific authority before generic runtime | `server/index.js` | Specific runtime routes run before generic Runtime Foundation. |
| Runtime mirror | Product, Fulfillment Plan, WorkspaceSession | Domain records can have RuntimeObject mirrors without moving all truth into Runtime. |
| Read projection | Twin, Kernel completion, ScopeVersion Twin projection | Derived views are computed from source records and not saved as authority. |
| Certified immutability / child versioning | ScopeVersion route | Certified ScopeVersion changes use child records rather than overwriting final truth. |
| Advisory flags | OpportunityScoutEngine, evidence records | Advisory outputs include no ScopeVersion creation / no inventory mutation semantics. |
| Permission-gated routes | ScopeVersion, engineering certification, proposal/auth-related routes | State mutation requires permissions. |
| Regression validations as architecture guardrails | Sprint validation scripts | Behavior is documented and guarded through Node validation scripts. |
| Workspace orchestration plus service routes | DAL workspaces and API client | UI coordinates work but durable mutation is route-backed. |

## 17. Existing Constitutional Patterns

| Pattern | Implemented expression |
|---|---|
| Authority boundary | ScopeVersion permissions, Engineering Certification, proposal approval actions, close authority checks. |
| Evidence boundary | Runtime Evidence, Draft IOF manifest/evidence refs, execution certificates, closure evidence. |
| Runtime history | Runtime Lifecycle Bridge, WorkspaceSession history, account/contact/proposal activity. |
| Lifecycle non-regression | ScopeVersion lifecycle merge preserves highest lifecycle unless exception states apply. |
| Certified immutability | Certified ScopeVersion cannot be directly deleted and may create child versions on update. |
| Close authority | Closure records are validated against ScopeVersion, stations/objects, authority, duplicate IDs, ControlWorkItem readiness. |
| Projection isolation | Twin reads and reports; it does not write authority. |
| Kernel invariant reporting | Blocking/warning/info findings for lifecycle, aliases, completion, fallback, and projection isolation. |
| Human certification | Engineering package certification requires actor/checklist path; proposal customer approval is an explicit action. |
| Product fulfillment doctrine in code | Fulfillment Plan flags express ownership as metadata and no ownership constraint. |

## 18. Areas Already Well Designed

1. Runtime rehydration is correctly modeled as continuity through pointers.
   The WorkspaceSession model avoids turning UI convenience into duplicated domain truth.

2. Specific runtime route ordering is now correct.
   `handleRuntimeWorkspaceSession` owns `/api/runtime/rehydrate` before generic Runtime Foundation can catch it.

3. ScopeVersion authority is well guarded after certification.
   Lifecycle merge, immutability, child versioning, closure validation, and permission gates are implemented.

4. Engineering Certification is a strong domain boundary.
   It assembles package evidence, certifies units/package, creates certificates, and persists ScopeVersion.

5. Product Fulfillment captures a distinctive carrier-neutral principle in executable data.
   Ownership classes and fulfillment mix are persisted and mirrored into runtime.

6. Twin projection is appropriately read-only.
   It consumes truth and reports operational state without becoming a second truth store.

7. Kernel has a clear non-mutating role.
   Its current implementation validates, normalizes, and projects rather than hiding state mutation.

8. Validation culture is strong.
   Sprint validation scripts encode important architectural constraints and make regressions visible.

## 19. Areas Requiring Clarification

These are not recommendations to change architecture. They are boundaries that need naming before Sprint 19 relies on them.

1. What is the implemented aggregate root for a guided opportunity?
   Account, Opportunity, WorkspaceSession, Proposal, and Runtime Lifecycle Bridge all participate.

2. Is pre-certification Spine a Runtime object, a Draft ScopeVersion candidate, or a structured set of artifacts?
   The post-certification ScopeVersion boundary is clear; pre-certification design authority is less clear.

3. Where should CustomerIntent live as an implemented artifact?
   Customer inputs exist through UI state, imports, opportunity records, and proposal fields, but the single artifact boundary is not explicit.

4. Which module owns next-action determination?
   Current next actions are distributed across UI state, proposal readiness, runtime lifecycle bridge, and route responses.

5. Is Product policy intended to remain in `product-fulfillment.js`, or become a client/server shared policy registry?
   Product already behaves policy-like, but the implemented source of truth is distributed.

6. Which runtime relationship ID convention is canonical?
   Runtime Foundation uses runtime IDs; lifecycle bridge also stores from/to object IDs.

7. How should client and server Kernel logic remain synchronized?
   Completion exists in both TypeScript and server JavaScript.

8. What is the authoritative route/geometry object before Engineering Certification?
   Geometry is carried through route results, proposal references, Draft IOF units, and ScopeVersion truth.

## 20. Actual Technical Debt

This section separates visible debt from intentional architecture.

1. `GoogleRfpWorkspace.tsx` is a very large orchestration surface.
   This is actual debt because it mixes many operator flow concerns, not because workspaces should be thin by doctrine.

2. Kernel completion logic exists in both client TypeScript and server JavaScript.
   The duplication is currently understandable, but it creates drift risk.

3. Lifecycle and transition concepts are mirrored across docs, client guards, server routes, and validations.
   Some duplication is constitutional mirroring; the debt is the lack of a generated or mechanically checked source for mirrored tables.

4. Pre-certification design state is distributed.
   Candidate, geometry, customer intent, product policy, pricing, and proposal readiness do not yet have one implemented aggregate.

5. Runtime relationship shapes are not fully uniform.
   Runtime Foundation normalizes `fromRuntimeId`/`toRuntimeId`, while lifecycle bridge persists relationship records with `fromObjectId`/`toObjectId` fields as well.

6. Product policy is split between server product definitions and commercial UI options.
   Product Fulfillment is strong, but design/pricing/deliverable policy is not fully centralized.

7. Several domains are validated by scripts and doctrines before they are fully one operator path.
   This is not bad architecture, but it is a readiness gap for a first-time operator workflow.

8. Route/geometry references are repeated through Proposal, Draft IOF, Certified IOF, ScopeVersion, and WorkspaceSession metadata.
   This supports traceability, but canonical ownership before certification remains hard to inspect.

## 21. Questions Before Sprint 19

1. What object is the unit of guided work: `CommercialOpportunity`, `WorkspaceSession`, a Runtime lifecycle object, or a new composition over existing IDs?

2. What exact artifact marks "customer inputs staged" after refresh?

3. What exact artifact marks "intent validated"?

4. What exact artifact marks "design approved" before Engineering Certification?

5. Should Spine commit be persisted as a Runtime Object, a proposal dependency, or a ScopeVersion candidate?

6. Should Proposal generation be blocked unless a pre-certification design artifact exists, or is current proposal readiness sufficient for Sprint 19 scope?

7. Which fields in Product definition are authoritative policy, and which are UI defaults?

8. Which side owns Product policy validation: server route, shared engine, or validation script only?

9. Should Runtime relationships standardize on runtime IDs, domain object IDs, or both with explicit fields?

10. Which existing route should own next governed action state?

11. How should client/server Kernel parity be maintained?

12. What is the minimum acceptance path through Certified IOF Package that must survive rehydration without relying on unsaved UI state?

## 22. Recommendations

These recommendations are based only on discovered architecture.

1. Preserve the current constitutional centers.
   Runtime, ScopeVersion, Kernel, Engineering Certification, Product Fulfillment, and Twin already have coherent roles. Sprint 19 should build on those boundaries.

2. Treat `GoogleRfpWorkspace.tsx` as the main discovery surface, not as evidence that the architecture is absent.
   The workspace currently contains too much orchestration, but it also reveals the real end-to-end workflow and all domain handoffs.

3. Document the implemented object lineage for the Google path before changing behavior.
   The critical lineage is Account -> Contact -> Opportunity -> Product -> Fulfillment Plan -> Proposal -> Draft IOF Package -> Certified IOF Package -> ScopeVersion -> Twin.

4. Keep ScopeVersion authority after Engineering Certification intact.
   No discovered implementation requires Proposal or UI state to bypass that gate.

5. Name the pre-certification design authority boundary before implementing guided Sprint 19 behavior.
   The current architecture can support Sprint 19, but the existing code does not yet make that boundary as explicit as Engineering Certification or ScopeVersion.

6. Use existing validation style as the guardrail for Sprint 19.
   The repository already relies on Node validation scripts to make doctrine executable. New behavior should be validated in the same style.

7. Avoid replacing Runtime with a different state model.
   Runtime already provides object libraries, relationships, history, and WorkspaceSession rehydration. The open problem is clearer lineage and state naming, not replacement.

8. Avoid replacing Kernel with an execution engine.
   Kernel currently succeeds because it validates and projects. Moving mutation into Kernel would be an architectural change not supported by current implementation evidence.

9. Keep Twin read-only.
   Twin's current projection model is clean and should remain distinct from Runtime and ScopeVersion authority.

10. Before Sprint 19 implementation, produce a short object-boundary decision record for:
    - CustomerIntent
    - ApprovedDesign
    - StationedGeometry
    - SpineCommit
    - GuidedOpportunity state

Final current-state conclusion:

Hyperlinx already has the skeleton of a governed infrastructure operating system. The implemented architecture is not missing its foundation; it needs Sprint 19 to make the existing boundaries visible and operable for a human. The platform should enter Sprint 19 by preserving the current constitutional architecture and clarifying the pre-certification opportunity/design boundary, not by replacing Runtime, ScopeVersion, Kernel, Product Fulfillment, or Twin.
