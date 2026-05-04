Diagnose issues with the household account book app running on Docker Compose.

## Step 1: コンテナ起動確認

```bash
docker ps --filter "name=kakeibo"
```

両方の STATUS が `Up` であることを確認。片方でも `Exited` なら次を実行:

```bash
docker logs kakeibo-backend --tail 50
docker logs kakeibo-frontend --tail 50
```

## Step 2: コードの変更が反映されているか確認

コードを変更した後に `--build` なしで起動すると古いイメージが使われる。
コンテナ内のファイルと手元のファイルを比較して確認する:

```bash
# コンテナ内のファイル一覧
docker exec kakeibo-backend ls /app/

# コンテナ内で特定ファイルの存在確認
docker exec kakeibo-backend ls /app/logger.py

# イメージのビルド履歴で RUN コマンドを確認
docker image history household_account_book_app-backend --no-trunc | grep -i "mkdir\|COPY"
```

**コードが反映されていない場合は必ず `--build` で再起動する:**

```bash
cd household_account_book_app && docker compose up -d --build
```

## Step 3: ログ出力の確認

```bash
# ログディレクトリの存在確認
docker exec kakeibo-backend ls -la /app/logs/

# 本日のDBログをリアルタイム確認
docker exec kakeibo-backend tail -f /app/logs/db_$(date +%Y-%m-%d).log

# 本日のエラーログ確認
docker exec kakeibo-backend cat /app/logs/error_$(date +%Y-%m-%d).log
```

## Step 4: API の疎通確認

```bash
# ヘルスチェック
curl -s http://localhost:8000/health

# DB書き込みテスト（メンバー作成）
curl -s -L -X POST http://localhost:8000/members/ \
  -H "Content-Type: application/json" \
  -d '{"name":"テスト","color":"#FF0000"}'

# レスポンスが JSON で返れば正常。307 が返る場合はパスの末尾スラッシュを確認する
```

## Step 5: DB の状態確認

```bash
# SQLite に直接クエリ
docker exec kakeibo-backend sqlite3 /app/data/kakeibo.db "SELECT * FROM members;"
docker exec kakeibo-backend sqlite3 /app/data/kakeibo.db "SELECT * FROM transactions ORDER BY id DESC LIMIT 10;"
```

## よくある原因と対処

| 症状 | 原因 | 対処 |
|---|---|---|
| ログファイルが存在しない | `--build` なしで起動し古いイメージを使用 | `docker compose up -d --build` |
| `logger.py` が見つからない | 同上 | 同上 |
| API が 307 を返す | URL の末尾スラッシュ不足 | `/members/` のようにスラッシュを付ける |
| コンテナが Exited になる | 起動時エラー | `docker logs kakeibo-backend` で確認 |
