"""Export the FastAPI contract before generating frontend DTOs."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend import app

Path("openapi.json").write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
