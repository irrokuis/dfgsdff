import type { AnalysisRequest, ScenarioMode, StoreType } from "./api/generated";

export type LocationSelection = { kind: "unselected" } | { kind: "address" | "map"; latitude: number; longitude: number; displayName: string };
export interface ScenarioFormValues { storeType: StoreType; scenarioMode: ScenarioMode; avgSalePrice: string; staffCount: string; monthlyWage: string; hoursOfWork: string; costOfGoodsPct: string; extraCost: string; rentOverride: string }
export const defaultScenario: ScenarioFormValues = { storeType: "Cafe", scenarioMode: "base", avgSalePrice: "15", staffCount: "3", monthlyWage: "4500", hoursOfWork: "10", costOfGoodsPct: "30", extraCost: "1000", rentOverride: "" };

function numberInRange(value: string, min: number, max: number, integer = false): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max && (!integer || Number.isInteger(parsed)) ? parsed : null;
}

export function validateScenario(location: LocationSelection, values: ScenarioFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (location.kind === "unselected") errors.location = "Choose an address or select a point on the map.";
  if (numberInRange(values.avgSalePrice, 0, 5_000) === null) errors.avgSalePrice = "Enter an amount between 0 and 5,000.";
  if (numberInRange(values.staffCount, 1, 100, true) === null) errors.staffCount = "Enter a whole number between 1 and 100.";
  if (numberInRange(values.monthlyWage, 0, 50_000) === null) errors.monthlyWage = "Enter an amount between 0 and 50,000.";
  if (numberInRange(values.hoursOfWork, 1, 24) === null) errors.hoursOfWork = "Enter hours between 1 and 24.";
  if (numberInRange(values.costOfGoodsPct, 0, 100) === null) errors.costOfGoodsPct = "Enter a percentage between 0 and 100.";
  if (numberInRange(values.extraCost, 0, 200_000) === null) errors.extraCost = "Enter an amount between 0 and 200,000.";
  if (values.rentOverride.trim() !== "" && numberInRange(values.rentOverride, 0, 200_000) === null) errors.rentOverride = "Enter an amount between 0 and 200,000.";
  return errors;
}

export function toAnalysisRequest(location: LocationSelection, values: ScenarioFormValues): AnalysisRequest | null {
  if (location.kind === "unselected" || Object.keys(validateScenario(location, values)).length) return null;
  return { latitude: location.latitude, longitude: location.longitude, store_type: values.storeType, avg_sale_price: Number(values.avgSalePrice), staff_count: Number(values.staffCount), monthly_wage: Number(values.monthlyWage), hours_of_work: Number(values.hoursOfWork), cost_of_goods_pct: Number(values.costOfGoodsPct), extra_cost: Number(values.extraCost), rent_override: values.rentOverride.trim() === "" ? null : Number(values.rentOverride), scenario_mode: values.scenarioMode };
}
