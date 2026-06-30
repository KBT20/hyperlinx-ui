# StellaOS Constitution Index

Date: 2026-06-30
Status: index only
Commit status: no commit created

## Purpose

This index is the front door for current StellaOS / Hyperlinx DAL doctrine.

It does not rewrite existing doctrine. It defines a reading order, identifies primary sources, and points future implementation sprints to the current constitutional audit.

Primary audit:

- `STELLAOS_CONSTITUTIONAL_AUDIT.md`

Primary lifecycle doctrine:

- `INFRASTRUCTURE_LIFECYCLE_DOCTRINE.md`

## Reading Order

1. Platform principles
   - `../HYPERLINX_IOF_DOCTRINES.md`
   - `INFRASTRUCTURE_LIFECYCLE_DOCTRINE.md`
   - `SCOPEVERSION_CONSTITUTIONAL_DOCTRINE.md`
   - `CONSTITUTIONAL_RUNTIME_AUDIT.md`
2. Runtime foundation
   - `EVIDENCE_DOCTRINE.md`
   - `RUNTIME_OBJECT_DOCTRINE.md`
   - `SPRINT_11_RUNTIME_FOUNDATION.md`
   - `KERNEL_ENTITY_REGISTRY.md`
   - `KERNEL_EVENT_REGISTRY.md`
3. Workspace and authority boundaries
   - `WORKSPACE_AUTHORITY_BOUNDARY.md`
   - `AUTHORITY_SOURCE_MAP.md`
   - `KERNEL_TRANSITION_AUTHORITY.md`
4. ScopeVersion lifecycle and close authority
   - `SCOPEVERSION_LIFECYCLE_DOCTRINE.md`
   - `SCOPEVERSION_CLOSE_AUTHORITY_DOCTRINE.md`
   - `SCOPEVERSION_TRANSITION_AUTHORITY.md`
   - `CONSTITUTIONAL_LIFECYCLE_AUDIT.md`
   - `CONSTITUTIONAL_CLOSE_AUDIT.md`
5. Commercial planning and inventory recovery
   - `COMMERCIAL_PLANNING_WORKSPACE_VNEXT.md`
   - `COMMERCIAL_PLANNING_RUNTIME_RECOVERY_AUDIT.md`
   - `SPRINT_12_7_INGESTION_LANE_SEPARATION.md`
6. Customer, opportunity, proposal, and handoff
   - `CUSTOMER_DOCTRINE.md`
   - `OPPORTUNITY_DOCTRINE.md`
   - `COMMERCIAL_FOUNDATION_DOCTRINE.md`
7. Execution domains
   - Marketplace, Control, Field, Completion, Operations, Work Package, Twin, and Operational Intelligence docs.
8. Advisory reasoning
   - `CONVERSATIONAL_REASONING_DOCTRINE.md`
   - Prism, corridor, evidence enrichment, and provider docs.

## Current Constitutional Model

```text
Organization
  -> User
  -> Workspace
  -> Infrastructure Lifecycle
      -> Business Intent
      -> Participant Workspace
      -> Commercial Planning
      -> Engineering Certification
      -> IOF Package
      -> ScopeVersion
      -> Marketplace
      -> Control
      -> Construction
      -> Field Validation
      -> Closure
      -> Operational Intelligence
      -> Recursive Learning
  -> Runtime Libraries
      -> Evidence Registry
      -> Runtime Inventory
      -> Runtime Objects
      -> Relationship Graph
      -> Activity History
  -> Customer
      -> Existing Inventory
      -> Customer Twin
      -> Opportunity
      -> Proposal
      -> Engineering Handoff
  -> ScopeVersion
      -> Certified Infrastructure Truth
      -> Close Authority
      -> Lifecycle Authority
      -> Execution
```

## Canonical Distinctions

- Evidence is proof basis, not authority.
- Runtime Objects provide stable identity, ownership, visibility, authority, evidence links, relationship links, and history.
- ScopeVersions are certified infrastructure truth at a bounded point in time.
- Infrastructure Lifecycle governs responsibility transfer from participant intent to operational truth.
- Workspaces are responsibility lenses, not owners of independent data copies.
- Existing Inventory creates Customer Twin source truth.
- Customer Design Requests create design intent and proposed network objects, not Runtime Inventory.
- Twin and Operational Intelligence are read-only projection layers.
- AI and conversational reasoning are advisory until a human or explicit authority workflow records a governed decision.

## Supersession Notes

- `SPRINT_12_7_INGESTION_LANE_SEPARATION.md` supersedes older wording that can be read as Customer Design Requests creating Runtime Inventory.
- `INFRASTRUCTURE_LIFECYCLE_DOCTRINE.md` introduces a stricter execution ScopeVersion gate: Engineering Certification and IOF Package generation precede ScopeVersion creation. Existing candidate, inventory, graph-extension, and field-closure ScopeVersion language should be reconciled against this lifecycle in the next doctrine consolidation pass.
- Local or IndexedDB persistence paths are fallback/development mechanics unless a doctrine explicitly grants runtime authority.
- Graph-first inventory documents should be read under Runtime Inventory and ScopeVersion authority.

## Missing Primary Doctrines

The audit recommends adding these before the next major runtime-expansion sprint:

- `STELLAOS_PLATFORM_CONSTITUTION.md`
- `TENANT_WORKSPACE_IDENTITY_DOCTRINE.md`
- `RUNTIME_LIBRARY_CONSTITUTION.md`
- `RUNTIME_OBJECT_SCOPEVERSION_BRIDGE.md`
- `VISIBILITY_AUTHORITY_GRANT_MATRIX.md`
- `CUSTOMER_TWIN_DOCTRINE.md`
- `PROPOSAL_LIBRARY_DOCTRINE.md`
- `ENGINEERING_LIBRARY_DOCTRINE.md`
- `RELATIONSHIP_GRAPH_DOCTRINE.md`
- `ACTIVITY_HISTORY_EVENT_LEDGER_DOCTRINE.md`

## Health Snapshot

Overall constitutional health from the audit: 83 / 100.

The platform is healthy enough to build on, but future work should first add the missing hierarchy and bridge doctrines so runtime object identity, workspace responsibility, and ScopeVersion truth remain aligned.
