# StellaOS Constitution Index

Date: 2026-07-04
Status: consolidated index
Commit status: no commit created

## Purpose

This index is the front door for current StellaOS / Hyperlinx DAL doctrine.

It does not rewrite existing doctrine. It identifies the canonical Constitution, preserves historical doctrine for backward compatibility, and points future implementation sprints to the current constitutional organization.

Primary Constitution:

- `docs/constitution/STELLAOS_CONSTITUTION.md`

Constitution version:

- `CONSTITUTION_VERSION.md`

Primary audit:

- `STELLAOS_CONSTITUTIONAL_AUDIT.md`

Primary lifecycle doctrine:

- `INFRASTRUCTURE_LIFECYCLE_DOCTRINE.md`
- `docs/cip/CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE.md`

## Reading Order

1. Canonical Constitution
   - `docs/constitution/STELLAOS_CONSTITUTION.md`
   - `CONSTITUTION_VERSION.md`
2. Platform principles
   - `../HYPERLINX_IOF_DOCTRINES.md`
   - `INFRASTRUCTURE_LIFECYCLE_DOCTRINE.md`
   - `docs/cip/CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE.md`
   - `SCOPEVERSION_CONSTITUTIONAL_DOCTRINE.md`
   - `CONSTITUTIONAL_RUNTIME_AUDIT.md`
3. Runtime foundation
   - `EVIDENCE_DOCTRINE.md`
   - `RUNTIME_OBJECT_DOCTRINE.md`
   - `SPRINT_11_RUNTIME_FOUNDATION.md`
   - `KERNEL_ENTITY_REGISTRY.md`
   - `KERNEL_EVENT_REGISTRY.md`
4. Workspace and authority boundaries
   - `WORKSPACE_AUTHORITY_BOUNDARY.md`
   - `AUTHORITY_SOURCE_MAP.md`
   - `KERNEL_TRANSITION_AUTHORITY.md`
5. ScopeVersion lifecycle and close authority
   - `docs/cip/CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE.md`
   - `SCOPEVERSION_LIFECYCLE_DOCTRINE.md`
   - `SCOPEVERSION_CLOSE_AUTHORITY_DOCTRINE.md`
   - `SCOPEVERSION_TRANSITION_AUTHORITY.md`
   - `CONSTITUTIONAL_LIFECYCLE_AUDIT.md`
   - `CONSTITUTIONAL_CLOSE_AUDIT.md`
6. Commercial planning and inventory recovery
   - `COMMERCIAL_PLANNING_WORKSPACE_VNEXT.md`
   - `COMMERCIAL_PLANNING_RUNTIME_RECOVERY_AUDIT.md`
   - `SPRINT_12_7_INGESTION_LANE_SEPARATION.md`
7. Customer, opportunity, proposal, and handoff
   - `CUSTOMER_DOCTRINE.md`
   - `OPPORTUNITY_DOCTRINE.md`
   - `COMMERCIAL_FOUNDATION_DOCTRINE.md`
8. Execution domains
   - Marketplace, Control, Field, Completion, Operations, Work Package, Twin, and Operational Intelligence docs.
9. Advisory reasoning
   - `CONVERSATIONAL_REASONING_DOCTRINE.md`
   - Prism, corridor, evidence enrichment, and provider docs.

## Constitutional Authority Organization

The canonical Constitution organizes doctrine by authority:

1. Platform Constitution
   - StellaOS Platform Constitution
   - Constitutional Layer Integrity
   - Infrastructure Lifecycle
   - Runtime Constitution
2. Runtime Constitution
   - Runtime Object Doctrine
   - Runtime Library Constitution
   - Kernel Entity Registry
   - Kernel Event Registry
   - Artifact Registry
   - Artifact Lineage
   - Relationship Graph
   - Activity Ledger
3. Commercial Authority
   - Customer Doctrine
   - Opportunity Doctrine
   - Product Doctrine
   - Commercial Foundation
   - Proposal Library
   - Fulfillment Request
   - Service Order Doctrine
4. Engineering Authority
   - PD-002A Addressing
   - PD-002B Placement
   - Spine Object Catalog
   - PD-003 Production
   - Engineering Certification
   - Engineering Library
5. Execution Authority
   - ScopeVersion Constitution
   - Transition Authority
   - Close Authority
   - Visibility Authority
   - Marketplace
   - Control
   - Field
6. Operational Authority
   - Operational Twin
   - Operational Intelligence
   - Activity History
   - Runtime Replay
7. Reasoning Authority
   - Conversational Reasoning
   - Prism
   - Recommendation Engine
   - Opportunity Discovery

## Current Constitutional Model

```text
Human Intent
  -> Fulfillment Request
  -> Commercial
  -> Engineering
  -> Customer Acceptance
  -> Service Order
  -> ScopeVersion
  -> Marketplace
  -> Control
  -> Field
  -> Closure
  -> Operational Twin
  -> Operational Intelligence
  -> Prism
  -> Next Fulfillment Request
```

## Canonical Distinctions

- Evidence is proof basis, not authority.
- Runtime Objects provide stable identity, ownership, visibility, authority, evidence links, relationship links, and history.
- ScopeVersions are certified infrastructure truth at a bounded point in time.
- Infrastructure Lifecycle governs responsibility transfer from participant intent to operational truth.
- Service Order owns commercial authorization before execution truth.
- Workspaces are responsibility lenses, not owners of independent data copies.
- Existing Inventory creates Customer Twin source truth.
- Customer Design Requests create design intent and proposed network objects, not Runtime Inventory.
- Twin and Operational Intelligence are read-only projection layers.
- AI and conversational reasoning are advisory until a human or explicit authority workflow records a governed decision.

## Supersession Notes

- `docs/constitution/STELLAOS_CONSTITUTION.md` is the canonical authority-organized Constitution for future doctrine and development planning.
- `CONSTITUTION_VERSION.md` versions the Constitution independently from software releases.
- `SPRINT_12_7_INGESTION_LANE_SEPARATION.md` supersedes older wording that can be read as Customer Design Requests creating Runtime Inventory.
- `INFRASTRUCTURE_LIFECYCLE_DOCTRINE.md` introduces a stricter execution ScopeVersion gate: Engineering Certification and IOF Package generation precede ScopeVersion creation. Existing candidate, inventory, graph-extension, and field-closure ScopeVersion language should be reconciled against this lifecycle in the next doctrine consolidation pass.
- `docs/cip/CONSTITUTIONAL_LAYER_INTEGRITY_DOCTRINE.md` adds the no-layer-skip rule: Customer Acceptance precedes Service Order, Service Order precedes execution ScopeVersion truth, ScopeVersion precedes Control and Field, and validated Close precedes payment eligibility.
- Local or IndexedDB persistence paths are fallback/development mechanics unless a doctrine explicitly grants runtime authority.
- Graph-first inventory documents should be read under Runtime Inventory and ScopeVersion authority.

## Backward Compatibility

Historical sprint reports, audits, validation reports, and implementation-specific documents remain part of the evidence corpus.

They are not deleted or rewritten by CIP-012.

They are now organized by the canonical authority model in `docs/constitution/STELLAOS_CONSTITUTION.md`.

## Open Doctrine Slots

The Constitution names these durable authority domains even where a standalone document is still pending:

- Runtime Library Constitution
- Runtime Object ScopeVersion Bridge
- Visibility Authority Grant Matrix
- Customer Twin Doctrine
- Proposal Library Doctrine
- Engineering Library Doctrine
- Relationship Graph Doctrine
- Activity History Event Ledger Doctrine
- Service Order Doctrine

## Health Snapshot

Overall constitutional health from the audit: 83 / 100.

The platform is healthy enough to build on, but future work should first add the missing hierarchy and bridge doctrines so runtime object identity, workspace responsibility, and ScopeVersion truth remain aligned.
