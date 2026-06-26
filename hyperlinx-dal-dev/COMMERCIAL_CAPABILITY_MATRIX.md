# Commercial Capability Matrix

This matrix inventories the current commercial roadmap.

| Capability | Status | Source |
| --- | --- | --- |
| Route Generation | Implemented | `src/corridor/CorridorGenerationEngine.ts`, OSRM centerline evidence |
| Stationing | Implemented | `src/corridor/CorridorGenerationEngine.ts`, `StationedCorridor` |
| Corridor Takeoff | Implemented | `src/corridor/CorridorTakeoff.ts` |
| Civil Mix | Partial | `src/construction/CivilMixEngine.ts`; engineering validation required |
| Commercial Items | Implemented | `src/commercial/CommercialItemCatalog.ts` |
| Unit Cost Library | Implemented | `src/commercial/UnitCostLibrary.ts`; development values only |
| Quantity Mapping | Implemented | `src/commercial/CommercialQuantityMapping.ts` |
| Itemized Budget | Implemented | `src/commercial/ItemizedBudget.ts`, `CommercialFoundationEngine.ts`; read-only |
| Budget Comparison | Partial | `src/marketplace/BudgetComparison.ts` |
| Vendor Response | Partial | `src/rfp/GoogleRfpResponseEngine.ts` vendor response preview |
| Google Workbook | Partial | Preview/staging only; no workbook write authority |
| KMZ Export | Partial | Staging/readiness only; no authoritative export workflow |
| Budget Candidate | Partial | `src/marketplace/BudgetCandidate.ts` |
| Budget Lock | Future/Partial | `src/marketplace/BudgetLock.ts`; not connected to execution |
| Contract/SOF | Future/Partial | Doctrine/readiness only |
| Control Handoff | Future | Must require governed commercial and contract close |

## Current Rule

Commercial Foundation is ready for read-only estimates. It is not ready for Budget Lock, contract, SOF, procurement, or execution authority.

