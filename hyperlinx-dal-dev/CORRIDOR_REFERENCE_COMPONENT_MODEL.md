# Corridor Reference Component Model

Reference components are reusable architecture building blocks.

Each component defines:

- purpose
- required objects
- required standards
- required tools
- human review boundary
- output expected for Route Engineering

## Components

## Conduit System

Purpose: Define conduit, duct, access, and residual capacity expectations.

Required objects:

- CONDUIT
- INNERDUCT
- RIGHT_OF_WAY

Required standards:

- STANDARD-CONDUIT-001

## Fiber System

Purpose: Define fiber count, strand reservation, service eligibility, and growth capacity.

Required objects:

- FIBER
- FIBER_PAIR
- SPLICE

Required standards:

- STANDARD-FIBER-001

## Optical System

Purpose: Define optical reach, wavelength, latency, regen, ADM, and platform expectations.

Required standards:

- STANDARD-REGEN-SITE-001
- STANDARD-ADM-SITE-001

Sales may not set optical reach, regen spacing, or ADM placement.

## Interconnection Plan

Purpose: Define data center, carrier hotel, IX, cloud on-ramp, and handoff expectations.

Required standards:

- STANDARD-DATA-CENTER-001
- STANDARD-CARRIER-HOTEL-001
- STANDARD-CLOUD-ONRAMP-001
- STANDARD-IX-001

## Power Proximity Plan

Purpose: Define power-adjacent evidence for AI, hyperscaler, and expansion corridors.

Required standards:

- STANDARD-SUBSTATION-001
- STANDARD-TRANSMISSION-001

Power proximity is not power capacity.

## Route Diversity Plan

Purpose: Define diversity, shared ROW, shared structure, and restoration expectations.

Route Engineering determines whether diversity is sufficient.

## Maintenance Plan

Purpose: Define maintenance access, repair rights, operating constraints, and responsibility.

## Restoration Plan

Purpose: Define restoration, SLA, protected path, and repair assumptions.

## Permitting / Jurisdiction Plan

Purpose: Define permit owners, lead times, authority, and jurisdiction risk.

Required standards:

- STANDARD-JURISDICTION-001

## Crossing Plan

Purpose: Define crossing method, owner, permit, cost, and schedule risk.

Required standards:

- STANDARD-CROSSING-001

## Evidence Plan

Purpose: Define required source evidence and normalization formats before architecture fit can be trusted.
