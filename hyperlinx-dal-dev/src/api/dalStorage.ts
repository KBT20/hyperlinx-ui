export type DALCollectionName =
  | "inventoryGraphs"
  | "inventoryImportJobs"
  | "customerDesignImports"
  | "candidateSites"
  | "graphExtensions"
  | "scopeVersions"
  | "iofPackages"
  | "closeEvents"
  | "opportunities"
  | "opportunitySeeds"
  | "quotes"
  | "workItems"
  | "closures";

export type GraphStorageTelemetry = {
  inventoryId?: string;
  graphId?: string;
  nodeCount: number;
  edgeCount: number;
  serializedSizeBytes: number;
  serializedSizeMB: number;
};

export type StoragePressureWarning = {
  warning: boolean;
  message?: string;
  usageBytes?: number;
  quotaBytes?: number;
  remainingBytes?: number;
  payloadBytes: number;
};

const DB_NAME = "hyperlinx-dal-dev";
const DB_VERSION = 5;
const LEGACY_STORAGE_PREFIX = "hyperlinx-dal-dev";

const COLLECTION_ID_KEYS: Record<DALCollectionName, string> = {
  inventoryGraphs: "inventoryId",
  inventoryImportJobs: "jobId",
  customerDesignImports: "importId",
  candidateSites: "candidateId",
  graphExtensions: "extensionId",
  scopeVersions: "scopeVersionId",
  iofPackages: "packageId",
  closeEvents: "closeEventId",
  opportunities: "opportunityId",
  opportunitySeeds: "id",
  quotes: "quoteId",
  workItems: "workItemId",
  closures: "closureId",
};

const COLLECTIONS = Object.keys(COLLECTION_ID_KEYS) as DALCollectionName[];

let dbPromise: Promise<IDBDatabase> | null = null;
let migrationPromise: Promise<void> | null = null;

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function openRawDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) return Promise.reject(new Error("IndexedDB is not available in this runtime."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      COLLECTIONS.forEach((collection) => {
        if (!db.objectStoreNames.contains(collection)) {
          db.createObjectStore(collection, { keyPath: COLLECTION_ID_KEYS[collection] });
        }
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
  });
}

async function openDb() {
  if (!dbPromise) dbPromise = openRawDb();
  const db = await dbPromise;
  await migrateLegacyLocalStorageCollections(db);
  return db;
}

function legacyStorageKey(collection: DALCollectionName) {
  return `${LEGACY_STORAGE_PREFIX}.${collection}`;
}

async function putRecordsWithDb<T>(db: IDBDatabase, collection: DALCollectionName, records: T[]) {
  if (!records.length) return;
  const transaction = db.transaction(collection, "readwrite");
  const store = transaction.objectStore(collection);
  records.forEach((record) => store.put(record));
  await transactionDone(transaction);
}

async function migrateLegacyLocalStorageCollections(db: IDBDatabase) {
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    if (typeof localStorage === "undefined") return;
    for (const collection of COLLECTIONS) {
      const key = legacyStorageKey(collection);
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed) ? parsed : [];
        if (records.length) {
          await putRecordsWithDb(db, collection, records);
          console.info("DAL INDEXEDDB MIGRATION COMPLETE", {
            collection,
            count: records.length,
            source: "legacy localStorage",
          });
        }
        localStorage.removeItem(key);
      } catch (err) {
        console.warn("DAL INDEXEDDB MIGRATION WARNING", {
          collection,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  })();
  return migrationPromise;
}

export function serializedSizeBytes(value: unknown) {
  const serialized = JSON.stringify(value);
  if (typeof Blob !== "undefined") return new Blob([serialized]).size;
  return serialized.length;
}

export function graphStorageTelemetry(graph: {
  inventoryId?: string;
  graphId?: string;
  nodes?: unknown[];
  edges?: unknown[];
}) {
  const serializedSize = serializedSizeBytes(graph);
  const telemetry: GraphStorageTelemetry = {
    inventoryId: graph.inventoryId,
    graphId: graph.graphId,
    nodeCount: graph.nodes?.length ?? 0,
    edgeCount: graph.edges?.length ?? 0,
    serializedSizeBytes: serializedSize,
    serializedSizeMB: Number((serializedSize / 1024 / 1024).toFixed(2)),
  };
  console.info("DAL GRAPH SIZE TELEMETRY", telemetry);
  return telemetry;
}

export async function storagePressureWarning(payloadBytes: number): Promise<StoragePressureWarning> {
  const fallback = { warning: false, payloadBytes };
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return fallback;
  try {
    const estimate = await navigator.storage.estimate();
    const quotaBytes = Number(estimate.quota ?? 0);
    const usageBytes = Number(estimate.usage ?? 0);
    if (!quotaBytes) return fallback;
    const remainingBytes = Math.max(0, quotaBytes - usageBytes);
    const warning = payloadBytes > remainingBytes * 0.75;
    const result: StoragePressureWarning = {
      warning,
      payloadBytes,
      usageBytes,
      quotaBytes,
      remainingBytes,
      message: warning
        ? `Graph payload is ${Math.round(payloadBytes / 1024 / 1024)} MB with ${Math.round(remainingBytes / 1024 / 1024)} MB browser storage remaining.`
        : undefined,
    };
    if (warning) console.warn("DAL STORAGE WARNING", result);
    return result;
  } catch (err) {
    console.warn("DAL STORAGE ESTIMATE WARNING", err instanceof Error ? err.message : String(err));
    return fallback;
  }
}

export async function readCollection<T>(collection: DALCollectionName): Promise<T[]> {
  const db = await openDb();
  const transaction = db.transaction(collection, "readonly");
  const store = transaction.objectStore(collection);
  return requestToPromise<T[]>(store.getAll() as IDBRequest<T[]>);
}

export async function writeRecord<T>(collection: DALCollectionName, record: T): Promise<T> {
  const db = await openDb();
  try {
    const transaction = db.transaction(collection, "readwrite");
    transaction.objectStore(collection).put(record);
    await transactionDone(transaction);
    return record;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/quota|storage/i.test(message)) {
      throw new Error(`DAL IndexedDB storage failed before commit: ${message}`);
    }
    throw err;
  }
}

export async function writeRecords<T>(collection: DALCollectionName, records: T[]): Promise<T[]> {
  const db = await openDb();
  await putRecordsWithDb(db, collection, records);
  return records;
}

export async function findRecord<T>(collection: DALCollectionName, id: string): Promise<T | undefined> {
  const db = await openDb();
  const transaction = db.transaction(collection, "readonly");
  const store = transaction.objectStore(collection);
  const record = await requestToPromise<T | undefined>(store.get(id) as IDBRequest<T | undefined>);
  return record;
}

export async function deleteRecord(collection: DALCollectionName, id: string): Promise<void> {
  const db = await openDb();
  const transaction = db.transaction(collection, "readwrite");
  transaction.objectStore(collection).delete(id);
  await transactionDone(transaction);
}
