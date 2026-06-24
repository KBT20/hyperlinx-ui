# Opportunity Detail Workspace Model

Phase: 6.8E

Opportunity Detail composes customer, opportunity, intent, protection, Translate, Baseline Network, Scope Review, Prism, and Preliminary Quote status into one deal page model.

## Workspace Sections

- Customer Summary
- Opportunity Summary
- Network Intent
- Protection Schema
- Locations
- Attachments
- Translate Status
- Baseline Network Summary
- Scope Review Status
- Prism Status
- Preliminary Quote Status
- Next Action
- Diagnostics

## Opportunity Summary Fields

- `customerId`
- `customerName`
- `opportunityId`
- `opportunityName`
- `accountOwner`
- `businessSponsor`
- `networkType`
- `protectionSchema`
- `requestedProducts`
- `requestedServices`
- `locationCount`
- `attachmentCount`
- `currentStatus`
- `nextAction`

The model is orchestration-only. It does not mutate underlying workspace state.
