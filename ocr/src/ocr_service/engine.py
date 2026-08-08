"""PaddleOCR engine wrapper.

Encapsulates lazy, non-blocking model loading so the FastAPI app can
report readiness (GET /health) without blocking the event loop while the
(CPU-heavy, possibly network-downloading) PaddleOCR model initializes.
"""
import asyncio
import os
import time
from typing import Dict, Optional

from paddleocr import PaddleOCR

from ocr_service.config import OCR_LANG, OCR_MODEL_CACHE_DIR, OCR_USE_ANGLE_CLS
from ocr_service.logging_config import logger


class EngineNotReadyError(RuntimeError):
    """Raised when an OCR request arrives before the default model has loaded."""


class OcrEngineManager:
    """Owns PaddleOCR instances, keyed by language.

    The default-language instance is loaded once at startup via
    `startup()` (called from the FastAPI lifespan, fired-and-forgotten so
    it does not block app boot). Other languages requested per-call (the
    `lang` form field on POST /ocr/process) are loaded lazily on first use
    and cached for subsequent requests.

    All PaddleOCR construction is blocking (model init and, on first run,
    model download), so it must only ever run inside asyncio.to_thread(),
    never directly on the event loop.
    """

    def __init__(self, default_lang: str = OCR_LANG):
        self.default_lang = default_lang
        self._instances: Dict[str, PaddleOCR] = {}
        # Guards both _instances mutation and concurrent duplicate loads:
        # without this, two requests for the same new language could each
        # kick off their own (expensive) PaddleOCR construction.
        self._lock = asyncio.Lock()
        self.model_loaded = False

    def _build(self, lang: str) -> PaddleOCR:
        """Blocking construction. Only call via asyncio.to_thread()."""
        logger.info("Loading PaddleOCR model (lang=%s)...", lang)
        start = time.monotonic()
        kwargs = dict(use_angle_cls=OCR_USE_ANGLE_CLS, lang=lang, use_gpu=False, show_log=False)
        if OCR_MODEL_CACHE_DIR:
            # Point PaddleOCR at a custom cache location instead of its
            # built-in default (~/.paddleocr). The directory names below
            # don't need to match PaddleOCR's own internal layout -- it
            # only uses them as a plain download/extract target per model.
            kwargs["det_model_dir"] = os.path.join(OCR_MODEL_CACHE_DIR, "det", lang)
            kwargs["rec_model_dir"] = os.path.join(OCR_MODEL_CACHE_DIR, "rec", lang)
            kwargs["cls_model_dir"] = os.path.join(OCR_MODEL_CACHE_DIR, "cls")
        instance = PaddleOCR(**kwargs)
        elapsed = time.monotonic() - start
        logger.info("PaddleOCR model loaded in %.2fs (lang=%s)", elapsed, lang)
        return instance

    async def startup(self) -> None:
        """Load the default-language model in the background at app startup."""
        async with self._lock:
            if self.default_lang not in self._instances:
                self._instances[self.default_lang] = await asyncio.to_thread(self._build, self.default_lang)
        self.model_loaded = True

    async def get(self, lang: Optional[str] = None) -> PaddleOCR:
        """Return a ready PaddleOCR instance for `lang` (default lang if omitted).

        Raises EngineNotReadyError if the default model has not finished
        loading yet, even when a different `lang` is requested -- this
        keeps /health's readiness semantics simple and predictable.
        """
        if not self.model_loaded:
            raise EngineNotReadyError("OCR engine is still starting up")

        target_lang = lang or self.default_lang
        if target_lang in self._instances:
            return self._instances[target_lang]

        async with self._lock:
            # Re-check after acquiring the lock: another request may have
            # already loaded this language while we were waiting on it.
            if target_lang not in self._instances:
                self._instances[target_lang] = await asyncio.to_thread(self._build, target_lang)
        return self._instances[target_lang]


# Module-level singleton shared by the FastAPI lifespan and route handlers.
engine_manager = OcrEngineManager()
