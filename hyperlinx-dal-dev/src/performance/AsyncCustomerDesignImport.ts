import { parseCustomerDesignFile } from "../translate/CustomerDesignImportEngine";
import type { CustomerDesignImport } from "../translate/CustomerDesignImport";
import { buildInventoryImportHash, dedupeCustomerDesignImport } from "./InventoryImportCache";
import { startRuntimePerformanceOperation } from "./RuntimePerformanceInstrumentation";

export type AsyncImportProgressState =
  | "Importing KMZ"
  | "Parsing"
  | "Normalizing"
  | "Building Geometry Index"
  | "Caching"
  | "Ready";

export type AsyncCustomerDesignImportResult = {
  record: CustomerDesignImport;
  importHash: string;
  duplicate: boolean;
  workerStatus: AsyncImportProgressState;
  progressLog: AsyncImportProgressState[];
};

function nextTick() {
  return new Promise<void>((resolve) => {
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export async function parseCustomerDesignFileAsync(args: {
  file: File;
  accountId?: string;
  customerName?: string;
  uploadedBy?: string;
  onProgress?: (state: AsyncImportProgressState) => void;
}): Promise<AsyncCustomerDesignImportResult> {
  const progressLog: AsyncImportProgressState[] = [];
  const progress = async (state: AsyncImportProgressState) => {
    progressLog.push(state);
    args.onProgress?.(state);
    await nextTick();
  };

  const parseMetric = startRuntimePerformanceOperation("kmz-parse", "IMPORT", { fileName: args.file.name });
  await progress("Importing KMZ");
  await progress("Parsing");
  const parsed = await parseCustomerDesignFile(args);
  parseMetric.end({
    recordsProcessed: parsed.routes.length + parsed.objects.length + parsed.polygons.length,
    workerStatus: "ASYNC_BACKGROUND_EXECUTION",
  });

  const normalizationMetric = startRuntimePerformanceOperation("normalization", "IMPORT", { fileName: args.file.name });
  await progress("Normalizing");
  const importHash = buildInventoryImportHash(parsed);
  const sourceBytes = await args.file.arrayBuffer();
  const sourceDigest = await crypto.subtle.digest("SHA-256", sourceBytes);
  const sourceFileHash = [...new Uint8Array(sourceDigest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  parsed.sourceFileHash = sourceFileHash;
  parsed.parserVersion = "CUSTOMER_DESIGN_IMPORT_ENGINE_V1";
  normalizationMetric.end({ recordsProcessed: parsed.routes.length, workerStatus: "ASYNC_BACKGROUND_EXECUTION" });

  const geometryMetric = startRuntimePerformanceOperation("geometry-build", "IMPORT", { fileName: args.file.name });
  await progress("Building Geometry Index");
  geometryMetric.end({
    recordsProcessed: parsed.routes.reduce((count, route) => count + (route.dalGeometry?.length ?? 0), 0),
    workerStatus: "ASYNC_BACKGROUND_EXECUTION",
  });

  await progress("Caching");
  const deduped = dedupeCustomerDesignImport(parsed);
  await progress("Ready");

  return {
    record: deduped.record,
    importHash: deduped.importHash || importHash,
    duplicate: deduped.duplicate,
    workerStatus: "Ready",
    progressLog,
  };
}
