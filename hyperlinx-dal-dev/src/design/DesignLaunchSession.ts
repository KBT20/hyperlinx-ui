import type { DesignLaunchRequest } from "./DesignLaunchRequest";
import type { NetworkClass } from "../designDoctrine/NetworkClass";
import type { ProtectionClass } from "../designDoctrine/ProtectionClass";
import type { TopologyClass } from "../designDoctrine/TopologyClass";
import type { TeralinxPrimaryProduct, TeralinxProtection } from "../teralinx/TeralinxDesignIntent";
import type { TeralinxSite } from "../teralinx/TeralinxRouteRequest";

export type DesignLaunchStatus = "READY" | "BLOCKED";
export type DesignLaunchNextWorkspace = "DESIGN";

export type DesignLaunchBlockerType =
  | "MISSING_CUSTOMER"
  | "MISSING_OPPORTUNITY"
  | "MISSING_SITES"
  | "UNSUPPORTED_NETWORK_TYPE"
  | "INVALID_PROTECTION"
  | "MISSING_PRODUCT";

export type DesignLaunchDiagnosticCode =
  | "DESIGN_LAUNCH_REQUESTED"
  | "DESIGN_LAUNCH_READY"
  | "DESIGN_LAUNCH_BLOCKED"
  | "DESIGN_CUSTOMER_VALIDATED"
  | "DESIGN_OPPORTUNITY_VALIDATED"
  | "DESIGN_SITES_VALIDATED"
  | "DESIGN_INTENT_VALIDATED";

export interface DesignLaunchBlocker {
  blockerId: string;
  blockerType: DesignLaunchBlockerType;
  message: string;
  requiredAction: string;
}

export interface DesignLaunchDiagnostic {
  diagnosticId: string;
  code: DesignLaunchDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface DesignLaunchEstimatedMetrics {
  estimatedMileage: number;
  estimatedNodeCount: number;
  estimatedStations: number;
  estimatedSegments: number;
  estimatedObjects: number;
  placeholderOnly: true;
}

export interface DesignLaunchSession {
  launchId: string;
  status: DesignLaunchStatus;
  customerId: string;
  opportunityId: string;
  customerName: string;
  opportunityName: string;
  siteList: TeralinxSite[];
  networkIntent: DesignLaunchRequest["networkIntent"];
  protection?: TeralinxProtection;
  designDoctrineId?: string;
  networkClass?: NetworkClass;
  topology?: TopologyClass;
  protectionClass?: ProtectionClass;
  primaryProduct?: TeralinxPrimaryProduct;
  estimatedMileage: number;
  estimatedNodeCount: number;
  estimatedStations: number;
  estimatedSegments: number;
  estimatedObjects: number;
  estimatedMetrics: DesignLaunchEstimatedMetrics;
  diagnostics: DesignLaunchDiagnostic[];
  blockers: DesignLaunchBlocker[];
  nextWorkspace: DesignLaunchNextWorkspace;
  readOnly: true;
  noPersistence: true;
  noRouting: true;
  noGeometry: true;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
  createdAt: string;
}
