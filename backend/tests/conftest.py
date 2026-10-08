"""Fixtures for integration tests against MySQL and Azurite (P-047)."""

from collections.abc import Iterator

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import OperationalError

from app.config import Settings
from app.db.session import create_db_engine
from tests.support import make_test_settings, services_unavailable


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    return make_test_settings()


@pytest.fixture(scope="session")
def engine(test_settings: Settings) -> Iterator[Engine]:
    engine = create_db_engine(test_settings)
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except OperationalError:
        engine.dispose()
        services_unavailable(
            f"MySQL is not reachable at {test_settings.db_host}:{test_settings.db_port}"
        )
    yield engine
    engine.dispose()
