# 家計簿アプリ

家庭内 LAN で完結する家計簿アプリ。収支の登録とレポート集計ができます。

## スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React / TypeScript / Vite |
| バックエンド | Python 3.12 / FastAPI |
| DB | SQLite |
| MCP サーバー | fastmcp (Streamable HTTP) |

## 起動方法

```bash
docker compose up -d
```

| サービス | URL |
|---|---|
| フロントエンド | http://localhost:3000 |
| バックエンド API | http://localhost:8000 |
| MCP サーバー | http://localhost:8001/mcp |

## MCP サーバー

Claude Code や VS Code Copilot Chat から家計簿の操作ができる MCP サーバーを同梱しています。

### 利用できるツール

| カテゴリ | ツール |
|---|---|
| 収支 | get_transactions, get_transaction, create_transaction, update_transaction, delete_transaction |
| メンバー | get_members, get_member, create_member, update_member |
| カテゴリ | get_categories, create_category, update_category |
| 定期取引 | get_scheduled_transactions, create_scheduled_transaction, update_scheduled_transaction, apply_scheduled_transactions |

### Claude Code の設定

`.claude/settings.json` にすでに設定済みです。`docker compose up -d` 後に `/mcp` コマンドで接続確認できます。

```json
{
  "mcpServers": {
    "household-mcp": {
      "type": "http",
      "url": "http://localhost:8001/mcp"
    }
  }
}
```

### VS Code の設定

`.vscode/mcp.json` にすでに設定済みです。Copilot Chat を Agent モードにすると利用できます。

### デバッグ・開発

→ [mcp/README.md](mcp/README.md) を参照

## E2E テスト（Playwright）

```bash
docker compose --profile test up -d
docker exec -it kakeibo-playwright bash
# コンテナ内でテストを実行
```
