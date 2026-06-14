console.log("🔥 NEW SERVER VERSION LOADED");

import 'dotenv/config';
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json({ limit: "750mb" }));

const baselineGraphs = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GRAPH_STORAGE_DIR = process.env.BASELINE_GRAPH_STORAGE_DIR || path.join(__dirname, "data", "baseline-graphs");
const GRAPH_CHUNK_TYPES = ["nodes", "edges", "stations", "routes"];

function ensureGraphStorageDir() {
  fs.mkdirSync(GRAPH_STORAGE_DIR, { recursive: true });
}

function safeInventoryId(inventoryId) {
  return String(inventoryId || "").replace(/[^a-zA-Z0-9_.-]/g, "_") || `inventory-${Date.now()}`;
}

function graphStoragePath(inventoryId) {
  return path.join(GRAPH_STORAGE_DIR, safeInventoryId(inventoryId));
}

function graphMetadataPath(inventoryId) {
  return path.join(graphStoragePath(inventoryId), "metadata.json");
}

function graphChunkDir(inventoryId, chunkType) {
  return path.join(graphStoragePath(inventoryId), chunkType);
}

function graphChunkPath(inventoryId, chunkType, chunkIndex) {
  return path.join(graphChunkDir(inventoryId, chunkType), `${Number(chunkIndex)}.json`);
}

function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), "utf8");
}

function emptyChunkState() {
  return Object.fromEntries(GRAPH_CHUNK_TYPES.map((type) => [type, { totalChunks: null, chunks: [] }]));
}

function normalizeChunkState(raw = {}) {
  const state = emptyChunkState();
  for (const type of GRAPH_CHUNK_TYPES) {
    const totalChunks = Number(raw[type]?.totalChunks ?? raw[type]?.total_chunks ?? raw[type]?.chunks ?? raw[type] ?? NaN);
    state[type].totalChunks = Number.isFinite(totalChunks) && totalChunks > 0 ? totalChunks : null;
  }
  return state;
}

function createInventoryScopeVersion(record) {
  return {
    scopeVersionId: `inventory-scope-${record.inventoryId}`,
    type: "INVENTORY_SCOPEVERSION",
    inventoryId: record.inventoryId,
    baselineGraphId: String(record.graphSummary?.baselineId || record.inventoryId),
    sourceFile: record.sourceFile,
    importedAt: record.importedAt,
    nodeCount: record.metadata.nodeCount,
    edgeCount: record.metadata.edgeCount,
    stationCount: record.metadata.stationCount,
    status: "ACTIVE",
  };
}

function graphMetadataFromRecord(record) {
  const summary = record.graphSummary || {};
  return {
    inventoryId: record.inventoryId,
    name: record.name,
    nodeCount: Number(summary.nodeCount ?? record.nodes?.length ?? 0),
    edgeCount: Number(summary.edgeCount ?? record.edges?.length ?? 0),
    stationCount: Number(summary.stationCount ?? record.stations?.length ?? 0),
    routeMiles: Number(summary.routeMiles ?? summary.totalLengthMiles ?? 0),
    bbox: summary.bbox || summary.bounds || null,
    connectedComponents: summary.connectedComponents,
    longestSegment: summary.longestSegment,
    chunkCounts: {
      nodes: Number(record.chunkState?.nodes?.totalChunks ?? 0),
      edges: Number(record.chunkState?.edges?.totalChunks ?? 0),
      stations: Number(record.chunkState?.stations?.totalChunks ?? 0),
      routes: Number(record.chunkState?.routes?.totalChunks ?? 0),
    },
    importedAt: record.importedAt,
    baselineGraphId: summary.baselineId,
    inventoryScopeVersionId: `inventory-scope-${record.inventoryId}`,
    sourceFile: record.sourceFile,
    graphSummary: summary,
  };
}

function flattenChunks(chunks) {
  return chunks.flatMap((chunk) => (Array.isArray(chunk) ? chunk : []));
}

function chunkExists(record, chunkType, chunkIndex) {
  return Boolean(record.chunkState?.[chunkType]?.chunks?.[chunkIndex]) || fs.existsSync(graphChunkPath(record.inventoryId, chunkType, chunkIndex));
}

function chunkSetComplete(record, chunkType) {
  const totalChunks = Number(record.chunkState?.[chunkType]?.totalChunks);
  if (!Number.isFinite(totalChunks) || totalChunks <= 0) return false;
  for (let index = 0; index < totalChunks; index++) {
    if (!chunkExists(record, chunkType, index)) return false;
  }
  return true;
}

function persistBaselineGraphRecord(record) {
  record.metadata = graphMetadataFromRecord(record);
  const persisted = {
    inventoryId: record.inventoryId,
    name: record.name,
    graphSummary: record.graphSummary,
    sourceFile: record.sourceFile,
    importedAt: record.importedAt,
    metadata: record.metadata,
    chunkState: Object.fromEntries(
      GRAPH_CHUNK_TYPES.map((type) => [type, { totalChunks: record.chunkState?.[type]?.totalChunks ?? null }])
    ),
    assembled: Boolean(record.assembled),
  };
  writeJsonFile(graphMetadataPath(record.inventoryId), persisted);
}

function recordFromPersisted(persisted) {
  const record = {
    inventoryId: String(persisted.inventoryId || ""),
    name: String(persisted.name || persisted.metadata?.name || "Carrier network inventory"),
    graphSummary: persisted.graphSummary || persisted.metadata?.graphSummary || {},
    nodes: [],
    edges: [],
    stations: [],
    routes: [],
    sourceFile: persisted.sourceFile || persisted.metadata?.sourceFile,
    importedAt: String(persisted.importedAt || persisted.metadata?.importedAt || new Date().toISOString()),
    metadata: persisted.metadata || {},
    chunkState: normalizeChunkState(persisted.chunkState || persisted.metadata?.chunkCounts),
    assembled: Boolean(persisted.assembled),
  };
  record.metadata = graphMetadataFromRecord(record);
  return record;
}

function loadBaselineGraphRecord(inventoryId) {
  if (baselineGraphs.has(inventoryId)) return baselineGraphs.get(inventoryId);
  const persisted = readJsonFile(graphMetadataPath(inventoryId));
  if (!persisted) return null;
  const record = recordFromPersisted(persisted);
  baselineGraphs.set(record.inventoryId, record);
  return record;
}

function loadAllBaselineGraphRecords() {
  ensureGraphStorageDir();
  for (const entry of fs.readdirSync(GRAPH_STORAGE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const persisted = readJsonFile(path.join(GRAPH_STORAGE_DIR, entry.name, "metadata.json"));
    if (!persisted?.inventoryId || baselineGraphs.has(persisted.inventoryId)) continue;
    baselineGraphs.set(persisted.inventoryId, recordFromPersisted(persisted));
  }
  return Array.from(baselineGraphs.values());
}

function readChunk(record, chunkType, chunkIndex) {
  const memoryChunk = record.chunkState?.[chunkType]?.chunks?.[chunkIndex];
  if (Array.isArray(memoryChunk)) return memoryChunk;
  return readJsonFile(graphChunkPath(record.inventoryId, chunkType, chunkIndex), []);
}

function writeChunk(record, chunkType, chunkIndex, data) {
  writeJsonFile(graphChunkPath(record.inventoryId, chunkType, chunkIndex), data);
  record.chunkState[chunkType].chunks[chunkIndex] = true;
}

function readAllChunks(record, chunkType) {
  const totalChunks = Number(record.chunkState?.[chunkType]?.totalChunks);
  if (!Number.isFinite(totalChunks) || totalChunks <= 0) return [];
  const records = [];
  for (let index = 0; index < totalChunks; index++) {
    records.push(...readChunk(record, chunkType, index));
  }
  return records;
}

function maybeAssembleGraph(record) {
  if (record.assembled) return false;
  const nodesReady = chunkSetComplete(record, "nodes");
  const edgesReady = chunkSetComplete(record, "edges");
  const stationsReady = chunkSetComplete(record, "stations");
  const routesRequired = Number(record.chunkState?.routes?.totalChunks) > 0;
  const routesReady = !routesRequired || chunkSetComplete(record, "routes");
  if (!nodesReady || !edgesReady || !stationsReady || !routesReady) return false;

  console.log("GRAPH ASSEMBLY START", { inventoryId: record.inventoryId });
  record.metadata = graphMetadataFromRecord(record);
  record.inventoryScopeVersion = createInventoryScopeVersion(record);
  record.assembled = true;
  persistBaselineGraphRecord(record);
  console.log("GRAPH ASSEMBLY COMPLETE", {
    inventoryId: record.inventoryId,
    nodes: record.metadata.nodeCount,
    edges: record.metadata.edgeCount,
    stations: record.metadata.stationCount,
  });
  console.log("SERVER GRAPH ASSEMBLY COMPLETE", {
    inventoryId: record.inventoryId,
    nodes: record.metadata.nodeCount,
    edges: record.metadata.edgeCount,
    stations: record.metadata.stationCount,
  });
  console.log("GRAPH STORED", { inventoryId: record.inventoryId });
  console.log("INVENTORY SCOPEVERSION CREATED", record.inventoryScopeVersion);
  return true;
}

ensureGraphStorageDir();
loadAllBaselineGraphRecords();

/* ===================== BASELINE GRAPHS ===================== */
app.post("/api/baseline-graphs", (req, res) => {
  try {
    const payload = req.body || {};
    const inventoryId = String(payload.inventoryId || payload.inventory_id || payload.graphSummary?.baselineId || `inventory-${Date.now()}`);
    const importedAt = String(payload.importedAt || new Date().toISOString());
    const graphSummary = payload.graphSummary || {};
    const record = {
      inventoryId,
      name: String(payload.name || graphSummary.name || "Carrier network inventory"),
      graphSummary,
      nodes: [],
      edges: [],
      stations: [],
      sourceFile: payload.sourceFile,
      importedAt,
      metadata: payload.metadata || {},
      chunkState: normalizeChunkState(payload.chunkCounts || payload.chunk_counts || payload.metadata?.chunkCounts || payload.metadata?.chunk_counts),
      assembled: false,
    };
    record.metadata = graphMetadataFromRecord(record);
    record.inventoryScopeVersion = createInventoryScopeVersion(record);

    baselineGraphs.set(inventoryId, record);
    const metadata = graphMetadataFromRecord(record);
    persistBaselineGraphRecord(record);
    console.log("BASELINE GRAPH SAVE START", metadata);
    res.json({
      metadata,
      inventoryScopeVersion: record.inventoryScopeVersion,
    });
  } catch (err) {
    console.error("BASELINE GRAPH SAVE ERROR", err);
    res.status(500).json({ error: "Baseline graph save failed", detail: err.message });
  }
});

function handleBaselineGraphChunkUpload(req, res) {
  try {
    const { inventoryId } = req.params;
    const record = loadBaselineGraphRecord(inventoryId);
    if (!record) return res.status(404).json({ error: "Baseline graph not initialized" });

    const payload = req.body || {};
    const chunkType = String(payload.chunkType || "");
    if (!GRAPH_CHUNK_TYPES.includes(chunkType)) return res.status(400).json({ error: "Unsupported chunk type" });

    const chunkIndex = Number(payload.chunkIndex);
    const totalChunks = Number(payload.totalChunks);
    const data = Array.isArray(payload.data) ? payload.data : [];
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) return res.status(400).json({ error: "Invalid chunk index" });
    if (!Number.isInteger(totalChunks) || totalChunks <= 0) return res.status(400).json({ error: "Invalid total chunks" });
    console.log("GRAPH CHUNK UPLOAD START", {
      inventoryId,
      chunkType,
      chunkIndex,
      totalChunks,
      recordCount: data.length,
    });
    console.log("BASELINE GRAPH CHUNK UPLOAD", { inventoryId, chunkType, chunkIndex, totalChunks, recordCount: data.length });
    console.log("CHUNK TYPE", chunkType);
    console.log("CHUNK INDEX", chunkIndex);
    console.log("CHUNK RECORD COUNT", data.length);

    record.chunkState[chunkType].totalChunks = totalChunks;
    writeChunk(record, chunkType, chunkIndex, data);

    const assembled = maybeAssembleGraph(record);
    const metadata = graphMetadataFromRecord(record);
    persistBaselineGraphRecord(record);
    console.log("GRAPH CHUNK UPLOAD COMPLETE", { inventoryId, chunkType, chunkIndex });
    if (assembled) console.log("BASELINE GRAPH SAVE COMPLETE", metadata);
    res.json({
      metadata,
      assembled,
      inventoryScopeVersion: record.inventoryScopeVersion,
    });
  } catch (err) {
    console.error("GRAPH CHUNK UPLOAD ERROR", err);
    res.status(500).json({ error: "Graph chunk upload failed", detail: err.message });
  }
}

app.post("/api/baseline-graphs/:inventoryId/chunks", handleBaselineGraphChunkUpload);
app.post("/api/baseline-graphs/:inventoryId/chunk", handleBaselineGraphChunkUpload);

app.get("/api/baseline-graphs", (_req, res) => {
  const items = loadAllBaselineGraphRecords().map(graphMetadataFromRecord);
  console.log("BASELINE GRAPH LIST LOADED", { count: items.length });
  res.json({ items });
});

app.get("/api/baseline-graphs/:inventoryId/chunks/:chunkIndex", (req, res) => {
  const record = loadBaselineGraphRecord(req.params.inventoryId);
  if (!record) return res.status(404).json({ error: "Baseline graph not found" });
  const metadata = graphMetadataFromRecord(record);
  const chunkIndex = Number(req.params.chunkIndex);
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) return res.status(400).json({ error: "Invalid chunk index" });
  const chunkType = req.query.chunkType ? String(req.query.chunkType) : "";

  if (chunkType) {
    if (!GRAPH_CHUNK_TYPES.includes(chunkType)) return res.status(400).json({ error: "Unsupported chunk type" });
    const state = record.chunkState[chunkType];
    const data = readChunk(record, chunkType, chunkIndex);
    console.log("GRAPH DETAIL CHUNK", {
      inventoryId: record.inventoryId,
      chunkType,
      chunkIndex,
      totalChunks: state.totalChunks,
      recordCount: data.length,
    });
    return res.json({ metadata, chunkType, chunkIndex, totalChunks: state.totalChunks, data });
  }

  const data = Object.fromEntries(GRAPH_CHUNK_TYPES.map((type) => [type, readChunk(record, type, chunkIndex)]));
  console.log("GRAPH DETAIL CHUNK", { inventoryId: record.inventoryId, chunkIndex });
  return res.json({ metadata, chunkIndex, data });
});

app.get("/api/baseline-graphs/:inventoryId", (req, res) => {
  const record = loadBaselineGraphRecord(req.params.inventoryId);
  if (!record) return res.status(404).json({ error: "Baseline graph not found" });
  const metadata = graphMetadataFromRecord(record);
  const chunkType = req.query.chunkType;
  if (GRAPH_CHUNK_TYPES.includes(chunkType)) {
    const state = record.chunkState[chunkType];
    const chunkIndex = req.query.chunkIndex === undefined ? null : Number(req.query.chunkIndex);
    if (chunkIndex !== null && Number.isFinite(chunkIndex)) {
      const data = readChunk(record, chunkType, chunkIndex);
      console.log("GRAPH DETAIL CHUNK", {
        inventoryId: record.inventoryId,
        chunkType,
        chunkIndex,
        totalChunks: state.totalChunks,
        recordCount: data.length,
      });
      return res.json({ metadata, chunkType, chunkIndex, totalChunks: state.totalChunks, data });
    }

    const data = readAllChunks(record, chunkType);
    console.log("GRAPH DETAIL CHUNK", { inventoryId: record.inventoryId, chunkType, recordCount: data.length });
    return res.json({ metadata, chunkType, totalChunks: state.totalChunks, data });
  }
  console.log("BASELINE GRAPH DETAIL LOADED", metadata);
  res.json({
    metadata,
    inventoryScopeVersion: record.inventoryScopeVersion,
  });
});

/* ===================== PRISM ===================== */
app.post("/api/prism", async (req, res) => {
  try {
    const { routeCoords } = req.body;

    if (!routeCoords || routeCoords.length === 0) {
      return res.status(400).json({ error: "Missing routeCoords" });
    }

    const prompt = `
Given this fiber route:
${JSON.stringify(routeCoords)}

Find 5 enterprise or commercial targets near the route.

Return ONLY JSON:
{
  "targets": [
    {
      "lat": number,
      "lon": number,
      "type": "enterprise",
      "confidence": number,
      "rationale": ["short reason", "short reason"]
    }
  ]
}
`;

    console.log("🔵 PRISM → Dallas LLM");

    const response = await fetch("http://72.46.85.137:8000/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistralai/Mistral-7B-Instruct-v0.2",
        temperature: 0.2,
        messages: [
          { role: "system", content: "Return ONLY valid JSON. No explanation." },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

    const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      return res.json(JSON.parse(cleaned));
    } catch {
      return res.json({
        targets: routeCoords.slice(0, 3).map(([lon, lat]) => ({
          lat,
          lon,
          type: "enterprise",
          confidence: 0.5,
          rationale: ["fallback"]
        }))
      });
    }

  } catch (err) {
    console.error("🔥 PRISM ERROR:", err);
    res.status(500).json({ error: "Prism failed" });
  }
});

/* ===================== TOOL LAYER ===================== */
async function runTool(name, args) {
  console.log("🛠️ TOOL CALL:", name, args);

  if (name === "getScopeVersion") {
    try {
      const scopeVersionId = args?.scopeVersionId;

      const response = await fetch(
        `http://64.34.93.5:4000/scopeversion/${scopeVersionId}`
      );

      const raw = await response.json();

      const stations = raw?.stations || [];
      const proposals = raw?.proposals || [];
      const closes = raw?.closes || [];

      const statusCounts = {
        planned: 0,
        engineering: 0,
        permitting: 0,
        construction: 0,
        complete: 0
      };

      for (const s of stations) {
        if (statusCounts[s.status] !== undefined) {
          statusCounts[s.status]++;
        }
      }

      return {
        scopeVersionId,
        stations: {
          total: stations.length,
          ...statusCounts
        },
        proposals: {
          total: proposals.length
        },
        closes: {
          total: closes.length
        }
      };

    } catch (err) {
      console.error("🔥 IOF FETCH ERROR:", err);
      return { error: "failed to fetch scopeversion" };
    }
  }

  return { error: "unknown tool" };
}

/* ===================== TWIN ===================== */
app.post("/api/twin", async (req, res) => {
  try {
    console.log("🟣 TWIN HIT");

    const { message, ...context } = req.body || {};

    const systemPrompt = `
You are Twin Operator.

You can request tools.

If needed return:
{ "tool": "getScopeVersion", "args": {} }

Otherwise return JSON:
{
  "result": "",
  "observations": [],
  "anomalies": [],
  "recommendations": [],
  "nextActions": []
}
`;

    const firstResponse = await fetch("http://72.46.85.137:8000/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistralai/Mistral-7B-Instruct-v0.2",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const firstData = await firstResponse.json();
    const firstContent = firstData?.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = JSON.parse(firstContent);
    } catch {
      return res.json({ result: firstContent });
    }

    if (parsed.tool) {
      const toolArgs = {
        ...parsed.args,
        scopeVersionId: context?.scopeVersionId
      };

      const toolResult = await runTool(parsed.tool, toolArgs);

      const mergedContext = {
        ...context,
        ...toolResult
      };

      const computed = {
        totalStations: toolResult?.stations?.total || 0,
        planned: toolResult?.stations?.planned || 0,
        engineering: toolResult?.stations?.engineering || 0,
        permitting: toolResult?.stations?.permitting || 0,
        construction: toolResult?.stations?.construction || 0,
        complete: toolResult?.stations?.complete || 0,
      };

      const finalContext = {
        ...mergedContext,
        computed
      };

      const secondResponse = await fetch("http://72.46.85.137:8000/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mistralai/Mistral-7B-Instruct-v0.2",
          temperature: 0.2,
          messages: [
            {
              role: "system",
            content: `
            You are Twin Operator.

            You MUST use the computed fields EXACTLY.

            Rules:
            - planned = computed.planned
            - engineering = computed.engineering
            - NEVER swap values
            - NEVER estimate
            - NEVER infer counts

            If asked for counts → return EXACT numbers from computed

            Return ONLY JSON:
            {
            "result": "",
            "observations": [],
            "anomalies": [],
            "recommendations": [],
            "nextActions": []
            }
            `
            },
            { role: "user", content: message },
            { role: "assistant", content: JSON.stringify(mergedContext) }
          ]
        })
      });

      const secondData = await secondResponse.json();
      const secondContent = secondData?.choices?.[0]?.message?.content || "";

      try {
        return res.json(JSON.parse(secondContent));
      } catch {
        return res.json({ result: secondContent });
      }
    }

    return res.json(parsed);

  } catch (err) {
      console.error("🔥 TWIN ERROR:", err);
      res.status(500).json({
        result: "Twin failed",
        error: err.message,
        stack: err.stack
      });
    }
});

/* ===================== CHAT ===================== */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, context } = req.body;

    const response = await fetch("http://72.46.85.137:8000/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistralai/Mistral-7B-Instruct-v0.2",
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are Prism Operator." },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

    res.json({ result: content });

  } catch (err) {
    console.error("🔥 CHAT ERROR:", err);
    res.status(500).json({ result: "Chat failed" });
  }
});

/* ===================== TEST ===================== */
app.get("/test", (req, res) => {
  res.send("Server is working");
});

/* ===================== START ===================== */
app.listen(3001, () => {
  console.log("LLM server running on http://64.34.93.5:3001");
});
