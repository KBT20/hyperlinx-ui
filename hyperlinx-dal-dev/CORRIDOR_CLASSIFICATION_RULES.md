# Corridor Classification Rules

Status: read-only classification doctrine.

## Rule Priority

The classifier evaluates role signals in this order:

1. Explicit hints, when provided.
2. Campus/facility signals.
3. Interconnection handoff signals.
4. AI fabric signals.
5. Backbone or transport-heavy signals.
6. Same-MSA aggregation signals.
7. MSA-to-MSA relationship.
8. Regional-to-MSA relationship.
9. Default regional classification.

## Same-MSA Metro Aggregation

If the corridor is inside the same MSA and evidence includes LSOs, carrier hotels, data centers, IX, enterprise, wireless, municipal, utility, or aggregation language, classify as:

- `networkRole = METRO_AGGREGATION`
- `corridorClass = METRO`

Distance is advisory only.

## MSA-to-MSA Interconnect

If A and Z MSAs are known and different, classify as:

- `networkRole = MSA_INTERCONNECT`
- `corridorClass = MIDDLE_MILE`

unless stronger backbone or AI fabric evidence is present.

## Backbone Interconnect

If evidence includes backbone, longhaul, transport backbone, regional POP, carrier hotel, DWDM, wave, transport, terabit, or intercity intent, classify as:

- `networkRole = BACKBONE_INTERCONNECT`
- `corridorClass = LONGHAUL`

## AI Fabric

If evidence includes AI, GPU, hyperscaler, neocloud, substation, transmission, power, or AI compute intent, classify as:

- `networkRole = AI_FABRIC`
- `corridorClass = AI_CORRIDOR`

The result may preserve an `underlyingCorridorClass` inferred from geography.

## Campus

If evidence indicates internal campus, building, facility, meet-me room, MMR, internal entrance, or campus distribution, classify as:

- `networkRole = CAMPUS`
- `corridorClass = CAMPUS`

## Interconnection

If evidence indicates cloud on-ramp, IX, meet-me, carrier hotel handoff, or cross-connect purpose, classify as:

- `networkRole = INTERCONNECTION`
- `corridorClass = INTERCONNECTION`

## Diagnostics

The classifier emits:

- `[CORRIDOR_CLASSIFICATION_STARTED]`
- `[CORRIDOR_ROLE_INFERRED]`
- `[CORRIDOR_MSA_RELATIONSHIP_INFERRED]`
- `[CORRIDOR_AGGREGATION_ROLE_INFERRED]`
- `[CORRIDOR_CLASSIFICATION_WARNING]`
- `[CORRIDOR_CLASSIFICATION_COMPLETE]`

