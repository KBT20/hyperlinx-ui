import { useEffect, useMemo, useState } from "react";
import {
  getConstraintCompleteness,
  listConstraintLayers,
  unloadConstraintLayer,
  type ConstraintAuthority,
  type ConstraintCertificationUse,
  type ConstraintReferenceLayerType,
} from "../reference/ConstraintGeometryRegistry";
import { registerGeoJsonConstraintLayer } from "../reference/constraintLayerImport";

const IMPORTABLE_LAYER_TYPES: Array<Extract<ConstraintReferenceLayerType, "WATER" | "RAILROADS" | "BUILDINGS" | "PARCELS" | "STREETS">> = [
  "STREETS",
  "WATER",
  "RAILROADS",
  "BUILDINGS",
  "PARCELS",
];

const AUTHORITIES: ConstraintAuthority[] = ["IMPORTED", "OSM", "USGS", "FRA", "COUNTY", "CITY", "STATE", "CUSTOMER", "MANUAL", "UNKNOWN"];
const CERTIFICATION_USE: ConstraintCertificationUse[] = ["USABLE_FOR_CERTIFICATION", "ROUTING_REFERENCE", "REFERENCE_ONLY", "NOT_USABLE"];

function fmt(value: number | undefined) {
  return Number(value || 0).toLocaleString();
}

function statusLabel(value: string) {
  if (value === "LOADED") return "Loaded";
  if (value === "FAILED") return "Failed";
  if (value === "USABLE_FOR_CERTIFICATION") return "Usable For Certification";
  if (value === "ROUTING_REFERENCE") return "Routing Reference";
  if (value === "REFERENCE_ONLY") return "Reference Only";
  if (value === "NOT_LOADED") return "Missing";
  return value.replaceAll("_", " ");
}

function coverageLabel(bbox: [number, number, number, number] | undefined) {
  if (!bbox) return "n/a";
  return bbox.map((value) => Number(value).toFixed(5)).join(", ");
}

export default function ConstraintGeometryRegistryPanel() {
  const [layersVersion, setLayersVersion] = useState(0);
  const [layerType, setLayerType] = useState<(typeof IMPORTABLE_LAYER_TYPES)[number]>("STREETS");
  const [authority, setAuthority] = useState<ConstraintAuthority>("IMPORTED");
  const [certificationUse, setCertificationUse] = useState<ConstraintCertificationUse>("ROUTING_REFERENCE");
  const [sourceName, setSourceName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Constraint Geometry Registry ready.");
  const layers = useMemo(() => listConstraintLayers(), [layersVersion]);
  const completeness = useMemo(() => getConstraintCompleteness(), [layersVersion]);
  const referenceOnly = layers.filter((layer) => layer.certificationUse === "REFERENCE_ONLY");
  const usable = layers.filter((layer) => layer.certificationUse === "USABLE_FOR_CERTIFICATION" && layer.status === "LOADED");

  useEffect(() => {
    if (layerType !== "STREETS") return;
    setAuthority("IMPORTED");
    setCertificationUse("ROUTING_REFERENCE");
  }, [layerType]);

  async function importGeoJson() {
    if (!selectedFile) return;
    try {
      const text = await selectedFile.text();
      const result = registerGeoJsonConstraintLayer({
        layerType,
        authority,
        certificationUse,
        sourceName: sourceName.trim() || selectedFile.name,
        text,
      });
      setLayersVersion((version) => version + 1);
      setSourceName("");
      setSelectedFile(null);
      setStatus(`Registered ${result.layer.layerType} constraint layer ${result.layer.sourceName} with ${result.features.length.toLocaleString()} features.`);
    } catch (err) {
      setStatus(`Constraint layer import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function unload(layerId: string) {
    unloadConstraintLayer(layerId);
    setLayersVersion((version) => version + 1);
    setStatus(`Unloaded ${layerId} from the active DAL constraint registry.`);
  }

  return (
    <div className="dal-panel">
      <h3>Constraint Geometry Registry</h3>
      <div className="dal-status">
        {status} Missing required layers remain UNKNOWN in constraint evidence. Engineer override requires notes and marks evidence INCOMPLETE_CONSTRAINT_EVIDENCE.
      </div>
      <div className="dal-metrics">
        <span>Constraint Completeness: {completeness.completenessPercent}%</span>
        <span>Required Layers Loaded: {fmt(completeness.loadedRequiredLayers)} / {fmt(completeness.totalRequiredLayers)}</span>
        <span>Missing Layers: {completeness.missingLayers.join(", ") || "none"}</span>
        <span>Usable For Certification: {completeness.usableForCertification ? "YES" : "NO"}</span>
        <span>Reference-Only Layers: {referenceOnly.map((layer) => layer.layerType).join(", ") || "none"}</span>
        <span>Usable Layers: {usable.map((layer) => layer.layerType).join(", ") || "none"}</span>
      </div>
      <div className="dal-grid compact">
        <select value={layerType} onChange={(event) => setLayerType(event.target.value as typeof layerType)}>
          {IMPORTABLE_LAYER_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select value={authority} onChange={(event) => setAuthority(event.target.value as ConstraintAuthority)}>
          {AUTHORITIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select value={certificationUse} onChange={(event) => setCertificationUse(event.target.value as ConstraintCertificationUse)}>
          {CERTIFICATION_USE.map((item) => (
            <option key={item} value={item}>
              {statusLabel(item)}
            </option>
          ))}
        </select>
        <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Source name" />
      </div>
      <div className="dal-actions">
        <label className="dal-file-button">
          Import GeoJSON Constraint Layer
          <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)} />
        </label>
        <button type="button" onClick={() => void importGeoJson()} disabled={!selectedFile}>
          Register Layer
        </button>
        <span>{selectedFile?.name ?? "No GeoJSON selected."}</span>
      </div>
      <div className="dal-table-wrap">
        <table className="dal-table">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Status</th>
              <th>Authority</th>
              <th>Feature Count</th>
              <th>Certification Use</th>
              <th>Coverage</th>
              <th>Last Loaded</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {layers.map((layer) => (
              <tr key={layer.layerId}>
                <td>
                  {layer.layerType}
                  <small>{layer.sourceName}</small>
                </td>
                <td>{statusLabel(layer.status)}</td>
                <td>{layer.authority}</td>
                <td>{fmt(layer.featureCount)}</td>
                <td>{statusLabel(layer.certificationUse)}</td>
                <td>{coverageLabel(layer.coverage?.bbox)}</td>
                <td>{layer.loadedAt ?? layer.lastUpdated ?? "n/a"}</td>
                <td>
                  <button type="button" onClick={() => unload(layer.layerId)}>
                    Unload
                  </button>
                </td>
              </tr>
            ))}
            {!layers.length ? (
              <tr>
                <td colSpan={8}>No constraint reference layers registered. Water, railroads, parcels, buildings, and streets remain UNKNOWN until loaded.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {completeness.notes.length ? <div className="dal-status">{completeness.notes.join(" ")}</div> : null}
    </div>
  );
}
