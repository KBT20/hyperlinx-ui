import type { ProposedGraph } from "../../../proposedGraph/ProposedGraph";
import type { ProposedGraphEdge } from "../../../proposedGraph/ProposedGraphEdge";
import type { ProposedGraphNode } from "../../../proposedGraph/ProposedGraphNode";
import type { ProposedNetworkSelection } from "./ProposedNetworkMapPanel";

function fmtNumber(value: number) {
  return Number.isFinite(value) ? value.toLocaleString() : "0";
}

function nodeInspector(node: ProposedGraphNode) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Node Inspector</h3>
        <span className="dal-badge pass">{node.type.replaceAll("_", " ")}</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Node Type</span>
          <b>{node.type.replaceAll("_", " ")}</b>
        </div>
        <div>
          <span>Name</span>
          <b>{node.name}</b>
        </div>
        <div>
          <span>Latitude</span>
          <b>{node.lat.toFixed(6)}</b>
        </div>
        <div>
          <span>Longitude</span>
          <b>{node.lng.toFixed(6)}</b>
        </div>
        <div>
          <span>Estimated Station</span>
          <b>{node.stationLabel}</b>
        </div>
        <div>
          <span>Estimated Cost</span>
          <b>${fmtNumber(node.estimatedCost)}</b>
        </div>
        <div>
          <span>Construction Type</span>
          <b>{node.estimatedConstructionType}</b>
        </div>
        <div>
          <span>Readiness</span>
          <b>{node.readiness.replaceAll("_", " ")}</b>
        </div>
        <div>
          <span>Confidence</span>
          <b>{node.confidence}</b>
        </div>
      </div>
      <div className="dal-status">{node.comments.join(" ")}</div>
    </section>
  );
}

function segmentInspector(edge: ProposedGraphEdge) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Segment Inspector</h3>
        <span className="dal-badge warning">Pending verification</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>From</span>
          <b>{edge.from}</b>
        </div>
        <div>
          <span>To</span>
          <b>{edge.to}</b>
        </div>
        <div>
          <span>Segment Length</span>
          <b>{fmtNumber(edge.estimatedDistance)} ft</b>
        </div>
        <div>
          <span>Fiber Feet</span>
          <b>{fmtNumber(edge.estimatedFiberFeet)}</b>
        </div>
        <div>
          <span>Duct Feet</span>
          <b>{fmtNumber(edge.estimatedDuctFeet)}</b>
        </div>
        <div>
          <span>Constraints</span>
          <b>{edge.crossings.length}</b>
        </div>
        <div>
          <span>Construction Method</span>
          <b>{edge.constructionMethod ?? edge.constructionType}</b>
        </div>
        <div>
          <span>Estimated Cost</span>
          <b>${fmtNumber(edge.estimatedCost ?? 0)}</b>
        </div>
        <div>
          <span>Confidence</span>
          <b>{edge.confidence}</b>
        </div>
      </div>
      <div className="dal-list">
        {edge.crossings.map((crossing) => (
          <div className="dal-list-row" key={crossing.crossingId}>
            <b>{crossing.label}</b>
            <span>{crossing.crossingType}</span>
            <small>Estimated cost ${fmtNumber(crossing.estimatedCost)}</small>
          </div>
        ))}
      </div>
      <div className="dal-status">{[...edge.comments, ...(edge.engineeringNotes ?? [])].join(" ")}</div>
    </section>
  );
}

export default function ProposedGraphInspectorPanel({ graph, selected }: { graph: ProposedGraph; selected: ProposedNetworkSelection }) {
  if (!selected) {
    return (
      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Property Inspector</h3>
          <span className="dal-badge warning">No selection</span>
        </div>
        <div className="dal-status">Select a proposed node or edge on the map.</div>
      </section>
    );
  }

  if (selected.type === "node") {
    return nodeInspector(selected.value);
  }

  if (selected.type === "edge") {
    return segmentInspector(selected.value);
  }

  if (selected.type === "station") {
    const station = selected.value;
    const stationObjects = graph.stationedCorridor?.inventoryObjects.filter((object) => object.stationId === station.stationId) ?? [];
    const nearestSegment = graph.stationedCorridor?.segments.find((segment) => station.stationFeet >= segment.fromStationFeet && station.stationFeet <= segment.toStationFeet);
    return (
      <section className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Station Inspector</h3>
          <span className="dal-badge warning">{station.engineeringStatus.replaceAll("_", " ")}</span>
        </div>
        <div className="teralinx-summary-grid">
          <div>
            <span>Station</span>
            <b>{station.stationLabel}</b>
          </div>
          <div>
            <span>Distance From A</span>
            <b>{fmtNumber(station.stationFeet)} ft</b>
          </div>
          <div>
            <span>Latitude</span>
            <b>{station.lat.toFixed(6)}</b>
          </div>
          <div>
            <span>Longitude</span>
            <b>{station.lng.toFixed(6)}</b>
          </div>
          <div>
            <span>Objects At Station</span>
            <b>{stationObjects.length}</b>
          </div>
          <div>
            <span>Nearest Segment</span>
            <b>{nearestSegment?.segmentId ?? "Not available"}</b>
          </div>
          <div>
            <span>Engineering Status</span>
            <b>{station.engineeringStatus.replaceAll("_", " ")}</b>
          </div>
        </div>
        <div className="dal-list">
          {stationObjects.map((object) => (
            <div className="dal-list-row" key={object.objectId}>
              <b>{object.objectType.replaceAll("_", " ")}</b>
              <span>{object.quantity.toLocaleString()} {object.unit}</span>
              <small>{object.engineeringStatus.replaceAll("_", " ")}</small>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const object = selected.value;
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Object Inspector</h3>
        <span className="dal-badge warning">{object.engineeringStatus.replaceAll("_", " ")}</span>
      </div>
      <div className="teralinx-summary-grid">
        <div>
          <span>Object Type</span>
          <b>{object.objectType.replaceAll("_", " ")}</b>
        </div>
        <div>
          <span>Station</span>
          <b>{object.stationLabel}</b>
        </div>
        <div>
          <span>Quantity</span>
          <b>{fmtNumber(object.quantity)} {object.unit}</b>
        </div>
        <div>
          <span>Material Profile</span>
          <b>{object.materialProfile}</b>
        </div>
        <div>
          <span>Install Method</span>
          <b>{object.installMethod}</b>
        </div>
        <div>
          <span>Estimated Cost</span>
          <b>${fmtNumber(object.estimatedCost)}</b>
        </div>
        <div>
          <span>Engineering Status</span>
          <b>{object.engineeringStatus.replaceAll("_", " ")}</b>
        </div>
      </div>
      <details>
        <summary>Developer diagnostics</summary>
        <pre className="dal-pre">{JSON.stringify(object, null, 2)}</pre>
      </details>
    </section>
  );
}
