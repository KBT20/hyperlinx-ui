import type { ObjectProductionProfile } from "../../doctrine/pd003/PD003ProductionContracts";
import type { AuditObjectManifestEntry } from "../manifest/AuditObjectManifestContracts";
import type { SpineObjectCatalogEntry } from "../catalog/SpineObjectCatalogContracts";
import type { SpineObjectProductionBinding } from "./SpineObjectInstantiationContracts";

export function createProductionBinding(args: {
  packageId: string;
  spineObjectId: string;
  catalogEntry: SpineObjectCatalogEntry;
  manifestEntry?: AuditObjectManifestEntry;
  objectProductionProfiles: ObjectProductionProfile[];
}): SpineObjectProductionBinding {
  const profiles = args.objectProductionProfiles.filter((profile) => profile.manifestEntryId === args.manifestEntry?.manifestEntryId);
  const profileIds = profiles.map((profile) => profile.profileId);
  const materialProfileIds = profiles
    .filter((profile) => String(profile.profileId).startsWith("MATERIAL_"))
    .map((profile) => profile.profileId);
  return {
    bindingId: `${args.spineObjectId}:PRODUCTION-BINDING`,
    spineObjectId: args.spineObjectId,
    productionProfileId: profileIds.find((profileId) => !String(profileId).startsWith("MATERIAL_") && !String(profileId).includes("INCLUDED")) ?? args.catalogEntry.primaryProductionProfileId,
    productionProfileIds: profileIds.length ? profileIds : args.catalogEntry.productionProfileIds,
    materialProfileIds: materialProfileIds.length ? materialProfileIds : args.catalogEntry.materialProfileIds,
    objectProductionProfileIds: profiles.map((profile) => profile.objectProductionProfileId),
    constructionMethod: args.catalogEntry.constructionMethods[0]?.method ?? args.catalogEntry.defaultPlacementMethod,
    authority: "PD003_PRODUCTION_DOCTRINE_AUTHORITY",
    noScopeVersionCreation: true,
  };
}
