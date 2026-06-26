# Unit Cost Library Model

The Unit Cost Library is the representative development source for commercial unit costs.

It is not production pricing.

## Required Fields

Each unit cost item contains:

| Field | Purpose |
| --- | --- |
| `itemId` | Stable commercial item identifier. |
| `description` | Human-readable item description. |
| `category` | Civil, Materials, Labor, Engineering, or General Conditions. |
| `unit` | Foot, Each, Mile, Month, Allowance, or Percent. |
| `unitCost` | Representative development cost. |
| `costBasis` | Cost source explanation. |
| `currency` | Currently USD. |
| `version` | Unit cost library version. |
| `effectiveDate` | Version effective date. |
| `confidence` | LOW, MEDIUM, HIGH, or VERIFIED. |
| `status` | DEVELOPMENT, ACTIVE, SUPERSEDED, or FUTURE. |

## Current Status

The current version is `DEV-2026-06`.

All populated values are representative development values for architecture validation. No item should be represented to customers as production pricing without a future production price authority.

## Current Library Location

`src/commercial/UnitCostLibrary.ts`

