# NEXT_CIP_RECOMMENDATIONS

Date: 2026-07-03
Program: CIP-010 - Constitutional Workspace Rationalization, Performance Audit & Foundation Review

## Priority Order

### CIP-011 - Constitutional Projection Cache and Assembly Scheduler

Why first:

The platform now assembles doctrine, audit, manifest, addressing, production, kernel, and instantiation artifacts. Running that stack from React memo chains is the largest stability risk.

Deliverables:

- Assembly input hash contract.
- Projection cache for Product Doctrine, Draft IOF Package, Audit Projection, Object Addressing, Kernel Graph, PD-003 artifacts, and Instantiation.
- Explicit assembly triggers.
- Development counters for assembly executions, projection executions, and cache hits.
- Regression validation proving no assembly occurs without input hash change.

### CIP-012 - Workspace Navigation and Commercial Planning Rationalization

Why second:

The navigation should express the constitutional lifecycle, and Commercial must stop behaving like an engineering workspace.

Deliverables:

- Grouped lifecycle navigation.
- Commercial Planning split into Customer/Product, Commercial Design, Financial Soundness, Constitutional Completeness, Engineering Handoff.
- Preliminary Proposal merged into Commercial.
- diagnostics moved under System.
- lazy workspace body loading.
- regression validation for workspace access and default workspace shell.

### CIP-013 - Constitutional Map Layer Architecture

Why third:

Map rendering is central to Commercial, Engineering, ScopeVersion, Field, Twin, and OI. It needs layer-level caching before object volume grows.

Deliverables:

- Layer projection registry.
- Per-layer cache keyed by source id, source revision, layer id, and style profile.
- Visible-only projection for expensive layers.
- Shared primitive list for render, metrics, and audit.
- Viewport/zoom gating for station labels and object layers.
- removal/gating of render logs.
- validation for duplicate render authority and hidden-layer non-render.

### CIP-014 - Engineering Certification Object Workbench

Why fourth:

The constitutional foundation now creates objects. Engineering needs a UI that certifies object presence, address, placement, dependency, sequence, evidence, and exceptions.

Deliverables:

- Spine object workbench.
- PD-002A address assignment queue.
- dependency graph view from Kernel Execution Graph.
- legal sequence validator.
- exception ledger.
- certification checklist bound to immutable Draft IOF Package revision.
- validation that Engineering certification does not create ScopeVersion.

### CIP-015 - ScopeVersion Readiness Gate and Foundation Contract

Why fifth:

ScopeVersion is the constitutional truth boundary. It should only be created from stable, certified, versioned foundation artifacts.

Deliverables:

- ScopeVersion readiness contract.
- Certified IOF Package to ScopeVersion mapping.
- required artifact list: doctrine assembly, audit projection, object manifest, address projection, catalog version, PD-003 artifacts, instantiation registry, kernel graph.
- blocker model for missing/excepted artifacts.
- validation that Commercial and Engineering preview states cannot create ScopeVersion directly.

## What Should Be Completed Before ScopeVersion Expansion

- Constitutional projection cache.
- Engineering object/address workbench.
- ScopeVersion readiness gate.
- Map layer cache and visible-only rendering.
- Lifecycle vocabulary convergence.
- validation counters for assembly/projection execution.

## What Should Be Deferred Until After Field

- payment authorization beyond forecast-only PD-003 projections,
- vendor marketplace procurement workflows,
- operational twin live telemetry,
- advanced OI analytics,
- field mobile specialization,
- automated construction scheduling optimization,
- AI-driven lifecycle mutation.

## If Starting Again Today

I would keep the constitutional doctrine chain, but redesign the runtime shell around:

- event-sourced artifact store,
- projection cache from day one,
- workspace lazy routes,
- one map layer registry,
- small Commercial bounded contexts,
- Engineering as the object certification center,
- ScopeVersion as the only production truth boundary,
- OI as a summary projection service instead of a render-time aggregator.

