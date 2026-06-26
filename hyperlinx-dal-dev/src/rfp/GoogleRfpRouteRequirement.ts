import type { TeralinxPrimaryProduct } from "../teralinx/TeralinxDesignIntent";
import type { TeralinxSite } from "../teralinx/TeralinxRouteRequest";

export type GoogleRfpRouteStatus = "NOT_STARTED" | "READY_FOR_DESIGN" | "CENTERLINE_READY" | "BUDGETARY_READY" | "BLOCKED";
export type GoogleRfpDiversityRequirement = "NONE" | "DIVERSE_FROM_ROUTE" | "REQUIRES_ENGINEERING_REVIEW";
export type GoogleRfpCoordinateStatus = "VERIFIED_FROM_RFP" | "VERIFIED_FROM_KMZ" | "MANUAL_REVIEW_REQUIRED" | "INVALID";

export interface GoogleRfpSite extends TeralinxSite {
  siteCode: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  sourceArtifact: string;
  sourceConfidence: number;
  coordinateStatus: GoogleRfpCoordinateStatus;
}

export interface GoogleRfpRouteRequirement {
  routeRequirementId: string;
  bidSegmentName: string;
  aSite: GoogleRfpSite;
  zSite: GoogleRfpSite;
  requiredProduct: TeralinxPrimaryProduct;
  fiberCount: number;
  ductRequirement: string;
  protectionRequirement: "NONE" | "PATH_PROTECTED" | "RING_PROTECTED" | "MESH_PROTECTED";
  diversityRequirement: GoogleRfpDiversityRequirement;
  diverseFromRouteRequirementId?: string;
  kmzFolderTarget: string;
  status: GoogleRfpRouteStatus;
}
