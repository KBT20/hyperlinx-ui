# Itemized Budget Model

The itemized budget is the first read-only commercial rollup from mapped quantities and unit costs.

It is not the final Budget Engine.

## Budget Line Fields

Each line contains:

| Field | Purpose |
| --- | --- |
| `description` | Human-readable line description. |
| `category` | Civil, Materials, Labor, Engineering, or General Conditions. |
| `quantity` | Derived quantity. |
| `unit` | Unit of measure. |
| `unitCost` | Unit cost from Unit Cost Library. |
| `extendedCost` | Quantity multiplied by unit cost. |
| `sourceQuantity` | Source field and value. |
| `sourceCorridor` | Centerline, stationed corridor, and takeoff references. |
| `confidence` | Unit cost confidence. |
| `overrideFlag` | Always false in Phase 7.4A. |

## Totals

The budget totals include:

- Civil
- Materials
- Labor
- Engineering
- General Conditions
- Direct Cost
- Markup
- Contingency
- Total Budget

## Current Model Location

`src/commercial/ItemizedBudget.ts`

## Current Engine Location

`src/commercial/CommercialFoundationEngine.ts`

