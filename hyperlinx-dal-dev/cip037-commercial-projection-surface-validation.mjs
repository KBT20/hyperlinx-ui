import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  commercialMap: path.join(root, "src", "components", "workspaces", "proposednetwork", "ProposedNetworkMapPanel.tsx"),
  commercialWorkspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  styles: path.join(root, "src", "styles.css"),
  geometryValidation: path.join(root, "cip037-single-geometry-authority-validation.mjs"),
};

for (const filePath of Object.values(paths)) {
  if (!existsSync(filePath)) {
    console.error(`FAIL missing required file: ${path.relative(root, filePath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]),
);

const checks = [];

function check(name, condition) {
  checks.push({ name, condition: Boolean(condition) });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

const map = sources.commercialMap;
const workspace = sources.commercialWorkspace;
const layerStateBlock = blockBetween(map, "type LayerState = {", "};");
const layerDefaultsBlock = blockBetween(map, "const [layers, setLayers] = useState<LayerState>({", "});");
const layerControlsBlock = blockBetween(map, "<b>Commercial IOF Projection</b>", "<b>Reference</b>");
const spanRenderBlock = blockBetween(map, "{layers.commercialProjectedSpans ? visibleCommercialIofSpans.map", "{layers.commercialProjectedObjects");
const objectRenderBlock = blockBetween(map, "{layers.commercialProjectedObjects ? visibleCommercialIofObjects.map", "{layers.commercialObjectAddresses");
const stationGraphRenderBlock = blockBetween(map, "{layers.commercialStationGraph ? (", "{layers.commercialProjectedSpans");
const addressRenderBlock = blockBetween(map, "{layers.commercialObjectAddresses ? (", "{commercialIlaStations.map");
const hoverBlock = blockBetween(map, "data-commercial-iof-hover-card=\"visible\"", "<div className=\"dal-map-attribution\"");
const projectionPanelBlock = blockBetween(workspace, "commercial-projection-diagnostics-panel", "commercial-doctrine-diagnostics-panel");
const doctrinePanelBlock = blockBetween(workspace, "commercial-doctrine-diagnostics-panel", "<div className=\"dal-panel-title-row commercial-route-inspector-title\"");
const selectedPayloadBlock = blockBetween(workspace, "{inventoryMapSelection.type === \"commercialIofObject\" ? (", ") : inventoryMapSelection.type === \"commercialIofSpan\"");
const selectedSpanPayloadBlock = blockBetween(workspace, ") : inventoryMapSelection.type === \"commercialIofSpan\" ? (", ") : (");

check("All Commercial projection layer state flags exist", includesAll(layerStateBlock, [
  "commercialMeasuredSpine",
  "commercialProjectedSpans",
  "commercialProjectedObjects",
  "commercialStationGraph",
  "commercialObjectAddresses",
]));

check("All Commercial projection layer defaults are visible", includesAll(layerDefaultsBlock, [
  "commercialMeasuredSpine: true",
  "commercialProjectedSpans: true",
  "commercialProjectedObjects: true",
  "commercialStationGraph: true",
  "commercialObjectAddresses: true",
]));

check("All Commercial projection layer toggles are present", includesAll(layerControlsBlock, [
  "Commercial IOF Projection",
  "Measured Spine",
  "Projected Spans",
  "Projected Objects",
  "Station Graph",
  "Object Address",
  "commercial-projection-layer-toggle",
]));

check("Projected Objects layer renders independently", includesAll(objectRenderBlock, [
  "commercial-iof-projected-object",
  "layers.commercialProjectedObjects",
  "onSelect({ type: \"commercialIofObject\"",
  "commercialIofObjectColor",
]));

check("Projected Spans layer renders by measured-spine clipping", includesAll(spanRenderBlock, [
  "commercial-iof-projected-span",
  "layers.commercialProjectedSpans",
  "pathData(coordinates, project)",
  "onSelect({ type: \"commercialIofSpan\"",
]) && map.includes("renderSpan(commercialIofProjection?.measuredCenterline, span)"));

check("Station Graph layer renders", includesAll(stationGraphRenderBlock, [
  "commercial-iof-station-graph-layer",
  "commercial-iof-station-graph-edge",
  "commercial-iof-station-graph-node",
  "layers.commercialStationGraph",
]) && map.includes("visibleCommercialStationGraphEdges") &&
  map.includes("renderSpan(commercialIofProjection?.measuredCenterline"));

check("Object Address layer renders", includesAll(addressRenderBlock, [
  "commercial-iof-object-address-layer",
  "commercial-iof-object-address",
  "layers.commercialObjectAddresses",
  "addressLabel",
]));

check("Commercial workspace feeds station graph, projection, attachments, and addresses to map", includesAll(workspace, [
  "displayedStationProjection",
  "displayedStationGraph",
  "displayedObjectStationAttachments",
  "stationProjection: displayedStationProjection",
  "stationGraph: displayedStationGraph",
  "objectStationAttachments: displayedObjectStationAttachments",
  "objectAddresses: displayedObjectAddresses",
]));

check("Doctrine Diagnostics panel renders in full", includesAll(doctrinePanelBlock, [
  "Commercial Doctrine Diagnostics",
  "data-commercial-doctrine-diagnostics=\"visible\"",
  "Math Present",
  "Objects Calculated",
  "Addresses Assigned",
  "Objects Projected",
  "Object Class",
  "Quantity Source",
  "Route Feet",
  "Station Count",
  "Object Count",
  "Nominal Interval",
  "Calculated Stations",
  "Resolved Coordinates",
  "Placement Authority",
  "Projection Result",
]));

check("Projection Diagnostics panel renders", includesAll(projectionPanelBlock, [
  "Commercial Projection Diagnostics",
  "data-commercial-projection-diagnostics=\"visible\"",
  "Measured Centerline",
  "Station Projection",
  "Station Graph",
  "Projected Object Manifest",
  "Projected Objects Layer",
  "Projected Spans Layer",
  "Station Graph Layer",
  "Object Address Layer",
  "Object Attachments",
  "Linear Attachments",
]));

check("Hover cards include required object payload", includesAll(hoverBlock, [
  "data-commercial-iof-hover-card=\"visible\"",
  "Doctrine",
  "Quantity Source",
  "Station",
  "Measure",
  "Lifecycle State",
  "Execution Sequence",
  "Labor Template",
  "Material Template",
  "Evidence Template",
  "Dependencies",
  "Payment Sequence",
  "Close Sequence",
  "commercialIofHover.object.doctrineObjectType",
  "commercialIofHover.object.doctrineQuantitySource",
  "commercialIofHover.object.executionSequenceId",
  "commercialIofHover.object.paymentSequenceId",
  "commercialIofHover.object.closeSequenceId",
]));

check("Hover cards include required span payload", includesAll(hoverBlock, [
  "commercialIofHover.span.spanType",
  "commercialIofHover.span.doctrineQuantitySource",
  "commercialIofHover.span.startMeasure",
  "commercialIofHover.span.endMeasure",
  "commercialIofHover.span.lifecycleState",
  "commercialIofHover.span.executionSequenceId",
  "commercialIofHover.span.paymentSequenceId",
  "commercialIofHover.span.closeSequenceId",
]));

check("Selected object inspector preserves full hover payload", includesAll(selectedPayloadBlock, [
  "Doctrine",
  "Quantity Source",
  "Measure",
  "Material Template",
  "Labor Template",
  "Evidence Template",
  "Dependencies",
  "Execution",
  "Payment",
  "Close",
]));

check("Selected span inspector preserves full hover payload", includesAll(selectedSpanPayloadBlock, [
  "Doctrine",
  "Quantity Source",
  "Start Measure",
  "End Measure",
  "Material Template",
  "Labor Template",
  "Evidence Template",
  "Dependencies",
  "Execution",
  "Payment",
  "Close",
]));

check("Geometry Authority functionality remains visible", includesAll(workspace, [
  "commercial-geometry-authority-panel",
  "data-geometry-authority-diagnostics=\"visible\"",
  "Geometry Authority",
  "Independent Geometry",
  "Objects On Spine",
  "Maximum Drift",
  "Independent Span Geometry",
]) && includesAll(map, [
  "commercial-iof-measured-spine",
  "renderSpan(commercialIofProjection?.measuredCenterline, span)",
]) && sources.geometryValidation.includes("CIP-037 Single Geometry Authority validation passed"));

check("Commercial projection hover styling exists", includesAll(sources.styles, [
  ".commercial-iof-hover-card",
  ".commercial-iof-hover-grid",
  "text-overflow: ellipsis",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} Commercial projection surface validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCommercial projection surface validation passed.");
