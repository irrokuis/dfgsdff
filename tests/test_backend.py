from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
import pytest

import backend
from server.models import Competitor, DataFreshness
from server.policy import calculate_projection, estimate_commercial_rent_details, estimate_revenue_capacity
from server.providers import OpenDataProvider, ProviderUnavailable


def scenario(**changes: object) -> dict[str, object]:
    value: dict[str, object] = {"latitude": -36.8485, "longitude": 174.7633, "store_type": "Cafe", "avg_sale_price": 15, "staff_count": 3, "monthly_wage": 4500, "hours_of_work": 10, "cost_of_goods_pct": 30, "extra_cost": 1000}
    value.update(changes)
    return value


def fresh_data() -> DataFreshness:
    now = datetime.now(UTC)
    return DataFreshness(source="OpenStreetMap via Overpass", fetched_at=now, cache_status="live", expires_at=now + timedelta(minutes=10))


def test_capacity_and_rent_policy() -> None:
    assert estimate_revenue_capacity("Cafe", 3, 10, 15) == 70_200
    assert estimate_revenue_capacity("Gym", 3, 10, 60) == 21_600
    assert estimate_commercial_rent_details(-36.8485, 174.7633, "Cafe")["estimated_monthly_rent"] > estimate_commercial_rent_details(-36.9485, 174.7633, "Cafe")["estimated_monthly_rent"]


def test_projection_has_future_ramp_and_seasonality() -> None:
    projection = calculate_projection(100_000, 10_000)
    assert len(projection) == 12
    assert projection[0].revenue == pytest.approx(60_500)
    assert projection[3].profit == pytest.approx(88_000)


def test_analysis_contract_includes_explainability(monkeypatch: pytest.MonkeyPatch) -> None:
    competitor = Competitor(id="node/1", name="Example Cafe", kind="Cafe", latitude=-36.85, longitude=174.76, distance_m=250)
    monkeypatch.setattr(backend.provider, "competitors", lambda *_: ([competitor], fresh_data()))
    response = TestClient(backend.app).post("/api/analyses", json=scenario())
    assert response.status_code == 200
    body = response.json()
    assert body["scenario_mode"] == "base"
    assert body["model_version"]
    assert body["forecast_drivers"]
    assert body["data_freshness"]["cache_status"] == "live"
    assert len(body["profit_projection"]) == 12


def test_scenario_modes_change_forecast(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(backend.provider, "competitors", lambda *_: ([], fresh_data()))
    client = TestClient(backend.app)
    conservative = client.post("/api/analyses", json=scenario(scenario_mode="conservative")).json()
    optimistic = client.post("/api/analyses", json=scenario(scenario_mode="optimistic")).json()
    assert conservative["central_estimate"] < optimistic["central_estimate"]


@pytest.mark.parametrize("store_type", ["Cafe", "Convenience Store", "Restaurant", "Bakery", "Pharmacy", "Gym"])
def test_every_store_type_has_a_complete_future_forecast(monkeypatch: pytest.MonkeyPatch, store_type: str) -> None:
    monkeypatch.setattr(backend.provider, "competitors", lambda *_: ([], fresh_data()))
    response = TestClient(backend.app).post("/api/analyses", json=scenario(store_type=store_type))
    assert response.status_code == 200
    body = response.json()
    assert body["store_type"] == store_type
    assert body["central_estimate"] > 0
    assert len(body["profit_projection"]) == 12


def test_close_competitor_is_explained_as_a_rating_driver(monkeypatch: pytest.MonkeyPatch) -> None:
    close = Competitor(id="node/close", name="Very Close Cafe", kind="Cafe", latitude=-36.8485, longitude=174.7633, distance_m=60)
    monkeypatch.setattr(backend.provider, "competitors", lambda *_: ([close], fresh_data()))
    response = TestClient(backend.app).post("/api/analyses", json=scenario(extra_cost=0, monthly_wage=9000, cost_of_goods_pct=0, rent_override=0))
    body = response.json()
    assert body["rating"] == "Risky - High Competition"
    assert body["cannibalization_multiplier"] == .60
    assert any("60 m" in reason for reason in body["rating_reasons"])


def test_analysis_rejects_invalid_input() -> None:
    assert TestClient(backend.app).post("/api/analyses", json={"latitude": 200}).status_code == 422


def test_analysis_reports_provider_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def unavailable(*_: object) -> object:
        raise ProviderUnavailable("Live competitor data is temporarily unavailable.")
    monkeypatch.setattr(backend.provider, "competitors", unavailable)
    response = TestClient(backend.app).post("/api/analyses", json=scenario())
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "competitor_data_unavailable"


def test_location_search_validates_and_returns_models(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(backend.provider, "locations", lambda *_: [{"display_name": "Queen Street, Auckland", "latitude": -36.848, "longitude": 174.763}])
    client = TestClient(backend.app)
    assert client.get("/api/locations/search?q=ab").status_code == 422
    response = client.get("/api/locations/search?q=Queen")
    assert response.status_code == 200
    assert response.json()[0]["display_name"] == "Queen Street, Auckland"


def test_provider_uses_fresh_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = OpenDataProvider()
    calls = 0
    class FakeResponse:
        def raise_for_status(self) -> None: return None
        def json(self) -> dict[str, object]: return {"elements": []}
    def post(*_: object, **__: object) -> FakeResponse:
        nonlocal calls
        calls += 1
        return FakeResponse()
    monkeypatch.setattr("server.providers.requests.post", post)
    _, initial = provider.competitors(-36.8485, 174.7633, "Cafe")
    _, cached = provider.competitors(-36.8485, 174.7633, "Cafe")
    assert calls == 1
    assert initial.cache_status == "live"
    assert cached.cache_status == "fresh_cache"


def test_provider_rejects_malformed_competitor_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    provider = OpenDataProvider()
    class FakeResponse:
        def raise_for_status(self) -> None: return None
        def json(self) -> dict[str, object]: return {"elements": "not-a-list"}
    monkeypatch.setattr("server.providers.requests.post", lambda *_args, **_kwargs: FakeResponse())
    with pytest.raises(ProviderUnavailable):
        provider.competitors(-36.8485, 174.7633, "Cafe")
