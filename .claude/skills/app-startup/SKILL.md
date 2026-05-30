---
name: app-startup
description: バグ診断時にDockerアプリを起動し、実際のHTTPエラーとログを確認する手順。dev-team-leadがバグ修正タスクの事前診断（Phase 0）で使用する。「アプリが動かない」「エラーが出る」タスクでは必ずこのスキルを参照してから調査に入る。
---

# アプリ起動・エラー確認手順

コードを読む前にアプリを実際に動かしてエラーを確認する。推測で全ファイルを読む前に、HTTPステータスとログメッセージから調査の方向を絞るのが目的。

## Step 1: コンテナの起動

```bash
cd /home/kobayashi/household-account-book/household_account_book_app
docker compose up -d
```

起動確認:

```bash
docker ps --filter "name=kakeibo"
```

両方の STATUS が `Up` であることを確認する。片方でも `Exited` なら Step 4 のログ確認へ進む。

## Step 2: 実際のAPIを叩いてエラーを確認

バグの内容に応じてエンドポイントを変えて叩く。以下は一例:

```bash
# PUT（更新）のエラー確認例
curl -s -X PUT "http://localhost:8000/transactions/1" \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":1000,"date":"2026-05-09","memo":"test"}' \
  | python3 -m json.tool

# POST（作成）のエラー確認例
curl -s -X POST "http://localhost:8000/members/" \
  -H "Content-Type: application/json" \
  -d '{"name":"テスト","color":"#FF0000"}' \
  | python3 -m json.tool

# ヘルスチェック
curl -s http://localhost:8000/health
```

**レスポンスの読み方**:
- `4xx` → リクエスト・バリデーションの問題。レスポンスボディのエラーメッセージを確認
- `5xx` → バックエンドの内部エラー。Step 4 のログを確認
- `307 Redirect` → URLの末尾スラッシュが必要（例: `/members/`）

## Step 3: コードが反映されているか確認

コード変更後に `--build` なしで起動すると古いイメージが使われる:

```bash
# コンテナ内のファイルと手元のファイルを比較
docker exec kakeibo-backend ls /app/

# 変更したファイルが存在するか確認（例: logger.py）
docker exec kakeibo-backend ls /app/logger.py
```

古いイメージが使われている場合は必ず `--build` で再起動する:

```bash
cd /home/kobayashi/household-account-book/household_account_book_app
docker compose up -d --build
```

## Step 4: エラーログの確認

```bash
# 直近30行のバックエンドログ
docker logs kakeibo-backend --tail 30

# 本日のDBログをリアルタイム確認
docker exec kakeibo-backend tail -f /app/logs/db_$(date +%Y-%m-%d).log

# 本日のエラーログ
docker exec kakeibo-backend cat /app/logs/error_$(date +%Y-%m-%d).log
```

**得られた情報をもとに調査する**:
- Traceback → ファイル名・行番号が原因箇所を示す → そのファイルを読む
- HTTP 422 Unprocessable Entity → Pydantic バリデーションエラー → schemas.py を確認
- HTTP 500 → バックエンドの未捕捉例外 → routers/ を確認
