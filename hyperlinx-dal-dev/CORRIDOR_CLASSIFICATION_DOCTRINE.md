# Corridor Classification Doctrine

Status: doctrine and read-only type alignment.

## Constitutional Rule

Corridor classification describes development intent. It does not create ScopeVersion truth, routing authority, Prism score authority, or execution authority.

ScopeVersion remains execution truth. Route Engineering remains the authority that converts reviewed corridor evidence into executable network truth.

## Purpose

Corridor classification separates physical length from network role.

A corridor may be long in miles and still be metro if it connects many local aggregation points inside one MSA. A short corridor may be strategic interconnection if it connects a cloud on-ramp, IX, meet-me room, or carrier hotel.

## Classification Layers

Classification has three advisory layers:

- `corridorClass`: broad corridor family such as `METRO`, `MIDDLE_MILE`, `LONGHAUL`, `AI_CORRIDOR`, or `INTERCONNECTION`.
- `networkRole`: functional role such as `METRO_AGGREGATION`, `MSA_INTERCONNECT`, `BACKBONE_INTERCONNECT`, or `AI_FABRIC`.
- `aggregationRole`: what the corridor aggregates or hands off, such as LSOs, AI compute, data centers, regional POPs, campus buildings, or interconnection points.

## Distance Doctrine

Distance is evidence, not classification authority.

Distance may influence confidence and warnings, but distance alone must not override:

- MSA context.
- endpoint role.
- customer intent.
- aggregation function.
- interconnection purpose.
- AI fabric purpose.

Example: a 165-mile route connecting 26 LSOs inside one MSA is `METRO_AGGREGATION` / `METRO`, not longhaul.

## AI Corridor Doctrine

`AI_CORRIDOR` may operate as an overlay on geography.

When AI, GPU, hyperscaler, neocloud, substation, transmission, or power-proximity evidence dominates, the network role may be `AI_FABRIC` while the underlying physical class remains metro, middle-mile, regional, or longhaul evidence.

## Authority Boundary

The classification engine may emit diagnostics, confidence, and warnings. It may not:

- call routing providers.
- score candidates.
- persist corridor truth.
- create ScopeVersions.
- approve promotion.
- modify lifecycle state.

