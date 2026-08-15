import asyncio
import os
import uuid
from datetime import datetime, date as date_type
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from logger import db_logger, error_logger
from services.ocr_processing import process_pending_receipts
from utils.image_processing import (
    UnsupportedImageError,
    compress_image,
    compute_sha256,
    load_and_validate_image,
)

router = APIRouter(prefix="/receipt-images", tags=["receipt-images"])

# Base directory for storing normalized receipt images.
# Mirrors the DATABASE_URL convention in database.py: the sqlite file lives
# under "./data" relative to the app's working directory (/app in the
# container, where docker-compose mounts the "db-data" volume at /app/data).
RECEIPTS_BASE_DIR = os.getenv("RECEIPTS_DIR", "./data/receipts")

# Per-file and per-request upload size limits (DoS protection).
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB
MAX_REQUEST_SIZE = 100 * 1024 * 1024  # 100MB
CHUNK_SIZE = 1024 * 1024  # 1MB read chunks


async def _read_upload_with_limit(file: UploadFile, remaining_request_budget: int) -> bytes:
    """Read an UploadFile in chunks, enforcing per-file and per-request caps.

    Returns the accumulated bytes on success. Raises ValueError with a
    human-readable reason if the file exceeds MAX_FILE_SIZE, or if reading it
    would exceed the remaining request-wide budget.
    """
    chunks = []
    total = 0
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_FILE_SIZE:
            raise ValueError(f"File exceeds per-file size limit of {MAX_FILE_SIZE} bytes")
        if total > remaining_request_budget:
            raise ValueError("Request-wide upload size limit exceeded")
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/", response_model=schemas.ReceiptImageUploadResponse)
async def upload_receipt_images(
    files: List[UploadFile] = File(...),
    member_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    uploaded: List[schemas.ReceiptImageUploadResult] = []
    rejected: List[schemas.RejectedFile] = []

    request_bytes_used = 0
    request_limit_hit = False

    for upload_file in files:
        filename = upload_file.filename or "unknown"

        if request_limit_hit:
            rejected.append(
                schemas.RejectedFile(filename=filename, reason="Request-wide upload size limit exceeded")
            )
            continue

        remaining_budget = MAX_REQUEST_SIZE - request_bytes_used
        try:
            raw_bytes = await _read_upload_with_limit(upload_file, remaining_budget)
        except ValueError as exc:
            reason = str(exc)
            rejected.append(schemas.RejectedFile(filename=filename, reason=reason))
            if "Request-wide" in reason:
                request_limit_hit = True
            continue
        finally:
            await upload_file.close()

        request_bytes_used += len(raw_bytes)

        # Validate format and decode with Pillow.
        try:
            image = load_and_validate_image(raw_bytes)
            compressed_bytes, width, height = compress_image(image)
        except UnsupportedImageError as exc:
            rejected.append(schemas.RejectedFile(filename=filename, reason=str(exc)))
            continue
        except Exception as exc:
            error_logger.error("Unexpected error processing upload %s: %s", filename, exc)
            rejected.append(schemas.RejectedFile(filename=filename, reason=f"Failed to process image: {exc}"))
            continue

        file_hash = compute_sha256(compressed_bytes)

        # Duplicate detection: if a record with this hash already exists,
        # reuse it instead of writing/storing again.
        existing = db.query(models.ReceiptImage).filter(models.ReceiptImage.file_hash == file_hash).first()
        if existing:
            uploaded.append(
                schemas.ReceiptImageUploadResult(
                    **schemas.ReceiptImageResponse.model_validate(existing).model_dump(),
                    duplicate=True,
                )
            )
            continue

        try:
            today = date_type.today()
            target_dir = os.path.join(RECEIPTS_BASE_DIR, str(today.year), f"{today.month:02d}")
            os.makedirs(target_dir, exist_ok=True)
            stored_filename = f"{uuid.uuid4()}.jpg"
            storage_path = os.path.join(target_dir, stored_filename)
            with open(storage_path, "wb") as fh:
                fh.write(compressed_bytes)

            db_image = models.ReceiptImage(
                member_id=member_id,
                storage_path=storage_path,
                file_hash=file_hash,
                file_size=len(compressed_bytes),
                width=width,
                height=height,
                mime_type="image/jpeg",
                ocr_status=models.OcrStatus.pending,
            )
            db.add(db_image)
            db.commit()
            db.refresh(db_image)
            db_logger.info("receipt image uploaded: id=%s filename=%s", db_image.id, filename)
            uploaded.append(
                schemas.ReceiptImageUploadResult(
                    **schemas.ReceiptImageResponse.model_validate(db_image).model_dump(),
                    duplicate=False,
                )
            )
        except Exception as exc:
            db.rollback()
            error_logger.error("Failed to save receipt image %s: %s", filename, exc)
            rejected.append(schemas.RejectedFile(filename=filename, reason=f"Failed to save image: {exc}"))

    return schemas.ReceiptImageUploadResponse(uploaded=uploaded, rejected=rejected)


@router.get("/", response_model=List[schemas.ReceiptImageResponse])
def get_receipt_images(
    member_id: Optional[int] = None,
    ocr_status: Optional[schemas.OcrStatus] = None,
    linked: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(models.ReceiptImage)
    if member_id is not None:
        query = query.filter(models.ReceiptImage.member_id == member_id)
    if ocr_status is not None:
        query = query.filter(models.ReceiptImage.ocr_status == ocr_status)
    if linked is not None:
        # .any() compiles to a correlated EXISTS subquery, so filtering stays
        # a single SQL statement instead of loading transactions per row.
        if linked:
            query = query.filter(models.ReceiptImage.transactions.any())
        else:
            query = query.filter(~models.ReceiptImage.transactions.any())
    return query.order_by(models.ReceiptImage.id.desc()).offset(skip).limit(limit).all()


@router.get("/{receipt_image_id}", response_model=schemas.ReceiptImageResponse)
def get_receipt_image(receipt_image_id: int, db: Session = Depends(get_db)):
    image = db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Receipt image not found")
    return image


@router.get("/{receipt_image_id}/file")
def get_receipt_image_file(receipt_image_id: int, db: Session = Depends(get_db)):
    image = db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Receipt image not found")
    if not os.path.exists(image.storage_path):
        raise HTTPException(status_code=404, detail="Receipt image file not found")
    return FileResponse(image.storage_path, media_type=image.mime_type)


@router.get("/{receipt_image_id}/ocr-result", response_model=schemas.ReceiptOcrResultResponse)
def get_receipt_ocr_result(receipt_image_id: int, db: Session = Depends(get_db)):
    image = db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Receipt image not found")
    # receipt_ocr_results is append-only history: the highest id is the most
    # recent attempt (see models.ReceiptOcrResult docstring).
    result = (
        db.query(models.ReceiptOcrResult)
        .filter(models.ReceiptOcrResult.receipt_image_id == receipt_image_id)
        .order_by(models.ReceiptOcrResult.id.desc())
        .first()
    )
    if not result:
        raise HTTPException(status_code=404, detail="OCR result not found")
    return result


@router.delete("/{receipt_image_id}")
def delete_receipt_image(receipt_image_id: int, db: Session = Depends(get_db)):
    image = db.query(models.ReceiptImage).filter(models.ReceiptImage.id == receipt_image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Receipt image not found")
    try:
        storage_path = image.storage_path
        db.delete(image)
        db.commit()
        if os.path.exists(storage_path):
            os.remove(storage_path)
        else:
            error_logger.error("Receipt image file missing on delete: id=%s path=%s", receipt_image_id, storage_path)
        db_logger.info("receipt image deleted: id=%s", receipt_image_id)
        return {"message": "Receipt image deleted"}
    except Exception as exc:
        db.rollback()
        error_logger.error("Failed to delete receipt image: id=%s | %s", receipt_image_id, exc)
        raise


@router.post("/ocr/rerun", response_model=schemas.OcrRerunResponse)
async def rerun_ocr(payload: schemas.OcrRerunRequest, db: Session = Depends(get_db)):
    if payload.receipt_image_id is not None:
        image = (
            db.query(models.ReceiptImage)
            .filter(models.ReceiptImage.id == payload.receipt_image_id)
            .first()
        )
        if not image:
            raise HTTPException(status_code=404, detail="Receipt image not found")

    try:
        # Delegate to the same processing function the hourly scheduler
        # uses (see services/ocr_processing.py) so the claim/status-
        # transition logic is never duplicated between the two entry
        # points. process_pending_receipts() does blocking DB + HTTP work,
        # so it's offloaded to a worker thread here to keep the event loop free.
        await asyncio.to_thread(process_pending_receipts, receipt_image_id=payload.receipt_image_id)
        db_logger.info("OCR rerun triggered: receipt_image_id=%s", payload.receipt_image_id)
    except Exception as exc:
        error_logger.error("OCR rerun failed to run: receipt_image_id=%s | %s", payload.receipt_image_id, exc)
        raise

    return schemas.OcrRerunResponse(message="OCR rerun triggered", receipt_image_id=payload.receipt_image_id)
