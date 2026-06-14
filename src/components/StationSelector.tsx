import { useState, useEffect } from "react";

export default function StationSelector({
  stationId,
  onChange
}: {
  stationId: string | null | undefined
  onChange: (value: string) => void
}) {

  const safeValue = stationId ?? "";

  const [localStation, setLocalStation] = useState(safeValue);

  useEffect(() => {
    setLocalStation(stationId ?? "");
  }, [stationId]);

  const handleChange = (e: any) => {
    const value = e.target.value ?? "";
    setLocalStation(value);
    onChange(value);
  };

  return (
    <div style={{ marginBottom: "10px" }}>
      <label>Station</label>

      <input
        type="text"
        value={localStation ?? ""}
        onChange={handleChange}
        placeholder="00+49"
        style={{ marginLeft: "10px" }}
      />
    </div>
  );
}