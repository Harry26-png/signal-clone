"""Runtime configuration, read from environment variables with local-dev defaults."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'signal.db'}")
    upload_dir: Path = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "uploads")))
    # Auth uses bearer tokens (no cookies), so a wildcard origin is safe by default.
    cors_origins: list[str] = _csv(os.getenv("CORS_ORIGINS", "*"))
    # Phone verification is mocked: every number accepts this code.
    mock_otp: str = os.getenv("MOCK_OTP", "123456")
    seed_on_startup: bool = os.getenv("SEED_ON_STARTUP", "true").lower() == "true"
    max_upload_bytes: int = 10 * 1024 * 1024
    sweep_interval_seconds: float = 2.0


settings = Settings()
