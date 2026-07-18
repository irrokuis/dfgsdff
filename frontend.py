"""Streamlit UI for the commercial site feasibility screener."""

from __future__ import annotations

from typing import Any

import folium
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from folium.plugins import HeatMap, MarkerCluster
from streamlit_folium import st_folium

from backend import (
    AUCKLAND_CENTER,
    INDUSTRY_BASE_REVENUE,
    RAMP_START_FACTOR,
    RAMP_UP_MONTHS,
    SEARCH_RADIUS_METERS,
    SEASONAL_MULTIPLIER_BY_CALENDAR_MONTH,
    SUBSCRIPTION_STORE_TYPES,
    calculate_analysis,
    estimate_commercial_rent,
    fetch_competitors,
)


st.set_page_config(
    page_title="Commercial Site Feasibility",
    page_icon="📍",
    layout="wide",
    initial_sidebar_state="expanded",
)


def inject_styles() -> None:
    """Add compact CSS that makes decision-critical values easier to scan."""
    st.markdown(
        """
        <style>
            .block-container { padding-top: 1.5rem; padding-bottom: 2rem; }
            h1, h2, h3 { font-weight: 700 !important; }
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


def make_map(
    target_latitude: float | None,
    target_longitude: float | None,
    competitors: list[dict[str, Any]] | None = None,
    map_center: tuple[float, float] | None = None,
    zoom_start: int = 13,
) -> folium.Map:
    """Build the Auckland map with a target marker and optional live competitor density layers.

    map_center/zoom_start only seed the map's very first view. The interactive
    configuration map overrides them every rerun via st_folium's own center/zoom
    args (backed by session state) so a click never snaps the view back and forth.
    """
    site_map = folium.Map(
        location=list(map_center) if map_center is not None else list(AUCKLAND_CENTER),
        zoom_start=zoom_start,
        control_scale=True,
    )

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
                labels=["Labor", "Cost of Goods", "Rent", "Extra"],
                values=[
                    analysis["labor_cost"],
                    analysis["cost_of_goods_cost"],
                    analysis["rent_cost"],
                    analysis["extra_cost"],
                ],
                hole=0.55,
                textinfo="label+percent",
                hovertemplate="%{label}: NZ$%{value:,.0f} (%{percent})<extra></extra>",
                marker={"colors": ["#2563eb", "#f59e0b", "#8b5cf6", "#ef4444"]},
            )
        ]
    )
    figure.update_layout(height=380, margin={"l": 10, "r": 10, "t": 10, "b": 10}, showlegend=False)
    return figure


def make_profit_chart(analysis: dict[str, Any]) -> go.Figure:
    """Project monthly profit over 12 months, ramping revenue up from opening and applying seasonality."""
    total_cost = analysis["total_cost"]
    central_estimate = analysis["central_estimate"]
    months = list(range(1, 13))
    profits = []
    for month in months:
        if month < RAMP_UP_MONTHS:
            ramp_progress = (month - 1) / (RAMP_UP_MONTHS - 1)
            ramp_factor = RAMP_START_FACTOR + (1 - RAMP_START_FACTOR) * ramp_progress
        else:
            ramp_factor = 1.0
        seasonal_factor = SEASONAL_MULTIPLIER_BY_CALENDAR_MONTH[(month - 1) % 12]
        revenue = central_estimate * ramp_factor * seasonal_factor
        profits.append(revenue - total_cost)

    bar_colors = ["#087f5b" if profit >= 0 else "#c92a2a" for profit in profits]
    figure = go.Figure(
        data=[
            go.Bar(
                x=[f"M{month}" for month in months],
                y=profits,
                marker={"color": bar_colors},
                hovertemplate="%{x}: NZ$%{y:,.0f}<extra></extra>",
            )
        ]
    )
    figure.update_layout(
        height=320,
        margin={"l": 10, "r": 10, "t": 10, "b": 10},
        showlegend=False,
        yaxis_title="Profit (NZD)",
    )
    figure.add_hline(y=0, line_width=1, line_color="#94a3b8")
    return figure


def render_configuration_page() -> None:
    """Render map selection, inputs, and the explicit live-data analysis action."""
    st.title("Commercial Site Feasibility Analysis")
    st.markdown("### Select a real Auckland location, set costs, and run a live competitor analysis.")

    with st.sidebar:
        st.markdown("## Scenario inputs")
        store_type = st.selectbox("Target store type", list(INDUSTRY_BASE_REVENUE), key="store_type")
        avg_sale_price_label = (
            "Estimated revenue per customer per month (NZD)"
            if store_type in SUBSCRIPTION_STORE_TYPES
            else "Average sale price per customer (NZD)"
        )
        avg_sale_price = st.number_input(avg_sale_price_label, min_value=0.0, max_value=5_000.0, value=15.0, step=0.5, key="avg_sale_price")
        staff_count = st.number_input("Staff count", min_value=1, max_value=100, value=3, step=1, key="staff_count")
        monthly_wage = st.number_input("Monthly wage per staff member (NZD)", min_value=0, max_value=50_000, value=4_500, step=100, key="monthly_wage")
        hours_of_work = st.number_input("Hours of operation per day", min_value=1.0, max_value=24.0, value=10.0, step=0.5, key="hours_of_work")
        cost_of_goods_pct = st.slider("Cost of goods (% of revenue)", min_value=0, max_value=100, value=30, key="cost_of_goods_pct")
        extra_cost = st.number_input("Extra monthly costs (NZD)", min_value=0, max_value=200_000, value=1_000, step=100, key="extra_cost")
        st.caption("Rent is estimated automatically from the site's distance to the CBD and typical floor area for the store type.")
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
        returned_objects=["last_clicked"],
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
        st.success("Target location selected. Adjust inputs and run the analysis when ready.")

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
                    avg_sale_price=float(avg_sale_price),
                    staff_count=int(staff_count),
                    monthly_wage=float(monthly_wage),
                    hours_of_work=float(hours_of_work),
                    cost_of_goods_pct=float(cost_of_goods_pct),
                    extra_cost=float(extra_cost),
                    rent_cost=estimate_commercial_rent(selected_latitude, selected_longitude, store_type),
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
    st.markdown(f"### {analysis['store_type']} feasibility results for the selected site")

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
            make_map(
                analysis["latitude"],
                analysis["longitude"],
                analysis["competitors"],
                map_center=(analysis["latitude"], analysis["longitude"]),
                zoom_start=14,
            ),
            height=560,
            use_container_width=True,
            returned_objects=[],
            key="result_map",
        )
    with chart_column:
        st.markdown("## Monthly cost allocation")
        if analysis["total_cost"] > 0:
            st.plotly_chart(make_cost_chart(analysis), use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("No monthly costs were entered, so there is no cost allocation chart.")

        st.markdown("## 12-month profit projection")
        st.plotly_chart(make_profit_chart(analysis), use_container_width=True, config={"displayModeBar": False})

    st.markdown("## Financial summary")
    nearest_text = "No competitor found" if analysis["nearest_distance"] is None else f"{analysis['nearest_distance']:,.0f} m"
    details = pd.DataFrame(
        {
            "Measure": [
                "Estimated monthly revenue",
                "Nearest same-type competitor",
                "Labor cost",
                "Cost of goods sold",
                "Estimated commercial rent",
                "Extra costs",
                "Total monthly costs",
                "Estimated monthly profit",
            ],
            "Value": [
                nzd(analysis["central_estimate"]),
                nearest_text,
                nzd(analysis["labor_cost"]),
                nzd(analysis["cost_of_goods_cost"]),
                nzd(analysis["rent_cost"]),
                nzd(analysis["extra_cost"]),
                nzd(analysis["total_cost"]),
                nzd(analysis["central_estimate"] - analysis["total_cost"]),
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
            "avg_sale_price",
            "staff_count",
            "monthly_wage",
            "hours_of_work",
            "cost_of_goods_pct",
            "extra_cost",
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
