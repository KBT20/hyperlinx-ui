# ScopeVersion Stabilization Report

Date: 2026-06-15

Scope: DAL-only stabilization inside `hyperlinx-dal-dev/`. No Chicago, root production, or IOF production files were modified.

## Current Model

Before Phase 2A, DAL ScopeVersions existed as flexible objects with a loose `canonicalTruth` map. Site Decision creation captured useful context, but downstream workspaces could still fall back to Opportunity Seeds, quotes, selected network affinity, or live graph state for route, station, attachment, build, risk, and commercial assumptions.

The previous model also retained legacy lifecycle states such as `CANDIDATE` and `FIELD_CLOSED`, which made status behavior ambiguous.

## Final Model

`ScopeVersion` is now the canonical DAL operational truth object. The formal model lives in `src/types/dal.ts` and contains these basis sections:

- `graphReference`: inventory ID, graph ID, graph version.
- `networkBasis`: route, node, station, attachment point, attachment coordinates, capacity, attachment strategy, affinity score.
- `geographicBasis`: candidate coordinates, geocoder metadata, build path geometry, route geometry, station geometry, node geometry.
- `engineeringBasis`: build feet, build miles, construction type, crossings, permit authorities, constructability score, engineering score.
- `financialBasis`: construction, engineering, permit, crossing, environmental cost, NRC, MRC, TCV, payback, ROI, margin, financial score.
- `riskBasis`: permit, crossing, construction, environmental, and composite risk.
- `decisionBasis`: GO / NO_GO / REVIEW recommendation, composite score, strategic score, engineering score, financial score, risk score, phase, priority.
- `sourceCandidate` and `sourceOpportunity`: traceability back to the source site and seed.

Site Decision ScopeVersions are created in `src/scopeversion/scopeVersionUtils.ts` and now persist the full frozen basis at creation time.

## Lifecycle Diagram

```text
DRAFT
  -> ANALYZED
  -> REJECTED

ANALYZED
  -> QUOTED
  -> APPROVED
  -> REJECTED

QUOTED
  -> APPROVED
  -> REJECTED

APPROVED
  -> ACTIVATED
  -> REJECTED

ACTIVATED
  -> IN_CONSTRUCTION
  -> COMPLETE
  -> REJECTED

IN_CONSTRUCTION
  -> COMPLETE

COMPLETE
  -> terminal

REJECTED
  -> terminal
```

Transitions are defined and enforced in `src/scopeversion/scopeVersionValidation.ts`.

## Validation Rules

A committed operational ScopeVersion is invalid if any of the following are missing:

- ScopeVersion ID.
- Creation timestamp.
- Creator.
- Decision timestamp.
- Lifecycle status.
- Graph ID and graph version.
- Source candidate.
- Route ID.
- Node ID.
- Station ID.
- Attachment coordinates.
- Candidate latitude and longitude.
- Build path geometry.
- Build path object.
- Build feet and build miles.
- Financial basis with NRC, MRC, and TCV.
- Decision recommendation.

Validation warnings are emitted for incomplete route, station, or node geometry snapshots. Invalid operational ScopeVersions are blocked before commit.

## Immutability Rules

After creation, the following frozen bases are preserved:

- Graph reference.
- Network basis.
- Geographic basis.
- Engineering basis.
- Financial basis.
- Risk basis.
- Decision basis.
- Source candidate.
- Source opportunity.

Lifecycle saves may update status, events, validation, and commercial quote overlays. They may not overwrite the frozen engineering, route, attachment, graph, or financial assumptions.

## Consumer Mappings

Marketplace:

- Consumes only ScopeVersions with formal `networkBasis` and `financialBasis`.
- Generates quotes from ScopeVersion truth through `src/commercial/quoteEngine.ts`.
- Does not import Opportunity Seeds or recalculate route, node, station, attachment, or construction basis.

Control:

- Creates work items only from ScopeVersion basis fields.
- Work items reference `scopeVersionId`.
- Route, node, station, attachment, permits, crossings, and build path come from the frozen ScopeVersion basis.
- Status advances through valid lifecycle transitions.

Twin:

- Planned network state renders from ScopeVersion basis.
- Candidate, attachment, service path, route, station, costs, crossings, and risks are read from the selected ScopeVersion.

Operational Intelligence:

- Tracks lifecycle counts for Draft, Analyzed, Quoted, Approved, Activated, In Construction, and Complete scopes.
- NRC, MRC, TCV, and revenue forecast are derived from ScopeVersion financial basis and quote overlays.

Reasoning:

- Receives `scopeVersionContext` and `scopeVersionBasis`.
- May explain route, attachment, recommendation, quote, permit, and risk rationale.
- Remains advisory only and does not mutate ScopeVersion.

## Verification

Required verification commands:

```text
npx tsc --noEmit
npm run build
```

