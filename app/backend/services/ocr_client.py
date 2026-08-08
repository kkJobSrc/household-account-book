"""HTTP client for the standalone OCR microservice (see ocr/).

This client is intentionally synchronous (httpx.Client) because it is only
ever called from synchronous code paths -- services/ocr_processing.py,
which itself is invoked via asyncio.to_thread() by the scheduler and by the
manual re-run endpoint. Keeping the HTTP call synchronous avoids mixing
sync DB sessions with an async HTTP client inside the same worker thread.
"""
import os
from dataclasses import dataclass
from typing import List, Optional

import httpx

# Base URL of the OCR service. Defaults to the docker-compose service name
# ("ocr") on its internal port; override via env for local dev.
OCR_SERVICE_URL = os.getenv("OCR_SERVICE_URL", "http://ocr:8002")

# Default timeout (seconds) for POST /ocr/process. Receipts can take a
# while to run through PaddleOCR, so this is intentionally more generous
# than the 3s health-check timeout.
OCR_REQUEST_TIMEOUT = float(os.getenv("OCR_REQUEST_TIMEOUT", "30"))

# Single engine currently wired up on the OCR service side. Kept as a
# constant here (not an Enum) so adding a second engine later doesn't
# require a schema change -- see models.ReceiptOcrResult.engine.
ENGINE_NAME = "paddleocr"


class OcrClientError(Exception):
    """Base class for errors raised while talking to the OCR service."""


class OcrInvalidImageError(OcrClientError):
    """Maps to HTTP 400: the image itself is unprocessable.

    Retrying without changing the image will not help, so callers should
    mark the receipt as permanently failed.
    """


class OcrEngineNotReadyError(OcrClientError):
    """Maps to HTTP 503, a connection failure, or a request timeout.

    The image is presumably fine; this is a transient condition on the OCR
    service side, so callers should requeue the receipt for the next scan.
    """


class OcrProcessingFailedError(OcrClientError):
    """Maps to HTTP 500 or any other unexpected response.

    Unexpected failure -- callers should mark the receipt as failed and
    leave it for a manual re-run via POST /receipt-images/ocr/rerun.
    """


@dataclass
class OcrProcessResult:
    raw_text: str
    lines: List[dict]
    engine: str
    processing_time_ms: int


def check_health(timeout: float = 3.0) -> bool:
    """Return True only if the OCR service is fully ready to accept work.

    Any failure mode (timeout, connection refused, non-2xx status, a
    malformed body, or a status of "starting") results in False rather
    than raising, so callers can simply skip a scan cycle.
    """
    try:
        response = httpx.get(f"{OCR_SERVICE_URL}/health", timeout=timeout)
        response.raise_for_status()
        data = response.json()
    except (httpx.TimeoutException, httpx.HTTPError, ValueError):
        return False
    return data.get("status") == "ok" and data.get("model_loaded") is True


def process_image(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    lang: Optional[str] = None,
    timeout: float = OCR_REQUEST_TIMEOUT,
) -> OcrProcessResult:
    """Call POST /ocr/process and return a parsed result.

    Raises one of OcrInvalidImageError / OcrEngineNotReadyError /
    OcrProcessingFailedError so the caller can decide the resulting
    receipt_images.ocr_status transition purely by exception type, without
    re-inspecting HTTP status codes itself.
    """
    files = {"file": (filename, file_bytes, mime_type)}
    data = {"lang": lang} if lang else {}

    try:
        response = httpx.post(
            f"{OCR_SERVICE_URL}/ocr/process", files=files, data=data, timeout=timeout
        )
    except httpx.TimeoutException as exc:
        raise OcrEngineNotReadyError(f"OCR request timed out: {exc}") from exc
    except httpx.HTTPError as exc:
        raise OcrEngineNotReadyError(f"OCR service unreachable: {exc}") from exc

    if response.status_code == 200:
        payload = response.json()
        return OcrProcessResult(
            raw_text=payload["raw_text"],
            lines=payload["lines"],
            engine=payload.get("engine", ENGINE_NAME),
            processing_time_ms=payload["processing_time_ms"],
        )
    if response.status_code == 400:
        raise OcrInvalidImageError(_extract_detail(response))
    if response.status_code == 503:
        raise OcrEngineNotReadyError(_extract_detail(response))
    raise OcrProcessingFailedError(_extract_detail(response))


def _extract_detail(response: httpx.Response) -> str:
    try:
        return str(response.json().get("detail", response.text))
    except ValueError:
        return response.text
