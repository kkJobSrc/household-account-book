"""OCR microservice: FastAPI app exposing PaddleOCR text extraction.

This service is intentionally independent from the main kakeibo backend,
following the same "standalone uv + Docker service" pattern as mcp/. It
loads the PaddleOCR model asynchronously on startup (via a lifespan
context manager) so the container can report readiness through
GET /health without blocking the event loop while the model initializes.
"""
import asyncio
import io
import time
import traceback
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from ocr_service.config import OCR_LANG
from ocr_service.engine import EngineNotReadyError, engine_manager
from ocr_service.logging_config import logger
from ocr_service.schemas import HealthResponse, OcrLine, OcrProcessResponse


async def _load_model_in_background() -> None:
    """Run the (blocking, potentially slow) model load and log any failure.

    Scheduled as a background task from `lifespan` rather than awaited
    directly, so the app finishes startup and starts serving GET /health
    (reporting "starting") immediately instead of blocking on model load.
    """
    try:
        await engine_manager.startup()
    except Exception:
        logger.error("Failed to load PaddleOCR model:\n%s", traceback.format_exc())


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("OCR service starting up (default lang=%s)...", OCR_LANG)
    load_task = asyncio.create_task(_load_model_in_background())
    yield
    # Best-effort: if the app is shutting down before the model finished
    # loading, don't leave a dangling task warning behind.
    if not load_task.done():
        load_task.cancel()
    logger.info("OCR service shutting down.")


app = FastAPI(
    title="OCR Service",
    description="Standalone PaddleOCR-based text extraction API for receipt images",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
def root():
    return {"message": "OCR service is running"}


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    if engine_manager.model_loaded:
        return HealthResponse(status="ok", engine="paddleocr", model_loaded=True)
    return HealthResponse(status="starting", engine="paddleocr", model_loaded=False)


@app.post("/ocr/process", response_model=OcrProcessResponse)
async def process_image(
    file: UploadFile = File(...),
    lang: Optional[str] = Form(None),
) -> OcrProcessResponse:
    start = time.monotonic()
    raw_bytes = await file.read()

    # Validate & decode with Pillow before handing the image to PaddleOCR,
    # same "fail fast on bad input" approach as
    # app/backend/utils/image_processing.load_and_validate_image.
    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image.load()
        image = image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc

    try:
        ocr = await engine_manager.get(lang)
    except EngineNotReadyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        image_array = np.array(image)
        # PaddleOCR's .ocr() is blocking/CPU-bound; keep it off the event loop.
        result = await asyncio.to_thread(ocr.ocr, image_array, cls=True)
    except Exception:
        logger.error("OCR processing failed:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail="OCR processing failed unexpectedly")

    lines = _parse_ocr_result(result)
    raw_text = "\n".join(line.text for line in lines)
    processing_time_ms = int((time.monotonic() - start) * 1000)

    return OcrProcessResponse(
        raw_text=raw_text,
        lines=lines,
        engine="paddleocr",
        processing_time_ms=processing_time_ms,
    )


def _parse_ocr_result(result) -> list[OcrLine]:
    """Flatten PaddleOCR's `.ocr()` output for a single image into OcrLine models.

    `ocr.ocr(img, cls=True)` returns a list with one entry per input image
    (we only ever pass one), where each entry is either None (nothing
    detected) or a list of [box, (text, confidence)] pairs.
    """
    if not result or result[0] is None:
        return []

    lines: list[OcrLine] = []
    for box, (text, confidence) in result[0]:
        lines.append(OcrLine(text=text, confidence=float(confidence), box=box))
    return lines
