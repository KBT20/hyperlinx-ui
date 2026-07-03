import {
  PD003_PRODUCTION_AUTHORITY,
  PD003_PRODUCTION_DOCTRINE_ID,
  PD003_PRODUCTION_DOCTRINE_VERSION,
  PRODUCTION_PROFILE_LIBRARY_AUTHORITY,
  type ProductionDoctrine,
} from "./PD003ProductionContracts";

export const PD003_PRODUCTION_DOCTRINE: ProductionDoctrine = {
  doctrineId: PD003_PRODUCTION_DOCTRINE_ID,
  doctrineVersion: PD003_PRODUCTION_DOCTRINE_VERSION,
  authority: PD003_PRODUCTION_AUTHORITY,
  principle: "PRODUCTION_IS_DETERMINISTIC",
  profileLibraryAuthority: PRODUCTION_PROFILE_LIBRARY_AUTHORITY,
  noUiHardCoding: true,
  humanOverridesRequireProvenance: true,
  paymentRequiresValidatedCloses: true,
  noScopeVersionCreation: true,
};

export function getPD003ProductionDoctrine() {
  return PD003_PRODUCTION_DOCTRINE;
}
