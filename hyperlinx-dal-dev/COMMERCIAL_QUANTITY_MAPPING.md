# Commercial Quantity Mapping

Every commercial budget line must map to a generated platform quantity.

## Current Quantity Sources

| Source | Quantity |
| --- | --- |
| CorridorTakeoff | `routeFeet` |
| CorridorTakeoff | `routeMiles` |
| CorridorTakeoff | `ductFeet` |
| CorridorTakeoff | `fiberFeet` |
| CorridorTakeoff | `vaultCount` |
| CorridorTakeoff | `handholeCount` |
| CorridorTakeoff | `regenSiteCount` |
| CorridorTakeoff | `splicePointCount` |
| CorridorTakeoff | `markerPostCount` |
| CorridorTakeoff | `roadCrossingCount` |
| CorridorTakeoff | `railCrossingCount` |
| CorridorTakeoff | `waterCrossingCount` |
| CorridorTakeoff | `bridgeCrossingCount` |
| CorridorTakeoff | `unknownConstraintCount` |
| CorridorTakeoff | `estimatedConstructionCost` |
| CorridorTakeoff | `routeMiles` for preliminary recurring O&M support |

## Selected-Scope Estimator Derived Quantities

| Commercial Quantity | Mapping |
| --- | --- |
| Standard Duct Package | `routeFeet x 3` |
| Purchased Fiber | `fiberFeet + vault slack + handhole slack + waste` |
| Reel Count | `Purchased Fiber / reel length` |
| Butt Splice Locations | `Reel Count - 1` |
| Splice Cases | `Butt Splice Locations` |
| FuturePath | Optional; disabled by default and priced separately if enabled |

`estimatedConstructionCost` is mapped as reference-only and is excluded from itemized budget lines to prevent double counting.

Recurring O&M mappings are excluded from construction budget lines and used only to derive preliminary MRC.

## Current Mapping Location

`src/commercial/CommercialQuantityMapping.ts`

## Rule

If a platform quantity is not mapped, it may not generate a commercial dollar value.
