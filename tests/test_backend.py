from fastapi.testclient import TestClient
import pytest

import backend


def test_estimate_revenue_capacity_for_transactions_and_memberships() -> None:
    assert backend.estimate_revenue_capacity("Cafe", 3, 10, 15) == 70_200
    assert backend.estimate_revenue_capacity("Gym", 3, 10, 60) == 21_600


def test_rent_is_higher_near_the_cbd() -> None:
    cbd_rent = backend.estimate_commercial_rent(-36.8485, 174.7633, "Cafe")
    distant_rent = backend.estimate_commercial_rent(-36.9485, 174.7633, "Cafe")
    assert cbd_rent > distant_rent > 0


def test_analysis_marks_a_viable_low_cost_scenario_as_highly_recommended() -> None:
    analysis = backend.calculate_analysis(
        latitude=-36.8485,
        longitude=174.7633,
        store_type="Cafe",
        avg_sale_price=15,
        staff_count=1,
        monthly_wage=1_000,
        hours_of_work=10,
        cost_of_goods_pct=10,
        extra_cost=0,
        rent_cost=0,
        competitors=[],
        api_error=None,
    )
    assert analysis["rating"] == "Highly Recommended"


def test_profit_projection_ramps_then_uses_seasonality() -> None:
    projection = backend.calculate_profit_projection(100_000, 10_000)
    assert len(projection) == 12
    assert projection[0]["month"] == 1
    assert projection[0]["revenue"] == pytest.approx(60_500)
    assert projection[0]["profit"] == pytest.approx(50_500)
    assert projection[3] == {"month": 4, "revenue": 98_000.0, "profit": 88_000.0}


def test_health_endpoint() -> None:
    response = TestClient(backend.app).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analysis_endpoint_returns_calculation_and_competitors(monkeypatch) -> None:
    monkeypatch.setattr(
        backend,
        "fetch_competitors",
        lambda *_: ([{"id": "node/1", "name": "Example Cafe", "kind": "Cafe", "latitude": -36.85, "longitude": 174.76, "distance_m": 250}], None),
    )
    response = TestClient(backend.app).post(
        "/api/analyses",
        json={
            "latitude": -36.8485,
            "longitude": 174.7633,
            "store_type": "Cafe",
            "avg_sale_price": 15,
            "staff_count": 3,
            "monthly_wage": 4500,
            "hours_of_work": 10,
            "cost_of_goods_pct": 30,
            "extra_cost": 1000,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["competitor_count"] == 1
    assert body["competitors"][0]["name"] == "Example Cafe"
    assert len(body["profit_projection"]) == 12


def test_analysis_endpoint_rejects_invalid_input() -> None:
    response = TestClient(backend.app).post("/api/analyses", json={"latitude": 200})
    assert response.status_code == 422


def test_analysis_endpoint_keeps_upstream_warning(monkeypatch) -> None:
    monkeypatch.setattr(backend, "fetch_competitors", lambda *_: ([], "Overpass is unavailable."))
    response = TestClient(backend.app).post(
        "/api/analyses",
        json={
            "latitude": -36.8485, "longitude": 174.7633, "store_type": "Gym", "avg_sale_price": 60,
            "staff_count": 3, "monthly_wage": 4500, "hours_of_work": 10, "cost_of_goods_pct": 30, "extra_cost": 1000,
        },
    )
    assert response.status_code == 200
    assert response.json()["api_error"] == "Overpass is unavailable."
