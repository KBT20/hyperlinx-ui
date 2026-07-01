# Hyperlinx Master Audit and Sprint 19 Plan

Status: Baseline package before Sprint 19

Sprint 19 title: Guided Opportunity Experience

Primary objective:

> An operator should be able to create, qualify, design, price, certify, and advance a Google opportunity without prior training.

IP note: This document does not provide legal advice. IP and patent sections identify technical invention candidates, documentation gaps, and evidence useful for patent counsel.

## 1. Executive Summary

Sprint 18 accomplished four important things:

- It paused feature expansion and reframed the next work around operator continuity.
- It fixed the A/Z dead-action path in Commercial Planning so raw A and Z text can resolve deterministically before a corridor seed is created.
- It created the Sprint 18 Operator Experience doctrine, naming the Google opportunity as the golden acceptance path.
- It passed operator validation, runtime rehydration validation, TypeScript, and production build.

Sprint 18 marks the transition from platform capability to operator experience because the platform now has many governed capabilities, but they are still distributed across panels, workspaces, validations, and runtime routes. The next value is not another product family or automation layer. The next value is making one real opportunity flow naturally from Account through Product, intent, design, pricing, customer review, engineering certification, Certified IOF Package, and downstream execution surfaces.

Sprint 19 should focus on Guided Opportunity Experience rather than product expansion because the current risk is not missing product breadth. The risk is that a human operator must understand the platform architecture before completing work. Sprint 19 should make the platform guide the operator through governed transitions and explain what will happen before any Runtime or ScopeVersion state changes.

Risks to address before implementation:

- `GoogleRfpWorkspace.tsx` still owns too much workflow, design, pricing, and runtime orchestration logic.
- The Design Engine concept is present across several engines, but not exposed as one first-class compiler with product policy inputs and deterministic outputs.
- ScopeVersion authority is strong after engineering certification, but weaker before the design is committed to a governed spine.
- Customer input, intent validation, design candidate generation, and stationing need a clearer transition model.
- Several downstream domains exist as validated doctrines or partial workspaces, but Marketplace, Control, Field, Twin, and Operational Intelligence are not yet one guided post-certification path.
- UI states and runtime states must remain separated. Sprint 19 must not promote visual convenience into business authority.

Recommendation: Hyperlinx is ready to begin Sprint 19 only as a stabilization and guided-workflow sprint. It is not ready for new Layer 2 product expansion until the Google opportunity can be operated end to end by a first-time operator.

## 2. Current Architecture Audit

### Audit Scale

Status values used below:

- Deterministic: output is reproducible from governed inputs.
- Advisory: output informs humans but does not certify state.
- Authoritative: output can create governed authority when required evidence and actor permissions exist.
- UI-driven: key workflow logic still lives in React surfaces.
- Engine-driven: domain logic is isolated in reusable engines or server routes.
- Partially implemented: contracts or engines exist, but production flow is incomplete.
- Production-ready: validated for the current local runtime model and regression harnesses.

### Subsystem Audit Matrix

| Subsystem | Purpose | Inputs | Outputs | Owned State | Mutated State | Consumed State | Runtime Artifacts Created | Downstream Consumers | Validation Coverage | Known Gaps | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ScopeVersion | Constitutional source of truth for executable infrastructure state. | Certified IOF Package, execution certificate, canonical truth, closes. | Immutable or child ScopeVersions, lifecycle state, canonical objects, stations. | `server/data/scopeversions`; ScopeVersion lifecycle and close contracts. | ScopeVersion records only through authority routes; child versions for amendments. | Certified IOF, field closures, control work, close events. | ScopeVersion runtime mirror, lifecycle history, close records. | Twin, Control, Field, Operational Intelligence, ScopeVersion services. | `SCOPEVERSION_LIFECYCLE_VALIDATION.md`, `SCOPEVERSION_CLOSE_AUTHORITY_VALIDATION.md`, `runtime-rehydration-validation.mjs`, `engineering-certification-validation.mjs`. | Pre-certification design-to-Spine authority needs Sprint 19 definition. | Authoritative, engine-driven, partially production-ready. |
| Runtime rehydration | Restore governed workspace context from Runtime rather than UI guesses. | Authenticated user, WorkspaceSession, runtime libraries. | Account, contacts, opportunity, product, fulfillment plan, proposal, IOF packages, ScopeVersion, route, graph, history. | `server/data/runtime-workspace-sessions`; Runtime Object Library. | WorkspaceSession resume pointers and runtime mirrors. | Accounts, contacts, opportunities, proposal drafts, packages, ScopeVersions. | `WORKSPACE_SESSION`, runtime history, twin restore metadata. | Commercial, Engineering, Twin, all workspaces needing resume. | `runtime-rehydration-validation.mjs`, `sprint18-operator-experience-validation.mjs`. | Bare curl is auth-protected; operator login path is validated. | Production-ready for authenticated current runtime. |
| Kernel | Guard invariants and completion projections. | ScopeVersion, control work, field closures, close events. | Completion projections, invariant diagnostics. | Kernel state registry and invariant engines. | Mostly none in client engines; server completion route projections. | ScopeVersion canonical truth and execution records. | Kernel diagnostics and completion output when routed. | Twin, Operational Intelligence, completion authority. | `CONSTITUTIONAL_RUNTIME_VALIDATION.md`, `COMPLETION_ENGINE_VALIDATION.md`, `COMPLETION_VALIDATION.md`. | Needs clearer operator-facing next-action integration. | Deterministic, engine-driven, partially implemented. |
| Graph | Represent network topology, routes, nodes, stations, relationships. | Inventory graphs, customer twins, route candidates, ScopeVersion truth. | Renderable topology, graph references, route adjacency. | Inventory graph libraries and ScopeVersion canonical truth. | Inventory graph records and derived projections. | Customer inventory, proposed designs, ScopeVersion. | Runtime relationships, graph IDs, route references. | Design Engine, Twin, Prism, routing, Control. | `CORRIDOR_OBJECT_VALIDATION.md`, `CORRIDOR_REFERENCE_ARCHITECTURE_VALIDATION.md`, `runtime-rehydration-validation.mjs`. | Need a single governed Spine graph for opportunity state. | Deterministic, partially implemented. |
| DAL | Application shell, navigation, storage adapters, workspace integration. | User navigation, runtime APIs, local storage fallback. | Workspace projections and UI surfaces. | DAL UI state and client cache. | UI state; local records when remote unavailable. | Runtime APIs, workspace engines. | None unless calling runtime routes. | All workspaces. | TypeScript, build, sprint validations. | DAL must remain orchestrator, not business logic owner. | UI-driven, partially production-ready. |
| Translate / Intake | Normalize external files into structured customer design or inventory records. | KMZ, KML, GeoJSON, CSV, Shapefile, Runtime Inventory JSON. | Parsed objects, diagnostics, candidate ScopeVersions or design evidence. | Translate jobs and customer design imports. | Customer design import records; diagnostics. | Files, customer account context, translate contracts. | Customer design import artifacts; possible evidence records. | Commercial Planning, Design Engine, ScopeVersion preview. | `TRANSLATE_V1_VALIDATION.md`, `TRANSLATE_SHAPEFILE_VALIDATION.md`, Sprint 18 KMZ/KML contract check. | Needs first-class guided intake in operator flow. | Deterministic parser, partially implemented. |
| Intent Extraction | Convert customer-provided materials into design intent. | Addresses, lat/lng, KMZ/KML, SLA, diversity, latency, route requirements. | Normalized customer intent and validation diagnostics. | Some intent lives in UI and import engines. | Opportunity draft state and imported design records. | Customer inputs and Product policy. | Not consistently represented as a standalone runtime object. | Design Engine, Proposal, Engineering. | Partial via translate and opportunity validations. | Needs explicit `CustomerIntent` runtime artifact. | Advisory/deterministic mix, partially implemented. |
| Network Intent Reasoning | Interpret whether intent is extension, lateral, new graph, protected route, or fulfillment blend. | Product, customer intent, inventory, opportunity scope. | Recommended workflow and design mode. | Currently distributed across UI modes and scout engines. | UI state and opportunity records. | Product definitions, customer twin, inventory. | Runtime history only when advanced through lifecycle. | Design Engine, Proposal, Twin. | Sprint 18 operator validation plus commercial validations. | Needs extracted policy-driven engine. | Advisory, UI-driven, partially implemented. |
| Design Engine | Compile product policy plus customer intent into deterministic design candidates. | Product policy, customer inputs, inventory, customer twin, constraints. | Candidate designs with explanations and scores. | Currently spread across Opportunity Scout, route generation, design doctrine, routing, pricing. | Candidate state, commercial drafts, proposed networks. | Product fulfillment, graph, spatial engines, pricing. | Candidate runtime artifacts only after explicit save/advance. | Stationing, Proposal, Engineering. | `DESIGN_LAUNCH_VALIDATION.md`, `ROUTE_GENERATION_VALIDATION.md`, Sprint 18 A/Z validation. | Needs first-class compiler API and artifact schema. | Partially implemented, not yet unified. |
| Topology Synthesis | Convert design choice into route, segment, node, station, and topology objects. | Candidate design, graph context, route geometry. | Proposed graph topology and network object set. | Proposed network and ScopeVersion object factories. | Proposed design records or ScopeVersion canonical truth after authority. | Geometry, stationing, product template. | Proposed runtime objects when committed. | Proposal, Certified IOF Package, Twin. | Corridor synthesis and object validations. | Must be tied to Product template and Spine commit in Sprint 19. | Deterministic, partially implemented. |
| Geometry | Represent route lines, coordinates, crossings, map render state. | OSRM route, customer KMZ/KML, manual A/Z, inventory geometry. | Renderable geometry and route metrics. | Route candidate and ScopeVersion geometry fields. | Route results, proposal geometry references. | Translate, routing, customer twin, inventory. | Geometry evidence and references. | Map, Stationing, Proposal, Engineering, Twin. | `ROUTE_GENERATION_VALIDATION.md`, runtime rehydration route proof. | Need explicit approved-design geometry record before proposal generation. | Deterministic, partially implemented. |
| Stationing | Create measure-based route stations and execution segmentation. | Approved geometry, route length, product standards, engineering rules. | Stations, station ranges, segment references. | ScopeVersion station arrays and stationing validators. | ScopeVersion canonical truth after certification or close events. | Route geometry and product standards. | Station records in ScopeVersion; closure references. | Control, Field, Completion, Twin. | ScopeVersion stationing and field closure validations. | Need pre-certification stationing stage in guided flow. | Deterministic, authoritative after ScopeVersion. |
| Spatial Inventory | Evaluate on-net, off-net, customer, partner, and marketplace infrastructure. | Inventory graphs, customer twin, marketplace assets, geography. | Resolved inventory candidates and fulfillment references. | Inventory graph libraries and fulfillment plans. | Fulfillment plans, selected inventory refs. | Product policy, customer design, route candidates. | Fulfillment Plan runtime object. | Design Engine, Proposal, Engineering, Twin. | `sprint15-product-fulfillment-validation.mjs`, inventory validations. | Need consistent operator explanation for why inventory was used or rejected. | Deterministic/advisory mix, partially implemented. |
| Adjacency Impact | Evaluate route adjacency, attachments, nearby inventory, and affected assets. | Candidate site, route, graph, customer twin, ScopeVersion. | Attachment candidates and adjacency diagnostics. | Attachment and affinity engine outputs. | UI selected attachment; routes when saved. | Customer twin and inventory graph. | Runtime artifacts after opportunity/proposal save. | Design Engine, Proposal, Engineering. | Commercial attachment and opportunity validations. | Some attachment workflow remains UI-owned. | Advisory/deterministic, partially implemented. |
| Prism Product Reasoning | Rank and reason about opportunities, products, strategic fit, and site decisions. | Product candidates, geography, revenue, engineering, strategic factors. | Scores, recommendations, ranked opportunities. | Prism engine outputs and fixtures. | Usually none unless operator saves opportunity. | Inventory, opportunity seeds, financial models. | Advisory evidence only when attached. | Commercial Planning, executive review. | `PRISM_VALIDATION.md`, `PRISM_SCORING_VALIDATION.md`, `PRISM_RECOMMENDATION_VALIDATION.md`, `PRISM_DECISION_VALIDATION.md`. | Must be kept advisory; cannot certify state. | Advisory, engine-driven. |
| SVA | Strategic value analysis for opportunity and route decisions. | Revenue, cost, strategic score, diversity, customer value. | SVA score and opportunity attractiveness. | Prism and quick quote outputs. | Usually proposal/opportunity metadata if saved. | Product policy, quote, route, customer context. | Advisory evidence when persisted. | Commercial Planning, Proposal. | Prism and preliminary quote validations. | Needs explicit explanation object in guided right panel. | Advisory, partially implemented. |
| Revenue Impact | Estimate NRC, MRC, revenue, margin, cost-plus pricing. | Product, route miles, civil mix, ILA assumptions, costs. | Pricing summaries, proposal economics. | Proposal and pricing engines. | Proposal records and runtime metadata. | Product config, design geometry, fulfillment plan. | Proposal runtime object, pricing metadata. | Customer Review, Engineering, Twin. | `PRELIMINARY_QUOTE_VALIDATION.md`, `QUOTE_PACKAGE_VALIDATION.md`, `proposal-runtime-validation.mjs`. | Pricing must be generated from Spine, not duplicated UI state. | Deterministic, partially production-ready. |
| Marketplace Package | Package executable ScopeVersion scope for vendor/partner/market inquiry. | ScopeVersion, station ranges, quantities, vendor registry. | Bid package, marketplace quote request, vendor comparison. | Marketplace package and quote libraries. | Marketplace quote records and package metadata. | Certified scope, product policy, inventory. | Marketplace quote/package artifacts. | Control, procurement, Twin. | `MARKETPLACE_ASSET_VALIDATION.md`, `BID_PACKAGE_VALIDATION.md`. | Must not consume Proposal or Draft IOF directly. | Partially implemented; not Sprint 19 primary unless post-certification lens. |
| Control Readiness | Determine whether certified scope can become controlled execution work. | ScopeVersion, contract/close evidence, work package readiness. | Control work items and readiness diagnostics. | Control work item library. | Control work records after authority. | ScopeVersion, contracts, marketplace results. | ControlWorkItem runtime artifacts. | Field, Twin, Completion. | `CONTROL_ACTIVATION_VALIDATION.md`, `CONTRACT_SOF_READINESS_VALIDATION.md`. | Contract/SOF not implemented; activation must remain gated. | Partially implemented; authority-gated. |
| Twin Impact | Project governed runtime and ScopeVersion state into operational/executive lens. | Runtime objects, ScopeVersions, control work, field closures. | Twin state, commercial runtime objects, completion projection. | Derived twin projection, no independent truth. | None for projection. | Runtime Object Library and ScopeVersion canonical truth. | No new runtime for read projection. | Executive, operations, Commercial, Field. | `runtime-rehydration-validation.mjs`, Twin state checks, ScopeVersion projection validations. | Opportunity-as-navigation needs guided flow. | Deterministic projection, partially production-ready. |
| Operational Intelligence | Evaluate readiness, operations handoff, support, telemetry, and service continuity. | Completion closes, operations evidence, ScopeVersion. | Operations readiness and authority diagnostics. | Operations authority contracts and fixtures. | Operations close when implemented. | ScopeVersion, completion authority, field closure. | Future operations artifacts. | Operations, Twin, revenue realization. | `OPERATIONS_VALIDATION.md`. | Not connected to guided Google operator journey yet. | Advisory/authority contracts, partially implemented. |
| Fulfillment | Create carrier-neutral Product Fulfillment Plan from product policy and governed inventory. | Product, account, opportunity, inventory ownership classes. | Product record, Fulfillment Plan, fulfillment mix. | `server/data/products`, `server/data/fulfillment-plans`. | Product mirrors and fulfillment plans. | Runtime lifecycle bridge, proposal drafts, inventory refs. | Product runtime object, Fulfillment Plan runtime object, history. | Proposal, Engineering, Twin. | `sprint15-product-fulfillment-validation.mjs`. | Need Product policy to drive Design Engine directly in Sprint 19. | Deterministic, engine/server-driven, production-ready for current flow. |
| Field Closure | Record field completion evidence against ScopeVersion and stations. | ScopeVersion, control work, field event evidence. | Field closure event, station state update, completion evidence. | Field closure libraries and ScopeVersion close authority. | Field closure records and ScopeVersion station states through guarded routes. | Control work, ScopeVersion canonical truth. | Field closure runtime/history records. | Completion, Operations, Twin. | `FIELD_CLOSURE_VALIDATION.md`, `FIELD_ACTIVATION_VALIDATION.md`, ScopeVersion close validation. | Requires active Control work; not part of pre-certification Sprint 19 build except acceptance path definition. | Authoritative when gated, partially implemented. |
| Certified IOF Package | Freeze engineering-certified scope and authorize ScopeVersion creation. | Draft IOF Package, checklist, proposed IOF units, engineering actor. | Certified IOF Package, execution certificate, ScopeVersion. | `server/data/certified-iof-packages`; execution certificates. | Certified package and ScopeVersion records. | Approved proposal, Draft IOF, runtime objects/evidence. | Certified IOF runtime object, evidence, history, ScopeVersion mirror. | Twin, Marketplace, Control, Field. | `engineering-certification-validation.mjs`, `runtime-rehydration-validation.mjs`. | Must remain the gate before execution. | Authoritative, production-ready for current flow. |

### Business Logic Still Living in UI

- `GoogleRfpWorkspace.tsx` contains workflow mode selection, A/Z resolving, opportunity scouting, routing triggers, import staging, proposal orchestration, package dashboard state, and runtime rehydration application.
- Some Product and Design Engine choices are represented as UI state before they become governed runtime state.
- Quick Quote, attachment selection, and candidate locking still have UI-owned orchestration.
- Map, lower pane, and right panel are not yet separated as durable architectural roles.

### Duplicated Logic

- A/Z and candidate creation exist in both `OpportunityScoutPanel` and the workspace-level inspector flow.
- Runtime resume logic exists in the server rehydration route and client application of returned objects.
- Route, geometry, and graph references are repeated through proposal, draft IOF, certified IOF, ScopeVersion, and workspace session metadata.
- Product/fulfillment lineage is threaded through multiple persistence paths and should be centralized behind a Product policy service.

### Dead Actions and Unclear Operator Transitions

- Sprint 18 fixed the A/Z raw text seed dead action.
- Remaining risk: actions that appear advisory may later mutate runtime without clear explanation.
- Customer input validation, design approval, stationing, and Spine commit need explicit next-action gating.
- "Generate Proposal" must become disabled until a governed design and Product policy are present.

### ScopeVersion Authority Gaps

- ScopeVersion authority is strongest after Engineering Certification.
- Before certification, customer intent, approved design, stationing, and Spine commit need a governed pre-ScopeVersion authority model.
- Sprint 19 should define whether the Spine is a pre-ScopeVersion runtime object, a draft ScopeVersion candidate, or a structured set of runtime objects that later compile into ScopeVersion.
- AI output cannot directly advance ScopeVersion state.

### Stabilization Items Required Before Sprint 19

- Freeze Product Definition and Fulfillment Plan schema for the Google path.
- Freeze Runtime rehydration route order and authenticated behavior.
- Freeze ScopeVersion certification gate.
- Define a single Opportunity state machine.
- Define a governed `CustomerIntent` artifact.
- Define a governed `ApprovedDesign` or `SpineCommit` artifact.
- Extract high-risk workflow logic from `GoogleRfpWorkspace.tsx` into hooks, engines, and services.

## 3. Runtime State Flow

| Stage | Entry Condition | Required Evidence | Runtime Objects Created or Changed | ScopeVersion Changes | Validation Required | Next Governed Action |
|---|---|---|---|---|---|---|
| Account | Authenticated operator has commercial authority. | Account name, customer identity, organization/workspace. | Account record, Account runtime mirror, history. | None. | Account persistence and contact linkage validation. | Select Product. |
| Product | Active Account exists. | Selected Product Definition and version. | Product runtime mirror, selected product pointer. | None. | Product exists and policy is valid. | Enter Customer Inputs. |
| Customer Inputs | Account and Product selected. | Address, lat/lng, KMZ/KML, SLA, diversity, latency, inventory references. | Customer design import, contact/evidence references, possible CustomerIntent runtime artifact. | None until committed. | Translate/intake validation and intent completeness checks. | Intent Validation. |
| Intent Validation | Customer inputs are present. | Product-required fields and normalized design intent. | Intent validation history and diagnostics. | None. | Product policy completeness validation. | Generate Design. |
| Design | Intent validated. | Product policy, inventory, graph, geometry, constraints. | Design candidate records, route geometry references, advisory explanations. | None unless candidate ScopeVersion model is adopted. | Deterministic Design Engine validation. | Approve Design. |
| Stationing | Operator approves design candidate. | Approved design, geometry, product stationing rules. | Stationed geometry and topology synthesis artifacts. | Candidate or future ScopeVersion station payload only after authority. | Stationing validator. | Commit Spine. |
| Proposal | Spine is committed. | Account, Product, customer intent, approved design, pricing model, fulfillment plan. | Proposal runtime object, pricing summary, recipient tasks. | None. | Proposal generation validation. | Customer Approval. |
| Customer Approval | Proposal submitted to customer review. | Customer approval actor and approval record. | Proposal approval, review task state, runtime history, Draft IOF trigger. | None. | Proposal customer-review validation. | Engineering Certification. |
| Engineering Certification | Approved proposal and Draft IOF Package exist. | Draft IOF Package, proposed IOF units, engineering checklist. | Certified IOF Package, execution certificate, runtime evidence/history. | New execution-authorized ScopeVersion created. | Engineering certification validation. | Certified IOF Package handoff. |
| Certified IOF Package | Engineering certification complete. | Certified units and execution certificate. | Certified package library, ScopeVersion runtime mirror. | ScopeVersion becomes executable truth. | ScopeVersion and rehydration validation. | Marketplace readiness. |
| Marketplace | Executable ScopeVersion exists. | ScopeVersion, quantities, station ranges, vendor/service requirements. | Marketplace package, quote request, vendor responses. | None until a validated close is accepted. | Marketplace readiness and bid package validation. | Control readiness. |
| Control | Contract/control authority exists. | ScopeVersion, contract/close evidence, marketplace result if required. | ControlWorkItems and control runtime records. | Lifecycle may advance after validated control close. | Control activation validation. | Field activation. |
| Field | Control active and work packages approved. | Work package, crew/asset assignment, field evidence. | Field closure events and station/object updates. | Station states mutate only through guarded closure route. | Field activation and closure validation. | Twin and completion projection. |
| Twin | Runtime or ScopeVersion object selected. | Runtime objects, ScopeVersion, work and closure state. | Derived projection only. | None. | Twin projection validation. | Operational Intelligence. |
| Operational Intelligence | Completion/operations evidence exists or is being evaluated. | Completion closes, support/operations evidence, service readiness. | Operations readiness and future operations close. | Lifecycle may advance through operations authority. | Operations validation. | Revenue/service continuity. |

## 4. IP / Patent Coverage Audit

This section is a technical invention inventory for patent counsel. It is not legal advice and does not assess patentability.

### Technical Invention Inventory

| Candidate | Technical Problem Solved | Prior Manual Process Replaced | System Components | Novel Technical Mechanism | Inputs | Outputs | State Transitions | Audit Trail | Human / AI Boundary | Evidence Generated | Possible Claim Themes | Status | Documentation Gaps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ScopeVersion constitutional model | Prevents ambiguous execution truth across commercial, engineering, and field systems. | Spreadsheet scope, drawing packages, email approvals. | ScopeVersion routes, close authority, lifecycle authority, certification. | Immutable or child-version canonical truth with authority-gated transitions. | Certified IOF, close events, actor roles. | ScopeVersion, child versions, lifecycle audits. | Draft/certified/execution/control/field/operations states. | Close audits, lifecycle audits, runtime history. | AI may advise; humans certify transitions. | ScopeVersion records, close records, certificates. | Infrastructure state authority object; immutable execution truth. | Implemented for certification and closures; earlier Spine pending. | Need diagrams and state machine evidence. |
| Governed closures | Converts evidence into authoritative state only when validated against ScopeVersion. | Field signoffs and status calls. | ScopeVersion Close Authority, Field Closure, Completion, Operations. | Close type, actor role, evidence, and target ScopeVersion are validated before mutation. | Closure payload, evidence, actor authority. | Validated close, station/object updates. | Field/control/completion/operations closure states. | Close audit records. | AI cannot validate close authority. | Evidence bundles and close audit JSON. | Evidence-bound infrastructure closure system. | Partially implemented. | Need end-to-end close replay package. |
| Runtime rehydration | Prevents workspace refresh from losing governed lifecycle context. | Browser session memory and manual reopen. | Runtime WorkspaceSession, rehydrate route, runtime object library. | Runtime stores resume pointers, not duplicate domain state. | Authenticated user, WorkspaceSession. | Rehydrated Account, Opportunity, Proposal, packages, ScopeVersion. | Authority resume after customer/engineering transitions. | Runtime history and session authority transactions. | AI not involved. | WorkspaceSession records and validation report. | Governed runtime resume model. | Implemented and validated. | Need architecture diagram and production auth notes. |
| Deterministic infrastructure state | Produces repeatable outputs from product policy, input evidence, and inventory. | Engineer/operator judgment without system trace. | Product fulfillment, Design Engine pieces, route generation, stationing. | Candidate output includes policy, inputs, geometry, and explanation references. | Product, intent, inventory, constraints. | Candidate design, route, stations, fulfillment plan. | Intent -> design -> approval -> Spine. | Runtime history when committed. | AI may explain; deterministic engine computes. | Candidate records and diagnostics. | Deterministic telecom design compiler. | Partially implemented. | Need single Design Compiler artifact. |
| Replayable audit lineage | Makes lifecycle transitions reconstructable from artifacts. | Manual audit trails across files and emails. | Runtime History, Runtime Objects, ScopeVersion, IOF packages. | Every transition records object IDs, relationships, actor, timestamp, evidence. | Transition request, artifacts, actor. | History, relationships, runtime mirrors. | Account -> execution lineage. | Runtime history and proof files. | AI advisory output is evidence, not authority. | Validation reports and persisted JSON. | Replayable infrastructure lifecycle. | Strong in Sprint 13-18 flow. | Need replay script for full Google acceptance. |
| AI advisory boundary | Separates recommendations from certification and state mutation. | Informal expert advice mixed with approvals. | Prism, reasoning panel, transition doctrine. | AI output cannot advance state without human/authority gate. | Scores, recommendations, explanations. | Advisory evidence and next-action suggestions. | None directly. | Advisory event records when persisted. | Human certifies governed transitions. | Advisory artifacts, explanations. | AI-governed infrastructure workflow. | Doctrine present; enforcement uneven. | Need machine-readable advisory policy. |
| Human certification boundary | Ensures governed state transitions have actor authority. | Verbal or email approvals. | Auth, engineering certification, ScopeVersion authority. | Human actor role and permission are required before mutation. | User session, checklist, evidence. | Certified IOF, ScopeVersion, close events. | Engineering -> execution. | Runtime history and certificate. | Human is certifier. | Execution authorization certificate. | Human-in-the-loop infrastructure certification. | Implemented for engineering certification. | Need UI transition record schema. |
| Kernel doctrine | Centralizes invariant and completion evaluation. | Manual progress tracking. | Kernel invariant engine, completion engine. | ScopeVersion and closure state are evaluated for readiness and completion. | ScopeVersion, work, closures. | Completion projection, diagnostics. | Control/field/completion readiness. | Kernel diagnostics. | AI may summarize; kernel computes. | Completion projection JSON. | Infrastructure completion kernel. | Partially implemented. | Need route and UI integration docs. |
| Reasoning layer doctrine | Makes right panel a reasoning/next-action surface, not authority owner. | Training-dependent operator workflows. | Future right panel, Prism, validation state. | Reasoning explains current state and next governed action. | Runtime state, product policy, validations. | Explanation, blockers, next action. | None without operator approval. | Advisory history if saved. | AI advises only. | Reasoning trace. | Guided infrastructure operations assistant. | Planned for Sprint 19. | Need component design and authority policy. |
| Translation engine | Normalizes files into governed design inputs. | Manual KMZ/KML/CSV interpretation. | Translate engines, CustomerDesignImportEngine. | Multi-format normalization with diagnostics and provenance. | KMZ/KML/CSV/GeoJSON/Shapefile. | Parsed geometry, objects, diagnostics. | Intake -> intent evidence. | Diagnostics and import records. | AI not required. | Parsed records and diagnostics. | Governed infrastructure file translation. | Implemented in pieces. | Need guided import-to-intent package. |
| Product-driven design policy | Uses product definition to constrain design, pricing, fulfillment, and deliverables. | Custom one-off engineering interpretation. | Product fulfillment, Product definitions, future Design Compiler. | Product policy becomes compiler input. | Product, intent, inventory. | Fulfillment plan, design candidates, deliverables. | Product selected -> policy loaded -> design constrained. | Product and fulfillment history. | AI may advise options; policy governs. | Product and plan records. | Product-governed infrastructure design. | Product fulfillment implemented; compiler pending. | Need Product policy schema freeze. |
| Map-first infrastructure design | Makes map primary operator workspace while ledger remains governed truth. | Switching between GIS, spreadsheets, and project tools. | GoogleRfpWorkspace, ProposedNetworkMapPanel, Twin. | Spatial interaction is tied to runtime state and next actions. | Map clicks, geometry, runtime state. | Candidate locations, routes, twin projections. | Map input -> governed action only through explicit transition. | Runtime history after save/advance. | AI may explain spatial options. | Candidate geometry and action records. | Map-led telecom product creation. | Partially implemented. | Need Sprint 19 layout architecture. |
| Marketplace orchestration | Converts certified scope into marketplace-ready packages. | Manual vendor bid packaging. | Marketplace assets, bid packages, quote routes. | Vendor assets and station packages are derived from ScopeVersion truth. | ScopeVersion, quantities, vendor registry. | Bid packages, quote requests. | Certified scope -> marketplace package. | Quote/package records. | Human awards/accepts. | Bid package validation. | Scope-derived marketplace orchestration. | Partially implemented. | Need post-certification integration evidence. |
| Control readiness | Gates execution work on certified authority and readiness evidence. | Manual handoff to construction/control. | Control work items, lifecycle doctrine, contract/SOF readiness. | Control cannot activate without ScopeVersion and required closes. | ScopeVersion, contract/control evidence. | Control work items and readiness. | Execution -> control ready/active. | Control validation records. | Human activates. | Control work records. | Authority-gated execution control. | Partially implemented. | Need SOF/contract bridge later. |
| Field closure | Converts field work evidence into station/object closure against ScopeVersion. | Field reports and manual progress updates. | Field workspace, closure authority, ScopeVersion route. | Guarded station/object mutation through validated closure. | Field evidence, station range, actor. | Field close and station update. | Field active -> closure -> completion. | Field closure audit. | Human field authority certifies. | Closure events. | Evidence-bound field mutation. | Partially implemented. | Need mobile/field evidence package. |
| Digital twin activation | Projects governed runtime and ScopeVersion state into an operational lens. | Manual dashboards disconnected from execution truth. | Twin state route, ScopeVersion projection, Runtime Objects. | Twin is derived, not a separate authority owner. | Runtime objects, ScopeVersion, closures. | Twin projection. | None; read projection. | Projection diagnostics. | AI may summarize. | Twin state response. | Runtime-derived infrastructure twin. | Implemented as projection. | Need opportunity-as-navigation spec. |
| Operational intelligence | Evaluates operational readiness after execution completion. | Manual turnover and operations readiness reviews. | Operations authority, completion authority, kernel. | Operations authority consumes completion close and readiness evidence. | Completion close, docs, service inventory. | Operations close/readiness. | Completion -> operations. | Operations validation. | Human operations authority certifies. | Operations artifacts. | Governed operations readiness. | Contract level implemented. | Need production service/billing boundary. |
| Opportunity lifecycle state machine | Makes Opportunity the unit of work across the platform. | Training-dependent navigation across tools. | Runtime, WorkspaceSession, Product, Design Engine, Proposal, Engineering. | Opportunity carries current governed state and next action. | Account, product, intent, runtime state. | Opportunity state, next action, blockers. | Account -> product -> design -> certification. | Runtime history. | Human approves transitions; AI advises. | Acceptance test evidence. | Guided opportunity operating system. | Planned Sprint 19. | Need state enum and transition record schema. |

### Candidate Groups

Core platform inventions:

- ScopeVersion constitutional model.
- Governed closures.
- Replayable audit lineage.
- Deterministic infrastructure state.
- Runtime object and relationship graph.

Operator-experience inventions:

- Opportunity lifecycle state machine.
- Map-first guided opportunity workflow.
- Lower-pane governed ledger.
- Right-panel reasoning and next-action surface.

AI governance inventions:

- AI advisory boundary.
- Human certification boundary.
- Evidence-based transition doctrine.

Runtime / rehydration inventions:

- WorkspaceSession as resume pointer object.
- Runtime rehydration without duplicate domain truth.
- Authority transfer rehydration across users and sessions.

Digital twin inventions:

- Twin as derived projection over Runtime and ScopeVersion.
- Opportunity-as-navigation into customer, product, design, proposal, engineering, and execution.

Marketplace / Control inventions:

- ScopeVersion-derived marketplace package.
- Authority-gated Control activation.
- Field closure against stationed ScopeVersion truth.

Possible continuation or CIP themes for counsel review:

- Product-policy-driven Design Compiler.
- Guided Opportunity Experience as an operator workflow system.
- Runtime rehydration and WorkspaceSession resume model.
- Human/AI authority separation for infrastructure certification.
- ScopeVersion and governed closure lifecycle.
- Map-first governed infrastructure design interface.

### Patent Evidence Checklist

- Architecture diagrams for Runtime, ScopeVersion, Design Compiler, and Twin.
- State machine diagrams for Opportunity and ScopeVersion.
- Example JSON records for Account, Product, Fulfillment Plan, Proposal, Draft IOF, Certified IOF, ScopeVersion, WorkspaceSession, Runtime History, Close events.
- Validation outputs for Sprint 13 through Sprint 18.
- Screenshots or recordings of Google golden path once Sprint 19 is implemented.
- Before/after examples showing manual telecom workflow replaced by governed runtime transitions.
- Evidence of deterministic output from identical inputs.
- Evidence of AI advisory output being blocked from direct certification.
- Evidence of human actor approval required for authority transitions.
- Source-file index for engines, routes, validation scripts, and reports.

### Counsel Review Package Checklist

- This master audit document.
- Sprint 13.4 through Sprint 18 reports.
- `runtime-rehydration-validation.mjs` proof output.
- Sprint 15, 16, and 18 validation proof outputs.
- ScopeVersion doctrine and validation documents.
- Runtime Lifecycle Bridge doctrine.
- Product Fulfillment report.
- Engineering Certification report.
- Generated example Runtime and ScopeVersion JSON.
- Any dated design notes, demos, diagrams, and operator workflow screenshots.

## 5. Governed Transition Doctrine

Core principle:

> A governed transition is valid only when evidence, artifacts, runtime mutation, authority, replayability, and auditability can be proven.

A transition is valid only when the platform can answer:

1. What evidence allowed this transition?
2. What artifacts were produced?
3. What runtime objects changed?
4. Who or what approved the transition?
5. Can this transition be replayed?
6. Can this transition be audited?
7. Did AI advise or did a human certify?

### Transition Definition

A transition is a state-changing action that creates, updates, certifies, closes, advances, or supersedes governed runtime state.

Not every click is a transition. Opening a modal, selecting a tab, panning a map, typing a draft field, or expanding a panel is UI state. A transition begins only when the operator commits governed intent or authority.

### Authority Boundary

- UI may request a transition.
- AI may recommend a transition.
- Engines may validate whether a transition is eligible.
- Runtime records the transition.
- ScopeVersion or the relevant governed object owns the resulting authority.
- A human or authorized service actor certifies transitions that create authority.

### Evidence Requirement

Every transition must include at least one evidence source:

- Operator input.
- Customer design file.
- Product policy.
- Validation output.
- Design candidate.
- Proposal approval.
- Engineering checklist.
- Certified IOF Package.
- ScopeVersion close.
- Marketplace package.
- Control work authorization.
- Field evidence.

### Artifact Requirement

Every transition must produce or update a named artifact:

- Account.
- Contact.
- Product selection.
- CustomerIntent.
- IntentValidation.
- DesignCandidate.
- ApprovedDesign.
- StationedGeometry.
- SpineCommit.
- Proposal.
- CustomerApproval.
- Draft IOF Package.
- Certified IOF Package.
- ScopeVersion.
- MarketplacePackage.
- ControlWorkItem.
- FieldClosure.
- TwinProjection.
- OperationsReadiness.

### Runtime Mutation Rule

No transition may mutate runtime state without:

- Object ID.
- Object type.
- Parent or relationship IDs.
- Actor ID.
- Authority scope.
- Evidence IDs or embedded evidence references.
- Timestamp.
- Previous and next lifecycle state where applicable.
- Runtime History event.

### AI Advisory Rule

AI can:

- Explain state.
- Recommend next actions.
- Summarize evidence.
- Rank alternatives.
- Identify missing evidence.
- Draft operator-facing language.

AI cannot:

- Certify a ScopeVersion.
- Approve customer acceptance.
- Execute engineering certification.
- Create a close as the certifying authority.
- Activate Control or Field.
- Override Product policy.

### Human Certification Rule

Human operators certify governed transitions that carry authority:

- Customer approval.
- Design approval when it commits to Spine.
- Engineering certification.
- Marketplace award/acceptance.
- Contract/SOF execution when implemented.
- Control activation.
- Field closure.
- Completion and operations closes.

### Replayability Rule

A transition is replayable when the platform can reconstruct:

- Initial state.
- Input evidence.
- Product policy.
- Validation results.
- Actor authority.
- Runtime mutation.
- Output artifact.
- Downstream relationships.

### Audit Rule

Every transition must be inspectable by:

- Object ID.
- Opportunity ID.
- Account ID.
- Product ID.
- ScopeVersion ID when available.
- Actor.
- Time.
- Authority boundary.
- Evidence.

### Invalid Transition Examples

- Proposal generated from UI-only route state without a committed design artifact.
- ScopeVersion created directly from commercial proposal without Engineering Certification.
- Field closure recorded without active Control work.
- Marketplace package generated from Draft IOF instead of executable ScopeVersion.
- AI recommendation directly advancing lifecycle state.
- Customer approval recorded without customer actor or contact authority.
- Runtime rehydration creating new proposal/package records instead of restoring existing objects.

### Required Transition Record Schema

```json
{
  "transitionId": "TRANSITION-...",
  "transitionType": "DESIGN_APPROVED",
  "opportunityId": "COMMERCIAL-OPPORTUNITY-...",
  "accountId": "google",
  "productId": "PRODUCT-L1-PROTECTED-DARK-FIBER-IRU",
  "scopeVersionId": "SV-...",
  "fromState": "DESIGN_READY",
  "toState": "DESIGN_APPROVED",
  "objectType": "ApprovedDesign",
  "objectId": "APPROVED-DESIGN-...",
  "artifactIds": ["DESIGN-CANDIDATE-...", "STATIONED-GEOMETRY-..."],
  "evidenceIds": ["CUSTOMER-INPUT-...", "PRODUCT-POLICY-..."],
  "actorId": "teralinx-user-ryan",
  "actorRole": "COMMERCIAL_OPERATOR",
  "authority": "COMMERCIAL",
  "aiAdvisoryIds": ["ADVISORY-..."],
  "humanCertified": true,
  "validation": {
    "passed": true,
    "validator": "guided-opportunity-validation"
  },
  "createdAt": "2026-07-01T00:00:00.000Z"
}
```

### Doctrine Applied to Major Transitions

| Transition | Evidence | Artifact | Runtime Mutation | Authority | AI Boundary | Human Certification |
|---|---|---|---|---|---|---|
| Account creation | Account fields and operator session. | Account. | Account record, mirror, history. | Commercial. | None. | Operator saves. |
| Product selection | Product definition/version. | Product selection and fulfillment policy context. | Product pointer and possible runtime history. | Product/commercial. | AI may explain fit. | Operator selects. |
| Customer input validation | Customer file/address/lat-lng and product requirements. | CustomerIntent, diagnostics. | Import/intent artifact and history. | Commercial. | AI may classify gaps. | Operator confirms. |
| Intent validation | Product policy and normalized intent. | IntentValidation. | Validation record. | Commercial/product policy. | AI advisory only. | Operator proceeds. |
| Design generation | Intent, product policy, inventory, constraints. | DesignCandidate set. | Candidate artifacts. | Design Engine produces; no authority yet. | AI explains. | None until approval. |
| Design approval | Candidate, evidence, operator decision. | ApprovedDesign. | Approved design record, history. | Commercial. | AI cannot approve. | Operator approves. |
| Stationing | ApprovedDesign and stationing standards. | StationedGeometry. | Station records or candidate payload. | Design/engineering pre-gate. | AI may explain. | Operator confirms or engineering validates. |
| Proposal generation | Spine, pricing model, product policy. | Proposal. | Proposal record, mirror, history. | Commercial. | AI can draft explanation. | Operator generates/submits. |
| Customer approval | Proposal and customer actor. | CustomerApproval. | Proposal status, review task, history. | Customer review. | AI cannot approve. | Customer/human approves. |
| Engineering certification | Draft IOF, checklist, engineer. | Certified IOF, certificate, ScopeVersion. | Certified package, evidence, history, ScopeVersion. | Engineering. | AI may assist checklist. | Engineer certifies. |
| Marketplace packaging | ScopeVersion and quantities. | MarketplacePackage. | Package/quote records. | Marketplace/commercial. | AI may recommend vendors. | Operator sends/awards. |
| Control activation | ScopeVersion, contract/control close. | ControlWorkItem. | Control records/history. | Control. | AI may identify blockers. | Control authority activates. |
| Field closure | Control work, field evidence. | FieldClosure. | Closure record and station/object update. | Field. | AI may summarize evidence. | Field operator certifies. |
| Twin activation | Runtime/ScopeVersion selected. | TwinProjection. | None. | Read projection. | AI may summarize. | No certification. |
| Operational Intelligence | Completion/operations evidence. | OperationsReadiness/Close. | Operations records when implemented. | Operations. | AI advisory only. | Operations authority certifies. |

## 6. Sprint 19 Roadmap - Guided Opportunity Experience

### Sprint Objective

Build a guided opportunity experience where the Google opportunity can move through Account, Product, Customer Inputs, Intent Validation, Design, Stationing, Proposal, Customer Approval, Engineering Certification, Certified IOF Package, Marketplace, Control, Field, Twin, and Operational Intelligence without prior operator training.

### Why Sprint 19 Matters

Sprint 19 is the bridge between a powerful platform and a usable operating system. It should reduce hidden knowledge, make every action deterministic, and expose the next governed action from Runtime state.

### Current State

- Runtime rehydration works for authenticated users.
- Account, Contact, Product, Fulfillment Plan, Proposal, Draft IOF, Certified IOF, and ScopeVersion persist and rehydrate.
- A/Z raw text path is deterministic after Sprint 18.
- KMZ/KML input exists in Commercial Planning and Translate/Intake engines.
- Google proposal path is validated in pieces.
- Operator workflow is still panel-heavy and workspace logic-heavy.

### Target Operator Experience

- The operator sees the map as the primary workspace.
- The lower pane shows the governed ledger: evidence, artifacts, validations, lifecycle history.
- The right panel explains current state, blockers, recommendations, and the next governed action.
- The operator never needs to know which subsystem owns an action.
- Buttons are state-aware and deterministic.
- Every action explains what object will change before the operator commits.

### Opportunity State Machine

Required states:

1. `ACCOUNT_SELECTED`
2. `PRODUCT_SELECTED`
3. `CUSTOMER_INPUTS_STAGED`
4. `INTENT_VALIDATED`
5. `DESIGN_CANDIDATES_READY`
6. `DESIGN_APPROVED`
7. `STATIONING_READY`
8. `SPINE_COMMITTED`
9. `PROPOSAL_GENERATED`
10. `CUSTOMER_APPROVED`
11. `ENGINEERING_CERTIFIED`
12. `CERTIFIED_IOF_READY`
13. `MARKETPLACE_READY`
14. `CONTROL_READY`
15. `FIELD_READY`
16. `TWIN_ACTIVE`
17. `OPERATIONAL_INTELLIGENCE_READY`

Sprint 19 should implement the state machine at least through `CERTIFIED_IOF_READY` and define read-only guided projections for later stages.

### Guided Workflow Design

Each step must show:

- Required input.
- Evidence present.
- Missing evidence.
- Product policy constraints.
- Objects that will be created or changed.
- Whether action is advisory or authoritative.
- Next action after success.

### Map-First Workspace Design

Map responsibilities:

- Display customer inputs, inventory, design candidates, approved design, stationing, and Twin projection.
- Accept spatial input only when the current state allows it.
- Never own business authority.

Lower ledger responsibilities:

- Show evidence, artifacts, runtime history, validation results, and transition records.
- Provide replayable audit context.

Right panel responsibilities:

- Explain state.
- Show blockers.
- Compare candidates.
- Present next governed action.
- Distinguish AI recommendation from human certification.

### Product Policy Architecture

Product policy should define:

- Required customer inputs.
- Allowed fulfillment modes.
- Engineering standards.
- Diversity/protection requirements.
- Pricing model.
- Required deliverables.
- Runtime object template.
- Validation gates.

Protected Dark Fiber IRU should be the first fully guided Product policy.

### Design Engine First-Class Role

The Design Engine should become a compiler:

```text
Product Policy + Customer Intent + Inventory + Constraints
  -> Deterministic Design Candidates + Explanations + Required Evidence
```

It should not be a collection of UI handlers. It should expose a typed request/response contract and a validation script.

### ScopeVersion Authority Rules

- ScopeVersion remains constitutional truth after Engineering Certification.
- Sprint 19 must define pre-ScopeVersion Spine authority.
- Proposal must derive from Spine, not UI state.
- Certified IOF Package remains the only path to executable ScopeVersion.
- AI cannot advance ScopeVersion state.

### Progressive Disclosure Rules

- Show only the active stage, completed stages, blockers, and next action.
- Hide advanced execution surfaces until the lifecycle reaches them.
- Show downstream stages as locked previews with evidence requirements.
- Make every disabled button explain its missing evidence.

### Component Refactor Plan

See Section 7 for the detailed component plan. Sprint 19 should begin by extracting workflow and policy logic from `GoogleRfpWorkspace.tsx`.

### Validation Plan

Required validation:

- Existing Sprint 18 operator validation.
- Runtime rehydration validation.
- New guided opportunity validation.
- Product policy validation.
- Design compiler validation.
- Proposal generation validation.
- Engineering certification regression.

### Regression Test Plan

Before Sprint 19 is complete, run:

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

### Definition of Done

Sprint 19 is done when:

- A first-time operator can follow the Google guided opportunity sequence without training.
- Every stage shows required evidence, created artifacts, and next governed action.
- A/Z, KMZ/KML, Product selection, design generation, proposal generation, customer approval, engineering certification, and rehydration are deterministic.
- Proposal generation depends on committed governed truth.
- Engineering certification produces Certified IOF Package and ScopeVersion without losing context.
- Runtime rehydration restores the opportunity at the correct state.
- The operator acceptance test passes end to end through Certified IOF Package.

### Explicit Non-Goals

- Do not add new Layer 2 products.
- Do not add new AI automation.
- Do not add work queues beyond existing validated flows.
- Do not implement full Marketplace transaction execution.
- Do not implement full Contract/SOF/SOW execution.
- Do not implement new OSS/BSS integrations.
- Do not let UI state become authority.

## 7. Component Refactor Plan

Focus: `src/components/workspaces/GoogleRfpWorkspace.tsx`

Target architecture:

```text
Map = spatial workspace
Lower pane = governed ledger
Right panel = reasoning, explanation, and next actions
Workspace = lifecycle orchestrator, not business logic owner
```

### Logic That Should Remain in the Workspace

- Top-level composition of map, ledger, and reasoning panel.
- Current authenticated session and selected opportunity ID.
- Calling hooks and services.
- Rendering current state from Runtime.
- Dispatching explicit operator actions to hooks/services.

### Logic That Should Move Into Hooks

- `useRuntimeRehydration`
- `useGuidedOpportunityState`
- `useOpportunityInputs`
- `useAzResolution`
- `useCustomerDesignImports`
- `useProposalLifecycle`
- `useEngineeringHandoff`
- `useWorkspaceSessionPersistence`

Hooks should own UI orchestration and call engines/services. Hooks should not own business authority.

### Logic That Should Move Into Engines

- Design candidate generation.
- A/Z and address resolution normalization.
- Route candidate scoring.
- Attachment and adjacency evaluation.
- Stationing preparation.
- Product-driven design validation.
- Next-action determination from state machine.

Candidate engines:

- `src/commercial/GuidedOpportunityEngine.ts`
- `src/commercial/CustomerIntentEngine.ts`
- `src/design/DesignCompilerEngine.ts`
- `src/design/StationedDesignEngine.ts`

### Logic That Should Move Into Product Policy

- Required inputs by Product.
- Fulfillment policy constraints.
- Engineering standards.
- Pricing model selection.
- Deliverable checklist.
- Candidate scoring rules.
- Proposal readiness gates.

Candidate service:

- `src/product/ProductPolicyRegistry.ts`

### Logic That Should Move Into ScopeVersion Services

- Pre-ScopeVersion Spine to executable ScopeVersion mapping.
- Stationing validation.
- ScopeVersion candidate validation.
- Certification handoff checks.
- Close and lifecycle authority checks.

### Logic That Should Move Into Validation Scripts

- A/Z deterministic resolution.
- KMZ/KML import contract.
- Product policy completeness.
- Design compiler deterministic output.
- Proposal generated from Spine.
- Rehydration after authority transfer.
- Certified IOF and ScopeVersion continuity.

### Components That Should Be Extracted

- `GuidedOpportunityShell`
- `OpportunityMapWorkspace`
- `GovernedLedgerPane`
- `ReasoningNextActionPanel`
- `OpportunityStateStepper`
- `CustomerInputPanel`
- `ProductPolicyPanel`
- `DesignCandidatePanel`
- `StationingPanel`
- `SpineCommitPanel`
- `ProposalActionPanel`
- `EngineeringCertificationPanel`
- `RuntimeEvidenceTimeline`

### Refactor Sequence

1. Add state machine and view model without changing behavior.
2. Extract A/Z and customer input hooks.
3. Extract Product policy read model.
4. Extract next-action panel.
5. Extract governed ledger.
6. Move design candidate generation behind a Design Compiler facade.
7. Update validation scripts after each extraction.

## 8. Operator Acceptance Test

Lifecycle:

Google opportunity -> Create Account -> Select Product -> Enter Locations -> Resolve A -> Resolve Z -> Generate Design -> Approve Design -> Station -> Commit Spine -> Generate Proposal -> Customer Approval -> Engineering Certification -> Certified IOF Package -> Marketplace -> Control -> Field -> Twin

| Step | Operator Action | Required Input | Expected UI Response | Expected ScopeVersion State | Expected Runtime Artifact | Expected Validation | Failure Condition | Recovery Behavior | Audit Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Google opportunity | Start guided Google flow. | Authenticated commercial user. | Guided state opens at Account. | None. | WorkspaceSession. | Auth and rehydration pass. | No session. | Prompt login. | Runtime session history. |
| Create Account | Create or select Google account. | Account identity. | Account selected, next action Product. | None. | Account runtime mirror. | Account persistence. | Missing name/authority. | Stay on Account with blocker. | `runtime.account.saved`. |
| Select Product | Select Protected Dark Fiber IRU. | Product ID/version. | Product policy loads. | None. | Product runtime mirror and policy context. | Product policy validation. | Product unavailable. | Select valid product. | `PRODUCT_SELECTED`. |
| Enter Locations | Enter A/Z address, lat/lng, or KMZ/KML. | Customer input. | Inputs staged in map and ledger. | None. | CustomerIntent or import artifact. | Translate/input validation. | Invalid file or coordinates. | Show diagnostics and allow correction. | Import diagnostics/history. |
| Resolve A | Resolve A endpoint. | A input. | A marker appears with source label. | None. | Resolved location evidence. | A resolution deterministic check. | Invalid input. | Keep unresolved and show reason. | Location evidence. |
| Resolve Z | Resolve Z endpoint. | Z input. | Z marker appears with source label. | None. | Resolved destination evidence. | Z uses destination input. | Z resolves to A or null. | Block design generation. | Location evidence. |
| Generate Design | Run Design Engine. | Product policy, resolved intent, inventory. | Candidate designs with explanations. | None or candidate draft only. | DesignCandidate set. | Design compiler validation. | No deterministic candidate. | Show blockers and missing evidence. | Candidate diagnostics. |
| Approve Design | Select preferred candidate. | Design candidate ID. | Candidate becomes ApprovedDesign. | None until Spine rule is defined. | ApprovedDesign runtime artifact. | Approval transition validation. | No candidate selected. | Keep in candidate stage. | `DESIGN_APPROVED`. |
| Station | Station approved design. | Approved geometry and standards. | Stations/segments visible. | Candidate station payload. | StationedGeometry artifact. | Stationing validation. | Geometry missing or station rules fail. | Return to Design. | Stationing diagnostics. |
| Commit Spine | Commit approved design and stationing. | Account, Product, Intent, ApprovedDesign, Stationing. | Lower ledger shows Spine committed. | Pre-ScopeVersion Spine or candidate canonical truth. | SpineCommit runtime artifact. | Spine validation. | Missing artifact. | Show missing checklist. | `SPINE_COMMITTED`. |
| Generate Proposal | Generate commercial proposal. | SpineCommit and pricing model. | Proposal summary and pricing show. | None. | Proposal runtime object. | Proposal generation validation. | Proposal reads UI-only state. | Block until Spine exists. | `PROPOSAL_CREATED`. |
| Customer Approval | Customer approves proposal. | Customer actor/contact. | Authority advances to Engineering. | None. | Customer approval and Draft IOF trigger. | Customer review validation. | Missing customer authority. | Assign customer reviewer. | Approval event/history. |
| Engineering Certification | Engineer certifies Draft IOF. | Draft IOF, checklist. | Certified package and certificate created. | New executable ScopeVersion. | Certified IOF Package, certificate, ScopeVersion. | Engineering certification validation. | Checklist incomplete. | Return package to engineering review. | Certification history. |
| Certified IOF Package | Open certified package. | Certified package ID. | Package is read-only and executable. | ScopeVersion active. | Certified package runtime mirror. | Rehydration and package validation. | Package missing after refresh. | Rehydrate by WorkspaceSession. | Package evidence. |
| Marketplace | Preview marketplace readiness. | ScopeVersion and quantities. | Marketplace readiness or blockers. | No mutation unless package sent. | MarketplacePackage when sent. | Marketplace readiness validation. | Reads proposal instead of ScopeVersion. | Block and show ScopeVersion requirement. | Package record. |
| Control | Preview control readiness. | ScopeVersion and control evidence. | Control readiness or blockers. | No mutation unless activated. | ControlWorkItem when authorized. | Control readiness validation. | No authority/contract close. | Keep locked. | Control diagnostics. |
| Field | Preview field readiness. | Active control work. | Field locked or ready. | No mutation until closure. | FieldClosure when executed. | Field validation. | No active control work. | Show prerequisite. | Field closure evidence. |
| Twin | Surface opportunity in Twin. | Opportunity or ScopeVersion selection. | Customer, Product, Design, Proposal, Engineering, Runtime state visible. | None. | Derived TwinProjection. | Twin activation validation. | Runtime object absent. | Repair runtime mirror or relationship. | Twin projection response. |

Automated checks where possible:

- Verify guided state machine starts at the correct state after login.
- Verify Product policy loads for `PRODUCT-L1-PROTECTED-DARK-FIBER-IRU`.
- Verify A and Z resolution use separate inputs.
- Verify KMZ/KML import contract remains available.
- Verify Proposal cannot generate without SpineCommit.
- Verify Engineering Certification creates ScopeVersion only from Certified IOF Package.
- Verify refresh rehydrates the same Opportunity state.
- Verify Twin projection includes Account, Product, Proposal, Certified IOF, and ScopeVersion.

Sprint 19 is not complete if any stage fails.

## 9. Validation Scripts Required

| Script | Purpose | Inputs | Assertions | Failure Behavior | Expected Command |
|---|---|---|---|---|---|
| Operator workflow validation | Prove the guided operator path and UI contracts. | Source code and golden path fixtures. | State machine, next action, A/Z, KMZ/KML, disabled button rules. | Fail on dead action or missing guided step. | `node sprint19-guided-opportunity-validation.mjs` |
| Runtime rehydration validation | Prove refresh/login/authority transfer continuity. | Runtime fixtures and auth users. | Rehydrate Account through ScopeVersion and Runtime History. | Fail if state is recreated or missing. | `node runtime-rehydration-validation.mjs` |
| ScopeVersion transition validation | Prove only allowed ScopeVersion transitions occur. | ScopeVersion fixtures, closes, actors. | Required closes, actor authority, transition audit. | Fail on orphan close or invalid transition. | `node sprint19-scopeversion-transition-validation.mjs` |
| Guided opportunity validation | Prove Google opportunity progresses through guided states. | Google account, product, customer inputs, design fixtures. | State order, artifacts, next actions, refresh continuity. | Fail on skipped or hidden transition. | `node sprint19-guided-opportunity-validation.mjs` |
| Product policy validation | Prove Product policy drives inputs, design, pricing, deliverables. | Product definitions. | Required fields and policy gates exist for Protected Dark Fiber IRU. | Fail on missing policy or UI hardcoding. | `node sprint19-product-policy-validation.mjs` |
| Design compiler validation | Prove deterministic design candidates from fixed inputs. | Product policy, intent, inventory, constraints. | Repeatable candidates, explanations, no black-box mutation. | Fail on nondeterministic output. | `node sprint19-design-compiler-validation.mjs` |
| Proposal generation validation | Prove proposal derives from Spine truth. | SpineCommit, pricing model, product policy. | Pricing, recipients, geometry, fulfillment lineage. | Fail if proposal uses UI-only state. | `node sprint19-proposal-generation-validation.mjs` |
| Marketplace readiness validation | Prove marketplace preview/package consumes ScopeVersion. | Certified ScopeVersion and quantities. | Package blocked before ScopeVersion; ready after. | Fail if marketplace consumes Proposal/Draft IOF directly. | `node sprint19-marketplace-readiness-validation.mjs` |
| Control readiness validation | Prove Control remains authority-gated. | ScopeVersion, closes, control fixtures. | No Control without required authority; work items trace to ScopeVersion. | Fail on ungated activation. | `node sprint19-control-readiness-validation.mjs` |
| Twin activation validation | Prove Opportunity selection surfaces full governed context. | Runtime objects, ScopeVersion, opportunity ID. | Customer, Product, Design, Proposal, Engineering, Runtime state visible. | Fail on missing projection. | `node sprint19-twin-activation-validation.mjs` |

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

## 10. Final Recommendation

Is Hyperlinx ready to begin Sprint 19?

Yes, if Sprint 19 is scoped as Guided Opportunity Experience stabilization. No, if Sprint 19 is interpreted as new product expansion, new AI automation, new work queues, or new execution-domain capability.

What must be frozen before Sprint 19?

- Runtime rehydration contract.
- Runtime handler order with specific runtime routes before foundation.
- Account/Contact persistence contract.
- Product and Fulfillment Plan schema for Protected Dark Fiber IRU.
- Engineering Certification gate.
- Certified IOF Package to ScopeVersion authority path.
- Sprint 18 A/Z deterministic resolution behavior.
- Existing validations used as regression guardrails.

What must not be changed during Sprint 19?

- Do not let Proposal create executable ScopeVersion.
- Do not bypass Engineering Certification.
- Do not let AI certify or mutate governed authority.
- Do not persist UI-only state as lifecycle truth.
- Do not expand Layer 2 products before the Google guided path is complete.
- Do not make Marketplace, Control, or Field consume Proposal or Draft IOF directly.

Highest-risk area:

The highest-risk area is pre-certification design authority. Customer inputs, intent validation, design candidate generation, design approval, stationing, and Spine commit need a governed state model before Proposal generation can truly be driven by the Spine.

Most important operator-experience improvement:

Create a single guided opportunity state machine with map-first spatial work, lower-pane governed ledger, and right-panel reasoning/next action. This turns the platform from a collection of capable panels into an operating system for human work.

What should be committed, tagged, or preserved as evidence?

- `SPRINT_18_OPERATOR_EXPERIENCE_REPORT.md`
- `sprint18-operator-experience-validation.mjs`
- `HYPERLINX_MASTER_AUDIT_AND_SPRINT_19_PLAN.md`
- `runtime-rehydration-validation.mjs`
- `SPRINT_17_RUNTIME_REHYDRATION_REPORT.md`
- `SPRINT_16_LIFECYCLE_PERSISTENCE_AUDIT.md`
- `SPRINT_15_PRODUCT_FULFILLMENT_REPORT.md`
- `SPRINT_14_ACCOUNT_WORKSPACE_REPORT.md`
- ScopeVersion doctrine and validation documents
- Engineering Certification and IOF Package reports
- Proof files under `.tmp` for Sprint 15 through Sprint 18
- Production build artifacts only if the repository convention requires committing `dist-dal`

Final recommendation:

Begin Sprint 19 as a guided-operator stabilization sprint. Treat the Google opportunity as the acceptance test. Make Opportunity the unit of work, Product policy the governing design input, the Design Engine the compiler, ScopeVersion the constitutional truth, Runtime the continuity layer, and human certification the only path to governed authority.
