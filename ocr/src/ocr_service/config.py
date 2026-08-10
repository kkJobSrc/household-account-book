"""Environment-based configuration for the OCR service.

Kept intentionally simple (module-level constants read once at import
time), mirroring the style of app/backend/database.py and
app/backend/routers/receipt_images.py, which read their tunables from
os.getenv() at module scope rather than via a settings framework.
"""
import os

# PaddleOCR language model loaded at startup (see engine.py). Can be
# overridden per request via the `lang` form field on POST /ocr/process.
OCR_LANG = os.getenv("OCR_LANG", "japan")

# Whether to enable PaddleOCR's text-orientation classifier, which lets it
# recognize text rotated ~180 degrees. Useful for receipt photos taken at
# arbitrary angles; costs a bit of extra inference time.
OCR_USE_ANGLE_CLS = os.getenv("OCR_USE_ANGLE_CLS", "true").strip().lower() in ("1", "true", "yes")

# Optional override for where PaddleOCR stores its downloaded model files.
# When unset, PaddleOCR falls back to its own default of ~/.paddleocr.
# Set this (and mount a named volume at the same path) so models survive
# container rebuilds instead of being re-downloaded every startup.
OCR_MODEL_CACHE_DIR = os.getenv("OCR_MODEL_CACHE_DIR") or None
