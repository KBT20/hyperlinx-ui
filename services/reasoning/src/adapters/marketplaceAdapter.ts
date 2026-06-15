import { summarizePricing } from "../tools/pricingTools.js";

export function marketplaceAdapter(context: any) {
  return summarizePricing(context);
}

