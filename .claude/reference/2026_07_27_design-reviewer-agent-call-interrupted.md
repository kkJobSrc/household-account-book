# design-reviewer 起動時のツール実行中断・再試行

**日付**: 2026-07-27
**作業種別**: 設計（design-team-lead によるレビュー統括作業）
**試行回数**: 3回（1回目: ツール使用拒否エラーで中断 / 2〜3回目: コーディネーターからの再開指示だが実際にはAPI接続エラー等で中断が継続 / 4回目でようやく成功）

## 発生した失敗

Issue #29「レシート画像アップロード機能」の設計レビューフローの中で、Phase 2（`design-reviewer` エージェントの起動）を実行しようとしたところ、以下のエラーが返却された。

```
The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.
```

その後、コーディネーター（呼び出し元）から「API接続エラーで中断したようです。作業を再開してください」という趣旨のメッセージが複数回（2回）送られてきており、Phase 2の再実行が都度中断された。

## 原因

- 直接的な原因はタスク実行環境側（ツール呼び出しの拒否／API接続断）にあり、design-team-lead側のロジックやプロンプト内容に誤りがあったわけではない。
- ただし、同一の長大なプロンプト（設計書全文を貼り付けた長いAgent呼び出し）を複数回にわたって再送する必要が生じ、対話のやり取りが冗長になった。

## 回避策・解決方法

- コーディネーターからの再開指示を受けて、同じ内容（design-reviewerへの設計書全文貼り付けプロンプト）でAgent呼び出しを再実行したところ、最終的に正常に完了しレビュー結果を取得できた。
- 再試行にあたり、Phase の状態（Phase 1完了済み・Phase 2未完了）を都度確認してから再実行することで、二重に issue-analyzer を起動するような手戻りは防げた。

## 再発防止メモ

- Agent呼び出しが中断された場合、まず「どのPhaseまで完了しているか」を明示的に確認してから再開する（今回はコーディネーターの指示文にPhaseの状態が明記されていたため助かった）。
- 長大なプロンプト（設計書全文の受け渡し）を伴うAgent呼び出しは、中断・再試行のコストが大きい。可能であれば、設計書をファイルに一時保存し、レビュー担当エージェントにファイルパスを渡す方式も検討の余地がある（ただし design-team-lead の現行定義では「Agent, Read, Bash, Write, AskUserQuestion」のみ許可されているため、Writeでスクラッチファイルに設計書を書き出し、design-reviewerにパスを渡す運用は可能）。
- ツール使用拒否エラーが発生した場合は、直前の指示を変更せずにそのまま同一内容で再試行することが有効だった（プロンプト自体に問題があったわけではないため）。

## 関連ファイル

- （コード変更なし。エージェント運用フローに関する事例のため対象ファイルなし）
- 参考: `.claude/agents/design-team-lead.md`
- 参考: `.claude/agents/design-reviewer.md`
