"""The whole app against real MySQL and Azurite."""

import contextlib
import uuid

import pytest
from alembic import command
from azure.core.exceptions import ResourceNotFoundError
from azure.storage.blob import ContainerClient
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.config import Settings
from app.main import create_app
from app.storage.blobs import BlobStore
from tests.support import alembic_config

pytestmark = pytest.mark.integration


def test_ready_against_real_services(
    migrated: Engine, blob_store: BlobStore, test_settings: Settings
) -> None:
    with TestClient(create_app(test_settings)) as client:
        response = client.get("/api/health/ready")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {"database": "ok", "migrations": "ok", "blob": "ok"},
    }


def test_not_ready_until_migrated(
    migrated: Engine, blob_store: BlobStore, test_settings: Settings
) -> None:
    with migrated.begin() as connection:
        command.downgrade(alembic_config(connection), "base")
    try:
        with TestClient(create_app(test_settings)) as client:
            response = client.get("/api/health/ready")
    finally:
        with migrated.begin() as connection:
            command.upgrade(alembic_config(connection), "head")
    assert response.status_code == 503
    assert response.json()["checks"] == {
        "database": "ok",
        "migrations": "unavailable",
        "blob": "ok",
    }


def test_startup_creates_the_blob_container(blob_store: BlobStore, test_settings: Settings) -> None:
    settings = test_settings.model_copy(update={"blob_container": f"test-{uuid.uuid4().hex[:12]}"})
    container = ContainerClient.from_connection_string(
        settings.blob_connection_string.get_secret_value(), settings.blob_container
    )
    try:
        with TestClient(create_app(settings)):
            assert container.exists()
    finally:
        with contextlib.suppress(ResourceNotFoundError):
            container.delete_container()
