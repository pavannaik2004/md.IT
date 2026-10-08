"""md.IT API. Uvicorn builds it with `--factory app.main:create_app`, so importing this
module never reads the environment."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool

from app.config import Settings
from app.db.session import create_db_engine
from app.errors import install_error_handlers
from app.logging import configure_logging
from app.readiness import ReadinessChecks, build_readiness
from app.routes import health
from app.storage.blobs import BlobStore


def create_app(
    settings: Settings | None = None, readiness: ReadinessChecks | None = None
) -> FastAPI:
    settings = settings or Settings()  # type: ignore[call-arg]  # values come from env vars
    configure_logging(settings.log_level)
    engine = create_db_engine(settings)
    blobs = BlobStore.from_connection_string(
        settings.blob_connection_string.get_secret_value(), settings.blob_container
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Never raises; if Azurite isn't up yet, readiness creates the container later.
        await run_in_threadpool(blobs.ensure_container)
        yield
        engine.dispose()

    app = FastAPI(
        title="md.IT API",
        version="0.1.0",
        lifespan=lifespan,
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url=None,
    )
    app.state.engine = engine
    app.state.blobs = blobs
    app.state.readiness = readiness or build_readiness(engine, blobs)
    install_error_handlers(app)
    app.include_router(health.router)
    return app
