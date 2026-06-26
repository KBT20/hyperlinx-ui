# Commercial Assumption Model

Phase: 7.4C  
Scope: Budget assumption contracts and fixtures

## Object Model

`BudgetAssumptionSet` contains many `BudgetAssumption` records.

Each assumption includes:

| Field | Purpose |
| --- | --- |
| `assumptionId` | Stable identifier used by budget traces. |
| `category` | Commercial grouping such as CIVIL, ENGINEERING, CUSTOMER, or RISK. |
| `name` | Human-readable assumption name. |
| `description` | Plain explanation of what is assumed. |
| `value` | Assumed value, status, percentage, count, or boolean. |
| `unit` | Unit for the assumption value. |
| `reason` | Why the assumption exists. |
| `source` | Origin of the assumption. |
| `confidence` | Level, score, and rationale. |
| `risk` | Cost exposure if the assumption is wrong. |
| `affectedCostCategories` | Budget categories impacted by the assumption. |
| `customerNeutral` | Whether the assumption is reusable beyond one customer. |

## Assumption Categories

The current DAL foundation supports:

- `CORRIDOR`
- `CORRIDOR_CONFIDENCE`
- `ROUTE_MATURITY`
- `EXISTING_INFRASTRUCTURE`
- `EXISTING_UTILITY`
- `CIVIL`
- `ENGINEERING`
- `COMMERCIAL`
- `CONSTRUCTION`
- `CUSTOMER`
- `RISK`

## Customer-Neutral Defaults

The default set is `BAS-TERALINX-DEV-2026-06`. It contains representative development assumptions only. It is not production pricing, not a customer standard library, and not a budget lock.

## Google Reference Handling

Reference patterns from the first hyperscaler opportunity are modeled as precedent:

- ILA/regen cost summaries imply explicit facility-spacing assumptions.
- ILA/rack workbooks imply rack-basis assumptions without importing price values.
- fiber project workbooks imply ILA location, fiber summary, OSP metric, civil, permitting, testing, and vendor quantity assumptions.
- campus RFP packages imply customer specification, route artifact, and acceptance assumptions.

These patterns remain reusable and customer-neutral.
