# CBS To Assumption Mapping

Phase: 7.4C  
Scope: Cost Breakdown Structure mapping

## Purpose

The Cost Breakdown Structure maps budget categories to the assumption categories required to defend them.

## Current Mapping

| CBS Category | Required Assumption Categories | Example Drivers |
| --- | --- | --- |
| CIVIL | CIVIL, CONSTRUCTION, RISK, CORRIDOR_CONFIDENCE | HDD %, plow %, rock, utilities, ROW, route maturity. |
| MATERIALS | EXISTING_INFRASTRUCTURE, CUSTOMER, COMMERCIAL | conduit/fiber standards, commodity status, infrastructure reuse. |
| LABOR | CONSTRUCTION, CUSTOMER, RISK | crew assumptions, working days, testing, restoration, unknown utilities. |
| ENGINEERING | ENGINEERING, RISK, CUSTOMER | survey, permits, environmental, customer standards, ROW uncertainty. |
| GENERAL_CONDITIONS | CONSTRUCTION, COMMERCIAL, RISK | mobilization, traffic control, project management, fuel/weather risk. |
| CONTINGENCY | RISK, CORRIDOR_CONFIDENCE, ROUTE_MATURITY | unknown utilities, geology, ROW, preliminary route maturity. |
| RECURRING | COMMERCIAL, CUSTOMER, RISK | O&M assumptions, customer acceptance, unresolved risk. |

## Implementation

Mappings are defined in:

`src/commercial/CostBreakdownStructure.ts`

Budget lines receive assumption IDs from:

`src/commercial/BudgetAssumptionEngine.ts`

## Boundary

CBS mapping does not calculate production pricing. It explains which assumption categories are required before a budget category can be trusted.

