"""Minimal logging setup for the OCR service.

Per project rules, log output must never be written outside the workspace.
Rather than managing our own log files/rotation (as app/backend/logger.py
does for the main API), this service logs to stdout only; `docker logs`
(or `uv run` in a terminal) already captures that without needing any
extra file path, and stdout logs are simpler to keep inside the workspace.
"""
import logging
import sys


def _build_logger() -> logging.Logger:
    log = logging.getLogger("ocr_service")
    if not log.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
        log.addHandler(handler)
        log.setLevel(logging.INFO)
        # Don't propagate to the root logger to avoid duplicate lines
        # when uvicorn also attaches handlers to it.
        log.propagate = False
    return log


logger = _build_logger()
