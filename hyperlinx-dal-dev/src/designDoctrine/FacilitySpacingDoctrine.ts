export interface FacilitySpacingDoctrine {
  facilityProfileId: string;
  regenSpacingMiles?: number;
  vaultSpacingFeet?: number;
  cabinetDensity?: "LOW" | "MEDIUM" | "HIGH";
  buildingEntranceAssumption?: "SINGLE" | "MULTIPLE";
  lateralAssumption?: "BACKBONE_ATTACH" | "ACCESS_DISTRIBUTION" | "CAMPUS_DISTRIBUTION";
  notes: string[];
}
