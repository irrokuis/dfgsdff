"""FastAPI service and feasibility calculations for commercial site screening."""

from __future__ import annotations

import math
from typing import Annotated, Any, Literal

import requests
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from requests.exceptions import RequestException


AUCKLAND_CENTER = (-36.8485, 174.7633)
SEARCH_RADIUS_METERS = 1_500
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
SERVICE_USER_AGENT = "CommercialSiteFeasibilityAPI/1.1 (educational demo)"

# These mock baselines are monthly gross revenue benchmarks in NZD.
INDUSTRY_BASE_REVENUE = {
    "Cafe": 40_000,
    "Convenience Store": 48_000,
    "Restaurant": 80_000,
    "Bakery": 36_000,
    "Pharmacy": 55_000,
    "Gym": 70_000,
}

# Every item is an Overpass QL tag filter for the selected business category.
OSM_TAG_FILTERS = {
    "Cafe": ['["amenity"="cafe"]'],
    "Convenience Store": ['["shop"="convenience"]'],
    "Restaurant": ['["amenity"="restaurant"]'],
    "Bakery": ['["shop"="bakery"]'],
    "Pharmacy": ['["amenity"="pharmacy"]'],
    "Gym": ['["leisure"="fitness_centre"]', '["amenity"="gym"]'],
}

# Commercial rent benchmarks: CBD-core and fringe annual NZD/sqm rates plus the
# assumed floor area per store type, used to estimate rent instead of asking for it.
CBD_PEAK_RENT_PER_SQM_YEAR = 850
FRINGE_RENT_PER_SQM_YEAR = 180
RENT_DECAY_KM = 4.5

ASSUMED_FLOOR_AREA_SQM = {
    "Cafe": 80,
    "Convenience Store": 120,
    "Restaurant": 160,
    "Bakery": 70,
    "Pharmacy": 110,
    "Gym": 320,
}

# Assumed customer throughput per staff member per hour, used with staff count,
# hours of work, and average sale price to estimate revenue capacity.
TRANSACTIONS_PER_STAFF_HOUR = {
    "Cafe": 6,
    "Convenience Store": 10,
    "Restaurant": 4,
    "Bakery": 8,
    "Pharmacy": 5,
}
OPERATING_DAYS_PER_MONTH = 26

# Gyms run on recurring memberships rather than per-visit transactions, so their
# capacity is modeled as staff-supportable members rather than hourly throughput.
SUBSCRIPTION_STORE_TYPES = {"Gym"}
GYM_MEMBERS_PER_STAFF = 120
BASELINE_HOURS_OF_WORK = 10

# New sites rarely open at full demand; revenue ramps from a reduced share of the
# estimate up to 100% over the first few months, then holds steady.
RAMP_UP_MONTHS = 4
RAMP_START_FACTOR = 0.55

# Generic NZ retail/hospitality seasonality (Jan-Dec), applied assuming month 1
# of the projection is January: summer and Christmas peaks, winter trough.
SEASONAL_MULTIPLIER_BY_CALENDAR_MONTH = [1.10, 1.05, 1.00, 0.98, 0.92, 0.85, 0.85, 0.88, 0.95, 1.00, 1.05, 1.15]

StoreType = Literal["Cafe", "Convenience Store", "Restaurant", "Bakery", "Pharmacy", "Gym"]


class AnalysisRequest(BaseModel):
    """Validated inputs supplied by the Vite client for one site analysis."""

    latitude: Annotated[float, Field(ge=-90, le=90)]
    longitude: Annotated[float, Field(ge=-180, le=180)]
    store_type: StoreType
    avg_sale_price: Annotated[float, Field(ge=0, le=5_000)]
    staff_count: Annotated[int, Field(ge=1, le=100)]
    monthly_wage: Annotated[float, Field(ge=0, le=50_000)]
    hours_of_work: Annotated[float, Field(ge=1, le=24)]
    cost_of_goods_pct: Annotated[float, Field(ge=0, le=100)]
    extra_cost: Annotated[float, Field(ge=0, le=200_000)]
    rent_override: Annotated[float | None, Field(default=None, ge=0, le=200_000)] = None


app = FastAPI(title="Commercial Site Feasibility API", version="1.0.0")


def haversine_distance_meters(lat_1: float, lon_1: float, lat_2: float, lon_2: float) -> float:
    """Calculate the great-circle distance between two WGS84 coordinates."""
    earth_radius_meters = 6_371_000
    lat_1_rad, lat_2_rad = math.radians(lat_1), math.radians(lat_2)
    delta_lat = math.radians(lat_2 - lat_1)
    delta_lon = math.radians(lon_2 - lon_1)
    a_value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_1_rad) * math.cos(lat_2_rad) * math.sin(delta_lon / 2) ** 2
    )
    return earth_radius_meters * 2 * math.atan2(math.sqrt(a_value), math.sqrt(1 - a_value))


def estimate_commercial_rent_details(latitude: float, longitude: float, store_type: str) -> dict[str, float]:
    """Estimate monthly commercial rent from CBD distance decay and store floor-area benchmarks."""
    distance_km = haversine_distance_meters(latitude, longitude, *AUCKLAND_CENTER) / 1_000
    rent_per_sqm_year = FRINGE_RENT_PER_SQM_YEAR + (
        CBD_PEAK_RENT_PER_SQM_YEAR - FRINGE_RENT_PER_SQM_YEAR
    ) * math.exp(-distance_km / RENT_DECAY_KM)
    floor_area_sqm = float(ASSUMED_FLOOR_AREA_SQM[store_type])
    return {
        "distance_to_cbd_km": distance_km,
        "annual_rent_per_sqm": rent_per_sqm_year,
        "assumed_floor_area_sqm": floor_area_sqm,
        "estimated_monthly_rent": rent_per_sqm_year * floor_area_sqm / 12,
    }


def estimate_commercial_rent(latitude: float, longitude: float, store_type: str) -> float:
    """Return the estimated monthly rent for callers that only need the value."""
    return estimate_commercial_rent_details(latitude, longitude, store_type)["estimated_monthly_rent"]


def estimate_revenue_capacity(store_type: str, staff_count: int, hours_of_work: float, avg_sale_price: float) -> float:
    """Estimate monthly revenue capacity from staffing throughput and average sale price."""
    if store_type in SUBSCRIPTION_STORE_TYPES:
        # avg_sale_price is the estimated monthly revenue per customer (e.g. a membership fee).
        return staff_count * (hours_of_work / BASELINE_HOURS_OF_WORK) * GYM_MEMBERS_PER_STAFF * avg_sale_price
    return (
        staff_count
        * hours_of_work
        * OPERATING_DAYS_PER_MONTH
        * TRANSACTIONS_PER_STAFF_HOUR[store_type]
        * avg_sale_price
    )


def build_overpass_query(store_type: str, latitude: float, longitude: float) -> str:
    """Build a bounded Overpass QL query for nodes, ways, and relations."""
    clauses = "\n".join(
        f'  nwr{tag_filter}(around:{SEARCH_RADIUS_METERS},{latitude:.6f},{longitude:.6f});'
        for tag_filter in OSM_TAG_FILTERS[store_type]
    )
    return f"""
    [out:json][timeout:25];
    (
    {clauses}
    );
    out center tags;
    """


def parse_overpass_elements(elements: list[dict[str, Any]], latitude: float, longitude: float) -> list[dict[str, Any]]:
    """Normalize Overpass nodes and centered ways/relations into map-ready records."""
    competitors: list[dict[str, Any]] = []
    seen_ids: set[tuple[str, int]] = set()

    for element in elements:
        element_id = (str(element.get("type", "unknown")), int(element.get("id", -1)))
        if element_id in seen_ids:
            continue
        seen_ids.add(element_id)

        # Nodes carry lat/lon directly. Ways and relations use the requested center field.
        point_lat = element.get("lat")
        point_lon = element.get("lon")
        if point_lat is None or point_lon is None:
            center = element.get("center", {})
            point_lat = center.get("lat")
            point_lon = center.get("lon")
        if point_lat is None or point_lon is None:
            continue

        tags = element.get("tags", {})
        business_kind = tags.get("amenity") or tags.get("shop") or tags.get("leisure") or "business"
        competitors.append(
            {
                "id": f"{element_id[0]}/{element_id[1]}",
                "name": tags.get("name", "Unnamed business"),
                "kind": business_kind.replace("_", " ").title(),
                "latitude": float(point_lat),
                "longitude": float(point_lon),
                "distance_m": haversine_distance_meters(latitude, longitude, float(point_lat), float(point_lon)),
            }
        )

    return sorted(competitors, key=lambda item: float(item["distance_m"]))


def fetch_competitors(latitude: float, longitude: float, store_type: str) -> tuple[list[dict[str, Any]], str | None]:
    """Fetch real local competitors from Overpass and return a user-safe error on failure."""
    query = build_overpass_query(store_type, latitude, longitude)
    headers = {"User-Agent": SERVICE_USER_AGENT}

    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            headers=headers,
            timeout=40,
        )
        response.raise_for_status()
        payload = response.json()
        elements = payload.get("elements", [])
        if not isinstance(elements, list):
            return [], "The live competitor service returned an unexpected response."
        return parse_overpass_elements(elements, latitude, longitude), None
    except requests.JSONDecodeError:
        return [], "The live competitor service returned an unreadable response."
    except RequestException as error:
        return [], f"Live competitor data could not be fetched ({error.__class__.__name__})."


def search_locations(query: str) -> list[dict[str, float | str]]:
    """Return a compact, Auckland-biased list of Nominatim address candidates."""
    response = requests.get(
        NOMINATIM_URL,
        params={
            "q": query,
            "format": "jsonv2",
            "limit": 5,
            "countrycodes": "nz",
            # This viewbox biases results toward Auckland without excluding nearby valid matches.
            "viewbox": "174.55,-36.65,175.10,-37.10",
            "bounded": 0,
            "accept-language": "en",
        },
        headers={"User-Agent": SERVICE_USER_AGENT},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        raise ValueError("Nominatim returned an unexpected payload")

    locations: list[dict[str, float | str]] = []
    for item in payload:
        try:
            display_name = str(item["display_name"])
            latitude = float(item["lat"])
            longitude = float(item["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if -90 <= latitude <= 90 and -180 <= longitude <= 180:
            locations.append(
                {"display_name": display_name, "latitude": latitude, "longitude": longitude}
            )
    return locations


def calculate_analysis(
    latitude: float,
    longitude: float,
    store_type: str,
    avg_sale_price: float,
    staff_count: int,
    monthly_wage: float,
    hours_of_work: float,
    cost_of_goods_pct: float,
    extra_cost: float,
    rent_cost: float,
    competitors: list[dict[str, Any]],
    rent_source: Literal["estimated", "manual"],
    rent_assumptions: dict[str, float | str],
) -> dict[str, Any]:
    """Calculate break-even, spatial adjustments, range, and feasibility rating."""
    industry_base_revenue = float(INDUSTRY_BASE_REVENUE[store_type])
    capacity_revenue = estimate_revenue_capacity(store_type, staff_count, hours_of_work, avg_sale_price)
    # Blend the industry benchmark with the staffing/sale-price-driven capacity estimate.
    base_revenue = (industry_base_revenue + capacity_revenue) / 2

    distances = [float(item["distance_m"]) for item in competitors]
    nearest_distance = min(distances) if distances else None

    # Very close peers cause a stronger cannibalization effect than distant peers.
    if nearest_distance is None or nearest_distance >= 500:
        cannibalization_multiplier = 1.00
    elif nearest_distance >= 250:
        cannibalization_multiplier = 0.90
    elif nearest_distance >= 100:
        cannibalization_multiplier = 0.78
    else:
        cannibalization_multiplier = 0.60

    # A larger nearby cluster is interpreted as a commercial-hub foot-traffic signal.
    competitor_count = len(competitors)
    foot_traffic_multiplier = 1.00 + min(0.20, competitor_count * 0.015)
    central_estimate = base_revenue * cannibalization_multiplier * foot_traffic_multiplier
    revenue_min = central_estimate * 0.85
    revenue_max = central_estimate * 1.15

    labor_cost = staff_count * monthly_wage
    cost_of_goods_cost = central_estimate * (cost_of_goods_pct / 100)
    total_cost = labor_cost + cost_of_goods_cost + rent_cost + extra_cost
    twenty_percent_buffer = total_cost * 1.20

    if revenue_min >= twenty_percent_buffer:
        rating = "Highly Recommended"
        rating_color = "#087f5b"
        rating_detail = "The conservative revenue estimate covers all monthly costs and a 20% operating buffer."
    elif revenue_max < total_cost:
        rating = "Not Recommended"
        rating_color = "#c92a2a"
        rating_detail = "Even the optimistic revenue estimate is below the monthly break-even point."
    elif revenue_max < twenty_percent_buffer:
        rating = "Risky - Cost Pressure"
        rating_color = "#d97706"
        rating_detail = "The scenario may cover costs, but it does not reach the 20% operating buffer."
    elif nearest_distance is not None and nearest_distance < 100:
        rating = "Risky - High Competition"
        rating_color = "#d97706"
        rating_detail = "The revenue range can be viable, but a same-type competitor is within 100 metres."
    else:
        rating = "Recommended with Conditions"
        rating_color = "#2563eb"
        rating_detail = "The upside reaches the 20% operating buffer; validate demand before committing."

    return {
        "latitude": latitude,
        "longitude": longitude,
        "store_type": store_type,
        "avg_sale_price": avg_sale_price,
        "staff_count": staff_count,
        "monthly_wage": monthly_wage,
        "hours_of_work": hours_of_work,
        "cost_of_goods_pct": cost_of_goods_pct,
        "labor_cost": labor_cost,
        "cost_of_goods_cost": cost_of_goods_cost,
        "rent_cost": rent_cost,
        "extra_cost": extra_cost,
        "total_cost": total_cost,
        "industry_base_revenue": industry_base_revenue,
        "capacity_revenue": capacity_revenue,
        "base_revenue": base_revenue,
        "competitors": competitors,
        "rent_source": rent_source,
        "rent_assumptions": rent_assumptions,
        "competitor_count": competitor_count,
        "nearest_distance": nearest_distance,
        "cannibalization_multiplier": cannibalization_multiplier,
        "foot_traffic_multiplier": foot_traffic_multiplier,
        "revenue_min": revenue_min,
        "central_estimate": central_estimate,
        "revenue_max": revenue_max,
        "twenty_percent_buffer": twenty_percent_buffer,
        "rating": rating,
        "rating_color": rating_color,
        "rating_detail": rating_detail,
    }


def calculate_profit_projection(central_estimate: float, total_cost: float) -> list[dict[str, float | int]]:
    """Return a 12-month profit forecast using the current ramp-up and seasonality assumptions."""
    projection: list[dict[str, float | int]] = []
    for month in range(1, 13):
        if month < RAMP_UP_MONTHS:
            ramp_progress = (month - 1) / (RAMP_UP_MONTHS - 1)
            ramp_factor = RAMP_START_FACTOR + (1 - RAMP_START_FACTOR) * ramp_progress
        else:
            ramp_factor = 1.0
        revenue = central_estimate * ramp_factor * SEASONAL_MULTIPLIER_BY_CALENDAR_MONTH[month - 1]
        projection.append({"month": month, "revenue": revenue, "profit": revenue - total_cost})
    return projection


@app.get("/api/health")
def health_check() -> dict[str, str]:
    """Report that the local API process is ready to accept requests."""
    return {"status": "ok"}


@app.get("/api/locations/search")
def location_search(query: Annotated[str, Query(min_length=3, max_length=120, alias="q")]) -> list[dict[str, float | str]]:
    """Search Auckland/NZ addresses without exposing a geocoding call to the browser."""
    normalized_query = query.strip()
    if len(normalized_query) < 3:
        raise HTTPException(status_code=422, detail="Enter at least three non-space characters to search addresses.")
    try:
        return search_locations(normalized_query)
    except (RequestException, ValueError):
        raise HTTPException(
            status_code=503,
            detail={
                "code": "location_search_unavailable",
                "message": "Address search is temporarily unavailable. Enter coordinates or choose a point on the map.",
            },
        ) from None


@app.post("/api/analyses")
def create_analysis(request: AnalysisRequest) -> dict[str, Any]:
    """Fetch nearby competitors and return a complete feasibility analysis."""
    competitors, api_error = fetch_competitors(request.latitude, request.longitude, request.store_type)
    if api_error:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "competitor_data_unavailable",
                "message": "Live competitor data is temporarily unavailable. Try the analysis again before making a recommendation.",
            },
        )

    estimated_rent = estimate_commercial_rent_details(request.latitude, request.longitude, request.store_type)
    if request.rent_override is None:
        rent_cost = estimated_rent["estimated_monthly_rent"]
        rent_source: Literal["estimated", "manual"] = "estimated"
        rent_assumptions: dict[str, float | str] = estimated_rent
    else:
        rent_cost = request.rent_override
        rent_source = "manual"
        rent_assumptions = {
            **estimated_rent,
            "manual_monthly_rent": request.rent_override,
        }
    analysis = calculate_analysis(
        latitude=request.latitude,
        longitude=request.longitude,
        store_type=request.store_type,
        avg_sale_price=request.avg_sale_price,
        staff_count=request.staff_count,
        monthly_wage=request.monthly_wage,
        hours_of_work=request.hours_of_work,
        cost_of_goods_pct=request.cost_of_goods_pct,
        extra_cost=request.extra_cost,
        rent_cost=rent_cost,
        competitors=competitors,
        rent_source=rent_source,
        rent_assumptions=rent_assumptions,
    )
    analysis["profit_projection"] = calculate_profit_projection(
        central_estimate=float(analysis["central_estimate"]),
        total_cost=float(analysis["total_cost"]),
    )
    return analysis
