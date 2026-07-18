import type { AnalysisRequest, AnalysisResponse, LocationResult } from "./generated";

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { detail?: string | { message?: string } } | null;
  if (typeof body?.detail === "string") return body.detail;
  if (body?.detail && typeof body.detail === "object" && typeof body.detail.message === "string") return body.detail.message;
  return `The analysis service returned an error (${response.status}).`;
}

export async function searchLocations(query: string, signal: AbortSignal): Promise<LocationResult[]> {
  const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<LocationResult[]>;
}

export async function analyseScenario(request: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch("/api/analyses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<AnalysisResponse>;
}
