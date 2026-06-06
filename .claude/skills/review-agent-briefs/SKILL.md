---
name: review-agent-briefs
description: レビューチームの作業分担アナウンスと4エージェント（data-integrity-reviewer, ui-ux-reviewer, security-expert, code-reviewer）への指示テンプレート。review-team-leadのPhase 1+2で使用する。レビュー開始時に必ず参照する。
---

# レビューエージェント指示テンプレート

## Phase 1: 作業分担アナウンス

レビュー開始時に必ず以下のアナウンスを出力する:

```
## レビュー開始：作業分担

【データ整合性担当】担当ファイル：
  - backend/database.py（セッション管理）
  - backend/models.py（制約定義）
  - backend/routers/transactions.py（書き込み処理）
  - backend/routers/members.py / categories.py（削除時の参照整合性）
  - backend/main.py（例外処理）
  - docker-compose.yml（DBボリューム）

【UI/UX担当】担当ファイル：
  - frontend/src/pages/Transactions.tsx（メインフォーム）
  - frontend/src/pages/Dashboard.tsx / Members.tsx / Reports.tsx
  - frontend/src/api/index.ts / client.ts（エラーハンドリング）
  - frontend/src/types/index.ts（型とフォームの整合性）

【セキュリティ担当】担当範囲：
  - 今回の変更箇所全体（git diff ベース）
  - OWASP Top 10 を軸に脆弱性を検出

【アーキテクチャ担当】担当範囲：
  - 今回の変更箇所全体（git diff ベース）
  - 拡張性低下・責務混在・保守性リスクを検出

4エージェントを並列起動します。
```

## Phase 2: 各エージェントへの指示テンプレート

**4エージェントを必ず同時に（並列で）起動する。**

### `data-integrity-reviewer` への指示

```
このプロジェクトのバックエンドコードのデータ整合性をレビューしてください。カレントディレクトリがプロジェクトルートです。以下のファイルを読んで分析してください：
- `household_account_book_app/backend/database.py`
- `household_account_book_app/backend/models.py`
- `household_account_book_app/backend/routers/transactions.py`
- `household_account_book_app/backend/routers/members.py`
- `household_account_book_app/backend/routers/categories.py`
- `household_account_book_app/backend/main.py`
- `household_account_book_app/docker-compose.yml`
並行書き込み・トランザクション処理・外部キー制約・入力バリデーション（バックエンド側）の問題を検出してください。
```

### `ui-ux-reviewer` への指示

```
このプロジェクトのフロントエンドコードのUI/UXをレビューしてください。カレントディレクトリがプロジェクトルートです。以下のファイルを読んで分析してください：
- `household_account_book_app/frontend/src/pages/Transactions.tsx`
- `household_account_book_app/frontend/src/pages/Dashboard.tsx`
- `household_account_book_app/frontend/src/pages/Members.tsx`
- `household_account_book_app/frontend/src/pages/Reports.tsx`
- `household_account_book_app/frontend/src/api/index.ts`
- `household_account_book_app/frontend/src/api/client.ts`
- `household_account_book_app/frontend/src/types/index.ts`
エラー表示・フォーム操作性・ローディング・モバイル対応の問題を検出してください。ユーザーは家族2人（非エンジニア）です。
```

### `security-expert` への指示

```
このプロジェクトの今回の変更箇所に対してセキュリティレビューを実施してください。カレントディレクトリがプロジェクトルートです。
まず `git diff main` で変更内容を確認し、変更されたファイルを重点的にレビューしてください。
OWASP Top 10 を軸に、このPRの変更範囲に絞って明らかな脆弱性を報告してください。
変更がない領域の指摘は不要です。今回の変更で新たに生じたリスクを優先してください。
```

### `code-reviewer` への指示

```
このプロジェクトの今回の変更箇所に対してアーキテクチャ・コード品質レビューを実施してください。カレントディレクトリがプロジェクトルートです。
まず `git diff main` で変更内容を確認し、変更されたファイルを重点的にレビューしてください。
特に「拡張性の低下」「責務の混在」「将来の変更を困難にする設計」「保守性の低下」を優先して報告してください。
変更がない領域の指摘は不要です。今回の変更で新たに生じた問題を優先してください。
```
