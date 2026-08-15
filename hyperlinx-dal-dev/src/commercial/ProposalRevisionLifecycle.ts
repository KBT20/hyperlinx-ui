export type ProposalChangeClass = "COMMERCIAL_ONLY" | "ESTIMATE_COST" | "PHYSICAL_CONFIGURATION" | "ROUTE";

export interface ProposalRevisionArtifact {
  proposalId: string;
  proposalRevisionId: string;
  parentProposalRevisionId?: string;
  derivedFromProposalHash?: string;
  revisionNumber: number;
  revisionReason: string;
  revisionStatus: string;
  proposalHash: string;
  createdBy: string;
  createdAt: string;
  snapshot: Record<string, unknown>;
}

export interface ProposalRevisionDifference {
  path: string;
  before: unknown;
  after: unknown;
  changeClass: ProposalChangeClass;
}

function classifyPath(path: string): ProposalChangeClass {
  if (/^(routeSnapshot|routeId|geometryReferences|customerDesignReferences)/.test(path)) return "ROUTE";
  if (/^(productConfiguration|engineeringObjectDoctrine|commercialDesign)/.test(path)) return "PHYSICAL_CONFIGURATION";
  if (/^(estimate|transparentEstimate|constructionQuantities|estimatingDoctrineId)/.test(path)) return "ESTIMATE_COST";
  return "COMMERCIAL_ONLY";
}

function walkDifferences(before: unknown, after: unknown, path: string, output: ProposalRevisionDifference[]) {
  if (Object.is(before, after)) return;
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    const left = before as Record<string, unknown>;
    const right = after as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    [...keys].sort().forEach((key) => walkDifferences(left[key], right[key], path ? `${path}.${key}` : key, output));
    return;
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  output.push({ path, before, after, changeClass: classifyPath(path) });
}

export function compareProposalRevisions(
  before: Pick<ProposalRevisionArtifact, "snapshot">,
  after: Pick<ProposalRevisionArtifact, "snapshot">,
): ProposalRevisionDifference[] {
  const output: ProposalRevisionDifference[] = [];
  walkDifferences(before.snapshot, after.snapshot, "", output);
  return output;
}

export function proposalRevisionApproval(
  revision: Pick<ProposalRevisionArtifact, "proposalRevisionId" | "proposalHash">,
  approvals: Array<Record<string, unknown>>,
) {
  return approvals.find((approval) =>
    approval.decision === "APPROVED" &&
    approval.proposalRevisionId === revision.proposalRevisionId &&
    approval.proposalHash === revision.proposalHash
  ) ?? null;
}

export function canUseProposalRevisionForHandoff(
  revision: Pick<ProposalRevisionArtifact, "proposalRevisionId" | "proposalHash" | "revisionStatus">,
  approvals: Array<Record<string, unknown>>,
) {
  return revision.revisionStatus === "SAVED" && Boolean(proposalRevisionApproval(revision, approvals));
}
