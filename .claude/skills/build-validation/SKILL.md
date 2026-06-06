---
name: build-validation
description: 実装完了後にフロントエンド(TypeScript)とバックエンド(Python)のビルドエラーと型整合性を検証する手順。dev-team-leadのPhase 3（整合性チェック）で使用する。実装後・コミット前に必ず実行する。
---

# ビルド検証・型整合性チェック手順

専門家エージェントの報告を鵜呑みにせず、型とエンドポイントを自分で突き合わせる。ビルドエラーがあればコミット前に該当エージェントへ差し戻す。

## Step 1: スキーマと型定義の目視確認

バックエンドとフロントエンドのキー定義を並べて比較する:

```bash
# バックエンドの Response / Create スキーマを列挙
grep -n "class.*Response\|class.*Create\|class.*Update" \
  household_account_book_app/backend/schemas.py
```

次に `frontend/src/types/index.ts` を読み、フィールド名・型がスキーマと一致するかを確認する。不一致があれば Step 3 を実行する前にフロントエンド担当へ修正を依頼する。

## Step 2: エンドポイントの整合性確認

`api/index.ts` のURLが実際のルーターと一致しているかを確認する:

```bash
# バックエンドのルーター prefix を列挙
grep -n 'prefix=' \
  household_account_book_app/backend/routers/*.py

# フロントエンドのAPI呼び出しURLを確認
grep -n 'api\.' \
  household_account_book_app/frontend/src/api/index.ts
```

## Step 3: TypeScript コンパイルエラー確認

型の不整合は実行時ではなくビルド時に検出できる:

```bash
cd household_account_book_app/frontend && npm run build 2>&1 | tail -20
```

エラーがなければ `Successfully compiled` または `✓ built in` が表示される。エラーがあればエラーメッセージのファイル名・行番号を frontend-educator に伝えて修正を依頼する。

## Step 4: Python インポートエラー確認

スキーマ・モデルのインポートが通ることを確認する:

```bash
cd household_account_book_app/backend && python -c "import schemas; import models; print('OK')"
```

`OK` が表示されれば問題なし。`ModuleNotFoundError` や `ImportError` があればエラーメッセージを backend-engineer に伝えて修正を依頼する。

## エラー時の対処

| エラーの種類 | 差し戻し先 | 伝える情報 |
|---|---|---|
| TypeScript 型エラー | `frontend-educator` | エラーメッセージ・ファイル名・行番号 |
| Python ImportError | `backend-engineer` | エラーメッセージ・該当モジュール名 |
| スキーマとの型不一致 | `frontend-educator` | バックエンドの実際の型・フロントの定義 |
| エンドポイントURLの不一致 | `frontend-educator` | 正しいURL（バックエンドの prefix から） |

ビルドエラーが解消されるまで完了レポートを出力しない。
