# Opportunity Intake Validation

Phase: 6.8A

## Implemented Files

- `src/opportunity/OpportunityRequest.ts`
- `src/opportunity/OpportunityIntake.ts`
- `src/opportunity/OpportunityPackageCandidate.ts`
- `src/opportunity/OpportunityAttachment.ts`
- `src/opportunity/OpportunityObjective.ts`
- `src/opportunity/OpportunityIntakeEngine.ts`
- `src/opportunity/fixtures/opportunityIntakeFixtures.ts`

## Valid Opportunity

A valid opportunity includes customer context, opportunity context, at least one objective, and at least one location.

## Missing Location Example

The incomplete fixture contains no locations and is blocked from Translate.

## Missing Objective Example

The incomplete fixture contains no objectives and is blocked from Translate.

## Google AI Opportunity Example

`Google Texas AI Expansion` contains:

- Customer: Google
- Type: HYPERSCALER
- Objective: AI_CORRIDOR
- Locations: Dallas Metro and West Texas AI Site
- Attachments: CSV and KMZ

## Carrier Route Example

`Carrier Long Haul Route` contains endpoint-style origin/destination locations and GeoJSON evidence.

## Ready For Translate Example

`Ready For Translate Opportunity` includes customer, opportunity, objective, location, and KMZ evidence.

## Blocked Example

`Incomplete Opportunity` is blocked because required customer, owner, location, and objective fields are missing.

## Diagnostics

- `[OPPORTUNITY_CREATED]`
- `[OPPORTUNITY_VALIDATED]`
- `[OPPORTUNITY_ATTACHMENT_REGISTERED]`
- `[OPPORTUNITY_LOCATION_REGISTERED]`
- `[OPPORTUNITY_GAP_IDENTIFIED]`
- `[READY_FOR_TRANSLATE]`
- `[TRANSLATE_BLOCKED]`

## Required Commands

```bash
npx tsc --noEmit
npm run build
git diff --check -- hyperlinx-dal-dev
```
