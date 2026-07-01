# Sprint 19 Kernel Constitutional Audit

Status: Sprint 19 foundation audit

Purpose: Determine whether the current Kernel architecture is sufficient to become the permanent constitutional execution engine for Hyperlinx.

Conclusion:

> The Kernel is ready to become Hyperlinx's permanent constitutional validation and eligibility engine, but it is not ready, and should not be allowed, to become a mutating execution authority. Runtime owns mutable operational state. ScopeVersion owns constitutional truth. The Kernel governs invariants, readiness, eligibility, replayability, and health.

## 1. Kernel Architecture Audit

### Current Implementation

Current Kernel implementation exists in:

- `src/kernel/KernelInvariantEngine.ts`
- `src/kernel/CompletionEngine.ts`
- `src/kernel/KernelStateRegistry.ts`
- `server/kernel/completion-engine.js`
- `src/audit/ConstitutionalAuditEngine.ts`
- `src/audit/ProductionIntegrationAuditEngine.ts`
- Kernel consumers in `server/routes/scopeversions.js`, `server/routes/twin-state.js`, and `src/scopeversion/ScopeVersionTwinProjection.ts`

Current Kernel behavior:

- Calculates completion projections from ScopeVersion stations, objects, control work, and field closures.
- Checks invariants around lifecycle regression, immutable certified evidence, Control work authority, Field closure validity, Twin projection isolation, portfolio boundaries, fallback mode, alias normalization, and completion data.
- Normalizes canonical state aliases for Control work and route authority.
- Supports constitutional audit concepts through traceability, authority, lifecycle, close, and replayability audit engines.
- Is already consumed by Twin and ScopeVersion surfaces as a projection/validation service.

### Missing Implementation

The Kernel does not yet provide a single constitutional service boundary for:

- Opportunity progression.
- Product policy enforcement.
- Design compilation orchestration.
- Runtime relationship graph validation.
- Runtime object lineage validation.
- Transition eligibility across Account, Product, Intent, Design, Proposal, Engineering, Marketplace, Control, Field, Twin, and Operational Intelligence.
- Runtime synchronization health.
- Replay validation over full Runtime History.
- Next governed action evaluation for the operator experience.

### Recommended Architecture

The Kernel should be a non-mutating constitutional engine with four public roles:

1. Invariant engine: checks whether runtime and ScopeVersion state violates doctrine.
2. Eligibility engine: determines whether a governed transition may be requested.
3. Readiness engine: evaluates whether a subsystem is ready for its next handoff.
4. Replay engine: proves a lifecycle sequence can be reconstructed from evidence, artifacts, relationships, actors, and history.

The Kernel should return verdicts, diagnostics, blockers, warnings, and required evidence. It should not directly create Accounts, Opportunities, Proposals, ScopeVersions, Marketplace packages, Control work, Field closures, or Twin projections.

### Future Ownership

Kernel owns:

- Constitutional invariants.
- Eligibility rules.
- Readiness checks.
- Completion projections.
- Replay validation.
- Relationship and lineage validation.
- Runtime health diagnostics.
- Cross-subsystem dependency checks.

Kernel does not own:

- Runtime persistence.
- ScopeVersion creation or mutation.
- UI state.
- Twin authority.
- Product definition authoring.
- Design Compiler internals.
- Human certification.
- AI recommendations.

### Validation Strategy

Kernel validation should be separated into:

- Unit tests for individual invariants.
- Snapshot tests for full opportunity lifecycle replay.
- Integration tests proving Kernel can read Runtime and ScopeVersion without mutating them.
- Regression tests proving Twin remains read-only and AI remains advisory.
- Negative tests for invalid transitions, orphan runtime objects, foreign ScopeVersion closures, and lifecycle bypass attempts.

## 2. Kernel Responsibility Matrix

| Responsibility | Current Implementation | Missing Implementation | Belongs in Kernel | Kernel Mode | Future Owner | Validation Strategy |
|---|---|---|---:|---|---|---|
| Lifecycle progression | ScopeVersion lifecycle engines and Runtime lifecycle bridge advance domain workflows. | Unified eligibility verdict before each lifecycle action. | Partial | Validate / determine eligibility | Runtime mutates; ScopeVersion owns truth | Transition eligibility validation |
| State validation | `KernelInvariantEngine`, ScopeVersion validation, constitutional audit. | One Kernel validation API across Runtime, Opportunity, ScopeVersion, Twin. | Yes | Validate | Kernel | Kernel invariant validation |
| Invariant checking | Implemented for lifecycle, certified evidence, Control, Field, Twin, completion, fallback, aliases. | Product, Opportunity, Runtime relationship, and Design invariants. | Yes | Validate | Kernel | Invariant suite |
| Transition eligibility | ScopeVersion transition authority exists; runtime lifecycle has permission checks. | Cross-object transition eligibility for guided opportunity. | Yes | Determine eligibility | Kernel verdict; Runtime executes | Guided opportunity validation |
| Completion engine | `CompletionEngine` and server completion engine exist. | Single shared implementation or generated server mirror. | Yes | Project / validate | Kernel | Completion validation |
| Dependency graph | Production integration audit evaluates dependencies. | Runtime relationship graph and Opportunity dependency graph validation. | Yes | Validate | Kernel | Relationship graph validation |
| Authority enforcement | Auth routes and subsystem routes enforce permissions; ScopeVersion authority engines enforce close/lifecycle. | Constitutional authority verdict before Runtime mutations. | Partial | Validate, never certify alone | Runtime/routes enforce; humans certify | Authority boundary validation |
| Replay validation | Constitutional audit has replayability checks. | Full Runtime History replay through Google opportunity. | Yes | Validate | Kernel | Replay validation script |
| Relationship validation | Some relationship IDs are persisted by Runtime lifecycle bridge. | Global runtime relationship graph validator. | Yes | Validate | Kernel | Relationship validation script |
| Object lineage | Runtime objects carry source IDs; ScopeVersion lineage exists. | Global lineage chain Account -> Product -> Design -> Proposal -> Certified IOF -> ScopeVersion. | Yes | Validate | Kernel | Lineage validation |
| Governed transitions | Doctrine exists; some routes write runtime history. | Required transition record schema enforced. | Yes | Validate eligibility and schema | Runtime persists | Governed transition validation |
| Runtime health | Fallback logging and production integration audit exist. | Runtime library health, orphan object checks, route ordering checks. | Yes | Observe / validate | Kernel | Runtime health validation |
| Opportunity progression | Not yet centralized; distributed across workspace and runtime bridge. | Opportunity state machine and next action engine. | Partial | Determine eligibility / next action | Runtime owns Opportunity state | Guided opportunity validation |
| Product policy enforcement | Product fulfillment route and Sprint 15 validation exist. | Kernel check that actions comply with Product policy. | Yes, as validation | Validate policy compliance | Product owns policy; Kernel validates | Product policy validation |
| Design compilation orchestration | Design logic distributed across UI and engines. | Compiler boundary and request/response contract. | No direct ownership | Observe / validate inputs and outputs | Design Compiler | Design compiler validation |
| ScopeVersion validation | ScopeVersion validation and Kernel invariants exist. | Kernel should expose aggregate ScopeVersion constitutional verdict. | Yes | Validate | Kernel + ScopeVersion services | ScopeVersion validation |
| Runtime synchronization | WorkspaceSession rehydration exists. | Kernel health checks for stale/missing mirrors, relationships, history. | Yes | Observe / validate | Runtime persists | Runtime sync validation |
| Twin projection triggers | Twin state route calls completion engine. | Kernel should not trigger Twin mutation; it can validate projection safety. | Partial | Validate read projection | Twin projects | Twin isolation validation |
| Marketplace readiness | Production integration audit and marketplace validations exist. | ScopeVersion-derived readiness verdict. | Yes | Determine readiness | Marketplace executes | Marketplace readiness validation |
| Control readiness | Production integration audit and Control validation exist. | Kernel readiness verdict from ScopeVersion, closes, contract/control evidence. | Yes | Determine readiness | Control executes | Control readiness validation |
| Field readiness | Field and closure validations exist. | Kernel readiness verdict before closure acceptance. | Yes | Determine readiness | Field executes | Field readiness validation |
| Operational Intelligence readiness | Operations authority exists as contracts/fixtures. | Kernel readiness verdict for operations handoff. | Yes | Determine readiness | OI observes; Operations certifies | OI readiness validation |

## 3. Authority Matrix

| Subsystem | Authority Owned | Authority Outside Kernel | Kernel Validates or Mutates | Kernel Observes or Executes | Kernel Certifies or Determines Eligibility |
|---|---|---|---|---|---|
| Commercial | Account, Opportunity, pre-proposal commercial action, proposal generation. | Customer approval, engineering certification, ScopeVersion truth. | Validates readiness; does not mutate. | Observes commercial artifacts. | Determines eligibility. |
| Engineering | Draft IOF review, Certified IOF Package, execution certificate. | Runtime persistence and ScopeVersion route mutation. | Validates certification prerequisites; does not certify. | Observes engineering artifacts. | Determines eligibility; human engineer certifies. |
| Marketplace | Vendor/bid package activity from executable scope. | ScopeVersion authority and Control activation. | Validates readiness; does not award or mutate. | Observes marketplace package state. | Determines readiness. |
| Control | Control work authorization and activation. | Field closure and operations authority. | Validates Control prerequisites; does not activate. | Observes Control state. | Determines eligibility. |
| Field | Field execution evidence and closure submission. | ScopeVersion close validation and completion authority. | Validates closure references; does not certify alone. | Observes Field closures. | Determines eligibility. |
| Twin | Read-only projection. | All mutation and authority. | Validates projection isolation. | Observes/provides projection diagnostics. | Never certifies. |
| Operational Intelligence | Portfolio observation and operations readiness advisory. | Operations close/certification. | Validates readiness inputs. | Observes. | Determines readiness. |
| Runtime | Mutable operational state, objects, relationships, history, WorkspaceSession. | ScopeVersion constitutional truth. | Kernel validates Runtime health; Runtime mutates. | Kernel observes Runtime. | Determines eligibility; Runtime executes. |
| ScopeVersion | Constitutional execution truth and lifecycle state. | UI, Runtime, Twin, AI cannot override it. | Kernel validates; ScopeVersion services mutate through authority. | Kernel observes ScopeVersion. | Determines eligibility; human/route certifies. |
| Product | Product policy, standards, pricing model, fulfillment rules. | Runtime execution and ScopeVersion truth. | Kernel validates policy compliance. | Observes policy. | Determines eligibility. |
| Design Compiler | Deterministic design candidate compilation. | Human design approval and ScopeVersion certification. | Kernel validates input/output contract. | Invoked by Commercial/Runtime or Product service, not owned by Kernel. | Determines whether compiled result is eligible for approval. |
| AI / Reasoning | Advisory explanation only. | Certification, mutation, authority. | Kernel validates advisory boundary. | Observes AI artifacts if persisted. | Never certifies. |

## 4. Runtime Relationship Audit

### Kernel Interaction With Runtime

| Runtime Surface | Kernel Reads | Kernel Writes | Kernel Never Touches | Required Kernel Check |
|---|---|---|---|---|
| Runtime | Runtime health, availability, route contract, fallback mode. | Nothing directly. | Runtime persistence and mutation. | Health and route ordering diagnostics. |
| Workspace Session | Resume pointers, authority trail, current object, selected IDs. | Nothing directly. | Session persistence. | Stale pointer and missing object checks. |
| Runtime Objects | Object type, source ID, metadata, authority, relationships. | Nothing directly. | Object creation/update/delete. | Orphan, duplicate, owner, authority, and source lineage checks. |
| Relationship Graph | Relationship IDs, from/to object IDs, relationship type. | Nothing directly. | Relationship repair or creation. | Missing, foreign, cyclic, or invalid relationship checks. |
| Runtime History | Event type, actor, object, timestamp, metadata. | Nothing directly. | History append. | Replayability, actor, ordering, evidence checks. |
| Evidence Registry | Evidence IDs, source, authority, provenance. | Nothing directly. | Evidence creation. | Missing evidence and AI/human authority checks. |
| Validation Pipeline | Validation results and diagnostics. | Kernel diagnostics as return values only. | Persisted validation state unless Runtime records it. | Transition readiness and proof completeness. |
| Opportunity | Opportunity ID, account/product links, current state, artifacts. | Nothing directly. | Opportunity state mutation. | State machine, dependency, next action, readiness checks. |

### Runtime Object Matrix

| Runtime Object | Owner | Authority | Parent | Children | Lifecycle | Validation | Evidence | Kernel Interaction | Replay Requirements |
|---|---|---|---|---|---|---|---|---|---|
| Account | Runtime Account Library | Commercial account authority | Organization / workspace | Contacts, opportunities | Active/customer lifecycle | Required IDs and owner | Account save event | Validate lineage root | Actor, account fields, history |
| Contact | Runtime Contact Library | Commercial/contact authority | Account | Proposal recipients, SOF recipients later | Active/inactive | `accountId`, recipient flags | Contact save event | Validate parent account | Actor, account link, flags |
| Opportunity | Runtime Opportunity Library | Commercial opportunity authority | Account | Product, intent, design, proposal | Guided opportunity state | State machine and dependencies | Opportunity creation/history | Validate aggregate and next action | All child artifacts and history |
| Product | Product Fulfillment service | Product definition authority | Product catalog | Fulfillment Plan, policy | Versioned definition | Product policy completeness | Product selected event | Validate policy compliance | Product ID/version/history |
| CustomerIntent | Future Runtime object | Commercial/customer input authority | Opportunity | IntentValidation, DesignCandidate | Staged/validated | Required product inputs | KMZ/KML/address/SLA evidence | Validate completeness | Inputs, parser diagnostics |
| IntentValidation | Future Runtime object | Kernel eligibility verdict persisted by Runtime | CustomerIntent | DesignCandidate | Passed/blocked | Product policy gate | Validation diagnostics | Kernel produces verdict | Rules, evidence, result |
| DesignCandidate | Future Design Compiler artifact | Design Compiler output, no authority until approved | CustomerIntent/Product | ApprovedDesign | Candidate/advisory | Deterministic output | Design diagnostics | Validate compiler contract | Input hash, output, explanation |
| ApprovedDesign | Future Runtime object | Human commercial approval | DesignCandidate | StationedGeometry, SpineCommit | Approved | Evidence and actor | Approval event | Validate approval eligibility | Candidate, actor, timestamp |
| StationedGeometry | Future Runtime object | Design/engineering pre-certification | ApprovedDesign | SpineCommit | Stationed | Stationing rules | Stationing diagnostics | Validate station coverage | Geometry, stations, product policy |
| SpineCommit | Future Runtime object | Commercial governed design authority | Opportunity | Proposal, Draft IOF | Committed | Complete required artifacts | Commit event | Validate pre-proposal readiness | Account, product, intent, design, stationing |
| FulfillmentPlan | Product Fulfillment service | Product fulfillment authority | Product/Opportunity | Proposal, IOF package | Created/resolved | Ownership classes and mix | Fulfillment history | Validate product compliance | Inventory refs, policy, mix |
| Proposal | Proposal Runtime Library | Commercial/customer review authority | Opportunity/SpineCommit | CustomerApproval, Draft IOF | Draft/submitted/approved | Pricing, recipients, lineage | Proposal history | Validate no UI-only source | Pricing, geometry, fulfillment |
| CustomerApproval | Proposal Runtime Library | Customer review authority | Proposal | Draft IOF | Approved/changes requested | Customer actor/contact | Approval history | Validate authority boundary | Actor, contact, proposal |
| Draft IOF Package | IOF Package service | Engineering review authority | Approved Proposal | Certified IOF | Draft/review | Manifest/readiness | Runtime evidence | Validate package lineage | Proposal, objects, evidence |
| Certified IOF Package | Engineering Certification | Engineering authority | Draft IOF | ScopeVersion | Certified | Checklist/certificate | Certificate/evidence | Validate certification prerequisites | Engineer, checklist, package |
| ScopeVersion | ScopeVersion service | Constitutional truth | Certified IOF | Control/Field/OI | Execution lifecycle | ScopeVersion validators | Certificate, closes | Validate invariants and readiness | Canonical truth, lifecycle, closes |
| MarketplacePackage | Marketplace service | Marketplace/commercial authority | ScopeVersion | Quotes/vendor records | Ready/sent/awarded | Scope-derived package | Bid package evidence | Validate ScopeVersion source | Scope, quantities, vendor |
| ControlWorkItem | Control service | Control authority | ScopeVersion | Field closures | Pending/active/complete | Control activation gates | Control close/work item | Validate readiness and lifecycle | Work ID, scope, status |
| FieldClosure | Field service | Field authority | ControlWorkItem/ScopeVersion | Completion close | Submitted/validated | Station/object references | Field evidence | Validate closure references | Closure, work, scope, evidence |
| TwinProjection | Twin service | Read-only projection | Runtime/ScopeVersion | None | Derived | Projection isolation | No authority evidence | Validate read-only isolation | Source object IDs |
| RuntimeHistory | Runtime | Audit authority | Any object | Replay chain | Immutable event | Required actor/object/evidence | It is evidence | Validate replayability | Event order and chain |

## 5. ScopeVersion Audit

### Questions and Answers

Can Kernel create ScopeVersion?

- No. ScopeVersion creation must remain owned by Engineering Certification and ScopeVersion services after Certified IOF Package and execution certificate are present.

Can Kernel modify ScopeVersion?

- No. Kernel may calculate diagnostics and eligibility. ScopeVersion mutation must occur only through governed ScopeVersion services and authority routes.

Should Kernel only validate ScopeVersion?

- Yes. Kernel should validate ScopeVersion invariants, lifecycle consistency, immutable certified evidence, station/object references, control/field readiness, completion projection, and replayability.

Should ScopeVersion call Kernel?

- Yes, for preflight validation and readiness projections. ScopeVersion services may call Kernel before mutation and may persist Kernel verdicts as evidence through Runtime, but Kernel itself should not persist.

Should Kernel determine readiness?

- Yes. Kernel should determine readiness for lifecycle actions, Control, Field, completion, operations, marketplace packaging, and Twin projection safety.

Should Kernel determine completion?

- Yes, as a projection and eligibility verdict. Completion authority remains a governed human/system authority that may consume Kernel completion output.

### ScopeVersion Interaction Matrix

| ScopeVersion Action | Kernel Role | Mutation Owner | Certification Owner | Required Rule |
|---|---|---|---|---|
| Create from Certified IOF | Validate package/certificate readiness | ScopeVersion service | Engineering | Kernel cannot create directly. |
| Update draft candidate | Validate schema and lineage | ScopeVersion service | Authorized route/user | Kernel cannot persist. |
| Certify | Validate immutable evidence and route authority | ScopeVersion service | Engineering/ScopeVersion authority | Certified state becomes protected. |
| Append closure | Validate work item, station, object, lifecycle | ScopeVersion route | Field/close authority | Closure must reference active Control work. |
| Project completion | Calculate completion projection | None | None | Projection is not authority alone. |
| Advance lifecycle | Validate transition eligibility | ScopeVersion lifecycle service | Human/system authority | Required closes and actor role must exist. |
| Twin projection | Validate selected scope and no leakage | Twin route | None | Twin never mutates ScopeVersion. |

## 6. Opportunity Interaction Matrix

Opportunity is becoming the primary runtime aggregate. Runtime should own the mutable Opportunity state. Kernel should validate Opportunity completeness, dependencies, health, and next-action eligibility.

| Opportunity Capability | Kernel Owns? | Runtime Owns? | Recommended Split |
|---|---:|---:|---|
| Opportunity lifecycle | No mutation; yes eligibility | Yes | Runtime stores state; Kernel validates transitions. |
| Opportunity readiness | Yes | Stores verdict if needed | Kernel computes readiness from artifacts. |
| Opportunity progression | Eligibility only | Yes | Runtime advances after human action. |
| Opportunity completion | Readiness/completion verdict | Yes for mutable state | Kernel determines whether completed; Runtime records. |
| Opportunity health | Yes | Stores health history if needed | Kernel detects missing relationships/artifacts. |
| Opportunity dependencies | Yes | Stores relationship graph | Kernel validates dependency graph. |
| Opportunity next actions | Eligibility and blockers | Presents/persists state | Kernel returns next-action model; Reasoning explains. |
| Opportunity validation | Yes | Stores validation history | Kernel validates and Runtime records. |

### Opportunity State Ownership

Runtime should own:

- `opportunityId`
- current opportunity state
- artifact IDs
- relationships
- runtime history
- workspace session pointers

Kernel should return:

- allowed next states
- blocked actions
- required evidence
- missing dependencies
- authority requirements
- replayability status

Reasoning layer should explain:

- why an action is next
- why an action is blocked
- what evidence is missing
- what a human must certify

## 7. Design Compiler Relationship Audit

### Where Design Compiler Belongs

The Design Compiler should be independent. It should not be part of Kernel, not part of UI, and not owned by Runtime.

Rationale:

- Design compilation is a domain engine: it transforms Product Policy, Customer Intent, inventory, constraints, and geometry into deterministic design candidates.
- Kernel should validate that the compiler inputs and outputs satisfy constitutional requirements.
- Runtime should persist selected and approved design artifacts.
- Product Policy should constrain the compiler.
- Commercial should invoke the compiler through the guided opportunity workflow.

### Design Compiler Relationship Diagram

```text
Commercial Guided Workflow
  -> Runtime loads Opportunity, Product, CustomerIntent
  -> Product Policy constrains allowed design space
  -> Design Compiler compiles deterministic candidates
  -> Kernel validates compiler inputs, output schema, evidence, policy compliance
  -> Human approves one candidate
  -> Runtime persists ApprovedDesign / StationedGeometry / SpineCommit
  -> Proposal consumes SpineCommit
  -> Engineering Certification creates Certified IOF and ScopeVersion
```

### Design Compiler Ownership Matrix

| Concern | Owner | Kernel Role |
|---|---|---|
| Candidate generation | Design Compiler | Validate deterministic contract |
| Product constraints | Product Policy | Validate compliance |
| Customer intent | Runtime / Intake | Validate completeness |
| Inventory evaluation | Design Compiler / Fulfillment | Validate allowed sources |
| Candidate explanation | Design Compiler / Reasoning | Validate evidence references |
| Candidate approval | Human operator through Runtime | Validate transition eligibility |
| ScopeVersion creation | Engineering / ScopeVersion service | Validate certification prerequisites |

## 8. Product Policy Relationship Audit

Product Policy should be a Kernel input and compiler input, not a Kernel plug-in that mutates behavior at runtime.

Recommended model:

- Product Policy is a governed Product Definition artifact.
- Product Policy defines required inputs, allowed fulfillment modes, engineering standards, pricing model, deliverables, and validation gates.
- Design Compiler consumes Product Policy.
- Proposal Generator consumes Product Policy and SpineCommit.
- Kernel validates that Product Policy was applied and that the next transition satisfies policy gates.

### Product Policy Relationship Diagram

```text
Product Definition
  -> Product Policy
      -> Customer Intent requirements
      -> Fulfillment policy
      -> Engineering standards
      -> Pricing model
      -> Deliverables
      -> Runtime object template

Product Policy + Customer Intent + Inventory + Constraints
  -> Design Compiler
  -> Candidate Designs
  -> Kernel Policy Compliance Verdict
  -> Human Design Approval
  -> SpineCommit
```

### Product Policy Matrix

| Product Policy Role | Kernel Relationship | Runtime Relationship | Design Compiler Relationship |
|---|---|---|---|
| Required inputs | Kernel validates completeness | Runtime stores CustomerIntent | Compiler receives normalized intent |
| Fulfillment modes | Kernel validates compliance | Runtime stores FulfillmentPlan | Compiler limits candidates |
| Engineering standards | Kernel checks candidate readiness | Runtime stores selected artifacts | Compiler applies standards |
| Pricing model | Kernel validates proposal source | Runtime stores Proposal | Compiler may expose design quantities |
| Deliverables | Kernel validates package readiness | Runtime stores artifacts | Compiler references deliverable needs |
| Runtime object template | Kernel validates lineage | Runtime creates objects | Compiler proposes object set |

## 9. Guided Operator Experience Audit

Kernel should not drive the UI. Kernel should drive the eligibility model that the UI and Reasoning Layer present.

| Operator Guidance Concern | Kernel Role | Runtime Role | Reasoning Layer Role | UI Role |
|---|---|---|---|---|
| Next Action | Determine eligible actions and blockers | Store current opportunity state | Explain why next | Render action |
| Blocked Action | Return missing evidence and authority | Store state and history | Explain recovery | Disable with reason |
| Required Evidence | Determine required evidence | Store evidence artifacts | Summarize evidence | Show checklist |
| Completion | Calculate projection/readiness | Store completion events | Explain completion state | Display progress |
| Warnings | Return diagnostics | Persist if needed | Translate to operator language | Render warning |
| State explanations | Provide machine verdicts | Provide current objects | Explain state | Present context |

Kernel output should be structured and machine-readable. Reasoning output can be human-friendly. UI must not own the business rule.

## 10. Twin Audit

Twin must remain a read-only projection.

Twin reads:

- Runtime Objects.
- Runtime Relationships.
- Runtime History.
- ScopeVersion canonical truth.
- Control work items.
- Field closures.
- Completion projections.

Kernel exposes:

- Completion projection.
- Projection isolation diagnostics.
- Scope leakage warnings.
- Readiness blockers.

Runtime exposes:

- Runtime object library.
- Relationship graph.
- WorkspaceSession pointers.
- History and evidence references.

ScopeVersion exposes:

- Canonical truth.
- Lifecycle state.
- Stations.
- Objects.
- Closures.
- Certified route reference.

Twin must never:

- Create ScopeVersion.
- Modify ScopeVersion.
- Create authority.
- Infer lifecycle state from projection display.
- Promote AI summary into certified state.

## 11. Architectural Principles

Existing principles confirmed:

- Opportunity is the unit of work.
- Runtime owns continuity.
- Kernel governs invariants.
- ScopeVersion owns constitutional truth.
- Products define policy.
- Design is compiled.
- Humans certify.
- AI advises.
- Twin projects.
- Every transition is replayable.
- Every governed action produces evidence.

Additional principles recommended:

- Kernel validates; it does not mutate.
- Kernel determines eligibility; it does not certify authority.
- Runtime records operational state; Kernel evaluates its constitutional health.
- ScopeVersion services may call Kernel, but Kernel may not bypass ScopeVersion authority.
- Design Compiler outputs candidates; Kernel validates policy compliance and replayability.
- Product Policy is governed input, not UI configuration.
- Next Action is a Kernel verdict plus Reasoning explanation, not a UI conditional.
- Completion projection is not completion authority until a governed close or transition consumes it.
- Twin must be derived from Runtime and ScopeVersion, never used as source truth.
- Every server-side Kernel mirror must be kept synchronized with the canonical TypeScript Kernel or generated from it.

## 12. Future Kernel Roadmap

### Phase 1 - Sprint 19 Foundation

- Document Kernel boundaries and authority model.
- Freeze non-mutating Kernel doctrine.
- Add Kernel readiness model for guided opportunity.
- Add validation for Opportunity state machine and transition eligibility.
- Add runtime object relationship validation.

### Phase 2 - Guided Opportunity Kernel API

- Implement `evaluateOpportunityKernelState(input)`.
- Return next actions, blockers, evidence requirements, policy gates, and transition eligibility.
- Do not persist from Kernel.
- Runtime may persist verdicts as history/evidence.

### Phase 3 - Design Compiler Integration

- Define compiler request/response contract.
- Kernel validates Product Policy, Customer Intent, compiler output, and evidence references.
- Human approval persists ApprovedDesign.

### Phase 4 - Runtime Replay Validation

- Build replay validator over Runtime History, Runtime Objects, Relationships, Evidence, and ScopeVersion.
- Prove Google path can be reconstructed from artifacts.

### Phase 5 - Execution Readiness

- Expand Kernel readiness checks for Marketplace, Control, Field, Completion, and Operations.
- Keep execution mutation in subsystem routes and ScopeVersion services.

### Phase 6 - Production Hardening

- Remove duplicate client/server Kernel logic or generate server mirrors.
- Add performance budgets.
- Add large runtime graph validation strategy.
- Add incremental validation and cacheable verdicts.

## 13. Recommended Refactoring Plan

1. Create a formal Kernel contract document and types:
   - `KernelVerdict`
   - `KernelBlocker`
   - `KernelEvidenceRequirement`
   - `KernelTransitionEligibility`
   - `KernelReadiness`

2. Extract Opportunity state eligibility from `GoogleRfpWorkspace.tsx`.

3. Add a Runtime relationship graph validator:
   - orphan objects
   - missing parents
   - duplicate relationships
   - relationship type mismatch
   - missing evidence

4. Add Kernel validation around Product Policy:
   - required inputs
   - allowed fulfillment
   - design candidate compliance
   - proposal readiness

5. Add Design Compiler boundary validation:
   - deterministic input hash
   - output schema
   - candidate explanations
   - evidence references

6. Add replay validation for the Google acceptance path.

7. Consolidate duplicate completion logic:
   - either generate `server/kernel/completion-engine.js` from the TypeScript source
   - or keep an explicit parity validation

8. Add Kernel diagnostics to the right-panel reasoning surface without letting the UI own the rules.

## 14. Risks

| Risk | Severity | Description | Mitigation |
|---|---|---|---|
| Kernel becomes mutating authority | Critical | Would violate Runtime and ScopeVersion doctrine. | Enforce non-mutating Kernel contract. |
| Kernel competes with ScopeVersion | Critical | Would create two sources of constitutional truth. | Kernel validates ScopeVersion; ScopeVersion owns truth. |
| UI continues owning workflow logic | High | Guided experience remains fragile and training-dependent. | Extract next-action and eligibility to Kernel/Runtime services. |
| Design Compiler boundary remains unclear | High | Proposal may continue deriving from UI-only state. | Define compiler artifact and SpineCommit. |
| Product policy stays implicit | High | Designs and proposals can bypass product standards. | Make Product Policy explicit and Kernel-validated. |
| Client/server Kernel drift | High | Completion and invariant behavior may diverge. | Generate server mirror or add parity validation. |
| Runtime relationship graph gaps | Medium | Replay and lineage can fail after refresh or authority transfer. | Add relationship validation. |
| Twin projection leakage | Medium | Twin could display foreign work/closures as selected scope truth. | Keep Kernel Twin isolation checks. |
| Performance degradation | Medium | Full graph validation may become expensive. | Incremental validation, scoped checks, cache verdicts. |

## 15. Technical Debt

- Kernel completion logic exists in both TypeScript and server JavaScript.
- Some ScopeVersion transition and station/object rules are mirrored across client engines and server routes.
- Opportunity state is not yet a first-class runtime aggregate with a single state machine.
- Product Policy exists through product fulfillment, but not yet as a complete compiler policy contract.
- Design Engine behavior is distributed across Opportunity Scout, route generation, commercial engines, proposal logic, and UI handlers.
- Runtime relationship graph validation is not yet centralized.
- Full replay validation over Runtime History is not yet implemented.
- Kernel diagnostics are not yet integrated into the guided operator next-action surface.

## 16. Validation Plan

| Validation | Purpose | Expected Command |
|---|---|---|
| Kernel constitutional audit validation | Confirm the audit document contains required matrices and doctrine. | `node sprint19-kernel-constitutional-audit-validation.mjs` |
| Kernel invariant validation | Prove current invariant engine catches lifecycle, closure, Twin, and completion violations. | Future `node sprint19-kernel-invariant-validation.mjs` |
| Kernel completion parity validation | Prove TS and server completion engines return equivalent projections. | Future `node sprint19-kernel-completion-parity-validation.mjs` |
| Runtime relationship validation | Prove Runtime objects and relationships form a replayable graph. | Future `node sprint19-runtime-relationship-validation.mjs` |
| Opportunity state validation | Prove Opportunity state machine and next actions are deterministic. | Future `node sprint19-guided-opportunity-validation.mjs` |
| Product policy validation | Prove Product Policy gates design, pricing, fulfillment, and deliverables. | Future `node sprint19-product-policy-validation.mjs` |
| Design compiler validation | Prove deterministic candidate output and Product Policy compliance. | Future `node sprint19-design-compiler-validation.mjs` |
| Runtime rehydration regression | Prove WorkspaceSession continuity remains intact. | `node runtime-rehydration-validation.mjs` |
| ScopeVersion transition regression | Prove lifecycle and close authority remain intact. | Existing ScopeVersion validations plus future Sprint 19 script |
| Twin isolation validation | Prove Twin remains read-only and scope-filtered. | Future `node sprint19-twin-isolation-validation.mjs` |

Regression commands to preserve:

```bash
node sprint18-operator-experience-validation.mjs
node runtime-rehydration-validation.mjs
node sprint16-lifecycle-persistence-validation.mjs
node sprint15-product-fulfillment-validation.mjs
node sprint14-account-workspace-validation.mjs
node engineering-certification-validation.mjs
npx tsc --noEmit
npm run build
```

## 17. Sprint Recommendations

### Begin Sprint 19 With These Work Items

1. Freeze Kernel doctrine: validate, determine eligibility, project readiness, never mutate.
2. Add a guided Opportunity state model.
3. Add Kernel Opportunity eligibility evaluation.
4. Define `CustomerIntent`, `ApprovedDesign`, `StationedGeometry`, and `SpineCommit` artifacts.
5. Create Product Policy contract for Protected Dark Fiber IRU.
6. Define Design Compiler request/response contract.
7. Add Kernel relationship and replay validation for the Google acceptance path.
8. Move next-action rules out of UI and into Kernel/Runtime services.

### Do Not Do In Sprint 19

- Do not make Kernel create ScopeVersion.
- Do not make Kernel write Runtime objects.
- Do not make Kernel certify human authority.
- Do not let Twin become authoritative.
- Do not let AI advance lifecycle state.
- Do not add new product families.
- Do not expand Marketplace, Control, Field, or Operational Intelligence beyond guided readiness unless the Google path requires read-only projection.

### Readiness Verdict

The current Kernel is sufficient as a foundation for constitutional validation, completion projection, and invariant checking. It is not yet sufficient as the complete permanent execution engine because Opportunity progression, Product Policy enforcement, Design Compiler validation, Runtime relationship validation, and replay validation are incomplete.

The permanent architecture should be:

```text
Runtime owns mutable operational state.
ScopeVersion owns constitutional truth.
Kernel governs invariants, eligibility, readiness, replayability, and health.
Product Policy constrains design and fulfillment.
Design Compiler creates deterministic design candidates.
Humans certify governed transitions.
AI advises.
Twin projects.
```

Final recommendation:

Proceed with Sprint 19 only if the Kernel remains non-mutating and constitutional. The first Sprint 19 implementation should make the Google Opportunity state machine Kernel-validated and Runtime-owned before adding any new feature layer.
