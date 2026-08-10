"""Pydantic request/response schemas for the OCR service.

Mirrors the separation style of app/backend/schemas.py: response models
are defined here and referenced from route handlers via `response_model`,
which both validates the outgoing data and drives the OpenAPI schema.
"""
from typing import List

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """GET /health payload.

    status is "starting" while the PaddleOCR model is still loading in the
    background, and "ok" once it is ready to serve /ocr/process requests.
    """

    status: str
    engine: str = "paddleocr"
    model_loaded: bool


class OcrLine(BaseModel):
    """A single recognized line of text within the image."""

    text: str
    confidence: float
    # 4 corner points [[x, y], [x, y], [x, y], [x, y]] as returned by
    # PaddleOCR's text detector, going clockwise from the top-left.
    box: List[List[float]]


class OcrProcessResponse(BaseModel):
    """POST /ocr/process payload."""

    raw_text: str
    lines: List[OcrLine]
    engine: str = "paddleocr"
    processing_time_ms: int
