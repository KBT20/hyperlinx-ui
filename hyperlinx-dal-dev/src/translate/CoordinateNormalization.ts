import type { ShapefileDiagnostic } from "./ShapefileContract";

export type SupportedCoordinateSystem = "WGS84" | "NAD83" | "UNKNOWN";

export interface CoordinateNormalizationResult {
  coordinateSystem: SupportedCoordinateSystem;
  confidenceAdjustment: number;
  diagnostics: ShapefileDiagnostic[];
}

function diagnostic(message: string, details?: Record<string, unknown>): ShapefileDiagnostic {
  const item = {
    diagnosticId: `shapefile-warning-projection-${Date.now()}`,
    code: "SHAPEFILE_WARNING" as const,
    severity: "WARNING" as const,
    message,
    details,
  };
  console.warn("[SHAPEFILE_WARNING]", item);
  return item;
}

export function detectCoordinateSystem(prj?: string): CoordinateNormalizationResult {
  if (!prj?.trim()) {
    return {
      coordinateSystem: "UNKNOWN",
      confidenceAdjustment: -18,
      diagnostics: [diagnostic("Missing PRJ projection file. Geometry is preserved with lower confidence.")],
    };
  }

  const normalized = prj.toUpperCase();
  if (normalized.includes("WGS_1984") || normalized.includes("WGS 84") || normalized.includes("EPSG\",4326")) {
    return {
      coordinateSystem: "WGS84",
      confidenceAdjustment: 0,
      diagnostics: [],
    };
  }

  if (normalized.includes("NAD_1983") || normalized.includes("NAD83")) {
    return {
      coordinateSystem: "NAD83",
      confidenceAdjustment: -4,
      diagnostics: [],
    };
  }

  return {
    coordinateSystem: "UNKNOWN",
    confidenceAdjustment: -18,
    diagnostics: [
      diagnostic("Projection could not be identified as WGS84 or NAD83. Geometry is preserved with lower confidence.", {
        prjPreview: prj.slice(0, 240),
      }),
    ],
  };
}

