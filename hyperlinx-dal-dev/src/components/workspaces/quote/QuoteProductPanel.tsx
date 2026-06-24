import type { PreliminaryQuoteWorkspace } from "../../../quote/PreliminaryQuoteWorkspace";

function money(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function QuoteProductPanel({ workspace }: { workspace: PreliminaryQuoteWorkspace }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Recommended Products</h3>
        <span className="dal-badge warning">Fixture pricing</span>
      </div>

      <div className="prism-card-grid">
        {workspace.lineItems.map((item) => (
          <article className="prism-advisory-card" key={item.lineItemId}>
            <div className="dal-panel-title-row">
              <h3>{item.label}</h3>
              <span className="dal-badge warning">{item.source.replaceAll("_", " ")}</span>
            </div>
            <div className="opportunity-facts">
              <span>NRC</span>
              <b>{money(item.estimatedNrc)}</b>
              <span>MRC</span>
              <b>{money(item.estimatedMrc)}</b>
              <span>Product</span>
              <b>{item.product}</b>
            </div>
          </article>
        ))}
      </div>

      <section className="dal-panel">
        <h3>Marketplace Inputs</h3>
        <div className="dal-list">
          {workspace.marketplaceAssets.slice(0, 6).map((asset) => (
            <div className="dal-list-row opportunity-list-row" key={asset.assetId}>
              <b>{asset.assetName}</b>
              <span>{asset.assetType}</span>
              <small>{asset.ownerName} · {asset.status}</small>
            </div>
          ))}
          {!workspace.marketplaceAssets.length && <div className="dal-status">No marketplace inputs.</div>}
        </div>
      </section>
    </section>
  );
}
