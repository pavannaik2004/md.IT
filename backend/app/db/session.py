"""Database engine and per-request sessions."""

from collections.abc import Iterator

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.config import Settings, database_url


def create_db_engine(settings: Settings) -> Engine:
    """Lazy: nothing connects until first use. Stored times are UTC (P-049)."""
    return create_engine(
        database_url(settings),
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={"connect_timeout": 2, "init_command": "SET time_zone = '+00:00'"},
    )


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, closed afterwards."""
    with Session(request.app.state.engine) as session:
        yield session
