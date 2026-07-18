import React, { useEffect, useRef, useState } from "react";
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
  AlertCircle,
  Info,
  Loader2,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./styles.css";

const AUCKLAND_CENTER = [-36.8485, 174.7633];
const SEARCH_RADIUS_METERS = 1_500;
const STORE_TYPES = ["Cafe", "Convenience Store", "Restaurant", "Bakery", "Pharmacy", "Gym"];
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
  const coordinate = location ? [location.latitude, location.longitude] : null;
  return (
    <MapContainer
      key={coordinate?.join(",") ?? "auckland"}
      center={coordinate ?? AUCKLAND_CENTER}
      zoom={coordinate ? 14 : 12}
      scrollWheelZoom
      className="map"
      aria-label={selectable ? "Map for choosing the proposed store location" : "Competitor map"}
    >
      <TileLayer
        attribution={'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'}
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      {selectable && <MapClickHandler onSelect={onSelect} />}
      {coordinate && (
        <>
          <Marker position={coordinate} icon={targetIcon}>
            <Popup>Proposed store location</Popup>
            <Tooltip>Proposed store location</Tooltip>
          </Marker>
          <Circle center={coordinate} radius={SEARCH_RADIUS_METERS} pathOptions={{ color: "#F97316", weight: 2, fill: false }} />
        </>
      )}
      {competitors.map((competitor) => (
        <CircleMarker
          key={competitor.id}
          center={[competitor.latitude, competitor.longitude]}
          radius={8}
          pathOptions={{ color: "#0284C7", fillColor: "#38BDF8", fillOpacity: 0.8 }}
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

function NumberField({ id, label, value, min = 0, max, step, onChange, error, optional = false }) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}{optional && " (optional)"}</span>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hintId}
      />
      <small id={hintId} className="field-hint">{optional ? "Leave blank to use the modelled estimate." : "Required"}</small>
      {error && <small id={errorId} className="field-error">{error}</small>}
    </label>
  );
}

function getApiErrorMessage(response, body) {
  if (typeof body?.detail?.message === "string") return body.detail.message;
  if (typeof body?.detail === "string") return body.detail;
  if (Array.isArray(body?.detail)) return "Please correct the highlighted scenario inputs and try again.";
  return `The analysis service returned an error (${response.status}).`;
}

function isInRange(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function AnalysisAction({ isLoading, canSubmit, className = "" }) {
  return (
    <div className={`analysis-action ${className}`}>
      <button className="primary-button" type="submit" disabled={isLoading || !canSubmit}>
        {isLoading ? <><Loader2 size={18} className="animate-spin" /> Fetching live data…</> : <><Activity size={18} /> Run Feasibility Analysis</>}
      </button>
      {!canSubmit && <p>Choose a valid location and complete required inputs to continue.</p>}
    </div>
  );
}

function Configuration({ onAnalysis }) {
  const [location, setLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState("idle");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [storeType, setStoreType] = useState("Cafe");
  const [avgSalePrice, setAvgSalePrice] = useState("15");
  const [staffCount, setStaffCount] = useState("3");
  const [monthlyWage, setMonthlyWage] = useState("4500");
  const [hoursOfWork, setHoursOfWork] = useState("10");
  const [costOfGoodsPct, setCostOfGoodsPct] = useState("30");
  const [extraCost, setExtraCost] = useState("1000");
  const [rentOverride, setRentOverride] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [requestError, setRequestError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const errorSummaryRef = useRef(null);
  const skipNextSearchRef = useRef(false);
  const salePriceLabel = storeType === "Gym" ? "Estimated monthly membership revenue per customer (NZD)" : "Average sale price per customer (NZD)";

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return undefined;
    }
    if (searchQuery.trim().length < 3) {
      setSearchResults([]);
      setSearchStatus("idle");
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchStatus("loading");
      try {
        const response = await fetch(`/api/locations/search?q=${encodeURIComponent(searchQuery.trim())}`, { signal: controller.signal });
        const body = await response.json().catch(() => []);
        if (!response.ok) throw new Error(getApiErrorMessage(response, body));
        setSearchResults(body);
        setSearchStatus(body.length ? "ready" : "empty");
      } catch (error) {
        if (error.name !== "AbortError") {
          setSearchResults([]);
          setSearchStatus("error");
        }
      }
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const values = {
    avgSalePrice: Number(avgSalePrice), staffCount: Number(staffCount), monthlyWage: Number(monthlyWage),
    hoursOfWork: Number(hoursOfWork), costOfGoodsPct: Number(costOfGoodsPct), extraCost: Number(extraCost),
    rentOverride: rentOverride === "" ? null : Number(rentOverride),
  };

  function validate() {
    const errors = {};
    if (!location) errors.location = "Choose an address, enter valid coordinates, or select a point on the map.";
    if (!isInRange(values.avgSalePrice, 0, 5000)) errors.avgSalePrice = "Enter an amount between 0 and 5,000.";
    if (!Number.isInteger(values.staffCount) || !isInRange(values.staffCount, 1, 100)) errors.staffCount = "Enter a whole number between 1 and 100.";
    if (!isInRange(values.monthlyWage, 0, 50000)) errors.monthlyWage = "Enter an amount between 0 and 50,000.";
    if (!isInRange(values.hoursOfWork, 1, 24)) errors.hoursOfWork = "Enter hours between 1 and 24.";
    if (!isInRange(values.costOfGoodsPct, 0, 100)) errors.costOfGoodsPct = "Enter a percentage between 0 and 100.";
    if (!isInRange(values.extraCost, 0, 200000)) errors.extraCost = "Enter an amount between 0 and 200,000.";
    if (values.rentOverride !== null && !isInRange(values.rentOverride, 0, 200000)) errors.rentOverride = "Enter an amount between 0 and 200,000.";
    return errors;
  }

  const canSubmit = Object.keys(validate()).length === 0;

  function selectLocation(nextLocation) {
    setLocation(nextLocation);
    setLatitude(nextLocation.latitude.toFixed(6));
    setLongitude(nextLocation.longitude.toFixed(6));
    setRequestError(null);
    setFieldErrors((current) => ({ ...current, location: undefined }));
  }

  function selectAddressResult(result) {
    selectLocation(result);
    skipNextSearchRef.current = true;
    setSearchQuery(result.display_name);
    setSearchResults([]);
  }

  function updateCoordinate(field, value) {
    const nextLatitude = field === "latitude" ? value : latitude;
    const nextLongitude = field === "longitude" ? value : longitude;
    if (field === "latitude") setLatitude(value); else setLongitude(value);
    const parsedLatitude = Number(nextLatitude);
    const parsedLongitude = Number(nextLongitude);
    if (isInRange(parsedLatitude, -90, 90) && isInRange(parsedLongitude, -180, 180)) {
      selectLocation({ latitude: parsedLatitude, longitude: parsedLongitude, displayName: "Manual coordinate selection" });
    } else {
      setLocation(null);
    }
  }

  async function runAnalysis() {
    const errors = validate();
    setFieldErrors(errors);
    setRequestError(null);
    if (Object.keys(errors).length) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location.latitude, longitude: location.longitude, store_type: storeType,
          avg_sale_price: values.avgSalePrice, staff_count: values.staffCount, monthly_wage: values.monthlyWage,
          hours_of_work: values.hoursOfWork, cost_of_goods_pct: values.costOfGoodsPct, extra_cost: values.extraCost,
          rent_override: values.rentOverride,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiErrorMessage(response, body));
      onAnalysis({ ...body, location_name: location.displayName });
    } catch (error) {
      setRequestError(error.message || "The analysis service could not be reached. Try again before making a recommendation.");
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="app-shell" onSubmit={(event) => { event.preventDefault(); runAnalysis(); }} onKeyDown={(event) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type !== "button") {
        event.preventDefault();
        runAnalysis();
      }
    }}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><Activity size={20} /></div><div><p>LOCATION INTELLIGENCE</p><h2>Site Feasibility</h2></div></div>
        <div className="sidebar-content">
          <h3>Scenario inputs</h3>
          <label className="field" htmlFor="store-type"><span>Target store type</span><select id="store-type" value={storeType} onChange={(event) => setStoreType(event.target.value)}>{STORE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
          <NumberField id="avg-sale-price" label={salePriceLabel} value={avgSalePrice} max={5000} step={0.5} onChange={setAvgSalePrice} error={fieldErrors.avgSalePrice} />
          <NumberField id="staff-count" label="Staff count" value={staffCount} min={1} max={100} step={1} onChange={setStaffCount} error={fieldErrors.staffCount} />
          <NumberField id="monthly-wage" label="Monthly wage per staff member (NZD)" value={monthlyWage} max={50000} step={100} onChange={setMonthlyWage} error={fieldErrors.monthlyWage} />
          <NumberField id="hours-of-work" label="Hours of operation per day" value={hoursOfWork} min={1} max={24} step={0.5} onChange={setHoursOfWork} error={fieldErrors.hoursOfWork} />
          <NumberField id="cost-of-goods" label="Cost of goods (% of revenue)" value={costOfGoodsPct} max={100} step={1} onChange={setCostOfGoodsPct} error={fieldErrors.costOfGoodsPct} />
          <NumberField id="extra-cost" label="Extra monthly costs (NZD)" value={extraCost} max={200000} step={100} onChange={setExtraCost} error={fieldErrors.extraCost} />
          <NumberField id="rent-override" label="Manual monthly rent (NZD)" value={rentOverride} max={200000} step={100} onChange={setRentOverride} error={fieldErrors.rentOverride} optional />
          <p className="sidebar-note">Without a manual rent, the model estimates monthly rent from CBD distance and a typical floor area for this store type. The result shows the exact assumptions.</p>
        </div>
        <AnalysisAction isLoading={isLoading} canSubmit={canSubmit} className="desktop-analysis-action" />
      </aside>

      <section className="workspace">
        <header><p className="eyebrow">AUCKLAND, NEW ZEALAND</p><h1>Commercial Site Feasibility</h1><p className="subtitle">Choose a real location, set costs, and run a live competitor analysis.</p></header>
        <div className="map-section">
          <div className="section-heading"><div><h2>Choose a location</h2><p>Search an Auckland address, enter coordinates, or click the map to place the proposed store.</p></div>{location && <div className="coordinate-card"><MapPin size={16} className="text-muted" /><div><span>Selected target</span><strong>{location.displayName}</strong><small>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</small></div></div>}</div>
          <section className="location-controls" aria-label="Location selection">
            <label className="field location-search" htmlFor="location-search"><span>Search Auckland address</span><div className="search-input"><Search size={18} aria-hidden="true" /><input id="location-search" role="combobox" aria-autocomplete="list" aria-expanded={searchResults.length > 0} aria-controls="location-results" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="e.g. 123 Queen Street" /></div>{searchStatus === "loading" && <small className="field-hint">Searching addresses…</small>}{searchStatus === "empty" && <small className="field-hint">No Auckland address matches found. Try a more specific address.</small>}{searchStatus === "error" && <small className="field-error">Address search is unavailable. Use coordinates or the map instead.</small>}</label>
            {searchResults.length > 0 && <ul id="location-results" className="location-results" role="listbox" aria-label="Address results">{searchResults.map((result) => <li key={`${result.latitude}-${result.longitude}`}><button type="button" role="option" onClick={() => selectAddressResult(result)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectAddressResult(result); } }}>{result.display_name}</button></li>)}</ul>}
            <div className="coordinate-inputs"><NumberField id="latitude" label="Latitude" value={latitude} min={-90} max={90} step={0.000001} onChange={(value) => updateCoordinate("latitude", value)} /><NumberField id="longitude" label="Longitude" value={longitude} min={-180} max={180} step={0.000001} onChange={(value) => updateCoordinate("longitude", value)} /></div>
          </section>
          <SiteMap location={location} selectable onSelect={([nextLatitude, nextLongitude]) => selectLocation({ latitude: nextLatitude, longitude: nextLongitude, displayName: "Map-selected site" })} />
          {(requestError || fieldErrors.location) && <div className="alert error" role="alert" aria-live="assertive" tabIndex={-1} ref={errorSummaryRef}><AlertCircle size={20} /><div><strong>Analysis not run</strong><br />{requestError || fieldErrors.location}</div></div>}
          <p className="map-note"><Info size={16} /> The analysis searches for the same business type within a 1.5 km radius. Live competitor data is required before a recommendation is shown.</p>
        </div>
      </section>
      {location && <AnalysisAction isLoading={isLoading} canSubmit={canSubmit} className="mobile-analysis-action" />}
    </form>
  );
}

function Result({ analysis, onRestart }) {
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const chartData = [
    { name: "Labor", value: analysis.labor_cost, color: "#2563EB" }, { name: "Cost of goods", value: analysis.cost_of_goods_cost, color: "#F59E0B" },
    { name: "Rent", value: analysis.rent_cost, color: "#8B5CF6" }, { name: "Extra", value: analysis.extra_cost, color: "#F97316" },
  ];
  const projectionData = analysis.profit_projection.map((item) => ({ ...item, label: `M${item.month}`, fill: item.profit >= 0 ? "#0F766E" : "#EA580C" }));
  const details = [
    ["Industry base revenue", nzd(analysis.industry_base_revenue)], ["Staffing capacity revenue", nzd(analysis.capacity_revenue)],
    ["Nearest same-type competitor", analysis.nearest_distance == null ? "No competitor found" : `${Math.round(analysis.nearest_distance).toLocaleString()} m`],
    ["Monthly rent used", nzd(analysis.rent_cost)], ["Cost of goods sold", nzd(analysis.cost_of_goods_cost)],
    ["Total monthly costs", nzd(analysis.total_cost)], ["Estimated monthly profit", nzd(analysis.central_estimate - analysis.total_cost)],
  ];
  const rentAssumptions = analysis.rent_assumptions ?? {};
  return (
    <main className="result-page">
      <header className="result-header"><div><p className="eyebrow">FEASIBILITY RESULT</p><h1 ref={headingRef} tabIndex={-1}>{analysis.store_type} site assessment</h1><p className="subtitle">{analysis.location_name || "Selected Auckland site"}</p></div><button className="back-button" onClick={onRestart}>New scenario <Plus size={18} /></button></header>
      <section className="bento-grid">
        <div className="rating-panel panel" style={{ "--rating-color": analysis.rating_color }}><p>FEASIBILITY RATING</p><h2>{analysis.rating}</h2><span>{analysis.rating_detail}</span></div>
        <div className="metrics"><div className="metric revenue"><p>Projected monthly revenue</p><strong>{nzd(analysis.revenue_min)} – {nzd(analysis.revenue_max)}</strong><span>Range calculated from live location signals</span></div><div className="metric"><p>Central estimate</p><strong>{nzd(analysis.central_estimate)}</strong></div><div className="metric"><p>Break-even point</p><strong>{nzd(analysis.total_cost)}</strong></div><div className="metric"><p>Live competitors found</p><strong>{analysis.competitor_count}</strong></div></div>
        <div className="dashboard-grid"><div className="panel"><div className="section-heading"><div><h2>Real competitor map</h2><p>Blue markers are same-type businesses from OpenStreetMap.</p></div></div><SiteMap location={{ latitude: analysis.latitude, longitude: analysis.longitude }} competitors={analysis.competitors} /></div>
          <div className="panel chart-panel"><h2>Monthly cost allocation</h2><p className="sr-only">Cost allocation: {chartData.map((item) => `${item.name} ${nzd(item.value)}`).join(", ")}.</p><div aria-hidden="true"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={104} paddingAngle={3}>{chartData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><ChartTooltip formatter={(value) => nzd(value)} contentStyle={{ borderColor: "#93C5FD", borderRadius: 0 }} /></PieChart></ResponsiveContainer></div><table className="data-table"><caption>Monthly cost allocation</caption><tbody>{chartData.map((item) => <tr key={item.name}><th scope="row">{item.name}</th><td>{nzd(item.value)}</td></tr>)}</tbody></table></div>
        </div>
        <div className="bottom-panels"><div className="panel projection-panel"><h2>12-month profit projection</h2><p>Revenue ramps up over the first four months, then follows the model’s seasonal assumptions.</p><div aria-hidden="true"><ResponsiveContainer width="100%" height={300}><BarChart data={projectionData} margin={{ top: 15, right: 8, left: 10, bottom: 0 }}><CartesianGrid stroke="#C7D2FE" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" stroke="#64748B" tick={{ fill: "#475569" }} /><YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} width={48} stroke="#64748B" tick={{ fill: "#475569" }} /><ChartTooltip formatter={(value) => nzd(value)} contentStyle={{ borderColor: "#99F6E4", borderRadius: 0 }} /><Bar dataKey="profit" name="Monthly profit">{projectionData.map((item) => <Cell key={item.month} fill={item.fill} />)}</Bar></BarChart></ResponsiveContainer></div><table className="data-table projection-table"><caption>12-month revenue and profit projection</caption><thead><tr><th>Month</th><th>Revenue</th><th>Profit</th></tr></thead><tbody>{analysis.profit_projection.map((item) => <tr key={item.month}><th scope="row">Month {item.month}</th><td>{nzd(item.revenue)}</td><td>{nzd(item.profit)}</td></tr>)}</tbody></table></div>
          <div className="panel details-panel"><h2>Financial summary</h2><div className="details-table">{details.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><details className="assumptions"><summary>Method & assumptions</summary><dl><div><dt>Rent source</dt><dd>{analysis.rent_source === "manual" ? "Manual monthly rent" : "Location-based estimate"}</dd></div>{rentAssumptions.manual_monthly_rent != null && <div><dt>Manual monthly rent</dt><dd>{nzd(rentAssumptions.manual_monthly_rent)}</dd></div>}{rentAssumptions.estimated_monthly_rent != null && <div><dt>Modelled monthly rent</dt><dd>{nzd(rentAssumptions.estimated_monthly_rent)}</dd></div>}{rentAssumptions.distance_to_cbd_km != null && <div><dt>Distance to Auckland CBD</dt><dd>{Number(rentAssumptions.distance_to_cbd_km).toFixed(1)} km</dd></div>}{rentAssumptions.assumed_floor_area_sqm != null && <div><dt>Typical floor area</dt><dd>{Number(rentAssumptions.assumed_floor_area_sqm).toLocaleString()} sqm</dd></div>}{rentAssumptions.annual_rent_per_sqm != null && <div><dt>Annual rent benchmark</dt><dd>{nzd(rentAssumptions.annual_rent_per_sqm)} / sqm</dd></div>}<div><dt>Revenue model</dt><dd>Industry benchmark blended with staffing capacity, live competitor proximity, and cluster signals.</dd></div></dl></details><p className="disclaimer"><Info size={16} /> Live business data comes from OpenStreetMap via Overpass. Results are screening estimates, not financial advice.</p></div>
        </div>
      </section>
    </main>
  );
}

function App() {
  const [analysis, setAnalysis] = useState(null);
  return analysis ? <Result analysis={analysis} onRestart={() => setAnalysis(null)} /> : <Configuration onAnalysis={setAnalysis} />;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
