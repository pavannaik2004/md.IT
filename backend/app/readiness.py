"""Readiness checks (P-050): each answers within a few seconds, never raises, and logs why."""

import logging
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.storage.blobs import BlobStore

log = logging.getLogger(__name__)

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


@dataclass(frozen=True)
class ReadinessChecks:
    database: Callable[[], bool]
    migrations: Callable[[], bool]
    blob: Callable[[], bool]


def head_revision() -> str | None:
    return ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_current_head()


def database_check(engine: Engine) -> Callable[[], bool]:
    def check() -> bool:
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
        except SQLAlchemyError:
            log.warning("Database is unavailable", exc_info=True)
            return False
        return True

    return check


def migrations_check(engine: Engine, head: str | None) -> Callable[[], bool]:
    def check() -> bool:
        try:
            with engine.connect() as connection:
                current = connection.execute(
                    text("SELECT version_num FROM alembic_version")
                ).scalar_one_or_none()
        except SQLAlchemyError:
            log.warning("Migration state is unavailable", exc_info=True)
            return False
        if current != head:
            log.warning("Database is at revision %s; expected %s", current, head)
            return False
        return True

    return check


def build_readiness(engine: Engine, blobs: BlobStore) -> ReadinessChecks:
    return ReadinessChecks(
        database=database_check(engine),
        migrations=migrations_check(engine, head_revision()),
        # Creates the container when missing, so a backend that started before Azurite recovers.
        blob=blobs.ensure_container,
    )
