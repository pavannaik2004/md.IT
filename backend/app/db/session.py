"""Database engine and per-request sessions."""

import ssl
from collections.abc import Iterator
from typing import Annotated, Any

from fastapi import Depends, Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from app.config import DatabaseSettings, database_url


def create_db_engine(settings: DatabaseSettings, *, io_timeout: int = 30, **pool: Any) -> Engine:
    """Lazy: nothing connects until first use. Stored times are UTC (P-049).

    `io_timeout` bounds every read and write, so a database that accepts connections but
    never answers can't block a request (or a health check) forever.
    """
    return create_engine(
        database_url(settings),
        pool_pre_ping=True,
        pool_recycle=3600,
        # Parameters can carry paths, messages and token hashes; never in error text or logs.
        hide_parameters=True,
        connect_args=connect_args(settings, io_timeout),
        **pool,
    )


def connect_args(settings: DatabaseSettings, io_timeout: int) -> dict[str, Any]:
    """PyMySQL options. With DB_SSL, TLS uses the system CAs and checks the server's name."""
    args: dict[str, Any] = {
        "connect_timeout": 2,
        "read_timeout": io_timeout,
        "write_timeout": io_timeout,
        "init_command": "SET time_zone = '+00:00'",
    }
    if settings.db_ssl:
        args["ssl"] = ssl.create_default_context()
    return args


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, closed afterwards."""
    with Session(request.app.state.engine) as session:
        yield session


DbSession = Annotated[Session, Depends(get_session)]
