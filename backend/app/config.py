"""Settings read from environment variables only (PRD section 10.4, P-052)."""

from typing import Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(frozen=True, extra="ignore")

    db_host: str
    db_port: int = 3306
    db_name: str = "mdit"
    db_user: str = "mdit"
    db_password: SecretStr
    blob_connection_string: SecretStr
    blob_container: str = "mdit-blobs"
    log_level: LogLevel = "INFO"

    @field_validator("log_level", mode="before")
    @classmethod
    def _upper(cls, value: object) -> object:
        return value.upper() if isinstance(value, str) else value


def database_url(settings: Settings) -> URL:
    """Built, not formatted, so passwords need no escaping."""
    return URL.create(
        "mysql+pymysql",
        username=settings.db_user,
        password=settings.db_password.get_secret_value(),
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
        query={"charset": "utf8mb4"},
    )
