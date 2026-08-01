# ローカル検証用の.venvがDockerビルドを壊す

**日付**: 2026-08-01
**作業種別**: 実装(build-validationスキルによる整合性チェック中)
**試行回数**: 2回

## 発生した失敗

`docker compose up -d --build` 実行後、`kakeibo-backend` コンテナが `unhealthy` になり起動失敗。
`docker logs kakeibo-backend` で以下のエラー:

```
exec /app/.venv/bin/uvicorn: no such file or directory
```

## 原因

build-validationスキルのStep 4「Python インポートエラー確認」を実施するため、ローカルで
`cd app/backend && uv sync --frozen --no-dev --no-install-project` を実行し `.venv` を作成した。

`app/backend` に `.dockerignore` が存在しないため、Dockerfile内の `COPY . .` がこのローカル
`.venv`（uvキャッシュパスへのシンボリックリンクを含む、ホスト環境専用のvenv）をイメージ内に
コピーし、Dockerfile内で `uv sync` によって正しく構築された `.venv` を上書きしてしまった。
結果、コンテナ内の `.venv/bin/uvicorn` が壊れたシンボリックリンクとなり起動不能になった。

## 回避策・解決方法

1. ローカルで作成した `app/backend/.venv` を `rm -rf` で削除する
2. `docker compose up -d --build` を再実行し、Dockerfile内の `uv sync` で正規の `.venv` を再構築させる
3. 復旧後 `docker logs kakeibo-backend` で `Uvicorn running on http://0.0.0.0:8000` を確認

## 再発防止メモ

- **恒久対策(未実施・推奨)**: `app/backend/.dockerignore` に `.venv` を追加すべき。今回はissueスコープ外のため実施していないが、次回同種の作業時に対応を検討する。
- ローカルでPythonのインポート確認をする際は、`uv run python -c "..."` を使うと一時的な実行になり `.venv` が作業ディレクトリに永続化されない場合がある(ただし本プロジェクトの `pyproject.toml` は `hatchling` のパッケージ検出に失敗するため `uv run` は使えず、`uv sync --no-install-project` + `.venv/bin/python` を使わざるを得なかった)。
- 作業後は必ず `git status` で意図しない `.venv` 等の生成物が残っていないか確認すること。

## 関連ファイル

- `app/backend/Dockerfile`
- `app/backend/pyproject.toml`(`.dockerignore` が存在しない)
