import type { CorridorEvidenceBundle } from "../corridor/CorridorNormalizedEvidence";
import type { TranslateArtifact, TranslateSourceType } from "./TranslateContract";
import type { TranslateDiagnostic } from "./TranslateDiagnostic";
import type { TranslateJob } from "./TranslateJob";

export interface TranslateResult {
  job: TranslateJob;
  sourceType: TranslateSourceType;
  sourceFile: string;
  evidenceBundle: CorridorEvidenceBundle;
  artifacts: TranslateArtifact[];
  diagnostics: TranslateDiagnostic[];
}

