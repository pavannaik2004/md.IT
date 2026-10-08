"""Settings come only from environment variables (PRD 10.4, P-052)."""

import pytest
from pydantic import ValidationError

from app.config import Settings, database_url

NAMES = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
    "BLOB_CONNECTION_STRING",
    "BLOB_CONTAINER",
    "LOG_LEVEL",
]
REQUIRED = {
    "DB_HOST": "db.internal",
    "DB_PASSWORD": "secret-password",
    "BLOB_CONNECTION_STRING": "UseDevelopmentStorage=true",
}


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch):
    for name in NAMES:
        monkeypatch.delenv(name, raising=False)

    def set_env(**values: str) -> None:
        for name, value in values.items():
            monkeypatch.setenv(name, value)

    return set_env


def test_reads_required_values_and_defaults(env) -> None:
    env(**REQUIRED)
    settings = Settings()
    assert settings.db_host == "db.internal"
    assert settings.db_port == 3306
    assert settings.db_name == "mdit"
    assert settings.db_user == "mdit"
    assert settings.db_password.get_secret_value() == "secret-password"
    assert settings.blob_container == "mdit-blobs"
    assert settings.log_level == "INFO"


def test_missing_required_values_fail(env) -> None:
    with pytest.raises(ValidationError) as info:
        Settings()
    missing = {error["loc"][0] for error in info.value.errors()}
    assert missing == {"db_host", "db_password", "blob_connection_string"}


def test_secrets_stay_out_of_repr(env) -> None:
    env(**REQUIRED)
    text = repr(Settings())
    assert "secret-password" not in text
    assert "UseDevelopmentStorage" not in text


def test_log_level_ignores_case(env) -> None:
    env(**REQUIRED, LOG_LEVEL="debug")
    assert Settings().log_level == "DEBUG"


def test_rejects_an_unknown_log_level(env) -> None:
    env(**REQUIRED, LOG_LEVEL="loud")
    with pytest.raises(ValidationError):
        Settings()


def test_database_url_keeps_special_characters_in_password(env) -> None:
    env(**{**REQUIRED, "DB_PASSWORD": "p@ss:/w#rd%", "DB_PORT": "3307"})
    url = database_url(Settings())
    assert url.drivername == "mysql+pymysql"
    assert url.username == "mdit"
    assert url.password == "p@ss:/w#rd%"
    assert url.host == "db.internal"
    assert url.port == 3307
    assert url.database == "mdit"
    assert dict(url.query) == {"charset": "utf8mb4"}
    assert "p@ss" not in url.render_as_string(hide_password=True)
