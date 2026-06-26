export type Layer1Product =
  | "DUCT_PLUS_FIBER"
  | "DARK_FIBER"
  | "EMPTY_DUCT"
  | "MICRODUCT"
  | "BACKBONE_FIBER"
  | "LATERAL";

export interface MaterialDoctrine {
  materialProfileId: string;
  defaultProducts: Layer1Product[];
  preferredBackboneFiberCount?: number;
  preferredDuctConfiguration?: string;
  overrideAllowed: true;
  notes: string[];
}
