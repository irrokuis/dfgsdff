# Commercial Site Feasibility

An Auckland “Back to The Future” site-screening tool. It uses today’s OpenStreetMap location signals and transparent financial assumptions to forecast a business site’s future viability under conservative, base, and optimistic demand views.

The React/TypeScript frontend consumes FastAPI’s OpenAPI contract. The backend separates forecast policy, open-data adapters, and analysis orchestration so the model remains explainable and testable.

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

Before a presentation, refresh the Auckland snapshot once while Overpass is available:

```bash
python3 scripts/warm_auckland_competitors.py
```

## Data and forecast model

- Address lookup uses Nominatim and competitor discovery uses OpenStreetMap via Overpass.
- Auckland competitor data is fetched as one city-wide OpenStreetMap snapshot, written to `data/auckland_competitors.json`, and filtered locally within the 1.5 km site radius. Each analysis tries to refresh the snapshot first; if Overpass is unavailable, the last snapshot remains available as a clearly labelled stale fallback for 90 days, including after a service restart. Locations outside Auckland follow the same live-first, cache-on-failure behaviour.
- Revenue, rent, competition, ramp-up, and seasonality assumptions are held in `server/policy.py`. The app returns the model version, forecast drivers, and limitations with every analysis.
- This is a screening tool, not financial advice. Validate local demand, lease terms, fit-out costs, and the actual site before committing.

## Verify

```bash
curl http://127.0.0.1:8000/api/health
npm run generate:api
npm run typecheck
npm run test
npm run test:e2e
npm run build
python3 -m pytest
```

`npm run verify` runs the type check, frontend unit tests, production build, and backend suite. Run `npm run test:e2e` separately when browser validation is required.
