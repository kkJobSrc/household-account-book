FROM python:3.12-slim
WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

ENV PATH="/app/.venv/bin:$PATH"

COPY . .

RUN mkdir -p /app/data /app/logs
RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
