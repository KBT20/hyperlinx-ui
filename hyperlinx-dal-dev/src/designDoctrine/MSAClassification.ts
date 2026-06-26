import type { TeralinxSite } from "../teralinx/TeralinxRouteRequest";

export type MSAClassificationStatus = "SAME_MSA" | "CROSS_MSA" | "UNKNOWN";

export interface MSAClassification {
  msaClassificationId: string;
  status: MSAClassificationStatus;
  identifiedMarkets: string[];
  recommendedNetworkClass?: "MIDDLE_MILE" | "LONG_HAUL" | "METRO";
  explanation: string;
  fixtureOnly: true;
}

const MARKET_ALIASES: Record<string, string> = {
  dallas: "DFW",
  plano: "DFW",
  irving: "DFW",
  frisco: "DFW",
  arlington: "DFW",
  "fort worth": "DFW",
  temple: "CENTRAL_TEXAS",
  austin: "AUSTIN",
  "san antonio": "SAN_ANTONIO",
  lawton: "LAWTON",
  "wichita falls": "WICHITA_FALLS",
};

function marketForText(text: string) {
  const normalized = text.toLowerCase();
  return Object.entries(MARKET_ALIASES).find(([token]) => normalized.includes(token))?.[1];
}

export function classifyMSA(sites: readonly TeralinxSite[], market?: string): MSAClassification {
  const identified = new Set<string>();
  const marketHit = marketForText(market ?? "");
  if (marketHit) identified.add(marketHit);

  sites.forEach((site) => {
    const siteText = `${site.facilityName ?? ""} ${site.address ?? ""}`;
    const hit = marketForText(siteText);
    if (hit) identified.add(hit);
  });

  const identifiedMarkets = Array.from(identified);
  const hasAustinSanAntonio = identified.has("AUSTIN") && identified.has("SAN_ANTONIO");
  const crossMsa = identifiedMarkets.length > 1 && !identifiedMarkets.every((item) => item === "DFW");

  if (hasAustinSanAntonio) {
    return {
      msaClassificationId: "MSA-AUSTIN-SAN-ANTONIO",
      status: "CROSS_MSA",
      identifiedMarkets,
      recommendedNetworkClass: "MIDDLE_MILE",
      explanation: "Austin to San Antonio should be treated as middle-mile rather than metro in fixture doctrine.",
      fixtureOnly: true,
    };
  }

  if (crossMsa) {
    return {
      msaClassificationId: `MSA-CROSS-${identifiedMarkets.join("-")}`,
      status: "CROSS_MSA",
      identifiedMarkets,
      recommendedNetworkClass: "MIDDLE_MILE",
      explanation: "Sites appear to cross fixture MSA boundaries; middle-mile doctrine should be considered.",
      fixtureOnly: true,
    };
  }

  if (identifiedMarkets.length === 1) {
    return {
      msaClassificationId: `MSA-${identifiedMarkets[0]}`,
      status: "SAME_MSA",
      identifiedMarkets,
      recommendedNetworkClass: "METRO",
      explanation: "Fixture classification places all recognized sites in one metropolitan market.",
      fixtureOnly: true,
    };
  }

  return {
    msaClassificationId: "MSA-UNKNOWN",
    status: "UNKNOWN",
    identifiedMarkets,
    explanation: "No live GIS lookup is performed in Phase 7.0A; classification is fixture-only.",
    fixtureOnly: true,
  };
}
