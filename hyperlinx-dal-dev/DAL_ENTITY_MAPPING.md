# DAL Entity Mapping

Phase: 6.7A

This document defines the read-only mapping between current DAL runtime records and Constitutional Runtime references.

| DAL Entity | Constitutional Target | Required Fields | Optional Fields | Mapping Confidence |
| --- | --- | --- | --- | --- |
| Customer | Customer | `customerId` | `name`, `accountId` | Verified when `customerId` exists |
| Opportunity | Opportunity | `opportunityId`, `customerId` | `corridorId`, `scopeVersionId` | Verified when customer and opportunity are linked |
| Corridor | Corridor | `corridorId` | `customerId`, `opportunityId`, `scopeVersionId` | Verified when corridor is bounded |
| ScopeVersion | ScopeVersion | `scopeVersionId`, `canonicalTruth.lifecycleState` | `customerId`, `sourceOpportunityId`, `canonicalTruth.corridorId` | Verified when lifecycle and traceability are present |
| Work Package | WorkPackage | `workPackageId`, `scopeVersionId` | `customerId`, `opportunityId`, `corridorId` | Verified when bounded to ScopeVersion |
| Control Item | WorkPackage | `workItemId`, `scopeVersionId` | `status`, `workType` | Verified when bounded to ScopeVersion |
| Field Item | CloseEvent | `closureId`, `scopeVersionId` | `stationId`, `objectId`, `closedAt` | Verified when bounded to ScopeVersion |
| Completion Item | Completion | `scopeVersionId`, `closeId` | `customerId`, `opportunityId`, `corridorId` | Verified when completion close is bounded |
| Operations Item | Operations | `scopeVersionId`, `closeId` | `customerId`, `opportunityId`, `corridorId` | Verified when operations close is bounded |

## Mapping Confidence

- `VERIFIED`: all required fields are present.
- `HIGH`: at least 75% of required fields are present.
- `MEDIUM`: at least 50% of required fields are present.
- `LOW`: fewer than half of required fields are present.

## Adapter Responsibility

The adapter reports missing fields as gaps. It does not synthesize identifiers, create fallback truth, or repair DAL records.
