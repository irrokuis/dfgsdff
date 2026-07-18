from __future__ import annotations

import logging
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

import requests
from requests.exceptions import RequestException

from server.models import Competitor, DataFreshness, LocationResult, StoreType
from server.policy import SEARCH_RADIUS_METERS, build_auckland_overpass_query, build_overpass_query, haversine_distance_meters, is_within_auckland_bounds

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "CommercialSiteFeasibilityAPI/2.0 (educational demo)"}
CACHE_TTL = timedelta(minutes=10)
STALE_CACHE_TTL = timedelta(hours=24)
AUCKLAND_CACHE_TTL = timedelta(days=7)
AUCKLAND_STALE_CACHE_TTL = timedelta(days=90)
logger = logging.getLogger(__name__)


class ProviderUnavailable(Exception):
    def __init__(self, message: str, code: str = "competitor_data_unavailable") -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class AucklandBusiness:
    id: str
    name: str
    kind: str
    latitude: float
    longitude: float
    store_types: tuple[StoreType, ...]


class OpenDataProvider:
    def __init__(self, cache_path: Path | None = None) -> None:
        self._competitor_cache: dict[tuple[float, float, StoreType], tuple[datetime, list[Competitor]]] = {}
        self._auckland_cache_path = cache_path or Path(__file__).resolve().parents[1] / "data" / "auckland_competitors.json"
        self._auckland_cache = self._load_auckland_cache()

    def competitors(self, latitude: float, longitude: float, store_type: StoreType) -> tuple[list[Competitor], DataFreshness]:
        if is_within_auckland_bounds(latitude, longitude):
            return self._auckland_competitors(latitude, longitude, store_type)
        return self._nearby_competitors(latitude, longitude, store_type)

    def warm_auckland_cache(self) -> DataFreshness:
        """Refresh the durable city snapshot without requiring a site analysis."""
        _, freshness = self._auckland_competitors(-36.8485, 174.7633, "Cafe")
        return freshness

    def _nearby_competitors(self, latitude: float, longitude: float, store_type: StoreType) -> tuple[list[Competitor], DataFreshness]:
        key = (round(latitude, 4), round(longitude, 4), store_type)
        now = datetime.now(UTC)
        cached = self._competitor_cache.get(key)
        try:
            response = requests.post(OVERPASS_URL, data={"data": build_overpass_query(store_type, latitude, longitude)}, headers=HEADERS, timeout=40)
            response.raise_for_status()
            payload = response.json()
            elements = payload.get("elements", [])
            if not isinstance(elements, list):
                raise ProviderUnavailable("The competitor provider returned an unexpected response.")
        except (RequestException, requests.JSONDecodeError, ProviderUnavailable) as error:
            response = getattr(error, "response", None)
            status_code = getattr(response, "status_code", None)
            if cached and now - cached[0] < STALE_CACHE_TTL:
                logger.warning(
                    "overpass_request_failed_using_stale_cache error_type=%s status_code=%s store_type=%s cache_age_seconds=%d",
                    type(error).__name__, status_code, store_type, (now - cached[0]).total_seconds(),
                )
                return cached[1], DataFreshness(
                    source="OpenStreetMap via Overpass",
                    fetched_at=cached[0],
                    cache_status="stale_cache",
                    expires_at=cached[0] + CACHE_TTL,
                )
            logger.warning(
                "overpass_request_failed error_type=%s status_code=%s store_type=%s cache_available=%s",
                type(error).__name__, status_code, store_type, cached is not None,
            )
            if status_code == 429:
                raise ProviderUnavailable(
                    "Live competitor data is rate limited. Please wait a moment and try again.",
                    code="competitor_data_rate_limited",
                ) from error
            raise ProviderUnavailable("Live competitor data is temporarily unavailable.") from error
        businesses = self._parse_competitors(elements, latitude, longitude)
        self._competitor_cache[key] = (now, businesses)
        return businesses, DataFreshness(source="OpenStreetMap via Overpass", fetched_at=now, cache_status="live", expires_at=now + CACHE_TTL)

    def _auckland_competitors(self, latitude: float, longitude: float, store_type: StoreType) -> tuple[list[Competitor], DataFreshness]:
        now = datetime.now(UTC)
        cached = self._auckland_cache
        try:
            response = requests.post(OVERPASS_URL, data={"data": build_auckland_overpass_query()}, headers=HEADERS, timeout=120)
            response.raise_for_status()
            payload = response.json()
            elements = payload.get("elements", [])
            if not isinstance(elements, list):
                raise ProviderUnavailable("The competitor provider returned an unexpected response.")
        except (RequestException, requests.JSONDecodeError, ProviderUnavailable) as error:
            response = getattr(error, "response", None)
            status_code = getattr(response, "status_code", None)
            if cached and now - cached[0] < AUCKLAND_STALE_CACHE_TTL:
                logger.warning(
                    "auckland_snapshot_refresh_failed_using_stale_cache error_type=%s status_code=%s cache_age_seconds=%d",
                    type(error).__name__, status_code, (now - cached[0]).total_seconds(),
                )
                return self._filter_auckland_businesses(cached[1], latitude, longitude, store_type), self._freshness(cached[0], "stale_cache")
            logger.warning(
                "auckland_snapshot_refresh_failed error_type=%s status_code=%s cache_available=%s",
                type(error).__name__, status_code, cached is not None,
            )
            if status_code == 429:
                raise ProviderUnavailable(
                    "Live competitor data is rate limited. Please wait a moment and try again.",
                    code="competitor_data_rate_limited",
                ) from error
            raise ProviderUnavailable("Live competitor data is temporarily unavailable.") from error
        businesses = self._parse_auckland_businesses(elements)
        self._auckland_cache = (now, businesses)
        self._persist_auckland_cache(now, businesses)
        return self._filter_auckland_businesses(businesses, latitude, longitude, store_type), self._freshness(now, "live")

    @staticmethod
    def _freshness(fetched_at: datetime, cache_status: Literal["live", "fresh_cache", "stale_cache"]) -> DataFreshness:
        return DataFreshness(
            source="OpenStreetMap via Overpass",
            fetched_at=fetched_at,
            cache_status=cache_status,
            expires_at=fetched_at + AUCKLAND_CACHE_TTL,
        )

    @staticmethod
    def _store_types(tags: dict[str, Any]) -> tuple[StoreType, ...]:
        matches: list[StoreType] = []
        if tags.get("amenity") == "cafe":
            matches.append("Cafe")
        if tags.get("shop") == "convenience":
            matches.append("Convenience Store")
        if tags.get("amenity") == "restaurant":
            matches.append("Restaurant")
        if tags.get("shop") == "bakery":
            matches.append("Bakery")
        if tags.get("shop") == "pharmacy":
            matches.append("Pharmacy")
        if tags.get("leisure") == "fitness_centre" or tags.get("amenity") == "gym":
            matches.append("Gym")
        return tuple(matches)

    @classmethod
    def _parse_auckland_businesses(cls, elements: list[dict[str, Any]]) -> list[AucklandBusiness]:
        results: list[AucklandBusiness] = []
        seen: set[tuple[str, int]] = set()
        for element in elements:
            try:
                identity = (str(element.get("type", "unknown")), int(element.get("id", -1)))
            except (TypeError, ValueError):
                continue
            if identity in seen:
                continue
            seen.add(identity)
            center = element.get("center")
            center = center if isinstance(center, dict) else {}
            point_lat, point_lon = element.get("lat", center.get("lat")), element.get("lon", center.get("lon"))
            tags = element.get("tags")
            if point_lat is None or point_lon is None or not isinstance(tags, dict):
                continue
            store_types = cls._store_types(tags)
            if not store_types:
                continue
            try:
                results.append(AucklandBusiness(
                    id=f"{identity[0]}/{identity[1]}",
                    name=str(tags.get("name", "Unnamed business")),
                    kind=str(tags.get("amenity") or tags.get("shop") or tags.get("leisure") or "business").replace("_", " ").title(),
                    latitude=float(point_lat),
                    longitude=float(point_lon),
                    store_types=store_types,
                ))
            except (TypeError, ValueError):
                continue
        return results

    @staticmethod
    def _filter_auckland_businesses(businesses: list[AucklandBusiness], latitude: float, longitude: float, store_type: StoreType) -> list[Competitor]:
        results = [
            Competitor(
                id=business.id,
                name=business.name,
                kind=business.kind,
                latitude=business.latitude,
                longitude=business.longitude,
                distance_m=haversine_distance_meters(latitude, longitude, business.latitude, business.longitude),
            )
            for business in businesses
            if store_type in business.store_types
            and haversine_distance_meters(latitude, longitude, business.latitude, business.longitude) <= SEARCH_RADIUS_METERS
        ]
        return sorted(results, key=lambda item: item.distance_m)

    def _load_auckland_cache(self) -> tuple[datetime, list[AucklandBusiness]] | None:
        try:
            with self._auckland_cache_path.open(encoding="utf-8") as cache_file:
                payload = json.load(cache_file)
            fetched_at = datetime.fromisoformat(payload["fetched_at"])
            if fetched_at.tzinfo is None:
                fetched_at = fetched_at.replace(tzinfo=UTC)
            entries = payload["businesses"]
            if not isinstance(entries, list):
                raise ValueError("businesses must be a list")
            businesses = [
                AucklandBusiness(
                    id=str(entry["id"]), name=str(entry["name"]), kind=str(entry["kind"]),
                    latitude=float(entry["latitude"]), longitude=float(entry["longitude"]),
                    store_types=tuple(entry["store_types"]),
                )
                for entry in entries
            ]
            return fetched_at, businesses
        except FileNotFoundError:
            return None
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            logger.warning("auckland_snapshot_cache_invalid path=%s error_type=%s", self._auckland_cache_path, type(error).__name__)
            return None

    def _persist_auckland_cache(self, fetched_at: datetime, businesses: list[AucklandBusiness]) -> None:
        self._auckland_cache_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self._auckland_cache_path.with_suffix(".tmp")
        payload = {
            "fetched_at": fetched_at.isoformat(),
            "businesses": [
                {"id": business.id, "name": business.name, "kind": business.kind, "latitude": business.latitude, "longitude": business.longitude, "store_types": list(business.store_types)}
                for business in businesses
            ],
        }
        with temporary_path.open("w", encoding="utf-8") as cache_file:
            json.dump(payload, cache_file, separators=(",", ":"))
        temporary_path.replace(self._auckland_cache_path)

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
