"""Application logs go to stdout (PRD 12: never bodies, headers, cookies or secrets)."""

import logging
import sys

FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def configure_logging(level: str) -> None:
    """Configure the `app` logger tree; Uvicorn keeps its own access and error logs."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(FORMAT))
    logger = logging.getLogger("app")
    logger.handlers[:] = [handler]
    logger.setLevel(level)
