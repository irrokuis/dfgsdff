"""FastAPI entrypoint for the commercial-site feasibility service."""
from __future__ import annotations

from typing import Annotated

from fastapi import FastAPI, HTTPException, Query

from server.models import AnalysisRequest, AnalysisResponse, LocationResult
from server.policy import calculate_projection as calculate_profit_projection
from server.policy import estimate_commercial_rent_details, estimate_revenue_capacity
from server.providers import OpenDataProvider, ProviderUnavailable
from server.service import AnalysisService

app = FastAPI(title="Commercial Site Feasibility API", version="2.0.0")
provider = OpenDataProvider()
service = AnalysisService(provider)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/locations/search", response_model=list[LocationResult])
def location_search(query: Annotated[str, Query(min_length=3, max_length=120, alias="q")]) -> list[LocationResult]:
    normalized = query.strip()
    if len(normalized) < 3:
        raise HTTPException(status_code=422, detail="Enter at least three non-space characters to search addresses.")
    try:
        return provider.locations(normalized)
    except ProviderUnavailable as error:
        raise HTTPException(status_code=503, detail={"code": "location_search_unavailable", "message": str(error)}) from None


@app.post("/api/analyses", response_model=AnalysisResponse)
def create_analysis(request: AnalysisRequest) -> AnalysisResponse:
    try:
        return service.analyse(request)
    except ProviderUnavailable as error:
        raise HTTPException(status_code=503, detail={"code": error.code, "message": str(error)}) from None
