"""APScheduler wiring for the periodic receipt-OCR scan.

Started and stopped from main.py's lifespan context manager (FastAPI's
@app.on_event is deprecated, so lifespan is used instead per issue #32).

AsyncIOScheduler runs its jobs on the same asyncio event loop uvicorn uses,
so the scheduled job itself must stay non-blocking: the actual work
(synchronous DB access + synchronous HTTP call to the OCR service) lives in
services.ocr_processing.process_pending_receipts(), which we offload to a
worker thread via asyncio.to_thread().
"""
import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from logger import db_logger, error_logger
from services.ocr_processing import process_pending_receipts

scheduler = AsyncIOScheduler()

_JOB_ID = "receipt_ocr_scan"


async def _scan_job() -> None:
    try:
        await asyncio.to_thread(process_pending_receipts)
    except Exception:
        # process_pending_receipts already logs per-image failures; this is
        # a last-resort guard so an unexpected error doesn't disappear into
        # APScheduler's internal exception handling unnoticed.
        error_logger.error("Scheduled OCR scan job raised an unexpected error", exc_info=True)


def start_scheduler() -> None:
    scheduler.add_job(
        _scan_job,
        trigger=IntervalTrigger(hours=1),
        id=_JOB_ID,
        # Never run two scans concurrently, and if a run is overdue after
        # e.g. a slow startup, only fire it once instead of catching up.
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    db_logger.info("OCR scan scheduler started (interval=1h)")


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        db_logger.info("OCR scan scheduler shut down")
