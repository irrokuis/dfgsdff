from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

StoreType = Literal["Cafe", "Convenience Store", "Restaurant", "Bakery", "Pharmacy", "Gym"]
ScenarioMode = Literal["base", "conservative", "optimistic"]


class AnalysisRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    store_type: StoreType
    avg_sale_price: float = Field(ge=0, le=5_000)
    staff_count: int = Field(ge=1, le=100)
    monthly_wage: float = Field(ge=0, le=50_000)
    hours_of_work: float = Field(ge=1, le=24)
    cost_of_goods_pct: float = Field(ge=0, le=100)
    extra_cost: float = Field(ge=0, le=200_000)
    rent_override: float | None = Field(default=None, ge=0, le=200_000)
    scenario_mode: ScenarioMode = "base"


class LocationResult(BaseModel):
    display_name: str
    latitude: float
    longitude: float


class Competitor(BaseModel):
    id: str
    name: str
    kind: str
    latitude: float
    longitude: float
    distance_m: float


class RentAssumptions(BaseModel):
    distance_to_cbd_km: float
    annual_rent_per_sqm: float
    assumed_floor_area_sqm: float
    estimated_monthly_rent: float
    manual_monthly_rent: float | None = None


class ProjectionMonth(BaseModel):
    month: int
    revenue: float
    profit: float


class ForecastDriver(BaseModel):
    label: str
    effect: str
    detail: str


class DataFreshness(BaseModel):
    source: str
    fetched_at: datetime
    cache_status: Literal["live", "fresh_cache", "stale_cache"]
    expires_at: datetime


class AnalysisResponse(BaseModel):
    latitude: float
    longitude: float
    store_type: StoreType
    scenario_mode: ScenarioMode
    model_version: str
    avg_sale_price: float
    staff_count: int
    monthly_wage: float
    hours_of_work: float
    cost_of_goods_pct: float
    labor_cost: float
    cost_of_goods_cost: float
    rent_cost: float
    extra_cost: float
    total_cost: float
    industry_base_revenue: float
    capacity_revenue: float
    base_revenue: float
    competitors: list[Competitor]
    rent_source: Literal["estimated", "manual"]
    rent_assumptions: RentAssumptions
    competitor_count: int
    nearest_distance: float | None
    cannibalization_multiplier: float
    foot_traffic_multiplier: float
    revenue_min: float
    central_estimate: float
    revenue_max: float
    twenty_percent_buffer: float
    rating: str
    rating_color: str
    rating_detail: str
    rating_reasons: list[str]
    forecast_drivers: list[ForecastDriver]
    assumptions_summary: str
    data_freshness: DataFreshness
    profit_projection: list[ProjectionMonth]
