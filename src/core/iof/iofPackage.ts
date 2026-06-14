import type { IOFPackage } from "./types";
import { validateIOFPackage } from "./governance";

export function isValidIOFPackage(pkg: IOFPackage): boolean {
  return validateIOFPackage(pkg).length === 0;
}

export function serializeIOFPackage(pkg: IOFPackage): string {
  return JSON.stringify(pkg, null, 2);
}

export function normalizeIOFPackage(pkg: IOFPackage): IOFPackage {
  return {
    ...pkg,
    canonicalTruth: {
      ...pkg.canonicalTruth,
      route: pkg.canonicalTruth.route || [],
      stations: pkg.canonicalTruth.stations || [],
      objects: pkg.canonicalTruth.objects || [],
      constraints: pkg.canonicalTruth.constraints || {},
      closeTaxonomy: pkg.canonicalTruth.closeTaxonomy || {},
      stateModel: pkg.canonicalTruth.stateModel || {
        version: "v1",
        derivationMode: "closure_only",
        states: [],
      },
    },
  };
}
