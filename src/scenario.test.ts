import { describe, expect, it } from "vitest";
import { defaultScenario, toAnalysisRequest, validateScenario } from "./scenario";

describe("scenario validation", () => {
  it("requires a selected address or map point", () => {
    const location = { kind: "unselected" } as const;
    expect(validateScenario(location, defaultScenario).location).toContain("address or select a point");
    expect(toAnalysisRequest(location, defaultScenario)).toBeNull();
  });
  it("serializes a map-selected location with the future mode", () => {
    const request = toAnalysisRequest({ kind: "map", latitude: -36.8485, longitude: 174.7633, displayName: "Map-selected site" }, { ...defaultScenario, scenarioMode: "optimistic" });
    expect(request?.scenario_mode).toBe("optimistic");
    expect(request?.rent_override).toBeNull();
  });
});
