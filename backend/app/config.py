"""Application configuration using environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/transitq.db")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
APP_TITLE = "TransitQ API"
APP_VERSION = "1.0.0"
