# Bid Package Quantity Model

Status: doctrine and contracts only.

## Purpose

Every Bid Package Item must have a measurable quantity.

Quantities allow pricing to propagate to stations, segments, budgets, ScopeVersions, opportunities, and customers in future phases.

## Supported Units

Supported quantity units include:

| Unit | Purpose |
| --- | --- |
| `FEET` | Linear construction or placement |
| `MILES` | Route length or long-haul quantity |
| `COUNT` | Generic count |
| `PAIR_MILES` | Dark fiber pair mile quantity |
| `CROSSINGS` | Road, rail, water, or other crossings |
| `SPLICES` | Splice count |
| `CABINETS` | Cabinet count |
| `REGENS` | Regeneration sites |
| `ADMS` | Add-drop multiplexer sites |
| `RACKS` | Rack count |
| `MW` | Megawatt quantity |
| `KW` | Kilowatt quantity |
| `ACRES` | Land quantity |
| `PERMITS` | Permit count |
| `MANHOLES` | Manhole count |
| `HANDHOLES` | Handhole count |
| `DUCTS` | Duct count |
| `FIBERS` | Fiber count |

## Required Item References

Every item must include:

- quantity.
- unit.
- object reference.
- station reference.
- segment reference.

These references remain read-only.

## Pricing

Quantity records may include:

- estimated unit cost.
- estimated total.
- linked price book id.
- marketplace unit type.

These are estimates only. They are not quotes or vendor responses.

## Object Alignment

Bid package items may reference:

- infrastructure objects.
- power objects.
- interconnection objects.
- property objects.
- operational objects.
- monetization objects.

No object mutation occurs in this phase.

