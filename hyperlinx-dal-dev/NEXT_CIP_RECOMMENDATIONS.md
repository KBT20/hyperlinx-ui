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

### CIP-013 - Signed Service Order Readiness

Why third:

CIP-013 must finish the commercial authorization package without creating the Order for Execution.

Deliverables:

- Draft IOF Package.
- Engineering Certification that certifies the Draft IOF Package only and marks it as the Certified Draft IOF Package.
- Proposal as a commercial projection of the Certified Draft IOF Package.
- Customer change loop from Customer Review to Draft IOF Package Revision, Engineering Re-certification, and New Proposal.
- Customer Acceptance.
- Service Order that references the Certified Draft IOF Package, Proposal, Customer Acceptance, and commercial terms.
- Signature-ready Service Order.
- Commercial Release 2 placeholders for terms and conditions, payment terms, insurance, warranty, signature blocks, and legal language.
- validation that Engineering Certification does not create ScopeVersion.
- validation that Service Order readiness does not create ScopeVersion.
- validation that Proposal and Service Order do not recreate engineering truth outside the Certified Draft IOF Package.

### CIP-014 - ScopeVersion Creation and Execution Readiness

Why fourth:

ScopeVersion is the Order for Execution and can only be created after signed Service Order authority exists.

Deliverables:

- Signed Service Order intake.
- signed Service Order to ScopeVersion creation.
- ScopeVersion readiness contract.
- Certified Draft IOF Package to ScopeVersion mapping.
- required artifact list: doctrine assembly, audit projection, object manifest, address projection, catalog version, PD-003 artifacts, instantiation registry, kernel graph, signed Service Order.
- blocker model for missing, unsigned, or excepted artifacts.
- validation that no signed Service Order means no ScopeVersion.
- validation that no ScopeVersion means no Marketplace, Control, Field, or execution readiness.
- validation that Proposal, Service Order, and Draft IOF Package are not executed.
- validation that Marketplace, Control, Field, Closure, Operational Twin, and Operational Intelligence execute only against ScopeVersion.
- validation that Runtime promotion transfers the same Certified Draft IOF Package truth without a second Engineering review.

### CIP-015 - Constitutional Map Layer Architecture

Why fifth:

Map rendering is central to Commercial, Engineering, ScopeVersion, Field, Twin, and OI. It needs layer-level caching before object volume grows.

Deliverables:

- Layer projection registry.
- Per-layer cache keyed by source id, source revision, layer id, and style profile.
- Visible-only projection for expensive layers.
- Shared primitive list for render, metrics, and audit.
- Viewport/zoom gating for station labels and object layers.
- removal/gating of render logs.
- validation for duplicate render authority and hidden-layer non-render.

## What Should Be Completed Before ScopeVersion Expansion

- Constitutional projection cache.
- Engineering object/address workbench.
- ScopeVersion readiness gate.
- signed Service Order gate.
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
