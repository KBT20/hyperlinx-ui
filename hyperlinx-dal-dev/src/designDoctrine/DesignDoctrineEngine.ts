import type { DesignLaunchSession } from "../design/DesignLaunchSession";
import type { TeralinxSite } from "../teralinx/TeralinxRouteRequest";
import type { AppliedDesignDoctrine, DesignDoctrine, DesignDoctrineDiagnostic } from "./DesignDoctrine";
import { DESIGN_DOCTRINES } from "./DesignDoctrineFixtures";
import { classifyMSA } from "./MSAClassification";
import { normalizeNetworkClass, type NetworkClass } from "./NetworkClass";
import { normalizeProtectionClass, type ProtectionClassInput } from "./ProtectionClass";

function diagnostic(
  code: DesignDoctrineDiagnostic["code"],
  severity: DesignDoctrineDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): DesignDoctrineDiagnostic {
  const entry: DesignDoctrineDiagnostic = {
    diagnosticId: `${code}-${Date.now()}`,
    code,
    severity,
    message,
    details,
    timestamp: new Date().toISOString(),
  };
  console.info(`[${code}]`, entry);
  return entry;
}

export function getDesignDoctrine(networkClass: NetworkClass): DesignDoctrine {
  return DESIGN_DOCTRINES[networkClass];
}

export function resolveDesignDoctrine(input: {
  networkClass?: string | null;
  protection?: ProtectionClassInput;
  siteList?: readonly TeralinxSite[];
  opportunityMarket?: string;
}): AppliedDesignDoctrine {
  const networkClass = normalizeNetworkClass(input.networkClass);
  const doctrine = getDesignDoctrine(networkClass);
  const protection = normalizeProtectionClass(input.protection, networkClass);
  const topology = doctrine.defaultTopology;
  const msaClassification = classifyMSA(input.siteList ?? [], input.opportunityMarket);
  const diagnostics = [
    diagnostic("DESIGN_DOCTRINE_LOADED", "INFO", "Layer 1 design doctrine loaded.", {
      designDoctrineId: doctrine.designDoctrineId,
      networkClass,
    }),
    diagnostic("PROTECTION_NORMALIZED", "INFO", "Protection input normalized to doctrine protection class.", {
      incomingProtection: input.protection,
      protection,
    }),
    diagnostic("MSA_CLASSIFIED", "INFO", "MSA classification applied using fixture-only doctrine.", {
      msaClassification,
    }),
  ];

  if (networkClass === "METRO" && msaClassification.status === "CROSS_MSA") {
    diagnostics.push(
      diagnostic("MSA_NETWORK_CLASS_WARNING", "WARNING", "Cross-MSA fixture classification suggests Middle Mile should be considered instead of Metro.", {
        networkClass,
        recommendedNetworkClass: msaClassification.recommendedNetworkClass,
      }),
    );
  }

  diagnostics.push(
    diagnostic("DESIGN_DOCTRINE_APPLIED", "INFO", "Layer 1 design doctrine applied to design intent.", {
      topology,
      protection,
      constructionProfileId: doctrine.constructionDoctrine.constructionProfileId,
      materialProfileId: doctrine.materialDoctrine.materialProfileId,
      facilityProfileId: doctrine.facilitySpacingDoctrine.facilityProfileId,
    }),
  );

  return {
    doctrineApplicationId: `APPLIED-${doctrine.designDoctrineId}`,
    doctrine,
    networkClass,
    topology,
    protection,
    constructionProfileId: doctrine.constructionDoctrine.constructionProfileId,
    materialProfileId: doctrine.materialDoctrine.materialProfileId,
    facilityProfileId: doctrine.facilitySpacingDoctrine.facilityProfileId,
    msaClassification,
    appliedRules: doctrine.rules,
    diagnostics,
  };
}

export function resolveDesignDoctrineForSession(session: DesignLaunchSession): AppliedDesignDoctrine {
  return resolveDesignDoctrine({
    networkClass: session.networkIntent.networkType,
    protection: session.protection,
    siteList: session.siteList,
    opportunityMarket: session.opportunityName,
  });
}
