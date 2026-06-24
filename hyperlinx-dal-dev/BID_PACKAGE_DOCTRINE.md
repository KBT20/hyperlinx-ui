# Bid Package Doctrine

Status: doctrine and contracts only.

## Purpose

Bid Packages define the unitized procurement structure vendors may respond to in future phases.

Engineering has approved the scope. Marketplace has assets, capabilities, vendors, service areas, and price books. The Bid Package model turns approved work into measurable procurement packages.

This phase does not collect bids, award vendors, create contracts, persist records, or execute work.

## Core Doctrine

Vendors do not bid ScopeVersions.

Vendors bid Bid Packages.

Bid Packages are composed of:

- objects.
- stations.
- segments.
- disciplines.
- categories.

Every Bid Package must contain measurable units.

All pricing must propagate downward to stations and upward to budgets.

## Authority Boundary

Bid Packages are procurement structure evidence.

They do not:

- create bid responses.
- award vendors.
- create contracts.
- mutate ScopeVersions.
- mutate lifecycle state.
- create Control work.
- create Field work.
- create Close Events.

ScopeVersion remains truth. Bid Package remains package structure.

## Package Composition

A Bid Package may be organized by:

- full project.
- segment.
- station group.
- discipline.
- category.
- hybrid grouping.

Each package item must reference:

- a quantity.
- a unit.
- an object reference.
- a station reference.
- a segment reference.

## Budget Role

Bid Packages become future Marketplace Budget inputs.

Price Books become Budget estimates.

Vendor Responses become Budget candidates.

Future:

```text
Bid Package
  -> Vendor Response
  -> Budget Candidate
  -> Budget Lock
```

No budget lock or response collection exists in this phase.

## ScopeVersion Close Authority Alignment

All authority resolves through ScopeVersion Close events.

Bid Packages remain procurement structure evidence until downstream validated close authority exists against `scopeVersionId`.

Vendor responses remain non-authoritative until closed through the ScopeVersion close authority chain.
