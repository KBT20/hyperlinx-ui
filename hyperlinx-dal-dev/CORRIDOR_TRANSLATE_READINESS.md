# Corridor Translate Readiness

Status: doctrine only.

## Current Safe Ingestion Targets

Translate can safely ingest and normalize:

- CorridorEndpoint from endpoint CSV, KML/KMZ, GeoJSON, or customer file.
- CorridorRequirement from customer ask text, workbook, or structured intake.
- CorridorRouteCandidate from customer-supplied route files.
- CorridorEvidence for every source row, file, API response, or human note.

These objects are development objects and do not create execution truth.

## Objects Requiring Human Review

Human review is required before promotion for:

- CorridorRouteCandidate.
- ConduitSystem.
- FiberSystem.
- OpticalSystem.
- InterconnectionNode.
- RegenerationSite.
- Jurisdiction.
- Crossing.
- Constraint.
- CorridorProduct.

Human review should create evidence.

## Objects Requiring API Enrichment

Likely API or dataset enrichment:

- Jurisdiction from DOT, county, city, railroad, federal, tribal, private datasets.
- Crossing from road, rail, water, bridge, pipeline, transmission, environmental datasets.
- UtilityAsset from electric, gas, water, wastewater, transmission, substation datasets.
- ServiceZone from crew, spares, truck roll, and restoration data.
- MonetizationOpportunity from facility, tower, school, municipal, carrier, and enterprise datasets.
- OpticalSystem from span, route length, regen, and standards data.

## Required Before Corridor Synthesis

Minimum:

- Corridor.
- A/Z endpoints.
- CorridorRequirement.
- At least one evidence-backed route source or routing provider.
- Evidence records for endpoint and requirement origin.

Recommended:

- customer type.
- topology target.
- latency target.
- diversity requirement.
- conduit/fiber/transport capacity target.
- commercial preference.

## Required Before Prism Scoring

Minimum:

- route candidates.
- distance.
- endpoint evidence.
- requirement evidence.
- constructability placeholder score.
- risk placeholder score.
- monetization placeholder score.

Recommended:

- jurisdictions.
- crossings.
- constraints.
- utility assets.
- service zones.
- residual capacity.
- product assumptions.

## Input Readiness Matrix

| Input Type | Normalize Ready | Human Review Required | Promotion Eligible |
| --- | --- | --- | --- |
| CSV | Yes | Yes, for mapped columns and inferred semantics | Not by itself |
| KML | Yes | Yes, for placemark meaning and geometry intent | Only with endpoints, requirements, and approval |
| KMZ | Yes | Yes, for extracted KML and asset meaning | Only with endpoints, requirements, and approval |
| GeoJSON | Yes | Yes, for feature semantics and route intent | Only with endpoints, requirements, and approval |
| Shapefile | Yes, after parser support | Yes, for layer semantics and coordinate system | Only with endpoints, requirements, and approval |
| Endpoint Pair | Yes | Yes, for facility identity and coordinates | Not by itself |
| Customer Route | Yes | Yes, for route intent, confidence, and assumptions | Only through promotion gate |

## Risk Register

| Risk | Level | Notes |
| --- | --- | --- |
| Customer endpoint ambiguity | HIGH | Data center campus, cloud onramp, and carrier hotel names may not geocode cleanly |
| Route evidence conflict | HIGH | Customer, DOT, OSRM, and human routes may disagree |
| Diversity overclaim | HIGH | Similar route candidates may appear diverse without physical separation evidence |
| Permit authority gaps | HIGH | Railroad, federal, tribal, and private ROW can be missed without authoritative datasets |
| Latency assumption drift | MEDIUM | Distance-derived latency is not optical path-certified |
| Residual monetization bias | MEDIUM | Secondary value can distort primary hyperscaler requirement |
| Product capacity assumptions | MEDIUM | Fiber/transport capability requires engineering review |
| Missing maintenance model | MEDIUM | Duct sale plus maintenance needs explicit owner and SLA assumptions |
| Evidence confidence misuse | LOW | Confidence is advisory, not authority |

## Not Ready For This Phase

Translate should not yet:

- create ScopeVersions from corridor objects.
- write IOF packages.
- trigger Control work.
- produce Field work.
- mutate Twin projection.
- establish lifecycle state.

Translate may create evidence-backed development objects only.
