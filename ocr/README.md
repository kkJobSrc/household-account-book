## OCR サービス

レシート画像からテキストを抽出する、`app/backend/` から独立した PaddleOCR ベースの FastAPI サービス。
`mcp/` と同じ「uv + Docker で構成する独立サービス」の流儀を踏襲しており、まだ `app/backend/` 側からは呼び出されていません（連携は別段階で対応）。

### エンドポイント

- `GET /health` → `{"status": "ok"|"starting", "engine": "paddleocr", "model_loaded": bool}`
  起動直後はモデルロード中のため `starting` を返す。
- `POST /ocr/process`（`multipart/form-data`）
  - `file`（必須）: 画像ファイル
  - `lang`（任意）: 指定した場合、そのリクエストのみ言語モデルを切り替える（初回はロードが走るため応答が遅くなる）
  - レスポンス: `{"raw_text": str, "lines": [{"text", "confidence", "box"}], "engine": "paddleocr", "processing_time_ms": int}`

### ローカル起動

```bash
cd ocr
uv sync
uv run uvicorn ocr_service.main:app --reload --port 8002
```

初回起動時、PaddleOCR が検出・認識・分類の各モデル（言語ごとに数十〜百数十MB）を自動ダウンロードする。
キャッシュ先はデフォルトで `~/.paddleocr`。`OCR_MODEL_CACHE_DIR` 環境変数で変更可能。

### 環境変数

| 変数 | デフォルト | 説明 |
|---|---|---|
| `OCR_LANG` | `japan` | 起動時にロードするPaddleOCRの言語モデル |
| `OCR_USE_ANGLE_CLS` | `true` | 180度回転したテキストを検出する分類器を使うか |
| `OCR_MODEL_CACHE_DIR` | 未設定（PaddleOCR既定の`~/.paddleocr`を使用） | モデルファイルのキャッシュ先ディレクトリ |
