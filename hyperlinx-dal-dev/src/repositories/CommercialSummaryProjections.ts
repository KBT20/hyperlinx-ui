export type CommercialOpportunitySummary = {
  opportunityId: string;
  accountId: string;
  name: string;
  status: string;
  owner: string;
  routeRepositoryId: string;
  productId: string;
  updatedAt: string;
  createdAt: string;
  summaryProjection: true;
};

export type RouteSummary = {
  routeRepositoryId: string;
  opportunityId: string;
  accountId: string;
  routeId: string;
  routeName: string;
  routeFeet: number;
  routeMiles: number;
  geometryHash: string;
  updatedAt: string;
  geometryVertexCount: number;
  summaryProjection: true;
};

export type ProposalSummary = {
  proposalId: string;
  proposalRecordId: string;
  opportunityId: string;
  accountId: string;
  title: string;
  status: string;
  version: number;
  updatedAt: string;
  summaryProjection: true;
};

export type IofPackageSummary = {
  packageId: string;
  proposalId: string;
  opportunityId: string;
  routeRepositoryId: string;
  status: string;
  packageRevision: number;
  updatedAt: string;
  summaryProjection: true;
};

export type EngineeringPackageSummary = {
  engineeringPackageId: string;
  packageId: string;
  opportunityId: string;
  routeRepositoryId: string;
  state: string;
  revisionId: string;
  updatedAt: string;
  summaryProjection: true;
};

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

export function projectCommercialOpportunitySummary(value: unknown): CommercialOpportunitySummary {
  const item = record(value);
  return { opportunityId: String(item.opportunityId ?? ""), accountId: String(item.accountId ?? ""), name: String(item.name ?? "Unnamed Opportunity"), status: String(item.status ?? "DRAFT"), owner: String(item.owner ?? item.salesOwner ?? ""), routeRepositoryId: String(item.routeRepositoryId ?? item.routeRepositoryRef?.routeRepositoryId ?? ""), productId: String(item.productId ?? ""), updatedAt: String(item.updatedAt ?? ""), createdAt: String(item.createdAt ?? ""), summaryProjection: true };
}

export function projectRouteSummary(value: unknown): RouteSummary {
  const item = record(value);
  const geometry = Array.isArray(item.commercialGeometry) ? item.commercialGeometry : [];
  return { routeRepositoryId: String(item.routeRepositoryId ?? ""), opportunityId: String(item.opportunityId ?? ""), accountId: String(item.accountId ?? item.customerId ?? ""), routeId: String(item.routeId ?? ""), routeName: String(item.routeName ?? item.name ?? "Unnamed Route"), routeFeet: Number(item.routeFeet ?? item.length?.feet ?? 0), routeMiles: Number(item.routeMiles ?? item.length?.miles ?? 0), geometryHash: String(item.geometryHash ?? ""), updatedAt: String(item.updatedAt ?? ""), geometryVertexCount: geometry.length, summaryProjection: true };
}

export function projectProposalSummary(value: unknown): ProposalSummary {
  const item = record(value);
  return { proposalId: String(item.proposalId ?? item.proposalRecordId ?? ""), proposalRecordId: String(item.proposalRecordId ?? item.proposalId ?? ""), opportunityId: String(item.opportunityId ?? ""), accountId: String(item.accountId ?? item.customerId ?? ""), title: String(item.title ?? item.name ?? "Unnamed Proposal"), status: String(item.status ?? "DRAFT"), version: Number(item.version ?? 1), updatedAt: String(item.updatedAt ?? ""), summaryProjection: true };
}

export function projectIofPackageSummary(value: unknown): IofPackageSummary {
  const item = record(value);
  return { packageId: String(item.packageId ?? item.draftIofPackageId ?? ""), proposalId: String(item.proposalId ?? ""), opportunityId: String(item.opportunityId ?? ""), routeRepositoryId: String(item.routeRepositoryId ?? item.routeRepositoryRef?.routeRepositoryId ?? ""), status: String(item.status ?? "DRAFT"), packageRevision: Number(item.packageRevision ?? item.revision ?? 1), updatedAt: String(item.updatedAt ?? ""), summaryProjection: true };
}

export function projectEngineeringPackageSummary(value: unknown): EngineeringPackageSummary {
  const item = record(value);
  return { engineeringPackageId: String(item.engineeringPackageId ?? ""), packageId: String(item.packageId ?? item.draftIofPackageId ?? ""), opportunityId: String(item.opportunityId ?? ""), routeRepositoryId: String(item.routeRepositoryId ?? item.routeRepositoryRef?.routeRepositoryId ?? ""), state: String(item.state ?? item.status ?? "DRAFT"), revisionId: String(item.revisionId ?? item.engineeringRevisionId ?? ""), updatedAt: String(item.updatedAt ?? ""), summaryProjection: true };
}

export function summaryExcludesLargeArtifacts(summary: unknown) {
  const item = record(summary);
  return !["geometry", "commercialGeometry", "stationGraph", "objectManifest", "sourceDocuments", "engineeringPayload"].some((key) => key in item);
}
