import { useEffect, useState } from "react";
import { Activity, AlertCircle, Info, Loader2, MapPin, Search } from "lucide-react";
import type { LocationResult } from "./api/generated";
import { searchLocations } from "./api/client";
import type { LocationSelection, ScenarioFormValues } from "./scenario";
import { SiteMap } from "./SiteMap";

const storeTypes = ["Cafe", "Convenience Store", "Restaurant", "Bakery", "Pharmacy", "Gym"] as const;
function Field({ label, value, onChange, error, optional = false, min = 0, step = "any" }: { label: string; value: string; onChange: (value: string) => void; error?: string; optional?: boolean; min?: number; step?: number | "any" }) {
  return <label className="field"><span>{label}{optional && " (optional)"}</span><input type="number" min={min} step={step} value={value} onChange={event => onChange(event.target.value)} aria-invalid={Boolean(error)} /> <small className={error ? "field-error" : "field-hint"}>{error ?? (optional ? "Leave blank to use the modelled estimate." : "Required")}</small></label>;
}

export function ScenarioEditor({ values, setValues, location, setLocation, errors, requestError, isLoading, onRun }: { values: ScenarioFormValues; setValues: (values: ScenarioFormValues) => void; location: LocationSelection; setLocation: (location: LocationSelection) => void; errors: Record<string, string>; requestError: string | null; isLoading: boolean; onRun: () => void }) {
  const [search, setSearch] = useState(""); const [results, setResults] = useState<LocationResult[]>([]); const [searchMessage, setSearchMessage] = useState("");
  useEffect(() => { if (search.trim().length < 3) { setResults([]); return; } const controller = new AbortController(); const timer = window.setTimeout(() => searchLocations(search.trim(), controller.signal).then(items => { setResults(items); setSearchMessage(items.length ? "" : "No Auckland matches found."); }).catch(error => { if (error.name !== "AbortError") setSearchMessage("Address search is unavailable. Select a point on the map instead."); }), 350); return () => { controller.abort(); window.clearTimeout(timer); }; }, [search]);
  const update = <K extends keyof ScenarioFormValues>(key: K, value: ScenarioFormValues[K]) => setValues({ ...values, [key]: value });
  return <form className="app-shell" onSubmit={event => { event.preventDefault(); onRun(); }}>
    <aside className="sidebar"><div className="brand"><div className="brand-icon"><Activity size={20} /></div><div><p>LOCATION INTELLIGENCE</p><h2>Site Feasibility</h2></div></div><div className="sidebar-content"><h3>Future scenario</h3>
      <label className="field"><span>Target store type</span><select value={values.storeType} onChange={event => update("storeType", event.target.value as ScenarioFormValues["storeType"])}>{storeTypes.map(type => <option key={type}>{type}</option>)}</select></label>
      <label className="field"><span>Future demand view</span><select value={values.scenarioMode} onChange={event => update("scenarioMode", event.target.value as ScenarioFormValues["scenarioMode"])}><option value="conservative">Conservative future</option><option value="base">Base future</option><option value="optimistic">Optimistic future</option></select><small className="field-hint">Shows how the same site performs under different future demand conditions.</small></label>
      <Field label={values.storeType === "Gym" ? "Monthly membership revenue per customer (NZD)" : "Average sale price per customer (NZD)"} value={values.avgSalePrice} onChange={value => update("avgSalePrice", value)} error={errors.avgSalePrice} step={.5} />
      <Field label="Staff count" value={values.staffCount} onChange={value => update("staffCount", value)} error={errors.staffCount} min={1} step={1} />
      <Field label="Monthly wage per staff member (NZD)" value={values.monthlyWage} onChange={value => update("monthlyWage", value)} error={errors.monthlyWage} step={100} />
      <Field label="Hours of operation per day" value={values.hoursOfWork} onChange={value => update("hoursOfWork", value)} error={errors.hoursOfWork} min={1} step={.5} />
      <Field label="Cost of goods (% of revenue)" value={values.costOfGoodsPct} onChange={value => update("costOfGoodsPct", value)} error={errors.costOfGoodsPct} step={1} />
      <Field label="Extra monthly costs (NZD)" value={values.extraCost} onChange={value => update("extraCost", value)} error={errors.extraCost} step={100} />
      <Field label="Manual monthly rent (NZD)" value={values.rentOverride} onChange={value => update("rentOverride", value)} error={errors.rentOverride} optional step={100} />
    </div><button className="primary-button" disabled={isLoading} type="submit">{isLoading ? <><Loader2 size={18} className="animate-spin" /> Forecasting future…</> : <><Activity size={18} /> Run Future Forecast</>}</button></aside>
    <section className="workspace"><header><p className="eyebrow">BACK TO THE FUTURE · AUCKLAND</p><h1>Commercial Site Feasibility</h1><p className="subtitle">Use today’s live location signals to forecast tomorrow’s best business site.</p></header><div className="map-section"><div className="section-heading"><div><h2>Choose a future site</h2><p>Search an Auckland address or click the map.</p></div>{location.kind !== "unselected" && <div className="selected-location-card"><MapPin size={16} /><div><span>Forecasting</span><strong>{location.displayName}</strong></div></div>}</div>
      <section className="location-controls"><label className="field"><span>Search Auckland address</span><div className="search-input"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="e.g. 123 Queen Street" /></div>{searchMessage && <small className="field-error">{searchMessage}</small>}</label>{results.length > 0 && <ul className="location-results">{results.map(result => <li key={`${result.latitude}-${result.longitude}`}><button type="button" onClick={() => { setLocation({ kind: "address", latitude: result.latitude, longitude: result.longitude, displayName: result.display_name }); setResults([]); setSearch(result.display_name); }}>{result.display_name}</button></li>)}</ul>}</section>
      <SiteMap location={location} onSelect={setLocation} />
      {(errors.location || requestError) && <div className="alert error" role="alert"><AlertCircle size={20} /><div><strong>Forecast not run</strong><br />{errors.location ?? requestError}</div></div>}
      <p className="map-note"><Info size={16} /> Live same-type competitors are used for a 1.5 km Auckland screening forecast. Results are decision support, not financial advice.</p>
    </div></section>
  </form>;
}
