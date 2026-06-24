# Baseline Network Validation

Phase: 6.8C

## Validation Scenarios

### Metro Ring

Input: `METRO + RING`

Expected: `METRO_RING_REFERENCE_ARCHITECTURE`

Objects: aggregation nodes, carrier hotel, enterprise access objects, metro segments.

### Middle Mile Diverse

Input: `MIDDLE_MILE + DIVERSE`

Expected: `MIDDLE_MILE_DIVERSE_REFERENCE_ARCHITECTURE`

Objects: aggregation sites, regional POPs, transport facilities, middle-mile segments.

### Long Haul Linear

Input: `LONG_HAUL + LINEAR`

Expected: `LONG_HAUL_LINEAR_REFERENCE_ARCHITECTURE`

Objects: ADM objects, regen objects, interconnect facilities, long-haul segments.

### AI Corridor Diverse

Input: `AI_CORRIDOR + DIVERSE`

Expected: `AI_CORRIDOR_DIVERSE_REFERENCE_ARCHITECTURE`

Objects: GPU facilities, substations, power objects, carrier hotels, data centers, interconnect facilities, long-haul connectivity objects.

### Blocked Example

Input: missing network intent or protection schema.

Expected: `BLOCKED`.

## Remaining Risks Before Implementation

- Scope Review has no UI in this phase.
- Architecture selections are deterministic mappings, not route analysis.
- Object counts are review placeholders and require human validation.
- No Prism scoring occurs in this phase.
