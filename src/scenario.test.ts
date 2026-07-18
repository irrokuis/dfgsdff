import { describe, expect, it } from "vitest";
import { defaultScenario, toAnalysisRequest, validateScenario } from "./scenario";

describe("scenario validation", () => {
  it("does not turn partial coordinates into a location", () => {
    const location = { kind: "unselected" } as const;
    expect(validateScenario(location, defaultScenario).location).toContain("both coordinates");
    expect(toAnalysisRequest(location, defaultScenario)).toBeNull();
  });
  it("serializes a complete manual location with the future mode", () => {
    const request = toAnalysisRequest({ kind: "manual", latitude: -36.8485, longitude: 174.7633, displayName: "Manual" }, { ...defaultScenario, scenarioMode: "optimistic" });
    expect(request?.scenario_mode).toBe("optimistic");
    expect(request?.rent_override).toBeNull();
  });
});
