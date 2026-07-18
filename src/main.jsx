import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Plus,
  Info,
  AlertCircle,
  Loader2,
  MapPin,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const AUCKLAND_CENTER = [-36.8485, 174.7633];
const SEARCH_RADIUS_METERS = 1_500;
const STORE_TYPES = [
  "Cafe",
  "Convenience Store",
  "Restaurant",
  "Bakery",
  "Pharmacy",
  "Gym",
];
const nzd = (value) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const targetIconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
const targetIcon = L.divIcon({
  className: "target-marker",
  html: targetIconHtml,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng]);
    },
  });
  return null;
}

function SiteMap({ location, competitors = [], selectable = false, onSelect }) {
  const center = location ?? AUCKLAND_CENTER;
  return (
    <MapContainer
      key={location?.join(",") ?? "auckland"}
      center={center}
      zoom={location ? 14 : 12}
      scrollWheelZoom
      className="map"
    >
      <TileLayer
        attribution={
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        }
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {selectable && <MapClickHandler onSelect={onSelect} />}
      {location && (
        <>
          <Marker position={location} icon={targetIcon}>
            <Popup>Proposed store location</Popup>
            <Tooltip>Proposed store location</Tooltip>
          </Marker>
          <Circle
            center={location}
            radius={SEARCH_RADIUS_METERS}
            pathOptions={{ color: "#F97316", weight: 2, fill: false }}
          />
        </>
      )}
      {competitors.map((competitor) => (
        <CircleMarker
          key={competitor.id}
          center={[competitor.latitude, competitor.longitude]}
          radius={8}
          pathOptions={{
            color: "#0284C7",
            fillColor: "#38BDF8",
            fillOpacity: 0.8,
          }}
        >
          <Popup>
            <strong>{competitor.name}</strong>
            <br />
            Category: {competitor.kind}
            <br />
            Distance: {Math.round(competitor.distance_m).toLocaleString()} m
          </Popup>
          <Tooltip>{competitor.name}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

function NumberField({ label, value, min = 0, max, step, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function getApiErrorMessage(response, body) {
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail))
    return "Please check that every scenario input is valid.";
  return `The analysis service returned an error (${response.status}).`;
}

function Configuration({ onAnalysis }) {
  const [location, setLocation] = useState(null);
  const [storeType, setStoreType] = useState("Cafe");
  const [avgSalePrice, setAvgSalePrice] = useState(15);
  const [staffCount, setStaffCount] = useState(3);
  const [monthlyWage, setMonthlyWage] = useState(4_500);
  const [hoursOfWork, setHoursOfWork] = useState(10);
  const [costOfGoodsPct, setCostOfGoodsPct] = useState(30);
  const [extraCost, setExtraCost] = useState(1_000);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const salePriceLabel =
    storeType === "Gym"
      ? "Estimated monthly membership revenue per customer (NZD)"
      : "Average sale price per customer (NZD)";

  async function runAnalysis() {
    if (!location) {
      setError("Please click the map to select a target location first.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location[0],
          longitude: location[1],
          store_type: storeType,
          avg_sale_price: avgSalePrice,
          staff_count: staffCount,
          monthly_wage: monthlyWage,
          hours_of_work: hoursOfWork,
          cost_of_goods_pct: costOfGoodsPct,
          extra_cost: extraCost,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiErrorMessage(response, body));
      onAnalysis(body);
    } catch (requestError) {
      setError(
        requestError.message ||
          "The analysis service could not be reached. Start the FastAPI server and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={20} />
          </div>
          <div>
            <p>LOCATION INTELLIGENCE</p>
            <h2>Site Feasibility</h2>
          </div>
        </div>
        <div className="sidebar-content">
          <h3>Scenario inputs</h3>
          <label className="field">
            <span>Target store type</span>
            <select
              value={storeType}
              onChange={(event) => setStoreType(event.target.value)}
            >
              {STORE_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <NumberField
            label={salePriceLabel}
            value={avgSalePrice}
            max={5_000}
            step={0.5}
            onChange={setAvgSalePrice}
          />
          <NumberField
            label="Staff count"
            value={staffCount}
            min={1}
            max={100}
            step={1}
            onChange={setStaffCount}
          />
          <NumberField
            label="Monthly wage per staff member (NZD)"
            value={monthlyWage}
            max={50_000}
            step={100}
            onChange={setMonthlyWage}
          />
          <NumberField
            label="Hours of operation per day"
            value={hoursOfWork}
            min={1}
            max={24}
            step={0.5}
            onChange={setHoursOfWork}
          />
          <NumberField
            label="Cost of goods (% of revenue)"
            value={costOfGoodsPct}
            max={100}
            step={1}
            onChange={setCostOfGoodsPct}
          />
          <NumberField
            label="Extra monthly costs (NZD)"
            value={extraCost}
            max={200_000}
            step={100}
            onChange={setExtraCost}
          />
          <p className="sidebar-note">
            Rent is estimated from the site's distance to the CBD and typical
            floor area for the store type.
          </p>
          <button
            className="primary-button"
            onClick={runAnalysis}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Fetching live
                data…
              </>
            ) : (
              <>
                <Activity size={18} /> Run Feasibility Analysis
              </>
            )}
          </button>
        </div>
      </aside>
      <section className="workspace">
        <header>
          <p className="eyebrow">AUCKLAND, NEW ZEALAND</p>
          <h1>Commercial Site Feasibility</h1>
          <p className="subtitle">
            Select a real location, set costs, and run a live competitor
            analysis.
          </p>
        </header>
        <div className="map-section">
          <div className="section-heading">
            <div>
              <h2>Choose a location</h2>
              <p>Click anywhere on the map to place the proposed store.</p>
            </div>
            {location && (
              <div className="coordinate-card">
                <MapPin size={16} className="text-muted" />
                <div>
                  <span>Selected target</span>
                  <br />
                  <strong>
                    {location[0].toFixed(6)}, {location[1].toFixed(6)}
                  </strong>
                </div>
              </div>
            )}
          </div>
          <SiteMap
            location={location}
            selectable
            onSelect={(nextLocation) => {
              setLocation(nextLocation);
              setError(null);
            }}
          />
          {error && (
            <p className="alert error">
              <AlertCircle size={20} /> {error}
            </p>
          )}
          <p className="map-note">
            <Info size={16} /> Your analysis searches for the same business type
            within a 1.5 km radius.
          </p>
        </div>
      </section>
    </main>
  );
}

function Result({ analysis, onRestart }) {
  const chartData = [
    { name: "Labor", value: analysis.labor_cost, color: "#2563EB" },
    {
      name: "Cost of goods",
      value: analysis.cost_of_goods_cost,
      color: "#F59E0B",
    },
    { name: "Rent", value: analysis.rent_cost, color: "#8B5CF6" },
    { name: "Extra", value: analysis.extra_cost, color: "#F97316" },
  ];
  const projectionData = analysis.profit_projection.map((item) => ({
    ...item,
    label: `M${item.month}`,
    fill: item.profit >= 0 ? "#0F766E" : "#EA580C",
  }));
  const details = [
    ["Industry base revenue", nzd(analysis.industry_base_revenue)],
    ["Staffing capacity revenue", nzd(analysis.capacity_revenue)],
    [
      "Nearest same-type competitor",
      analysis.nearest_distance == null
        ? "No competitor found"
        : `${Math.round(analysis.nearest_distance).toLocaleString()} m`,
    ],
    ["Estimated commercial rent", nzd(analysis.rent_cost)],
    ["Cost of goods sold", nzd(analysis.cost_of_goods_cost)],
    ["Total monthly costs", nzd(analysis.total_cost)],
    [
      "Estimated monthly profit",
      nzd(analysis.central_estimate - analysis.total_cost),
    ],
  ];

  return (
    <main className="result-page">
      <header className="result-header">
        <div>
          <p className="eyebrow">FEASIBILITY RESULT</p>
          <h1>{analysis.store_type} site assessment</h1>
          <p className="subtitle">Auckland, New Zealand</p>
        </div>
        <button className="back-button" onClick={onRestart}>
          New scenario <Plus size={18} />
        </button>
      </header>
      <section className="bento-grid">
        <div
          className="rating-panel panel"
          
        >
          <p>FEASIBILITY RATING</p>
          <h2>{analysis.rating}</h2>
          <span>{analysis.rating_detail}</span>
        </div>
        <div className="metrics">
          <div className="metric revenue">
            <p>Projected monthly revenue</p>
            <strong>
              {nzd(analysis.revenue_min)} – {nzd(analysis.revenue_max)}
            </strong>
            <span>Screening range based on live location signals</span>
          </div>
          <div className="metric">
            <p>Central estimate</p>
            <strong>{nzd(analysis.central_estimate)}</strong>
          </div>
          <div className="metric">
            <p>Break-even point</p>
            <strong>{nzd(analysis.total_cost)}</strong>
          </div>
          <div className="metric">
            <p>Live competitors found</p>
            <strong>{analysis.competitor_count}</strong>
          </div>
        </div>
        {analysis.api_error && (
          <p className="alert" style={{ gridColumn: "span 12" }}>
            <AlertCircle size={20} /> {analysis.api_error}
          </p>
        )}
        <div className="dashboard-grid">
          <div className="panel">
            <div className="section-heading">
              <div>
                <h2>Real competitor map</h2>
                <p>Blue markers are same-type businesses from OpenStreetMap.</p>
              </div>
            </div>
            <SiteMap
              location={[analysis.latitude, analysis.longitude]}
              competitors={analysis.competitors}
            />
          </div>
          <div className="panel chart-panel">
            <h2>Monthly cost allocation</h2>
            {analysis.total_cost > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={104}
                      paddingAngle={3}
                    >
                      {chartData.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      formatter={(value) => nzd(value)}
                      contentStyle={{ borderColor: "#93C5FD", borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="cost-breakdown" aria-label="Monthly cost breakdown">
                  {chartData.map((item) => (
                    <div key={item.name}>
                      <span><i style={{ backgroundColor: item.color }} />{item.name}</span>
                      <strong>{nzd(item.value)}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty">
                No monthly costs were entered, so there is no cost allocation
                chart.
              </p>
            )}
          </div>
        </div>
        <div className="bottom-panels">
          <div className="panel projection-panel">
            <h2>12-month profit projection</h2>
            <p>
              Revenue ramps up over the first four months, then follows the
              model's seasonal assumptions.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={projectionData}
                margin={{ top: 15, right: 8, left: 10, bottom: 0 }}
              >
                <CartesianGrid stroke="#C7D2FE" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#64748B"
                  tick={{ fill: "#475569" }}
                />
                <YAxis
                  tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  width={48}
                  stroke="#64748B"
                  tick={{ fill: "#475569" }}
                />
                <ChartTooltip
                  formatter={(value) => nzd(value)}
                  contentStyle={{ borderColor: "#99F6E4", borderRadius: 8 }}
                />
                <Bar dataKey="profit" name="Monthly profit">
                  {projectionData.map((item) => (
                    <Cell key={item.month} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="panel details-panel">
            <h2>Financial summary</h2>
            <div className="details-table">
              {details.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="disclaimer">
              <Info size={16} /> Live business data comes from OpenStreetMap via
              the Overpass API. Results are screening estimates, not financial
              advice.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [analysis, setAnalysis] = useState(null);
  return analysis ? (
    <Result analysis={analysis} onRestart={() => setAnalysis(null)} />
  ) : (
    <Configuration onAnalysis={setAnalysis} />
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
