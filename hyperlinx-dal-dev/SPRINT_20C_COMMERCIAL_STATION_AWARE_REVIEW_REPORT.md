# SPRINT_20C_COMMERCIAL_STATION_AWARE_REVIEW_REPORT

## Executive Summary

Sprint 20C extends Sprint 20B station authority into Commercial Review.

Commercial can now consume the Draft IOF Package `measuredSpine`, `stationAuthority`, `stationToCoordinateMap`, `objectStationAttachments`, and `stationIndexedGraph` before Engineering handoff.

Commercial can move proposed station-attached objects by station reference, update the object coordinate from station authority, preserve review history, record customer-requested moves, and carry the updated placement into the Draft IOF Package submitted to Engineering.

Commercial still cannot certify station authority and cannot create ScopeVersion.

## Why Commercial Needs Stationing

Customer and proposal review often happens before Engineering Certification. A customer may ask Commercial to move a proposed ILA, regen hut, handhole, vault, splice case, pull point, or marker by station reference.

Sprint 20C allows Commercial to work against the same constitutional reference artifacts Engineering will later certify:

- measured spine
- station authority
- station coordinate map
- object station attachments
- station-indexed graph

The commercial move is advisory and revision-tracked. Engineering remains the certifying authority.

## Commercial Authority Limits

Commercial may:

- consume `measuredSpine`
- consume `stationAuthority`
- view stations
- look up stations by label, id, measure, or coordinate
- place proposed objects at stations
- move proposed objects from one station to another
- add proposed station-attached objects
- remove proposed station-attached objects
- record customer-requested station moves
- recalculate commercial impact
- save and submit a Draft IOF Package

Commercial may not:

- manually edit measured spine
- manually edit station measures
- manually move stations
- certify station authority
- create ScopeVersion
- bypass Engineering Certification

## Station-Aware Object Review Behavior

Added:

- `src/commercial/CommercialStationReviewEngine.ts`
- `src/components/commercial/StationAwareObjectReviewPanel.tsx`

The Commercial Review workspace now shows:

- object id
- object type
- current station id
- current station label
- current measure feet
- current coordinate
- attachment method
- spacing from prior facility
- spacing to next facility
- advisory doctrine spacing status
- commercial impact status

The panel also renders a Commercial MapKernel view containing:

- centerline
- measured spine
- station authority
- major station labels
- station-indexed graph edges
- station-attached proposed objects

## Move Object By Station Behavior

Added:

- `src/commercial/CommercialObjectPlacementEngine.ts`

`moveCommercialObjectByStation()` accepts:

- Draft IOF Package
- object id
- target station label/id/measure/coordinate
- reason
- actor
- customer-requested flag

The move flow:

- looks up the target station from `stationAuthority`
- updates the object station fields
- updates the object coordinate from station authority
- updates `objectStationAttachments`
- preserves the previous station
- records `commercialObjectPlacementHistory`
- records `customerRequestedMoves` when applicable
- creates `commercialImpactSummary`
- marks the package as requiring Engineering review
- preserves `measuredSpine`
- preserves `stationAuthority`
- does not create ScopeVersion

## Commercial Impact Summary

Each station move records:

- distance moved
- prior station
- new station
- affected doctrine spacing status
- affected ILA/regen chain note
- affected quantity note
- affected pricing note
- `requiresEngineeringReview: YES`

This is advisory only. It does not certify the move.

## Package Persistence Changes

Draft IOF Package assembly now initializes:

- `commercialObjectPlacementHistory`
- `customerRequestedMoves`
- `commercialImpactSummary`
- `commercialImpactSummaries`
- `commercialReviewRevision`

The Commercial package API preserves those fields.

Submit-to-Engineering now checks station-aware readiness and blocks only when required constitutional review artifacts are missing:

- route geometry missing
- `measuredSpine` missing
- `stationAuthority` missing
- `objectStationAttachments` missing
- unresolved required facility object

Commercial save remains non-certifying and non-blocking.

## Engineering Handoff Behavior

The Google RFP Commercial workspace now submits the edited Commercial Draft IOF Package state, not the unedited preview.

Engineering Certification receives:

- updated object station fields
- updated object coordinate
- updated `objectStationAttachments`
- commercial placement history
- customer-requested move history
- commercial impact summary
- unchanged measured spine
- unchanged station authority

Engineering then reviews and certifies. ScopeVersion remains out of scope.

## Validation Results

Commands run:

- `npx tsc --noEmit`: PASS
- `node sprint20c-commercial-station-aware-review-validation.mjs`: PASS, 38 checks
- `npm run build`: PASS

Build note: Vite reported the existing large chunk warning after a successful build.

## Remaining Gaps Before ScopeVersion

Sprint 20C creates Commercial station-aware review, but downstream authority remains unfinished.

Remaining gaps before ScopeVersion:

- Engineering must certify or reject Commercial station-aware placement changes.
- Accepted Engineering reroutes must invoke the Sprint 20B regeneration core.
- Certified IOF Package must preserve Commercial move history and station authority.
- ScopeVersion must refuse any Certified IOF Package missing station authority.
- Field and Operational Twin must consume stationed ScopeVersion authority, not Commercial review state.

## Constitutional Result

Commercial can now review a proposed route using measured spine and station authority.

Commercial can move a proposed ILA, regen, handhole, vault, splice case, pull point, marker, or hut by station reference.

The moved object receives its coordinate from station authority.

Measured spine and station authority remain unchanged.

The move is recorded as Commercial/customer review history.

The Draft IOF Package submitted to Engineering contains the updated station-aware object placement.

Engineering receives and reviews the updated placement.

ScopeVersion remains out of scope.
