import type { SpineObjectIdentity, SpineObjectIdentityRegistry } from "./SpineObjectInstantiationContracts";

const PREFIX_BY_TYPE: Record<string, string> = {
  HANDHOLE: "HH",
  MANHOLE: "MH",
  VAULT: "VLT",
  POP: "POP",
  ILA: "ILA",
  REGEN: "RGN",
  CONDUIT: "CD",
  FIBER: "FB",
  SPLICE_CASE: "SC",
  PLOW_SEGMENT: "PLW",
  DIRECTIONAL_BORE_SEGMENT: "DB",
  ROCK_BORE_SEGMENT: "RB",
  OPEN_TRENCH_SEGMENT: "OT",
  RAILROAD_CROSSING: "RRX",
  RIVER_CROSSING: "RIV",
  ROAD_CROSSING: "RD",
  WATER_CROSSING: "WTR",
  DOT_CROSSING: "DOT",
  BRIDGE: "BRG",
  BRIDGE_ATTACHMENT: "BRG",
  UTILITY_CONFLICT: "UTL",
  ENVIRONMENTAL_IMPACT: "ENV",
  ROCK_REVIEW: "RCK",
};

export function spineObjectPrefix(objectType: string) {
  return PREFIX_BY_TYPE[objectType.toUpperCase()] ?? (objectType.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 3) || "OBJ");
}

export function createSpineObjectIdentity(objectType: string, sequence: number): SpineObjectIdentity {
  const prefix = spineObjectPrefix(objectType);
  return {
    spineObjectId: `SPO-${prefix}-${String(sequence).padStart(6, "0")}`,
    sequence,
    objectType,
    prefix,
    permanent: true,
    immutableAcrossEngineeringDeltas: true,
    immutableAcrossFieldRedlines: true,
    referencedByScopeVersion: true,
    referencedByKernelExecutionGraph: true,
    referencedByClosureLedger: true,
  };
}

export function createIdentityRegistry(packageId: string, identities: SpineObjectIdentity[]): SpineObjectIdentityRegistry {
  return {
    registryId: `${packageId}:SPINE-OBJECT-IDENTITY-REGISTRY`,
    packageId,
    identities,
    bySpineObjectId: Object.fromEntries(identities.map((identity) => [identity.spineObjectId, identity])),
    permanentIdentity: true,
    noScopeVersionCreation: true,
  };
}
