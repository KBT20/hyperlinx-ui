export type ConstructionProfileId =
  | "LONG_HAUL_BURIED_BACKBONE"
  | "MIDDLE_MILE_BURIED_AGGREGATION"
  | "METRO_DENSE_UNDERGROUND"
  | "CAMPUS_REDUNDANT_DUCT";

export interface ConstructionDoctrine {
  constructionProfileId: ConstructionProfileId;
  preferredConstructionType: "BURIED" | "UNDERGROUND_DUCT" | "MIXED";
  constructionAssumptions: string[];
  infrastructureAssumptions: string[];
  futureRoutingConstraints: string[];
}
