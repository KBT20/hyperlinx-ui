# Corridor Object Registry

Status: doctrine only.

Scope: DAL corridor development objects for hyperscaler, neocloud, carrier, AI infrastructure, and transport corridor planning. This document does not change kernel lifecycle, closure authority, completion, Twin projection, Control, Field, or Operational Intelligence contracts.

## Constitutional Rule

Corridor objects are development and evidence objects until a human-approved design is promoted into a ScopeVersion.

ScopeVersion remains execution truth. Corridor is the development opportunity. Evidence supports authority but does not become authority.

## Primary Development Objects

| Object | Purpose | Authority owner | May become ScopeVersion truth |
| --- | --- | --- | --- |
| Corridor | Parent infrastructure opportunity | Corridor Synthesis | No |
| CorridorEndpoint | A/Z/intermediate asset to connect | Translate | No |
| CorridorRequirement | Customer ask and design target | Translate / Human Engineering | No |
| CorridorRouteCandidate | Candidate route option | Corridor Synthesis | Yes, after approval |
| CorridorEvidence | Source-backed support for a claim | Translate | No |

## Infrastructure Objects

| Object | Answers | Authority boundary |
| --- | --- | --- |
| ConduitSystem | Can we sell/maintain duct? | Design intent only until ScopeVersion promotion |
| FiberSystem | Can we IRU strands or reserve capacity? | Design intent only until ScopeVersion promotion |
| OpticalSystem | Can it meet transport requirements? | Design intent only until ScopeVersion promotion |
| InterconnectionNode | Can we connect to cloud/carrier/IX? | Evidence-backed facility reference |
| RegenerationSite | Can optics meet span and service targets? | Engineering-reviewed design object |

## Buildability And Risk Objects

| Object | Answers | Authority boundary |
| --- | --- | --- |
| Jurisdiction | Can we permit it? | Permit evidence, not permit authority |
| Crossing | Can we cross it and what method? | Risk evidence until certified |
| Constraint | What can block or distort the design? | Advisory until promoted |
| UtilityAsset | What utility conflicts/support exist? | Evidence only |
| ServiceZone | Can we operate and restore it? | Operational evidence only |

## Monetization Objects

| Object | Purpose | Primary model |
| --- | --- | --- |
| ResidualCapacity | Identifies unused duct/fiber/transport value | Secondary monetization |
| MonetizationOpportunity | Potential adjacent customer or attachment | Secondary monetization |
| CorridorProduct | Commercial product offered on corridor | Duct sale, IRU, recurring transport, operations |

## Required Object Questions

Every corridor object should answer at least one question:

- Can we build it?
- Can we permit it?
- Can we operate it?
- Can we restore it?
- Can we expand it?
- Can we monetize unused capacity?
- Can it meet the hyperscaler requirement?
- Can we substantiate the truth with evidence?

## Object Categories

Corridor objects are classified as:

- `DEVELOPMENT`: opportunity and candidate objects.
- `INFRASTRUCTURE`: conduit, fiber, optical, interconnection, regen.
- `BUILDABILITY`: jurisdiction, crossings, constraints, utilities, service zones.
- `MONETIZATION`: residual capacity, opportunities, products.
- `EVIDENCE`: source records and human review.
- `EXECUTION_REFERENCE`: ScopeVersion linkage only.

## Classification Context

Corridors may also carry advisory classification context:

- `corridorClass`: physical or commercial corridor family.
- `networkRole`: functional role in the network.
- `msaContext`: A/Z MSA relationship.
- `aggregationRole`: LSO, data center, AI compute, POP, backbone, campus, or interconnection aggregation function.

These fields classify development intent. They do not create ScopeVersion truth or execution authority.

## Implementation Reference

Additive TypeScript definitions live in:

- `src/corridor/corridorTypes.ts`
- `src/corridor/corridorObjectRegistry.ts`
- `src/corridor/corridorEvidence.ts`

These files are isolated from the DAL kernel and do not wire corridor objects into execution.
