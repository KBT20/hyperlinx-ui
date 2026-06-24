export type PreliminaryQuoteConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface PreliminaryQuoteConfidenceBasis {
  dataCompleteness: PreliminaryQuoteConfidence;
  marketplaceCompleteness: PreliminaryQuoteConfidence;
  architectureCompleteness: PreliminaryQuoteConfidence;
  reviewCompleteness: PreliminaryQuoteConfidence;
  prismCompleteness: PreliminaryQuoteConfidence;
  overallConfidence: PreliminaryQuoteConfidence;
  advisoryOnly: true;
}
