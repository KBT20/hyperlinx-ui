import 'dotenv/config';
import express from "express";
import OpenAI from "openai";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
    console.log("🔵 Sending to OpenAI...");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return ONLY valid JSON. No explanation." },
        { role: "user", content: prompt }
      ]
    });

    const content = response.choices[0].message.content;

    const cleaned = content
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

    let parsed;

    try {
    parsed = JSON.parse(cleaned);
    } catch (e) {
    console.warn("⚠️ JSON parse failed, using fallback");

    parsed = {
        targets: routeCoords.slice(0, 3).map(([lon, lat]) => ({
        lat,
        lon,
        type: "enterprise",
        confidence: 0.5
        }))
    };
    }

    res.json(parsed);

  } catch (err) {
    console.error("🔥 LLM BACKEND ERROR:", err?.message || err);

    res.status(500).json({
      error: "LLM failed",
      detail: err?.message
    });
  }
});

app.get("/osrm/route", async (req, res) => {
  const { from, to } = req.query;

  const url = `https://router.project-osrm.org/route/v1/driving/${from};${to}?overview=full&geometries=geojson`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "osrm failed" });
  }
});

app.get("/osrm/nearest", async (req, res) => {
  const { point } = req.query;

  const url = `https://router.project-osrm.org/nearest/v1/driving/${point}`;

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "osrm failed" });
  }
});

app.listen(3001, () => {
  console.log("LLM server running on http://localhost:3001");
});

app.get("/test", (req, res) => {
  res.send("Server is working");
});