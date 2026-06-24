# Work Package Doctrine

Status: doctrine, contracts, generation rules, validation fixtures, and read-only audit only.

## Purpose

Work Packages are the controlled decomposition of approved ScopeVersion truth into executable planning artifacts.

Control authorizes execution.

Work Packages organize execution.

Field performs execution.

## Core Doctrine

A Work Package inherits authority from `scopeVersionId` through `CONTROL_ACTIVE`.

No Work Package may exist without `scopeVersionId`.

No Work Package may exceed approved ScopeVersion authority.

No Work Package may modify ScopeVersion truth.

## Authority Boundary

This phase does not implement:

- scheduling.
- crew assignment.
- Field activation.
- execution.
- persistence.
- server routes.
- kernel mutation.

Generated Work Packages are planning artifacts only.

## Field Activation Authority Alignment

Approved Work Packages are required for Field activation.

Field executes approved Work Packages after Field Activation Authority approves execution.

Field activation creates Field authority.

Field closure occurs in a future phase.

## Field Closure Authority Alignment

Work Packages define the approved work that Field may close.

Field activation authorizes work.

Field closure records completed work against approved Work Packages.

ScopeVersion Close Authority validates closures.

Completion Authority consumes validated closures in a future phase.

## Generation Authority

Work Package generation requires `CONTROL_ACTIVE`.

Work Package generation may not occur from:

- Prism.
- Marketplace.
- Budget Candidate.
- Contract Readiness.
- Vendor Response.
- SOF Readiness.

Only `CONTROL_ACTIVE` may generate Work Packages.
