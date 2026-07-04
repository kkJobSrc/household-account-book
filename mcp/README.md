## MCP サーバーのデバッグ手順

### 前提
- FastAPI サーバーが起動していること（`http://localhost:8000`）
- Node.js がインストールされていること（`npx` を使うため）

### 1. 依存関係のインストール

```bash
cd mcp
uv sync
```

### 2. MCP サーバー単体の起動確認

```bash
uv run household-mcp
```

エラーなく起動すれば OK（Ctrl+C で終了）。

### 3. MCP Inspector で動作確認

```bash
npx @modelcontextprotocol/inspector uv run --directory ./mcp household-mcp
```

ブラウザで `http://localhost:6274` を開き、以下を確認する。

1. 左サイドバーの **Tools** に登録済みツールが表示されるか
2. 各ツールを選択し、引数を入力して **Run Tool** を実行
3. レスポンスが正しく返るか確認

### 4. トラブルシュート

| 症状 | 確認箇所 |
|---|---|
| ツールが一覧に出ない | `server.py` の `mcp.mount()` が正しいか |
| Connection refused | FastAPI サーバーが起動しているか |
| 404 Not Found | エンドポイントのパス（末尾スラッシュ等）を確認 |
| 422 Unprocessable Entity | 引数の型・必須項目が API と一致しているか |
| Validation Error: data.result should be string | ツールの戻り値の型ヒントを確認（`str` か `dict` か） |

### 5. VS Code (Copilot Chat Agent) からの確認

`.vscode/mcp.json` を設定後、Copilot Chat を Agent モードに切り替えて動作確認する。


コードの詳細は [household-account-book](https://github.com/kkJobSrc/household-account-book) を参照。