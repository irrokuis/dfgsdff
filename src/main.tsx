import { useState } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import type { AnalysisResponse } from "./api/generated";
import { analyseScenario } from "./api/client";
import { ForecastResult } from "./ForecastResult";
import { ScenarioEditor } from "./ScenarioEditor";
import { defaultScenario, toAnalysisRequest, type LocationSelection, type ScenarioFormValues, validateScenario } from "./scenario";

function App() {
  const [values, setValues] = useState<ScenarioFormValues>(defaultScenario);
  const [location, setLocation] = useState<LocationSelection>({ kind: "unselected" });
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  async function run() {
    const nextErrors = validateScenario(location, values); setErrors(nextErrors); setRequestError(null);
    const request = toAnalysisRequest(location, values);
    if (!request) return;
    setIsLoading(true);
    try { setAnalysis(await analyseScenario(request)); } catch (error) { setRequestError(error instanceof Error ? error.message : "The analysis service could not be reached."); } finally { setIsLoading(false); }
  }
  if (analysis) return <ForecastResult analysis={analysis} location={location} onRestart={() => setAnalysis(null)} />;
  return <ScenarioEditor values={values} setValues={setValues} location={location} setLocation={setLocation} errors={errors} requestError={requestError} isLoading={isLoading} onRun={run} />;
}
createRoot(document.getElementById("root")!).render(<App />);
