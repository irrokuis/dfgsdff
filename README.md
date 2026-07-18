# Commercial Site Feasibility

An Auckland commercial-site screening tool with a Vite/React frontend and a FastAPI backend. The backend calculates feasibility and requests live same-type competitor data from OpenStreetMap's Overpass API.

## Run locally

Install the Python service dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Install frontend dependencies and run both services in separate terminals:

```bash
npm install
npm run dev:api
```

```bash
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). Vite proxies `/api` requests to FastAPI at `http://127.0.0.1:8000`.

## Verify

```bash
curl http://127.0.0.1:8000/api/health
npm run build
python3 -m pytest
```
