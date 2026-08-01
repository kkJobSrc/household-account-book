"""Image compression and hashing utilities for receipt image uploads.

This module always normalizes uploaded images into JPEG (quality=80) with the
long edge capped at 1024px, and provides a SHA-256 hash helper used for
duplicate detection.
"""
import hashlib
import io

from PIL import Image, ImageOps
import pillow_heif

# Register the HEIC/HEIF opener once at import time so that Image.open()
# can transparently handle .heic/.heif files, same as JPEG/PNG.
pillow_heif.register_heif_opener()

# Formats we accept from the client. Pillow reports the format in upper-case
# (e.g. "JPEG", "PNG", "HEIF").
ALLOWED_FORMATS = {"JPEG", "PNG", "HEIF"}

MAX_LONG_EDGE = 1024
JPEG_QUALITY = 80


class UnsupportedImageError(ValueError):
    """Raised when the uploaded file is not a readable/supported image."""


def load_and_validate_image(raw_bytes: bytes) -> Image.Image:
    """Open raw bytes with Pillow and validate the format.

    Raises UnsupportedImageError if the file cannot be opened or its format
    is not in ALLOWED_FORMATS.
    """
    try:
        image = Image.open(io.BytesIO(raw_bytes))
        # verify() would close the file object, so we re-open for actual use.
        image_format = (image.format or "").upper()
        if image_format not in ALLOWED_FORMATS:
            raise UnsupportedImageError(f"Unsupported image format: {image_format or 'unknown'}")
        # Force loading pixel data now so later corruption is caught here,
        # not when we try to use the image later.
        image.load()
        return image
    except UnsupportedImageError:
        raise
    except Exception as exc:
        raise UnsupportedImageError(f"Failed to open image: {exc}") from exc


def compress_image(image: Image.Image) -> tuple[bytes, int, int]:
    """Normalize an image into a compressed JPEG byte string.

    - Applies EXIF orientation so the saved image looks upright.
    - Resizes so the long edge is at most MAX_LONG_EDGE px (aspect ratio kept).
    - Always re-encodes as JPEG quality=80.

    Returns a tuple of (jpeg_bytes, width, height) reflecting the final,
    post-resize dimensions.
    """
    # Rotate/flip according to EXIF Orientation tag, then drop the tag.
    image = ImageOps.exif_transpose(image)

    # JPEG has no alpha channel; flatten transparency (e.g. from PNG) onto white.
    if image.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", image.size, (255, 255, 255))
        rgba_image = image.convert("RGBA")
        background.paste(rgba_image, mask=rgba_image.split()[-1])
        image = background
    elif image.mode != "RGB":
        image = image.convert("RGB")

    width, height = image.size
    long_edge = max(width, height)
    if long_edge > MAX_LONG_EDGE:
        scale = MAX_LONG_EDGE / long_edge
        new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
        image = image.resize(new_size, Image.LANCZOS)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY)
    return buffer.getvalue(), image.width, image.height


def compute_sha256(data: bytes) -> str:
    """Return the hex-encoded SHA-256 digest (64 chars) of the given bytes."""
    return hashlib.sha256(data).hexdigest()
