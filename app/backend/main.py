import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import members, categories, transactions, reports, scheduled_transactions, receipt_images
from scheduler import shutdown_scheduler, start_scheduler
from seed import seed
from logger import error_logger
# Importing this module registers the HEIC/HEIF opener with Pillow at
# startup, so receipt uploads in that format can be opened anywhere in the app.
import utils.image_processing  # noqa: F401

# Schema creation/migration is now fully managed by Alembic
# (see alembic/ and entrypoint.sh). This module no longer touches DDL.


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed default category data, then start the hourly receipt
    # OCR scan job. @app.on_event is deprecated in FastAPI, so lifespan is
    # used instead (see issue #32).
    seed()
    start_scheduler()
    yield
    # Shutdown: stop the scheduler before the process exits so no job fires
    # against a DB connection that's already being torn down.
    shutdown_scheduler()


app = FastAPI(
    title="家計簿API",
    description="家族で使える家計簿アプリのAPI",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS設定（家庭内Wi-Fi利用を想定）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
app.include_router(members.router)
app.include_router(categories.router)
app.include_router(transactions.router)
app.include_router(reports.router)
app.include_router(scheduled_transactions.router)
app.include_router(receipt_images.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    error_logger.error(
        "Unhandled error: %s %s | %s | %s",
        request.method,
        request.url,
        type(exc).__name__,
        traceback.format_exc(),
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/")
def root():
    return {"message": "家計簿API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
