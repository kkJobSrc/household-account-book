import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import engine
import models
from routers import members, categories, transactions, reports
from seed import seed
from logger import error_logger

# テーブル作成
models.Base.metadata.create_all(bind=engine)

# 初期データ投入
seed()

app = FastAPI(
    title="家計簿API",
    description="家族で使える家計簿アプリのAPI",
    version="1.0.0"
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
