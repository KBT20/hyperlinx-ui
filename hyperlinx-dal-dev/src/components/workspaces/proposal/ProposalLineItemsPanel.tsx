import type { PreliminaryQuotePackage } from "../../../proposal/PreliminaryQuotePackage";

export default function ProposalLineItemsPanel({ quotePackage }: { quotePackage: PreliminaryQuotePackage | null }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Quote Line Items</h3>
        <span className="dal-badge warning">Read-only</span>
      </div>
      {!quotePackage ? (
        <div className="dal-status">Generate a preliminary quote to view line items.</div>
      ) : (
        <div className="dal-list">
          {quotePackage.lineItems.map((item) => (
            <div className="dal-list-row teralinx-list-row" key={item.lineItemId}>
              <b>{item.category.replaceAll("_", " ")}</b>
              <span>${item.estimatedNrc.toLocaleString()}</span>
              <small>
                {item.description} - {item.quantity.toLocaleString()} {item.unit} @ ${item.unitCost.toLocaleString()}
              </small>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
