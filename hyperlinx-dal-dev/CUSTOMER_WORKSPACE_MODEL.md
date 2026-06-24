# Customer Workspace Model

Phase: 6.8D

Customer Workspace presents a customer-facing and CRO-facing business lens.

## Customer Summary

The workspace shows:

- `customerId`
- `customerName`
- `customerType`
- `accountOwner`
- `relationshipStatus`

## Opportunity Metrics

The workspace tracks:

- `activeOpportunities`
- `blockedOpportunities`
- `readyForTranslateOpportunities`
- `inReviewOpportunities`
- `inPrismOpportunities`
- `inMarketplaceOpportunities`
- `contractedOpportunities`
- `operationalOpportunities`

## Opportunity Summary

Each opportunity summary shows:

- `opportunityId`
- `opportunityName`
- `networkType`
- `protectionSchema`
- `status`
- `requestedProducts`
- `locations`
- `attachments`
- `readiness`
- `nextAction`
- `lastUpdated`

The workspace does not create or mutate opportunities. It organizes existing customer and opportunity context.

Opportunity Detail is the primary business development cockpit for each listed opportunity.

Customer Workspace organizes accounts. Opportunity Detail drives opportunity progression.
