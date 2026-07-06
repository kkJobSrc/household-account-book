## MCP サーバー

家計簿アプリの操作を Claude Code や VS Code Copilot Chat から行うための MCP サーバー。

### 通常運用（コンテナ）

`docker compose up -d` で MCP サーバーも自動起動します。
トランスポートは **Streamable HTTP**（ポート 8001）で、常駐コンテナとして動きます。

```
Claude Code / VS Code
  └─ HTTP POST → localhost:8001/mcp → kakeibo-mcp コンテナ
                                           └─ HTTP → backend:8000
```

---

## デバッグ方法（stdio・ホスト直接実行）

MCP Inspector を使った対話的なデバッグや、コンテナを使わずにホストで動かすときの手順です。

### 前提

- バックエンドが起動していること（`http://localhost:8000`）
- `uv` がホストにインストールされていること
- Node.js がインストールされていること（MCP Inspector 使用時）

### 手順 1: `server.py` を stdio モードに切り替える

`mcp/src/household_mcp/server.py` の `main()` を以下に変更する：

```python
# デバッグ用（stdio）
def main():
    mcp.run()
```

※ 通常運用に戻すときは `mcp.run(transport="streamable-http", host="0.0.0.0", port=8001)` に戻す。

### 手順 2: `.claude/settings.json` を stdio 設定に切り替える

```json
{
  "mcpServers": {
    "household-mcp": {
      "type": "stdio",
      "command": "uv",
      "args": ["--directory", "./mcp", "run", "household-mcp"],
      "env": { "HOUSEHOLD_API_URL": "http://localhost:8000" }
    }
  }
}
```

※ 通常運用に戻すときは `type: "http"`, `url: "http://localhost:8001/mcp"` に戻す。

### 手順 3: 依存関係のインストールと起動確認

```bash
cd mcp
uv sync
uv run household-mcp
# エラーなく起動すれば OK（Ctrl+C で終了）
```

### 手順 4: MCP Inspector で対話的に確認する

```bash
npx @modelcontextprotocol/inspector uv run --directory ./mcp household-mcp
```

ブラウザで `http://localhost:6274` を開き、以下を確認する：

1. **Tools** に登録済みツールが表示されるか
2. 各ツールを選択して引数を入力し **Run Tool** を実行
3. バックエンドからレスポンスが正しく返るか

---

## トラブルシュート

| 症状 | 確認箇所 |
|---|---|
| ツールが一覧に出ない | `server.py` の `mcp.mount()` が正しいか |
| Connection refused (backend) | バックエンドが起動しているか (`localhost:8000`) |
| Connection refused (mcp コンテナ) | `docker compose up -d mcp` で起動しているか |
| 404 Not Found | エンドポイントのパス（末尾スラッシュ等）を確認 |
| 422 Unprocessable Entity | 引数の型・必須項目が API と一致しているか |
| Not Acceptable エラー | `Accept: application/json, text/event-stream` ヘッダーが必要（Streamable HTTP） |
