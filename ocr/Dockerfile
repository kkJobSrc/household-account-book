FROM python:3.12-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# PaddleOCR needs libgomp/libgl at runtime for OpenCV; python:3.12-slim does
# not ship them by default.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY src/ ./src/

# PaddleOCR downloads its detection/recognition/classification models on
# first use and caches them under $HOME/.paddleocr (here /root/.paddleocr,
# since the container runs as root). A named volume should be mounted at
# that path in docker-compose so the ~50-150MB models survive rebuilds
# instead of being re-downloaded on every container start.
# (Volume wiring itself happens in a later stage; see ocr_service.config
# for the OCR_MODEL_CACHE_DIR override used to relocate this directory.)

EXPOSE 8002

CMD ["uv", "run", "uvicorn", "ocr_service.main:app", "--host", "0.0.0.0", "--port", "8002"]
