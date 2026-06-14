// FULL POLISHED MARKETPLACE REWRITE (IOF SAFE)
import { useEffect, useMemo, useState } from "react";
import ScopeSelector from "./components/ScopeSelector";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = "http://64.34.93.5:4000";

// Icons
const baseIcon = (color: string) =>
  L.divIcon({
    html: `<div style="width:12px;height:12px;border-radius:999px;background:${color};border:2px solid white"></div>`
  });

const blueIcon = baseIcon("#3b82f6");
const selectedIcon = baseIcon("#f59e0b");

function normalizeId(id?: string) {
  return (id || "").toString().trim().toUpperCase();
}

function parseStation(station: string) {
  const [a, b] = station.split("+").map(Number);
  return a * 100 + b;
}

function groupStations(ids: string[]) {
  const sorted = [...ids].sort();
  const groups: string[][] = [];
  let current: string[] = [];

  const toNum = (id: string) => parseInt(id.replace("STA-", ""));

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];

    if (!current.length) {
      current.push(curr);
      continue;
    }

    const prev = current[current.length - 1];

    if (toNum(curr) - toNum(prev) === 200) {
      current.push(curr);
    } else {
      groups.push(current);
      current = [curr];
    }
  }

  if (current.length) groups.push(current);

  return groups;
}

export default function MarketplaceMode() {
  const [scopeVersion, setScopeVersion] = useState<string | null>(null);
  const [scopeData, setScopeData] = useState<any>(null);
  const [selectedScope, setSelectedScope] = useState<any>(null);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const [budgetLineItems, setBudgetLineItems] = useState<any[]>([]);

  const [pricePerFoot, setPricePerFoot] = useState("");
  const [productionRate, setProductionRate] = useState("");

  // LOAD
  useEffect(() => {
    let cancelled = false;

    if (!scopeVersion) {
      setScopeData(null);
      setSelectedObjectId(null);
      setSelectedStations([]);
      setPricePerFoot("");
      setProductionRate("");
      setSelectedScope(null);
      return;
    }

    setScopeData(null);
    setSelectedObjectId(null);
    setSelectedStations([]);
    setPricePerFoot("");
    setProductionRate("");

    async function loadScope() {
      try {
        const res = await fetch(`${API}/scope/${scopeVersion}`);
        if (!res.ok) {
          throw new Error(`Scope request failed: ${res.status}`);
        }

        const data = await res.json();
        if (cancelled) return;

        const truth = data.canonicalTruth ?? data;
        if (!cancelled) {
          setScopeData({ ...truth, ...data });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Marketplace scope load failed", err);
        setScopeData(null);
      }
    }

    loadScope();

    return () => {
      cancelled = true;
    };
  }, [scopeVersion]);

  useEffect(() => {
    const model = scopeData?.financialContext?.designBudgetModel;
    if (!model?.budgetLineItems?.length) {
      setBudgetLineItems([]);
      return;
    }

    setBudgetLineItems(
      model.budgetLineItems.map((item: any) => ({
        ...item,
        marketUnitCost: item.marketUnitCost ?? 0,
        marketAmount: item.marketAmount ?? item.budgetAmount,
        vendorName: item.vendorName ?? "",
        quoteStatus: item.quoteStatus ?? "",
      }))
    );
  }, [scopeData]);

  const stationPositions = useMemo(() => {
    return scopeData?.stations?.map((s: any) => ({
      ...s,
      id: normalizeId(s.stationId),
      pos: [s.lat, s.lon]
    })) || [];
  }, [scopeData]);

  const selectedCount = selectedStations.length;
  const totalFeet = selectedCount * 100;
  const value = totalFeet * (Number(pricePerFoot) || 0);

  const groups = groupStations(selectedStations);

  const budgetTotals = useMemo(() => {
    const totalBudget = budgetLineItems.reduce((sum, item) => sum + (Number(item.budgetAmount) || 0), 0);
    const totalMarket = budgetLineItems.reduce((sum, item) => sum + (Number(item.marketAmount) || 0), 0);
    return { totalBudget, totalMarket };
  }, [budgetLineItems]);

  async function submitPricing() {
    if (!selectedObjectId || !selectedStations.length) return alert("Missing inputs");

    for (const group of groups) {
      await fetch(`${API}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeVersionId: scopeVersion,
          corridorId: selectedScope.corridorId,
          segmentId: selectedScope.segmentId,
          objectId: selectedObjectId,
          stationId: group[0],
          closeType: "pricing.submitted",
          payload: {
            stationStart: group[0],
            stationEnd: group[group.length - 1],
            stationIds: group,
            totalFeet: group.length * 100,
            pricePerFoot: Number(pricePerFoot),
            productionRate: Number(productionRate)
          }
        })
      });
    }

    alert("Pricing submitted");
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "360px 1fr",
      position: "fixed",
      top: 50,
      left: 0,
      right: 0,
      height: "calc(100vh - 50px)",
      background: "#0b1220",
      color: "white"
    }}>

      {/* LEFT PANEL */}
      <aside style={{ padding: 16, overflowY: "auto" }}>
        <h2>StellaOS Marketplace</h2>
        <div style={{ marginBottom: 16, color: "#94a3b8" }}>
          Infrastructure Commercialization
        </div>

        <ScopeSelector
          selectedScopeVersionId={scopeVersion}
          onSelect={(id, scope) => {
            setScopeVersion(id);
            setSelectedScope({
              corridorId: scope.corridor_id,
              segmentId: scope.segment_id
            });
            setScopeData(null);
            setSelectedObjectId(null);
            setSelectedStations([]);
            setPricePerFoot("");
            setProductionRate("");
          }}
        />

        <h3>Work Types</h3>
        {scopeData?.objects?.map((o: any) => (
          <div
            key={o.objectId}
            onClick={() => setSelectedObjectId(o.objectId)}
            style={{
              padding: 10,
              marginBottom: 6,
              background: selectedObjectId === o.objectId ? "#065f46" : "#1f2937",
              cursor: "pointer"
            }}
          >
            {o.objectType}
          </div>
        ))}

        {budgetLineItems.length > 0 && (
          <div style={{ marginTop: 16, padding: 12, background: "#111827", borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>Budget Line Items</h3>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  This scope includes design budget line items from the approved IOF package.
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Total Budget</div>
                <div style={{ fontWeight: 700 }}>${budgetTotals.totalBudget.toLocaleString()}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Market Estimate</div>
                <div style={{ fontWeight: 700 }}>${budgetTotals.totalMarket.toLocaleString()}</div>
              </div>
            </div>
            {budgetLineItems.map((item, index) => (
              <div key={item.id || index} style={{ marginBottom: 10, padding: 8, background: "#1f2937", borderRadius: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong>{item.label}</strong>
                  <span style={{ opacity: 0.75 }}>${item.budgetAmount?.toLocaleString?.() ?? item.budgetAmount}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, opacity: 0.8 }}>Market Unit Cost</label>
                    <input
                      type="number"
                      value={item.marketUnitCost}
                      onChange={(e) => {
                        const next = [...budgetLineItems];
                        const value = Number(e.target.value);
                        next[index] = {
                          ...next[index],
                          marketUnitCost: value,
                          marketAmount: Number.isFinite(value) ? value * next[index].quantity : 0,
                        };
                        setBudgetLineItems(next);
                      }}
                      style={{ width: "100%", marginTop: 4, padding: 6, background: "#0f172a", border: "1px solid #334155", color: "white" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, opacity: 0.8 }}>Vendor</label>
                    <input
                      value={item.vendorName}
                      onChange={(e) => {
                        const next = [...budgetLineItems];
                        next[index] = { ...next[index], vendorName: e.target.value };
                        setBudgetLineItems(next);
                      }}
                      style={{ width: "100%", marginTop: 4, padding: 6, background: "#0f172a", border: "1px solid #334155", color: "white" }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                  <span>Market Amount: ${item.marketAmount?.toLocaleString?.() ?? item.marketAmount}</span>
                  <span>Status: {item.quoteStatus || "unquoted"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <h3>Stations</h3>
        <button onClick={() => setSelectedStations(stationPositions.map(s => s.id))}>Select All</button>

        {stationPositions.map(s => (
          <label key={s.id} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={selectedStations.includes(s.id)}
              onChange={() => {
                setSelectedStations(prev =>
                  prev.includes(s.id)
                    ? prev.filter(x => x !== s.id)
                    : [...prev, s.id]
                );
              }}
            />
            {s.station}
          </label>
        ))}

        <h3>Pricing</h3>
        <div>Feet: {totalFeet}</div>
        <div>Value: ${value.toLocaleString()}</div>

        <input placeholder="$ / ft" onChange={e => setPricePerFoot(e.target.value)} />
        <input placeholder="ft/day" onChange={e => setProductionRate(e.target.value)} />

        <button onClick={submitPricing}>Submit Pricing</button>
      </aside>

      {/* MAP */}
      <section>
        {scopeData && (
          <MapContainer
            center={[scopeData.stations[0].lat, scopeData.stations[0].lon]}
            zoom={16}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {stationPositions.map(s => (
              <Marker
                key={s.id}
                position={s.pos}
                icon={selectedStations.includes(s.id) ? selectedIcon : blueIcon}
                eventHandlers={{ click: () => {
                  setSelectedStations(prev =>
                    prev.includes(s.id)
                      ? prev.filter(x => x !== s.id)
                      : [...prev, s.id]
                  );
                }}}
              >
                <Popup>{s.station}</Popup>
              </Marker>
            ))}

            {groups.map((g, i) => (
              <Polyline
                key={i}
                positions={g.map(id => {
                  const s = stationPositions.find(x => x.id === id);
                  return s?.pos;
                }).filter(Boolean)}
                color="#f59e0b"
              />
            ))}

          </MapContainer>
        )}
      </section>
    </div>
  );
}
