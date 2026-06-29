# Hyperlinx DAL Development

This is a separate DAL development UI and runtime. It is intentionally isolated from the existing Chicago production/demo application.

## Boundaries

- The DAL app has its own Vite config.
- The DAL app has its own environment files.
- The DAL app has its own API config.
- The DAL app has its own build output: `dist-dal`.
- The production app does not import DAL code.
- DAL code does not modify production startup, routes, or top-level state.

## Environment

Copy or edit `hyperlinx-dal-dev/.env`:

Production single-origin mode:

```env
VITE_DAL_API=
VITE_DAL_BASELINE_API=
VITE_DAL_BASELINE_GRAPH_API=
VITE_DAL_INVENTORY_GRAPH_API=
VITE_DAL_REASONING_PRIMARY_API=http://72.46.85.137:8000
VITE_DAL_REASONING_PRIMARY_MODEL=mistralai/Mistral-7B-Instruct-v0.2
VITE_DAL_REASONING_SECONDARY_API=
VITE_DAL_REASONING_FALLBACK_API=
VITE_DAL_APP_NAME=Teralinx Infrastructure Operating Platform
```

Blank DAL API values mean the browser calls `/api/*` on the same origin that served the UI. This is the required production mode for `https://app.teralinx.net`.

Local development uses the same browser URL shape. Run the runtime on port `3001`, run Vite on port `5174`, and let Vite proxy `/api/*` to the runtime without compiling an API host into the browser:

```env
VITE_DAL_API=
VITE_DAL_BASELINE_API=
VITE_DAL_BASELINE_GRAPH_API=
VITE_DAL_INVENTORY_GRAPH_API=
VITE_DAL_REASONING_PRIMARY_API=http://127.0.0.1:8000
VITE_DAL_REASONING_PRIMARY_MODEL=Local OpenAI-Compatible Reasoning
VITE_DAL_REASONING_SECONDARY_API=
VITE_DAL_REASONING_FALLBACK_API=
VITE_DAL_APP_NAME=Teralinx Infrastructure Operating Platform
```

DAL runtime truth-layer API calls are same-origin browser requests. Reasoning is a separate fabric and is resolved through primary, secondary, fallback, or `VITE_DAL_REASONING_ENDPOINTS` registry configuration. When the app is served from `server/index.js`, the runtime API and UI share one origin and no browser CORS path is required.

Reasoning registry JSON example:

```env
VITE_DAL_REASONING_ENDPOINTS=[{"name":"DAL1-GPU","host":"72.46.85.137","port":8000,"protocol":"http","modelName":"mistralai/Mistral-7B-Instruct-v0.2","capabilities":["GRAPH_ANALYSIS","PRISM_ANALYSIS","TRANSLATION","AFFINITY","SYNTHESIS","GENERAL_REASONING"]}]
```

## Run

```bash
cd hyperlinx-dal-dev
npm run dev
```

Default development UI: `http://<dal-ui-host>:5174`

Vite is development-only. Browser code still calls relative `/api/*` URLs; the dev server proxy forwards those requests to the local runtime.

## Build

```bash
cd hyperlinx-dal-dev
npm run build
```

Output: `hyperlinx-dal-dev/dist-dal`

## Production Runtime

The DAL runtime is the single production entry point. It serves:

```text
/api/*      Runtime APIs
/health     Runtime health
/           React build from dist-dal
/*          SPA fallback to dist-dal/index.html
```

Production startup:

```bash
cd hyperlinx-dal-dev
npm run build
npm run start
```

PM2 startup:

```bash
cd hyperlinx-dal-dev
pm2 start ecosystem.config.cjs
```

Cloudflare Tunnel should target `http://localhost:3001`. Do not point production traffic at Vite dev or Vite preview ports.

## Translate V1

DAL Translate accepts CSV, KML, KMZ, and GeoJSON files. It builds:

```json
{
  "inventoryId": "...",
  "metadata": {
    "graphId": "...",
    "createdDate": "..."
  },
  "nodes": [],
  "edges": [],
  "stations": [],
  "routes": []
}
```

Save uses `POST /api/inventory-graphs`. Inventory Graphs uses:

```text
GET /api/inventory-graphs
GET /api/inventory-graphs/:inventoryId
```

## Deploy To DAL1

Build `dist-dal` and run `server/index.js` as the DAL runtime. Production must not serve the UI from `vite preview` or a standalone static server, because browser requests to `/api/*` must reach the same runtime that serves the application.

## Promotion Rule

DAL development must move through Integration/Test before Production. Development artifacts must not be deployed directly over Chicago production/demo infrastructure.
