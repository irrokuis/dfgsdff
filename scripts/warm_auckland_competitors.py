"""Fetch and persist the Auckland-wide competitor snapshot for demos."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server.providers import OpenDataProvider, ProviderUnavailable


def main() -> None:
    provider = OpenDataProvider()
    try:
        freshness = provider.warm_auckland_cache()
    except ProviderUnavailable as error:
        raise SystemExit(f"Could not warm the Auckland competitor cache: {error}") from error
    print(
        "Auckland competitor cache ready "
        f"({freshness.cache_status}; fetched {freshness.fetched_at.isoformat()}; "
        f"expires {freshness.expires_at.isoformat()})."
    )


if __name__ == "__main__":
    main()
