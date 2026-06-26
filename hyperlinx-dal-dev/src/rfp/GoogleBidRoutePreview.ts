import type { GoogleRfpDiversityStatus } from "./GoogleRfpBidPlan";

export interface GoogleBidRoutePreview {
  routeRequirementId: string;
  routeName: string;
  aSite: string;
  zSite: string;
  routeMiles: number;
  civilMix: string;
  plowMiles: number;
  hddMiles: number;
  openTrenchMiles: number;
  bridgeAttachmentCount: number;
  railCrossings: number;
  waterCrossings: number;
  highwayCrossings: number;
  vaultCount: number;
  handholeCount: number;
  regenIlaCount: number;
  estimatedNrc: number;
  estimatedMrc: number;
  riskNotes: string[];
  diversityStatus: GoogleRfpDiversityStatus;
  status: "READY" | "BLOCKED";
}
