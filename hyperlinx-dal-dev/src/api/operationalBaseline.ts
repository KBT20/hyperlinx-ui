import { DAL_API } from "../config/dalApi";
import { withStoredAuth } from "./authHeaders";

export type OperationalLensId = "MARKETPLACE" | "CONTROL" | "FIELD" | "TWIN";

export type OperationalProjection = {
  projectionContractVersion: string;
  lens: { lensId: OperationalLensId; lensType: string; mutatesSpine: false; createsCloseAuthority: false; completionAuthority?: string };
  baselineIdentity: { operationalBaselineId: string; operationalBaselineHash: string; deterministic: true };
  executionAuthority: { scopeVersionId: string; scopeVersionRevision: number; scopeVersionHash: string; state: "AUTHORIZED"; immutable: true };
  project: { organizationId: string; customerId?: string; accountId: string; accountName?: string; opportunityId: string; opportunityName?: string; productId?: string; productName?: string };
  route: { id: string; revision: string; geometryId: string; geometryHash: string };
  authorityCensus: { stations: number; objects: number; relationships: number; workSegments: number; closureEvents: number };
  identities: { stationIds: string[]; objectIds: string[]; relationshipIds: string[]; workSegmentIds: string[] };
  initialState: { execution: "AUTHORIZED"; objects: "AUTHORIZED_NOT_REALIZED"; physicallyComplete: false; realized: false };
  closeBoundary: { mutationAuthority: "GOVERNED_CLOSE_ONLY"; operationalLensesMutateSpine: false };
  projectionOnly: true;
};

export async function loadOperationalProjection(scopeVersionId: string, lensId: OperationalLensId): Promise<OperationalProjection> {
  const response = await fetch(`${DAL_API}/api/operational-baselines/${encodeURIComponent(scopeVersionId)}/lenses/${lensId}`, withStoredAuth());
  const text = await response.text().catch(() => "");
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${payload?.error ?? response.status}: ${payload?.message ?? response.statusText}`);
  return payload.operationalProjection as OperationalProjection;
}
