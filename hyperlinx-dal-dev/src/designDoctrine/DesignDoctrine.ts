import type { ConstructionDoctrine } from "./ConstructionDoctrine";
import type { FacilitySpacingDoctrine } from "./FacilitySpacingDoctrine";
import type { MaterialDoctrine } from "./MaterialDoctrine";
import type { MSAClassification } from "./MSAClassification";
import type { NetworkClass } from "./NetworkClass";
import type { ProtectionClass } from "./ProtectionClass";
import type { TopologyClass } from "./TopologyClass";

export interface DesignDoctrine {
  designDoctrineId: string;
  networkClass: NetworkClass;
  defaultTopology: TopologyClass;
  allowedTopologies: TopologyClass[];
  defaultProtection: ProtectionClass;
  optionalProtections: ProtectionClass[];
  rules: string[];
  constructionDoctrine: ConstructionDoctrine;
  facilitySpacingDoctrine: FacilitySpacingDoctrine;
  materialDoctrine: MaterialDoctrine;
  readOnly: true;
  noRouting: true;
  noGeometryCreation: true;
}

export interface AppliedDesignDoctrine {
  doctrineApplicationId: string;
  doctrine: DesignDoctrine;
  networkClass: NetworkClass;
  topology: TopologyClass;
  protection: ProtectionClass;
  constructionProfileId: string;
  materialProfileId: string;
  facilityProfileId: string;
  msaClassification: MSAClassification;
  appliedRules: string[];
  diagnostics: DesignDoctrineDiagnostic[];
}

export interface DesignDoctrineDiagnostic {
  diagnosticId: string;
  code:
    | "DESIGN_DOCTRINE_LOADED"
    | "DESIGN_DOCTRINE_APPLIED"
    | "PROTECTION_NORMALIZED"
    | "MSA_CLASSIFIED"
    | "MSA_NETWORK_CLASS_WARNING";
  severity: "INFO" | "WARNING" | "ERROR";
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
