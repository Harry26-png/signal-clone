import os
import tempfile
from pathlib import Path

import pytest

# Point the app at a throwaway database/upload dir before it is imported.
_tmp = Path(tempfile.mkdtemp(prefix="signal-clone-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp / 'test.db'}"
os.environ["UPLOAD_DIR"] = str(_tmp / "uploads")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

ALICE = "+15550100001"
BOB = "+15550100002"
CAROL = "+15550100003"
HENRY = "+15550100008"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:  # runs lifespan: create tables + seed
        yield test_client


def login(client: TestClient, phone: str) -> tuple[dict, dict]:
    response = client.post("/api/auth/verify", json={"phone": phone, "code": "123456"})
    assert response.status_code == 200, response.text
    body = response.json()
    return {"Authorization": f"Bearer {body['token']}"}, body
