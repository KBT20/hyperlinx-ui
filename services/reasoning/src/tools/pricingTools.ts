export function summarizePricing(context: any) {
  const metadata = context?.metadata ?? {};
  return {
    quoteId: context?.quoteId,
    nrc: metadata?.nrc,
    mrc: metadata?.mrc,
    totalContractValue: metadata?.totalContractValue,
    missingInputs: ["term", "construction assumptions", "risk margin"].filter((key) => metadata?.[key] === undefined),
  };
}

