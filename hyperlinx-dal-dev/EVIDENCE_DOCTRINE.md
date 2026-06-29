# Evidence Doctrine

## Purpose

Everything starts as evidence. Evidence may be customer-provided, carrier-provided, Teralinx-generated, field-observed, or system-produced. Evidence is never the same thing as authority; it is the basis from which authority can be reviewed and promoted.

## Evidence Flow

Evidence flows through:

1. Evidence Registry
2. Translation
3. Normalization
4. Runtime Object Layer
5. Relationship Graph
6. ScopeVersion, when approved by the proper authority
7. Closure

## Evidence Metadata

Every evidence record must include:

- Evidence ID
- Source type
- Source name
- Source system
- Authority boundary
- Collected timestamp
- Ingested timestamp
- Validation status
- Lineage metadata

## Translation

Translation converts raw evidence into normalized runtime objects and relationships. Translation may preserve customer geometry and attributes, but it may not create ScopeVersion, Certified Route, Control, Field, Twin, Marketplace, or OI authority.

## Normalization

Normalization creates stable runtime IDs, object types, relationships, validation reports, and history records. Source files such as KMZ, KML, CSV, or API payloads are evidence inputs, not runtime authority containers.

## Runtime Commit

A runtime commit persists evidence, inventories, runtime objects, relationships, validation reports, connector metadata, and history. A commit must be append-only from an audit perspective.

## Promotion

Promotion from evidence to commercial, engineering, ScopeVersion, or operational authority requires an explicit workflow with recorded human or doctrinal approval.

## Current Sprint 11 Rule

Customer inventory may not be loaded directly from browser-local storage or static project assets in normal workflows. It must enter through evidence, translation, normalization, and runtime commit.
