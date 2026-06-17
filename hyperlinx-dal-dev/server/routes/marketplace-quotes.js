import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeQuote(quote = {}) {
  const timestamp = nowIso();
  return {
    ...quote,
    quoteId: String(quote.quoteId),
    createdAt: quote.createdAt ?? timestamp,
    updatedAt: quote.updatedAt ?? timestamp,
  };
}

export async function handleMarketplaceQuotes(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/marketplace/quotes",
    dir: DIRS.marketplaceQuotes,
    idKey: "quoteId",
    listKey: "quotes",
    itemKey: "quote",
    pluralBodyKeys: ["quotes", "items", "data"],
    idPrefix: "quote",
    normalize: normalizeQuote,
  });
}
