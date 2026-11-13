"""Engine and per-request sessions."""

import ssl
from types import SimpleNamespace

import pytest
from sqlalchemy import Engine, text

from app.config import DatabaseSettings
from app.db.session import connect_args, create_db_engine, get_session
from tests.support import fake_settings


def test_connect_args_have_no_ssl_by_default() -> None:
    args = connect_args(fake_settings(), 30)
    assert "ssl" not in args
    assert args["connect_timeout"] == 2
    assert args["read_timeout"] == 30
    assert args["write_timeout"] == 30
    assert args["init_command"] == "SET time_zone = '+00:00'"


def test_db_ssl_verifies_server_certificate() -> None:
    # Azure Database for MySQL requires TLS (Phase 7); the certificate and name are checked.
    context = connect_args(fake_settings(db_ssl=True), 30)["ssl"]
    assert isinstance(context, ssl.SSLContext)
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname is True


def test_db_ssl_reads_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DB_HOST", "mysql")
    monkeypatch.setenv("DB_PASSWORD", "unused")
    monkeypatch.setenv("DB_SSL", "true")
    assert DatabaseSettings().db_ssl is True  # type: ignore[call-arg]  # values come from env vars


def test_engine_uses_pymysql_without_connecting() -> None:
    engine = create_db_engine(fake_settings())
    assert engine.url.drivername == "mysql+pymysql"
    assert engine.url.port == 1
    engine.dispose()


def test_engine_hides_parameters() -> None:
    # SQL parameters can carry document paths, messages and token hashes; keep them out of logs.
    engine = create_db_engine(fake_settings())
    assert engine.hide_parameters is True
    engine.dispose()


@pytest.mark.integration
def test_connections_use_utc_and_utf8mb4(engine: Engine) -> None:
    with engine.connect() as connection:
        zone, charset = connection.execute(
            text("SELECT @@session.time_zone, @@character_set_connection")
        ).one()
    assert zone == "+00:00"
    assert charset == "utf8mb4"


@pytest.mark.integration
def test_get_session_yields_a_working_session(engine: Engine) -> None:
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(engine=engine)))
    sessions = get_session(request)  # type: ignore[arg-type]
    session = next(sessions)
    assert session.execute(text("SELECT 1")).scalar_one() == 1
    sessions.close()
