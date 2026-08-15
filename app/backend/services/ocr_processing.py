"""Shared OCR processing logic.

Both the periodic scheduler job (scheduler.py) and the manual re-run
endpoint (POST /receipt-images/ocr/rerun) call process_pending_receipts()
so the claim / process / status-transition logic lives in exactly one
place, per issue #32.

This module is synchronous end-to-end (DB session + HTTP call via
services.ocr_client), because there is no per-request Depends(get_db) to
piggyback on here -- it opens and closes its own SessionLocal(). Callers
running inside the asyncio event loop (scheduler job, rerun endpoint) are
expected to wrap calls to process_pending_receipts() in
asyncio.to_thread() themselves.
"""
import json
import os
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

import models
from database import SessionLocal
from logger import db_logger, error_logger
from services import ocr_client

# Cap on consecutive OCR attempts per receipt image before giving up
# permanently. "Attempt" here means one call into ocr_client.process_image()
# that resulted in a transient failure (OcrEngineNotReadyError) and was
# requeued via _requeue_pending(). Once ocr_attempt_count reaches this value
# (i.e. the initial attempt plus MAX_OCR_ATTEMPTS - 1 retries), the receipt
# is marked "failed" instead of being requeued again.
MAX_OCR_ATTEMPTS = 5


def process_pending_receipts(receipt_image_id: Optional[int] = None) -> None:
    """Scan and OCR receipt images.

    - receipt_image_id given: force-claim that single image regardless of
      its current ocr_status (used for manual re-run; results are appended
      as history even if the image was already completed/failed before).
    - receipt_image_id omitted: claim every currently-pending image, each
      via its own conditional UPDATE, so a second concurrent run (e.g. the
      hourly job firing while a manual re-run is still in flight) cannot
      double-process the same row.
    """
    # db_logger is used for the "skip" warning (not error_logger): error_logger
    # is configured at logging.ERROR level, which would silently swallow a
    # .warning() call. See logger.py.
    if not ocr_client.check_health():
        db_logger.warning(
            "OCR service health check failed; skipping scan (receipt_image_id=%s)",
            receipt_image_id,
        )
        return

    db = SessionLocal()
    try:
        if receipt_image_id is not None:
            if _claim_forced(db, receipt_image_id):
                _process_one(db, receipt_image_id)
        else:
            for image_id in _fetch_pending_ids(db):
                if _claim_pending(db, image_id):
                    _process_one(db, image_id)
    finally:
        db.close()


def _fetch_pending_ids(db: Session) -> List[int]:
    rows = (
        db.query(models.ReceiptImage.id)
        .filter(models.ReceiptImage.ocr_status == models.OcrStatus.pending)
        .all()
    )
    return [row[0] for row in rows]


def _claim_pending(db: Session, receipt_image_id: int) -> bool:
    """Conditionally claim one pending image: UPDATE ... WHERE id=? AND
    ocr_status='pending'. Returns True only if this call won the claim,
    i.e. no other run had already moved it out of "pending".
    """
    rows_matched = (
        db.query(models.ReceiptImage)
        .filter(
            models.ReceiptImage.id == receipt_image_id,
            models.ReceiptImage.ocr_status == models.OcrStatus.pending,
        )
        .update({"ocr_status": models.OcrStatus.processing}, synchronize_session=False)
    )
    db.commit()
    return rows_matched > 0


def _claim_forced(db: Session, receipt_image_id: int) -> bool:
    """Force-claim one image regardless of its current ocr_status, for
    manual re-run. No status condition -- returns True only if a row with
    this id exists at all.
    """
    rows_matched = (
        db.query(models.ReceiptImage)
        .filter(models.ReceiptImage.id == receipt_image_id)
        .update({"ocr_status": models.OcrStatus.processing}, synchronize_session=False)
    )
    db.commit()
    if rows_matched == 0:
        db_logger.warning("OCR rerun requested for unknown receipt_image_id=%s", receipt_image_id)
    return rows_matched > 0


def _process_one(db: Session, receipt_image_id: int) -> None:
    image = db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).first()
    if image is None:
        # Should not happen (we just claimed this row), but guard defensively.
        error_logger.error("Claimed receipt_image_id=%s vanished before processing", receipt_image_id)
        return

    try:
        with open(image.storage_path, "rb") as fh:
            file_bytes = fh.read()
    except OSError as exc:
        error_logger.error("Failed to read receipt image file for OCR: id=%s | %s", receipt_image_id, exc)
        _record_failure(db, receipt_image_id, str(exc))
        return

    filename = os.path.basename(image.storage_path)

    try:
        result = ocr_client.process_image(file_bytes, filename, image.mime_type)
    except ocr_client.OcrInvalidImageError as exc:
        error_logger.error("OCR rejected invalid image: id=%s | %s", receipt_image_id, exc)
        _record_failure(db, receipt_image_id, str(exc))
        return
    except ocr_client.OcrEngineNotReadyError as exc:
        # Image itself is presumably fine; retry on the next scan.
        db_logger.warning("OCR engine not ready/unreachable, requeued: id=%s | %s", receipt_image_id, exc)
        _requeue_pending(db, receipt_image_id)
        return
    except ocr_client.OcrProcessingFailedError as exc:
        error_logger.error("OCR processing failed: id=%s | %s", receipt_image_id, exc)
        _record_failure(db, receipt_image_id, str(exc))
        return
    except Exception as exc:
        # Defensive catch-all: one bad image must not abort the rest of the scan.
        error_logger.error("Unexpected error during OCR: id=%s | %s", receipt_image_id, exc)
        _record_failure(db, receipt_image_id, str(exc))
        return

    _record_success(db, receipt_image_id, result)


def _record_success(db: Session, receipt_image_id: int, result: ocr_client.OcrProcessResult) -> None:
    try:
        db.add(
            models.ReceiptOcrResult(
                receipt_image_id=receipt_image_id,
                engine=result.engine,
                raw_text=result.raw_text,
                raw_json=json.dumps(result.lines, ensure_ascii=False),
                status="completed",
                processing_time_ms=result.processing_time_ms,
            )
        )
        db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).update(
            {
                "ocr_status": models.OcrStatus.completed,
                "ocr_processed_at": datetime.now(timezone.utc),
                # Reset the retry counter now that this receipt has succeeded.
                "ocr_attempt_count": 0,
            },
            synchronize_session=False,
        )
        db.commit()
        db_logger.info(
            "OCR completed: receipt_image_id=%s processing_time_ms=%s",
            receipt_image_id,
            result.processing_time_ms,
        )
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to persist OCR success result: id=%s | %s", receipt_image_id, exc)
        raise


def _record_failure(db: Session, receipt_image_id: int, error_message: str) -> None:
    try:
        db.add(
            models.ReceiptOcrResult(
                receipt_image_id=receipt_image_id,
                engine=ocr_client.ENGINE_NAME,
                status="failed",
                error_message=error_message,
            )
        )
        db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).update(
            {"ocr_status": models.OcrStatus.failed}, synchronize_session=False
        )
        db.commit()
        db_logger.info("OCR failed, recorded as failed: receipt_image_id=%s", receipt_image_id)
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to persist OCR failure result: id=%s | %s", receipt_image_id, exc)
        raise


def _requeue_pending(db: Session, receipt_image_id: int) -> None:
    """Handle a transient OCR failure (503/timeout/connection error).

    Increments ocr_attempt_count first. If that push reaches
    MAX_OCR_ATTEMPTS, the receipt is given up on permanently (status
    "failed" + a ReceiptOcrResult history row, mirroring _record_failure())
    instead of being requeued yet again. Below the cap, behavior is
    unchanged from before: just flip ocr_status back to "pending" so the
    next scan picks it up.
    """
    try:
        image = db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).first()
        if image is None:
            # Should not happen (we just claimed this row), but guard defensively.
            error_logger.error("Requeue requested for missing receipt_image_id=%s", receipt_image_id)
            return

        attempt_count = image.ocr_attempt_count + 1

        if attempt_count >= MAX_OCR_ATTEMPTS:
            db.add(
                models.ReceiptOcrResult(
                    receipt_image_id=receipt_image_id,
                    engine=ocr_client.ENGINE_NAME,
                    status="failed",
                    error_message=f"Max retry attempts ({MAX_OCR_ATTEMPTS}) exceeded",
                )
            )
            db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).update(
                {"ocr_status": models.OcrStatus.failed, "ocr_attempt_count": attempt_count},
                synchronize_session=False,
            )
            db.commit()
            db_logger.info(
                "OCR retry attempts exhausted, marked as failed: receipt_image_id=%s attempt_count=%s",
                receipt_image_id,
                attempt_count,
            )
        else:
            db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).update(
                {"ocr_status": models.OcrStatus.pending, "ocr_attempt_count": attempt_count},
                synchronize_session=False,
            )
            db.commit()
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to requeue receipt image after 503/timeout: id=%s | %s", receipt_image_id, exc)
        raise
