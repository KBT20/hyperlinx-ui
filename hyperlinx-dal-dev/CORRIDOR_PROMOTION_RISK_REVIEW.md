# Corridor Promotion Risk Review

Status: doctrine only.

## Risk Review Objective

The promotion gate must prevent under-evidenced corridor concepts from becoming ScopeVersion drafts. The risk review protects Route Engineering from inheriting ambiguous, unbuildable, or commercially incomplete candidates.

## Blocking Risks

| Risk | Blocker code |
| --- | --- |
| Missing endpoint | MISSING_A_ENDPOINT / MISSING_Z_ENDPOINT |
| Invalid coordinates | MISSING_ENDPOINT_COORDINATES |
| Missing route | NO_ROUTE_CANDIDATE_SELECTED |
| Invalid geometry | INVALID_GEOMETRY |
| Low route confidence | ROUTE_CONFIDENCE_BELOW_THRESHOLD |
| Missing customer requirement | MISSING_CUSTOMER_REQUIREMENT |
| Missing service intent | MISSING_SERVICE_INTENT |
| Missing availability target | MISSING_AVAILABILITY_TARGET |
| Missing commercial intent | MISSING_COMMERCIAL_PRODUCT_INTENT |
| Missing jurisdiction summary | MISSING_JURISDICTION_SUMMARY |
| Unresolved high constraint | UNRESOLVED_HIGH_SEVERITY_CONSTRAINT |
| Missing constructability risk | MISSING_CONSTRUCTABILITY_RISK |
| Missing permit risk | MISSING_PERMIT_RISK |
| Missing conduit assumption | MISSING_CONDUIT_ASSUMPTION |
| Missing fiber assumption | MISSING_FIBER_ASSUMPTION |
| Missing optical assumption | MISSING_OPTICAL_TRANSPORT_ASSUMPTION |
| Missing human approval | MISSING_HUMAN_ENGINEERING_APPROVAL |
| Duplicate active truth | DUPLICATE_ACTIVE_SCOPEVERSION |

## Review Guidance

Human engineering review should confirm:

- endpoints are the correct facilities.
- route candidate geometry is plausible.
- route diversity is not overclaimed.
- constructability risks are understood.
- permit fatal risks are resolved or explicitly rejected.
- conduit/fiber/transport assumptions match the customer ask.
- monetization assumptions do not override primary service objectives.

## Risk Ownership

Corridor Synthesis may identify risk. Prism may score risk. Human Engineering decides whether the candidate is eligible for ScopeVersion drafting. Route Engineering remains responsible for certification and approval after draft creation.

