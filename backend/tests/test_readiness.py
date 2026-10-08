"""Real readiness checks against services that are down, and logging setup."""

import logging
import time
from collections.abc import Iterator

import pytest

from app.db.session import create_db_engine
from app.logging import configure_logging
from app.readiness import database_check, migrations_check
from tests.support import fake_settings


def test_database_check_reports_an_unreachable_database(caplog: pytest.LogCaptureFixture) -> None:
    engine = create_db_engine(fake_settings())
    started = time.monotonic()
    assert database_check(engine)() is False
    assert time.monotonic() - started < 5
    assert "Database is unavailable" in caplog.text
    engine.dispose()


def test_migrations_check_reports_an_unreachable_database() -> None:
    engine = create_db_engine(fake_settings())
    assert migrations_check(engine, "0001")() is False
    engine.dispose()


@pytest.fixture
def app_logger() -> Iterator[logging.Logger]:
    logger = logging.getLogger("app")
    handlers, level = logger.handlers[:], logger.level
    yield logger
    logger.handlers[:] = handlers
    logger.setLevel(level)


def test_app_logs_go_to_stdout_at_the_configured_level(
    app_logger: logging.Logger, capsys: pytest.CaptureFixture[str]
) -> None:
    configure_logging("WARNING")
    logging.getLogger("app.example").info("hidden line")
    logging.getLogger("app.example").warning("shown line")
    out = capsys.readouterr().out
    assert "shown line" in out
    assert "hidden line" not in out
