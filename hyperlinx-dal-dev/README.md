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

Remote DAL mode:

```env
VITE_DAL_API=http://67.213.118.179:3001
VITE_DAL_BASELINE_API=http://67.213.118.179:3001
VITE_DAL_BASELINE_GRAPH_API=http://67.213.118.179:3001
VITE_DAL_INVENTORY_GRAPH_API=http://67.213.118.179:3001
VITE_DAL_REASONING_API=http://67.213.118.179:4100
VITE_DAL_APP_NAME=HYPERLINX DAL DEVELOPMENT
```

Local mode:

```env
VITE_DAL_API=http://127.0.0.1:3001
VITE_DAL_BASELINE_API=http://127.0.0.1:3001
VITE_DAL_BASELINE_GRAPH_API=http://127.0.0.1:3001
VITE_DAL_INVENTORY_GRAPH_API=http://127.0.0.1:3001
VITE_DAL_REASONING_API=http://127.0.0.1:4100
VITE_DAL_APP_NAME=HYPERLINX DAL DEVELOPMENT
```

DAL runtime API targets come from these environment values. If an API value is omitted, the DAL app derives the API host from the browser host and the expected service port.

## Run

```bash
cd hyperlinx-dal-dev
npm run dev
```

Default development UI: `http://<dal-ui-host>:5174`

## Build

```bash
cd hyperlinx-dal-dev
npm run build
```

Output: `hyperlinx-dal-dev/dist-dal`

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

Build `dist-dal` and deploy that directory to the DAL1 web host. DAL1 API targets should come from DAL environment variables, not Chicago constants.

## Promotion Rule

DAL development must move through Integration/Test before Production. Development artifacts must not be deployed directly over Chicago production/demo infrastructure.
