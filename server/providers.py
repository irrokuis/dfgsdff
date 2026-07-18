from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import requests
from requests.exceptions import RequestException

from server.models import Competitor, DataFreshness, LocationResult, StoreType
from server.policy import build_overpass_query, haversine_distance_meters

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "CommercialSiteFeasibilityAPI/2.0 (educational demo)"}
CACHE_TTL = timedelta(minutes=10)


class ProviderUnavailable(Exception):
    pass


class OpenDataProvider:
    def __init__(self) -> None:
        self._competitor_cache: dict[tuple[float, float, StoreType], tuple[datetime, list[Competitor]]] = {}

    def competitors(self, latitude: float, longitude: float, store_type: StoreType) -> tuple[list[Competitor], DataFreshness]:
        key = (round(latitude, 4), round(longitude, 4), store_type)
        now = datetime.now(UTC)
        cached = self._competitor_cache.get(key)
        if cached and now - cached[0] < CACHE_TTL:
            return cached[1], DataFreshness(source="OpenStreetMap via Overpass", fetched_at=cached[0], cache_status="fresh_cache", expires_at=cached[0] + CACHE_TTL)
        try:
            response = requests.post(OVERPASS_URL, data={"data": build_overpass_query(store_type, latitude, longitude)}, headers=HEADERS, timeout=40)
            response.raise_for_status()
            payload = response.json()
            elements = payload.get("elements", [])
            if not isinstance(elements, list):
                raise ProviderUnavailable("The competitor provider returned an unexpected response.")
        except (RequestException, requests.JSONDecodeError) as error:
            raise ProviderUnavailable("Live competitor data is temporarily unavailable.") from error
        businesses = self._parse_competitors(elements, latitude, longitude)
        self._competitor_cache[key] = (now, businesses)
        return businesses, DataFreshness(source="OpenStreetMap via Overpass", fetched_at=now, cache_status="live", expires_at=now + CACHE_TTL)

    def locations(self, query: str) -> list[LocationResult]:
        try:
            response = requests.get(NOMINATIM_URL, params={"q": query, "format": "jsonv2", "limit": 5, "countrycodes": "nz", "viewbox": "174.55,-36.65,175.10,-37.10", "bounded": 0, "accept-language": "en"}, headers=HEADERS, timeout=10)
            response.raise_for_status()
            payload = response.json()
        except (RequestException, requests.JSONDecodeError) as error:
            raise ProviderUnavailable("Address search is temporarily unavailable.") from error
        if not isinstance(payload, list):
            raise ProviderUnavailable("Address search returned an unexpected response.")
        results: list[LocationResult] = []
        for item in payload:
            try:
                results.append(LocationResult(display_name=str(item["display_name"]), latitude=float(item["lat"]), longitude=float(item["lon"])))
            except (KeyError, TypeError, ValueError):
                continue
        return results

    @staticmethod
    def _parse_competitors(elements: list[dict[str, Any]], latitude: float, longitude: float) -> list[Competitor]:
        results: list[Competitor] = []
        seen: set[tuple[str, int]] = set()
        for element in elements:
            identity = (str(element.get("type", "unknown")), int(element.get("id", -1)))
            if identity in seen:
                continue
            seen.add(identity)
            center = element.get("center", {})
            point_lat, point_lon = element.get("lat", center.get("lat")), element.get("lon", center.get("lon"))
            if point_lat is None or point_lon is None:
                continue
            tags = element.get("tags", {})
            results.append(Competitor(id=f"{identity[0]}/{identity[1]}", name=tags.get("name", "Unnamed business"), kind=(tags.get("amenity") or tags.get("shop") or tags.get("leisure") or "business").replace("_", " ").title(), latitude=float(point_lat), longitude=float(point_lon), distance_m=haversine_distance_meters(latitude, longitude, float(point_lat), float(point_lon))))
        return sorted(results, key=lambda item: item.distance_m)
