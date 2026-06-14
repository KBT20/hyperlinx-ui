import { CHICAGO_API } from "../config/api";

export const LARGE_DATASET_THRESHOLD_BYTES = 25 * 1024 * 1024;

export type LargeDatasetStatus = "Uploading" | "Uploaded" | "Queued" | "Normalizing" | "Complete" | "Failed" | "Canceled";

export type IngestionMetrics = {
  rowsRead?: number;
  pointsAccepted?: number;
  rowsRejected?: number;
  progressPct?: number;
  baselineId?: string;
};

export type UploadResponse = {
  uploadId: string;
  status?: string;
  raw?: any;
};

export type IngestionJob = IngestionMetrics & {
  jobId: string;
  uploadId?: string;
  status: LargeDatasetStatus;
  message?: string;
  raw?: any;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

function numberFrom(...values: any[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function stringFrom(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value)) return String(value);
  }
  return undefined;
}

function normalizeStatus(rawStatus: any): LargeDatasetStatus {
  const status = String(rawStatus ?? "").toLowerCase();
  if (status.includes("cancel")) return "Canceled";
  if (status.includes("fail") || status.includes("error")) return "Failed";
  if (status.includes("complete") || status.includes("success") || status === "done") return "Complete";
  if (status.includes("normal") || status.includes("process") || status.includes("running") || status.includes("ingest")) {
    return "Normalizing";
  }
  if (status.includes("queue") || status.includes("pending")) return "Queued";
  if (status.includes("upload")) return "Uploaded";
  return "Queued";
}

function metricsFrom(raw: any): IngestionMetrics {
  const metrics = raw?.metrics ?? raw?.progress ?? raw?.stats ?? {};
  return {
    rowsRead: numberFrom(raw?.rowsRead, raw?.rows_read, metrics?.rowsRead, metrics?.rows_read),
    pointsAccepted: numberFrom(
      raw?.pointsAccepted,
      raw?.points_accepted,
      raw?.acceptedPoints,
      raw?.accepted_points,
      metrics?.pointsAccepted,
      metrics?.points_accepted
    ),
    rowsRejected: numberFrom(raw?.rowsRejected, raw?.rows_rejected, metrics?.rowsRejected, metrics?.rows_rejected),
    progressPct: numberFrom(raw?.progressPct, raw?.progress_pct, raw?.percent, raw?.progress, metrics?.progressPct, metrics?.percent),
    baselineId: stringFrom(raw?.baselineId, raw?.baseline_id, raw?.datasetId, raw?.dataset_id, raw?.result?.baselineId),
  };
}

export async function uploadRawDataset(file: File, metadata: Record<string, unknown> = {}): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("metadata", JSON.stringify(metadata));
  const data = await requestJson<any>(`${CHICAGO_API}/api/uploads`, {
    method: "POST",
    body: form,
  });
  const uploadId = stringFrom(data?.uploadId, data?.upload_id, data?.id, data?.upload?.id);
  if (!uploadId) throw new Error("Chicago upload response did not include an upload ID.");
  return { uploadId, status: data?.status ? String(data.status) : undefined, raw: data };
}

export async function startIngestion(uploadId: string, metadata: Record<string, unknown> = {}): Promise<IngestionJob> {
  const data = await requestJson<any>(`${CHICAGO_API}/api/uploads/${encodeURIComponent(uploadId)}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  return normalizeIngestionJob(data, uploadId);
}

export async function getUploadStatus(uploadId: string): Promise<UploadResponse> {
  const data = await requestJson<any>(`${CHICAGO_API}/api/uploads/${encodeURIComponent(uploadId)}/status`);
  return {
    uploadId: stringFrom(data?.uploadId, data?.upload_id, data?.id) ?? uploadId,
    status: data?.status ? String(data.status) : undefined,
    raw: data,
  };
}

export async function getIngestionJob(jobId: string): Promise<IngestionJob> {
  const data = await requestJson<any>(`${CHICAGO_API}/api/ingestion-jobs/${encodeURIComponent(jobId)}`);
  return normalizeIngestionJob(data);
}

export async function cancelIngestionJob(jobId: string): Promise<IngestionJob> {
  const data = await requestJson<any>(`${CHICAGO_API}/api/ingestion-jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
  });
  return normalizeIngestionJob(data);
}

function normalizeIngestionJob(data: any, fallbackUploadId?: string): IngestionJob {
  const raw = data?.job ?? data?.ingestionJob ?? data?.data ?? data ?? {};
  const jobId = stringFrom(raw?.jobId, raw?.job_id, raw?.id, data?.jobId, data?.job_id);
  if (!jobId) throw new Error("Chicago ingestion response did not include a job ID.");
  return {
    jobId,
    uploadId: stringFrom(raw?.uploadId, raw?.upload_id, data?.uploadId, data?.upload_id, fallbackUploadId),
    status: normalizeStatus(raw?.status ?? data?.status),
    message: stringFrom(raw?.message, raw?.error, data?.message),
    ...metricsFrom(raw),
    raw,
  };
}
