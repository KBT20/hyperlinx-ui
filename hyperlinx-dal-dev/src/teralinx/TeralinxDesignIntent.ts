export type TeralinxNetworkType = "METRO" | "MIDDLE_MILE" | "LONG_HAUL" | "CAMPUS";

export type TeralinxProtection = "LINEAR" | "DIVERSE" | "RING" | "NONE" | "PATH_PROTECTED" | "RING_PROTECTED" | "MESH_PROTECTED";

export type TeralinxPrimaryProduct = "DUCT" | "FIBER" | "DUCT_PLUS_FIBER";

export interface TeralinxDesignIntent {
  networkType?: TeralinxNetworkType;
  protection?: TeralinxProtection;
  primaryProduct?: TeralinxPrimaryProduct;
}
