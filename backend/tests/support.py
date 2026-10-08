"""Helpers shared by tests: settings for the test services and their availability (P-047)."""

import os
import uuid
from typing import Any, NoReturn

import pytest
from pydantic import SecretStr

from app.config import Settings

# Azurite's published development key, not a secret.
AZURITE_ACCOUNT_KEY = (
    "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
)
START_HINT = "Start them with: docker compose up -d --wait mysql azurite"


def azurite_connection_string(host: str = "127.0.0.1", port: int = 10000) -> str:
    return (
        "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;"
        f"AccountKey={AZURITE_ACCOUNT_KEY};"
        f"BlobEndpoint=http://{host}:{port}/devstoreaccount1;"
    )


def make_test_settings() -> Settings:
    """MySQL database mdit_test and Azurite from docker-compose.yml, overridable by TEST_* vars."""
    env = os.environ.get
    return Settings(
        db_host=env("TEST_DB_HOST", "127.0.0.1"),
        # Compose publishes MySQL on 3307 (P-055).
        db_port=int(env("TEST_DB_PORT", "3307")),
        db_name=env("TEST_DB_NAME", "mdit_test"),
        db_user=env("TEST_DB_USER", "mdit"),
        db_password=SecretStr(env("TEST_DB_PASSWORD", "mdit-dev-password")),
        blob_connection_string=SecretStr(
            env("TEST_BLOB_CONNECTION_STRING", azurite_connection_string())
        ),
        blob_container=f"test-{uuid.uuid4().hex[:12]}",
    )


def fake_settings(**overrides: Any) -> Settings:
    """Settings for unit tests: everything points at port 1, where nothing listens."""
    values: dict[str, Any] = {
        "db_host": "127.0.0.1",
        "db_port": 1,
        "db_password": SecretStr("unused"),
        "blob_connection_string": SecretStr(azurite_connection_string(port=1)),
    }
    values.update(overrides)
    return Settings(**values)


def services_unavailable(reason: str) -> NoReturn:
    """Skip locally; fail when MDIT_REQUIRE_SERVICES=1 (CI) so CI can't pass by skipping."""
    message = f"{reason}. {START_HINT}"
    if os.environ.get("MDIT_REQUIRE_SERVICES") == "1":
        pytest.fail(message, pytrace=False)
    pytest.skip(message)
