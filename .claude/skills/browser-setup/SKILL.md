---
name: browser-setup
description: Playwright + Chromium の Docker コンテナ起動手順と動作確認スクリプト。UIを含む変更の verify でブラウザが必要なときに参照する。コンテナには全システムライブラリ込みのため sudo 不要。
---

# browser-setup スキル

Playwright + Chromium を Docker コンテナとして起動し、UIのスクリーンショット取得や動作確認を可能にする。
公式イメージに全依存ライブラリ（libnspr4/libnss3 等）が含まれるため、追加インストール不要。

## 前提条件の確認

```bash
# playwright コンテナが起動中かチェック
docker ps --filter "name=kakeibo-playwright" --filter "status=running" --format "{{.Names}}"
```

出力が `kakeibo-playwright` なら準備完了。空ならセットアップへ進む。

## セットアップ手順

### 1. playwright コンテナを起動する

```bash
cd household_account_book_app
docker compose --profile test up -d playwright
```

### 2. 起動確認

```bash
docker ps --filter "name=kakeibo-playwright"
```

`STATUS` が `Up` であれば完了。

## 動作確認スクリプト（起動後）

```python
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 390, "height": 844})  # iPhone 14
    page.goto("http://localhost:3000/<path>")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    page.screenshot(path="/tmp/verify_screenshot.png", full_page=True)
    browser.close()
```

スクリプトをファイルに保存して実行:

```bash
docker compose exec playwright python3 /workspace/.claude/skills/verify/screenshot.py
```

## トラブルシューティング

| エラー | 原因 | 対処 |
|---|---|---|
| `container not found` | コンテナ未起動 | セットアップ手順1を実行 |
| `Error response from daemon: pull access denied` | イメージ取得失敗 | Docker Hub へのネットワーク疎通を確認 |
| `http://localhost:3000` に接続できない | frontend コンテナが未起動 | `docker compose up -d` で frontend を先に起動 |
| `No such service: playwright` | docker-compose.yml に記載なし | docker-compose.yml の playwright サービス定義を確認 |
