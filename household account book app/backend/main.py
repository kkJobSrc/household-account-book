from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
from routers import members, categories, transactions, reports
from seed import seed

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


@app.get("/")
def root():
    return {"message": "家計簿API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
