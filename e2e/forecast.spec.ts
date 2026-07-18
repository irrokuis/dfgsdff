import { expect, test } from "@playwright/test";

test("runs a future forecast with mocked open-data results", async ({ page }) => {
  await page.route("**/api/analyses", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({
    latitude: -36.8485, longitude: 174.7633, store_type: "Cafe", scenario_mode: "base", model_version: "test-v1", avg_sale_price: 15, staff_count: 3, monthly_wage: 4500, hours_of_work: 10, cost_of_goods_pct: 30, labor_cost: 13500, cost_of_goods_cost: 9000, rent_cost: 5000, extra_cost: 1000, total_cost: 28500, industry_base_revenue: 40000, capacity_revenue: 70200, base_revenue: 55100, competitors: [], rent_source: "estimated", rent_assumptions: { distance_to_cbd_km: 0, annual_rent_per_sqm: 850, assumed_floor_area_sqm: 80, estimated_monthly_rent: 5000, manual_monthly_rent: null }, competitor_count: 0, nearest_distance: null, cannibalization_multiplier: 1, foot_traffic_multiplier: 1, revenue_min: 42000, central_estimate: 50000, revenue_max: 57000, twenty_percent_buffer: 34200, rating: "Highly Recommended", rating_color: "#087f5b", rating_detail: "Forecast clears the buffer.", rating_reasons: ["Forecast clears the buffer."], forecast_drivers: [{ label: "Future demand scenario", effect: "Base demand", detail: "Test driver" }], assumptions_summary: "Test assumptions", data_freshness: { source: "OpenStreetMap via Overpass", fetched_at: "2026-07-18T00:00:00Z", cache_status: "live", expires_at: "2026-07-18T00:10:00Z" }, profit_projection: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, revenue: 50000, profit: 21500 }))
  }) }));
  await page.goto("/");
  await page.getByLabel("Latitude").fill("-36.8485");
  await page.getByLabel("Longitude").fill("174.7633");
  await page.getByRole("button", { name: "Run Future Forecast" }).click();
  await expect(page.getByText("FUTURE VIABILITY FORECAST")).toBeVisible();
  await expect(page.getByText("Why this future view?")).toBeVisible();
});
