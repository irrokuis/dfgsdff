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

## Data and forecast model

- Address lookup uses Nominatim and competitor discovery uses OpenStreetMap via Overpass.
- Successful competitor responses are cached for 10 minutes and visibly labelled as live or fresh cached data. Stale data never generates a recommendation.
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
