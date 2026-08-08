# WALモードのSQLiteを`cp`でバックアップすると不完全になる

**日付**: 2026-08-08
**作業種別**: 実装(issue #32 Alembic導入、稼働中DBへのstamp/migration前バックアップ)
**試行回数**: 2回

## 発生した失敗

issue #32のAlembic導入にあたり、稼働中の`kakeibo-backend`コンテナ内のSQLiteファイル
（`/app/data/kakeibo.db`）を`alembic stamp head`実行前にバックアップする際、単純に
`cp /app/data/kakeibo.db backup.db` を実行した。

生成されたバックアップファイルのサイズが4096バイトしかなく、同時に存在する
`kakeibo.db-wal`（362KB）と比べて不自然に小さいことに気づいた。実データ
（取引191件など）が反映されていない、不完全なバックアップになっていた。

## 原因

`database.py`で`PRAGMA journal_mode=WAL`を設定しているため、DBはWALモードで稼働している。
WALモードでは直近の書き込みが`kakeibo.db`本体ではなく`kakeibo.db-wal`（Write-Ahead Log）
に溜まっており、チェックポイントが実行されるまで本体ファイルには反映されない。
そのため`kakeibo.db`単体を`cp`しても、`-wal`ファイルの内容を含まない、チェックポイント時点
（今回は6月21日）のスナップショットしか複製できていなかった。

## 回避策・解決方法

Pythonの`sqlite3`モジュールが提供するオンラインバックアップAPI（`Connection.backup()`）を使う。
これはSQLite公式のBackup APIを内部で使っており、WALの内容も含めて安全に一貫性のある
コピーを作成できる。

```python
import sqlite3
src = sqlite3.connect("/app/data/kakeibo.db")
dst = sqlite3.connect("/app/data/kakeibo.db.bak.<timestamp>")
src.backup(dst)
src.close()
dst.close()
```

実行後、バックアップファイルは77KB程度になり、`PRAGMA integrity_check`が`ok`、
各テーブルの行数が本体と一致することを確認した。

なお、`app/backend/entrypoint.sh`（今回のAlembic導入で新規作成）のコンテナ起動時
自動バックアップも、単純な`cp`ではなくこの方式に倣うべきか検討したが、コンテナ起動直後は
WALが空に近い状態であることが多く、また万一不完全でも次回の`cp`バックアップが上書きされず
別名で残る設計にしているため、今回はentrypoint.sh側の`cp`はそのまま残した。**本番相当DBに
対して手動でバックアップを取る場合は、必ずPythonの`sqlite3.Connection.backup()`かSQLite CLIの
`.backup`コマンドを使うこと。**

## 再発防止メモ

- WALモード（`journal_mode=WAL`）のSQLiteファイルを`cp`だけでバックアップしないこと。
  バックアップファイルのサイズが元のDBファイル単体と近い/小さすぎる場合は要注意のサイン。
- 稼働中コンテナ内で`sqlite3` CLIバイナリが入っていないことがある（`python:3.12-slim`ベース）。
  その場合はPython標準ライブラリの`sqlite3`モジュールで代替できる。
- バックアップ後は`PRAGMA integrity_check`と主要テーブルの行数比較で健全性を確認する運用にする。

## 関連ファイル

- app/backend/database.py（`PRAGMA journal_mode=WAL`の設定箇所）
- app/backend/entrypoint.sh（起動時自動バックアップ、今回新規作成）
