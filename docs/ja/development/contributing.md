# コントリビュート

バグ報告やプルリクエストは歓迎します。大きな変更の場合はまず Issue を立ててください。

## 前提条件

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/)

## セットアップ

```bash
git clone https://github.com/yushi265/zen-todo.git
cd zen-todo
pnpm install
```

## ビルド

```bash
# ウォッチモードで開発ビルド
pnpm dev

# プロダクションビルド（型チェック含む）
pnpm build
```

出力ファイル（`main.js`、`manifest.json`、`styles.css`）を Vault の `.obsidian/plugins/zen-todo/` フォルダにコピーして使用できます。

## プロジェクト構造

```
src/
├── main.ts                    # プラグインのエントリーポイント & Obsidian ライフサイクル
├── settings.ts                # 設定 UI タブ
├── types.ts                   # TypeScript インターフェース
├── constants.ts               # デフォルト値、ビュータイプ ID、絵文字マーカー
├── models/
│   └── task.ts                # タスク生成・変更ヘルパー
├── parser/
│   ├── markdown-parser.ts     # Markdown → タスクオブジェクトツリー
│   └── markdown-serializer.ts # タスクオブジェクトツリー → Markdown
├── utils/
│   └── date-utils.ts          # 日付フォーマットと比較
└── views/
    ├── todo-view.ts           # サイドバーパネル（ItemView ラッパー）
    ├── todo-controller.ts     # 状態管理とアクションディスパッチ
    ├── codeblock-processor.ts # インライン埋め込みビュー（MarkdownRenderChild）
    ├── list-selector.ts       # リスト切り替えタブバー
    ├── task-input.ts          # 新規タスク入力行
    ├── task-section.ts        # 未完了 / 完了セクションのレンダリング
    ├── task-item-renderer.ts  # 個別タスク行 + インライン編集
    ├── drag-handler.ts        # タスク行ドラッグ＆ドロップ並び替え
    └── tab-drag-handler.ts    # リストタブドラッグ＆ドロップ並び替え
```

## アーキテクチャ概要

詳細なアーキテクチャドキュメントは [CLAUDE.md](https://github.com/yushi265/zen-todo/blob/main/CLAUDE.md) を参照してください。

## ライセンス

[MIT](https://github.com/yushi265/zen-todo/blob/main/LICENSE)
