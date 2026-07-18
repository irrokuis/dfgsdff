"""Streamlit application for real-map commercial site feasibility screening."""

from __future__ import annotations

import math
from typing import Any

import folium
import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st
from folium.plugins import HeatMap, MarkerCluster
from requests.exceptions import RequestException
from streamlit_folium import st_folium


st.set_page_config(
    page_title="Commercial Site Feasibility",
    page_icon="📍",
    layout="wide",
    initial_sidebar_state="expanded",
)


AUCKLAND_CENTER = (-36.8485, 174.7633)
SEARCH_RADIUS_METERS = 1_500
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

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


def inject_styles() -> None:
    """Add compact CSS that makes decision-critical values easier to scan."""
    st.markdown(
        """
        <style>
            .block-container { padding-top: 1.5rem; padding-bottom: 2rem; }
            h1, h2, h3 { font-weight: 700 !important; }
            .coordinate-display {
                padding: 1rem 1.25rem;
                border-radius: 0.75rem;
                background: #e8f1ff;
                color: #0b3d91;
                font-size: 1.45rem;
                font-weight: 700;
                margin: 0.4rem 0 1rem 0;
            }
            .revenue-display {
                padding: 1.2rem 1.4rem;
                border-radius: 0.8rem;
                background: #e8fff2;
                color: #075b35;
                font-size: 2.25rem;
                font-weight: 800;
                text-align: center;
                margin: 0.5rem 0 1rem 0;
            }
            .rating-display {
                font-size: 1.65rem;
                font-weight: 800;
                margin: 0.4rem 0;
            }
            div[data-testid="stMetricValue"] { font-size: 1.55rem; }
            div[data-testid="stMetricLabel"] { font-size: 1rem; }
            section[data-testid="stSidebar"] label { font-size: 1.03rem; font-weight: 600; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def nzd(value: float) -> str:
    """Format a monetary value as a whole NZD amount."""
    return f"NZ${value:,.0f}"


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
    headers = {"User-Agent": "CommercialSiteFeasibilityStreamlit/1.0 (educational demo)"}

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
            return [], "The Overpass response had an unexpected format. The analysis used zero competitors."
        return parse_overpass_elements(elements, latitude, longitude), None
    except requests.JSONDecodeError:
        return [], "Overpass returned an unreadable response. The analysis used zero competitors."
    except RequestException as error:
        return [], f"Live competitor data could not be fetched ({error.__class__.__name__}). The analysis used zero competitors."


def calculate_analysis(
    latitude: float,
    longitude: float,
    store_type: str,
    labor_cost: float,
    material_cost: float,
    rent_cost: float,
    competitors: list[dict[str, Any]],
    api_error: str | None,
) -> dict[str, Any]:
    """Calculate break-even, spatial adjustments, range, and feasibility rating."""
    total_cost = labor_cost + material_cost + rent_cost
    base_revenue = float(INDUSTRY_BASE_REVENUE[store_type])
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
        "labor_cost": labor_cost,
        "material_cost": material_cost,
        "rent_cost": rent_cost,
        "total_cost": total_cost,
        "base_revenue": base_revenue,
        "competitors": competitors,
        "api_error": api_error,
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


def make_map(
    target_latitude: float | None,
    target_longitude: float | None,
    competitors: list[dict[str, Any]] | None = None,
) -> folium.Map:
    """Build the Auckland map with a target marker and optional live competitor density layers."""
    map_center = (
        [target_latitude, target_longitude]
        if target_latitude is not None and target_longitude is not None
        else list(AUCKLAND_CENTER)
    )
    site_map = folium.Map(location=map_center, zoom_start=14 if target_latitude is not None else 12, control_scale=True)

    if target_latitude is not None and target_longitude is not None:
        folium.Marker(
            [target_latitude, target_longitude],
            popup="Proposed store location",
            tooltip="Proposed store location",
            icon=folium.Icon(color="red", icon="star", prefix="glyphicon"),
        ).add_to(site_map)
        folium.Circle(
            [target_latitude, target_longitude],
            radius=SEARCH_RADIUS_METERS,
            color="#dc2626",
            weight=2,
            fill=False,
            tooltip="1.5 km competitor search radius",
        ).add_to(site_map)

    if competitors:
        heat_points = [[item["latitude"], item["longitude"], 1.0] for item in competitors]
        HeatMap(heat_points, radius=25, blur=18, min_opacity=0.35, name="Competitor density").add_to(site_map)
        cluster = MarkerCluster(name="Competitor markers").add_to(site_map)
        for item in competitors:
            popup_html = (
                f"<b>{item['name']}</b><br>Category: {item['kind']}<br>"
                f"Distance: {float(item['distance_m']):,.0f} m"
            )
            folium.Marker(
                [item["latitude"], item["longitude"]],
                popup=folium.Popup(popup_html, max_width=260),
                tooltip=str(item["name"]),
                icon=folium.Icon(color="blue", icon="briefcase", prefix="glyphicon"),
            ).add_to(cluster)
        folium.LayerControl(collapsed=False).add_to(site_map)

    return site_map


def make_cost_chart(analysis: dict[str, Any]) -> go.Figure:
    """Create an NZD monthly cost donut chart for the results dashboard."""
    figure = go.Figure(
        data=[
            go.Pie(
                labels=["Labor", "Materials", "Rent"],
                values=[analysis["labor_cost"], analysis["material_cost"], analysis["rent_cost"]],
                hole=0.55,
                textinfo="label+percent",
                hovertemplate="%{label}: NZ$%{value:,.0f} (%{percent})<extra></extra>",
                marker={"colors": ["#2563eb", "#f59e0b", "#8b5cf6"]},
            )
        ]
    )
    figure.update_layout(height=380, margin={"l": 10, "r": 10, "t": 10, "b": 10}, showlegend=False)
    return figure


def render_configuration_page() -> None:
    """Render map selection, inputs, and the explicit live-data analysis action."""
    st.title("Commercial Site Feasibility Analysis")
    st.markdown("### Select a real Auckland location, set costs, and run a live competitor analysis.")

    with st.sidebar:
        st.markdown("## Scenario inputs")
        store_type = st.selectbox("Target store type", list(INDUSTRY_BASE_REVENUE), key="store_type")
        labor_cost = st.number_input("Expected monthly labor cost (NZD)", min_value=0, max_value=500_000, value=20_000, step=500, key="labor_cost")
        material_cost = st.number_input("Expected monthly material cost (NZD)", min_value=0, max_value=500_000, value=15_000, step=500, key="material_cost")
        rent_cost = st.number_input("Expected monthly rent (NZD)", min_value=0, max_value=100_000, value=5_000, step=250, key="rent_cost")
        st.divider()
        run_analysis = st.button("Run Feasibility Analysis", type="primary", use_container_width=True)

    selected_latitude = st.session_state.get("selected_latitude")
    selected_longitude = st.session_state.get("selected_longitude")

    st.markdown("## Interactive location map")
    st.markdown("### Click anywhere on the map to place the proposed store.")
    map_response = st_folium(
        make_map(selected_latitude, selected_longitude),
        height=620,
        use_container_width=True,
        key="configuration_map",
    )

    last_clicked = map_response.get("last_clicked") if map_response else None
    if last_clicked:
        clicked_latitude = float(last_clicked["lat"])
        clicked_longitude = float(last_clicked["lng"])
        if (clicked_latitude, clicked_longitude) != (selected_latitude, selected_longitude):
            st.session_state.selected_latitude = clicked_latitude
            st.session_state.selected_longitude = clicked_longitude
            st.rerun()

    if selected_latitude is None or selected_longitude is None:
        st.warning("No location selected yet. Click the map before running the analysis.")
    else:
        st.markdown("### Selected target location")
        st.markdown(
            f'<div class="coordinate-display">Latitude: {selected_latitude:.6f} &nbsp; | &nbsp; Longitude: {selected_longitude:.6f}</div>',
            unsafe_allow_html=True,
        )

    if run_analysis:
        if selected_latitude is None or selected_longitude is None:
            st.error("Please click the map to select a target location first.")
        else:
            with st.spinner("Fetching live OpenStreetMap competitor data and calculating the scenario..."):
                competitors, api_error = fetch_competitors(selected_latitude, selected_longitude, store_type)
                st.session_state.analysis = calculate_analysis(
                    latitude=selected_latitude,
                    longitude=selected_longitude,
                    store_type=store_type,
                    labor_cost=float(labor_cost),
                    material_cost=float(material_cost),
                    rent_cost=float(rent_cost),
                    competitors=competitors,
                    api_error=api_error,
                )
            st.session_state.page = "result"
            st.rerun()


def render_result_page() -> None:
    """Render the persisted dashboard with live competitor markers and financial results."""
    analysis = st.session_state.get("analysis")
    if analysis is None:
        st.session_state.page = "configuration"
        st.rerun()

    st.title("Site Feasibility Dashboard")
    st.markdown(
        f"### {analysis['store_type']} at latitude {analysis['latitude']:.6f}, longitude {analysis['longitude']:.6f}"
    )

    st.markdown("### Feasibility rating")
    st.markdown(
        f'<div class="rating-display" style="color:{analysis["rating_color"]};">{analysis["rating"]}</div>',
        unsafe_allow_html=True,
    )
    st.write(analysis["rating_detail"])

    st.markdown("### Projected monthly revenue")
    st.markdown(
        f'<div class="revenue-display">{nzd(analysis["revenue_min"])} – {nzd(analysis["revenue_max"])}</div>',
        unsafe_allow_html=True,
    )

    metric_1, metric_2, metric_3, metric_4 = st.columns(4)
    metric_1.metric("Central estimate", nzd(analysis["central_estimate"]))
    metric_2.metric("Breakeven point", nzd(analysis["total_cost"]))
    metric_3.metric("Revenue for 20% buffer", nzd(analysis["twenty_percent_buffer"]))
    metric_4.metric("Live competitors found", str(analysis["competitor_count"]))

    if analysis["api_error"]:
        st.warning(analysis["api_error"])

    map_column, chart_column = st.columns([1.25, 1])
    with map_column:
        st.markdown("## Real competitor map")
        st.markdown("### Blue markers are live OpenStreetMap competitors. The heat layer shows their local density.")
        st_folium(
            make_map(analysis["latitude"], analysis["longitude"], analysis["competitors"]),
            height=560,
            use_container_width=True,
            key="result_map",
        )
    with chart_column:
        st.markdown("## Monthly cost allocation")
        if analysis["total_cost"] > 0:
            st.plotly_chart(make_cost_chart(analysis), use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("No monthly costs were entered, so there is no cost allocation chart.")

    st.markdown("## Spatial calculation details")
    nearest_text = "No competitor found" if analysis["nearest_distance"] is None else f"{analysis['nearest_distance']:,.0f} m"
    details = pd.DataFrame(
        {
            "Measure": [
                "Industry base revenue",
                "Nearest same-type competitor",
                "Cannibalization multiplier",
                "Foot-traffic multiplier",
                "Total monthly costs",
            ],
            "Value": [
                nzd(analysis["base_revenue"]),
                nearest_text,
                f"{analysis['cannibalization_multiplier']:.2f}×",
                f"{analysis['foot_traffic_multiplier']:.2f}×",
                nzd(analysis["total_cost"]),
            ],
        }
    )
    st.dataframe(details, hide_index=True, use_container_width=True)
    st.caption("Live business data comes from OpenStreetMap via the Overpass API. Results are screening estimates, not financial advice.")

    if st.button("Start Over", type="primary"):
        for key in [
            "analysis",
            "selected_latitude",
            "selected_longitude",
            "store_type",
            "labor_cost",
            "material_cost",
            "rent_cost",
        ]:
            st.session_state.pop(key, None)
        st.session_state.page = "configuration"
        st.rerun()


def main() -> None:
    """Initialize the two-page session flow and render the selected page."""
    inject_styles()
    if "page" not in st.session_state:
        st.session_state.page = "configuration"

    if st.session_state.page == "result":
        render_result_page()
    else:
        render_configuration_page()


if __name__ == "__main__":
    main()
