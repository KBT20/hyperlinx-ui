export type CommercialMapDomain =
  | "BASE_MAP"
  | "ENRICHMENT"
  | "CUSTOMER_INVENTORY"
  | "CUSTOMER_PROPOSED_NETWORK"
  | "SALES_COMMERCIAL_DRAFT"
  | "CUSTOMER_DRAFT"
  | "ENGINEERING_DRAFT"
  | "ACCEPTED_PROPOSAL"
  | "SHARED_REVIEW"
  | "FIELD_CERTIFIED"
  | "OPERATIONAL";

export type CommercialMapFeatureScope = "BASE" | "ROUTES" | "OBJECTS" | "CORRIDOR" | "REVIEW";
export type CommercialMapVisibility = "VISIBLE" | "HIDDEN";
export type CommercialMapLockState = "LOCKED" | "EDITABLE";
export type CommercialMapRefreshMode = "SESSION_FROZEN" | "USER_REFRESH" | "LIVE_DRAFT" | "REVIEW_ONLY";
export type CommercialMapLayerState = "REFERENCE" | "ACTIVE" | "INACTIVE";

export interface CommercialMapLayer {
  id: string;
  label: string;
  domain: CommercialMapDomain;
  accountId: string;
  authority: "Customer" | "Sales" | "Commercial Review" | "Engineering" | "Field" | "Operations" | "System";
  owner: string;
  visibility: CommercialMapVisibility;
  lockState: CommercialMapLockState;
  renderState: CommercialMapLayerState;
  zIndex: number;
  source: string;
  refreshMode: CommercialMapRefreshMode;
  featureScope: CommercialMapFeatureScope;
  featureCount: number;
  routeMiles?: number;
  sourceLayerId?: string;
  sourceNetworkId?: string;
}

const DOMAIN_Z_INDEX: Record<CommercialMapDomain, number> = {
  BASE_MAP: 0,
  ENRICHMENT: 10,
  CUSTOMER_INVENTORY: 20,
  CUSTOMER_PROPOSED_NETWORK: 40,
  SALES_COMMERCIAL_DRAFT: 50,
  ENGINEERING_DRAFT: 54,
  ACCEPTED_PROPOSAL: 55,
  CUSTOMER_DRAFT: 60,
  SHARED_REVIEW: 70,
  FIELD_CERTIFIED: 80,
  OPERATIONAL: 90,
};

export function commercialMapZIndex(domain: CommercialMapDomain, featureScope: CommercialMapFeatureScope) {
  if (domain === "CUSTOMER_INVENTORY" && featureScope === "ROUTES") return 30;
  return DOMAIN_Z_INDEX[domain];
}

export function sortCommercialMapLayers(layers: CommercialMapLayer[]) {
  return [...layers].sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
}

export function isCommercialMapLayerVisible(layer: CommercialMapLayer | undefined) {
  return Boolean(layer && layer.visibility === "VISIBLE");
}

export function visibleCommercialMapLayerIds(layers: CommercialMapLayer[]) {
  return new Set(layers.filter(isCommercialMapLayerVisible).map((layer) => layer.id));
}

export function sourceLayerIdsForVisibleDomain(
  layers: CommercialMapLayer[],
  domain: CommercialMapDomain,
  featureScope: CommercialMapFeatureScope,
) {
  return new Set(
    layers
      .filter((layer) => layer.domain === domain && layer.featureScope === featureScope && layer.visibility === "VISIBLE")
      .map((layer) => layer.sourceLayerId)
      .filter((sourceLayerId): sourceLayerId is string => Boolean(sourceLayerId)),
  );
}
