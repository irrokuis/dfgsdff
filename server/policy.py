from __future__ import annotations

import math
from dataclasses import dataclass

from server.models import Competitor, ForecastDriver, ProjectionMonth, ScenarioMode, StoreType

AUCKLAND_CENTER = (-36.8485, 174.7633)
SEARCH_RADIUS_METERS = 1_500
MODEL_VERSION = "2026.07-open-data-v1"
INDUSTRY_BASE_REVENUE = {"Cafe": 40_000, "Convenience Store": 48_000, "Restaurant": 80_000, "Bakery": 36_000, "Pharmacy": 55_000, "Gym": 70_000}
OSM_TAG_FILTERS = {"Cafe": ['["amenity"="cafe"]'], "Convenience Store": ['["shop"="convenience"]'], "Restaurant": ['["amenity"="restaurant"]'], "Bakery": ['["shop"="bakery"]'], "Pharmacy": ['["amenity"="pharmacy"]'], "Gym": ['["leisure"="fitness_centre"]', '["amenity"="gym"]']}
ASSUMED_FLOOR_AREA_SQM = {"Cafe": 80, "Convenience Store": 120, "Restaurant": 160, "Bakery": 70, "Pharmacy": 110, "Gym": 320}
TRANSACTIONS_PER_STAFF_HOUR = {"Cafe": 6, "Convenience Store": 10, "Restaurant": 4, "Bakery": 8, "Pharmacy": 5}
SEASONAL_MULTIPLIER_BY_CALENDAR_MONTH = [1.10, 1.05, 1.00, .98, .92, .85, .85, .88, .95, 1.00, 1.05, 1.15]


@dataclass(frozen=True)
class ModelAssumptions:
    source: str = "OpenStreetMap/Overpass live same-type businesses plus transparent Auckland screening heuristics"
    cbd_peak_rent_per_sqm_year: float = 850
    fringe_rent_per_sqm_year: float = 180
    rent_decay_km: float = 4.5
    operating_days_per_month: int = 26
    ramp_start_factor: float = .55
    ramp_up_months: int = 4


ASSUMPTIONS = ModelAssumptions()
SCENARIO_MULTIPLIERS = {"conservative": .85, "base": 1.0, "optimistic": 1.15}


def haversine_distance_meters(lat_1: float, lon_1: float, lat_2: float, lon_2: float) -> float:
    delta_lat, delta_lon = math.radians(lat_2 - lat_1), math.radians(lon_2 - lon_1)
    a_value = math.sin(delta_lat / 2) ** 2 + math.cos(math.radians(lat_1)) * math.cos(math.radians(lat_2)) * math.sin(delta_lon / 2) ** 2
    return 6_371_000 * 2 * math.atan2(math.sqrt(a_value), math.sqrt(1 - a_value))


def estimate_commercial_rent_details(latitude: float, longitude: float, store_type: StoreType) -> dict[str, float]:
    distance_km = haversine_distance_meters(latitude, longitude, *AUCKLAND_CENTER) / 1_000
    annual = ASSUMPTIONS.fringe_rent_per_sqm_year + (ASSUMPTIONS.cbd_peak_rent_per_sqm_year - ASSUMPTIONS.fringe_rent_per_sqm_year) * math.exp(-distance_km / ASSUMPTIONS.rent_decay_km)
    floor_area = float(ASSUMED_FLOOR_AREA_SQM[store_type])
    return {"distance_to_cbd_km": distance_km, "annual_rent_per_sqm": annual, "assumed_floor_area_sqm": floor_area, "estimated_monthly_rent": annual * floor_area / 12}


def estimate_revenue_capacity(store_type: StoreType, staff_count: int, hours_of_work: float, avg_sale_price: float) -> float:
    if store_type == "Gym":
        return staff_count * (hours_of_work / 10) * 120 * avg_sale_price
    return staff_count * hours_of_work * ASSUMPTIONS.operating_days_per_month * TRANSACTIONS_PER_STAFF_HOUR[store_type] * avg_sale_price


def build_overpass_query(store_type: StoreType, latitude: float, longitude: float) -> str:
    clauses = "\n".join(f"  nwr{filter_}(around:{SEARCH_RADIUS_METERS},{latitude:.6f},{longitude:.6f});" for filter_ in OSM_TAG_FILTERS[store_type])
    return f"[out:json][timeout:25];(\n{clauses}\n);out center tags;"


def calculate_projection(central_estimate: float, total_cost: float) -> list[ProjectionMonth]:
    projection: list[ProjectionMonth] = []
    for month in range(1, 13):
        ramp = ASSUMPTIONS.ramp_start_factor + (1 - ASSUMPTIONS.ramp_start_factor) * ((month - 1) / (ASSUMPTIONS.ramp_up_months - 1)) if month < ASSUMPTIONS.ramp_up_months else 1.0
        revenue = central_estimate * ramp * SEASONAL_MULTIPLIER_BY_CALENDAR_MONTH[month - 1]
        projection.append(ProjectionMonth(month=month, revenue=revenue, profit=revenue - total_cost))
    return projection


def forecast_drivers(competitors: list[Competitor], multiplier: float, scenario_mode: ScenarioMode) -> list[ForecastDriver]:
    nearest = competitors[0].distance_m if competitors else None
    competition = "No same-type competitor was found in the search radius." if nearest is None else f"{len(competitors)} same-type businesses found; nearest is {round(nearest)} m away."
    return [ForecastDriver(label="Future demand scenario", effect=f"{scenario_mode.title()} demand", detail=f"Revenue is adjusted by {SCENARIO_MULTIPLIERS[scenario_mode]:.0%} for this future view."), ForecastDriver(label="Competition signal", effect=f"{multiplier:.0%} revenue retention", detail=competition), ForecastDriver(label="Open-data confidence", effect="Screening estimate", detail="Use this forecast to shortlist sites, then validate demand, lease terms, and fit-out costs.")]
