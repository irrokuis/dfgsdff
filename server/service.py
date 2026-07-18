from __future__ import annotations

from server.models import AnalysisRequest, AnalysisResponse, RentAssumptions
from server.policy import ASSUMPTIONS, INDUSTRY_BASE_REVENUE, MODEL_VERSION, SCENARIO_MULTIPLIERS, calculate_projection, estimate_commercial_rent_details, estimate_revenue_capacity, forecast_drivers
from server.providers import OpenDataProvider


class AnalysisService:
    def __init__(self, provider: OpenDataProvider) -> None:
        self.provider = provider

    def analyse(self, request: AnalysisRequest) -> AnalysisResponse:
        competitors, freshness = self.provider.competitors(request.latitude, request.longitude, request.store_type)
        rent_values = estimate_commercial_rent_details(request.latitude, request.longitude, request.store_type)
        rent_source = "manual" if request.rent_override is not None else "estimated"
        rent_cost = request.rent_override if request.rent_override is not None else rent_values["estimated_monthly_rent"]
        rent = RentAssumptions(**rent_values, manual_monthly_rent=request.rent_override)
        capacity = estimate_revenue_capacity(request.store_type, request.staff_count, request.hours_of_work, request.avg_sale_price)
        industry_base = float(INDUSTRY_BASE_REVENUE[request.store_type])
        base = (capacity + industry_base) / 2
        nearest = competitors[0].distance_m if competitors else None
        retention = 1.0 if nearest is None or nearest >= 500 else .90 if nearest >= 250 else .78 if nearest >= 100 else .60
        foot_traffic = 1 + min(.20, len(competitors) * .015)
        central = base * retention * foot_traffic * SCENARIO_MULTIPLIERS[request.scenario_mode]
        cost_of_goods = central * request.cost_of_goods_pct / 100
        total_cost = request.staff_count * request.monthly_wage + cost_of_goods + rent_cost + request.extra_cost
        minimum, maximum, buffer = central * .85, central * 1.15, total_cost * 1.20
        reasons: list[str] = []
        if minimum >= buffer:
            rating, color, detail = "Highly Recommended", "#087f5b", "The conservative forecast covers monthly costs and a 20% operating buffer."
            reasons.append("Even the conservative revenue range clears the operating buffer.")
        elif maximum < total_cost:
            rating, color, detail = "Not Recommended", "#c92a2a", "Even the optimistic forecast is below the monthly break-even point."
            reasons.append("The optimistic revenue range does not cover monthly costs.")
        elif maximum < buffer:
            rating, color, detail = "Risky - Cost Pressure", "#d97706", "The scenario may cover costs but does not reach a 20% operating buffer."
            reasons.append("The forecast does not retain a 20% operating buffer.")
        elif nearest is not None and nearest < 100:
            rating, color, detail = "Risky - High Competition", "#d97706", "The revenue range can be viable, but a same-type competitor is within 100 metres."
            reasons.append(f"A same-type competitor is only {round(nearest)} m away.")
        else:
            rating, color, detail = "Recommended with Conditions", "#2563eb", "The upside reaches the operating buffer; validate local demand before committing."
            reasons.append("The upside reaches the buffer, but demand validation remains necessary.")
        return AnalysisResponse(latitude=request.latitude, longitude=request.longitude, store_type=request.store_type, scenario_mode=request.scenario_mode, model_version=MODEL_VERSION, avg_sale_price=request.avg_sale_price, staff_count=request.staff_count, monthly_wage=request.monthly_wage, hours_of_work=request.hours_of_work, cost_of_goods_pct=request.cost_of_goods_pct, labor_cost=request.staff_count * request.monthly_wage, cost_of_goods_cost=cost_of_goods, rent_cost=rent_cost, extra_cost=request.extra_cost, total_cost=total_cost, industry_base_revenue=industry_base, capacity_revenue=capacity, base_revenue=base, competitors=competitors, rent_source=rent_source, rent_assumptions=rent, competitor_count=len(competitors), nearest_distance=nearest, cannibalization_multiplier=retention, foot_traffic_multiplier=foot_traffic, revenue_min=minimum, central_estimate=central, revenue_max=maximum, twenty_percent_buffer=buffer, rating=rating, rating_color=color, rating_detail=detail, rating_reasons=reasons, forecast_drivers=forecast_drivers(competitors, retention, request.scenario_mode), assumptions_summary=ASSUMPTIONS.source, data_freshness=freshness, profit_projection=calculate_projection(central, total_cost))
