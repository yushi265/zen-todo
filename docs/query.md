# Query View

## Query View とは

`zen-todo` コードブロックにクエリを書くと、全リストからフィルタ結果をインラインで表示するビューが表示されます。空のコードブロックはフルインタラクティブパネルになります。

## Quick Start

コードブロックにそのままコピペして使えます。

**今日完了したタスクを見る**

````markdown
```zen-todo
completed today
```
````

**期限切れタスクを見る**

````markdown
```zen-todo
overdue
```
````

**今週期限のタスクを見る**

````markdown
```zen-todo
due this week
```
````

## Filter Reference

### Completion filters

| フィルタ | 説明 |
|---------|------|
| `completed today` | 今日完了したタスク |
| `completed this week` | 今週完了したタスク |
| `completed this month` | 今月完了したタスク |
| `completed YYYY-MM-DD` | 指定日に完了したタスク（例: `completed 2026-03-01`） |
| `completed before YYYY-MM-DD` | 指定日より前に完了したタスク |
| `completed after YYYY-MM-DD` | 指定日より後に完了したタスク |

### Due date filters

| フィルタ | 説明 |
|---------|------|
| `due today` | 今日が期限のタスク |
| `due this week` | 今週が期限のタスク |
| `due this month` | 今月が期限のタスク |
| `due YYYY-MM-DD` | 指定日が期限のタスク（例: `due 2026-03-15`） |
| `due before YYYY-MM-DD` | 指定日より前が期限のタスク |
| `due after YYYY-MM-DD` | 指定日より後が期限のタスク |

### Status filters

| フィルタ | 説明 |
|---------|------|
| `overdue` | 期限超過の未完了タスク |
| `incomplete` | すべての未完了タスク |
| `not completed` | `incomplete` の別名 |

### List filter

| フィルタ | 説明 |
|---------|------|
| `list: Work` | タイトルに "Work" を含むリストのタスク（大文字小文字不問） |
| `list: "Daily Tasks"` | スペースを含むリスト名（クォートで囲む） |

### Comments

`#` で始まる行はコメントとして無視されます。

```
# 今日のレビュー用
completed today
```

## Combining Filters

複数行に書いたフィルタは **AND** で結合されます。

**期限切れ かつ Work リストのタスク**

````markdown
```zen-todo
overdue
list: Work
```
````

**今月 Work リストで完了したタスク**

````markdown
```zen-todo
completed this month
list: Work
```
````

**今週期限 かつ 未完了のタスク**

````markdown
```zen-todo
due this week
incomplete
```
````

## Behavior Notes

- **空コードブロック** → フルインタラクティブパネル（タスクの追加・編集・アーカイブが可能）
- **テキストありコードブロック** → クエリモード（読み取り + チェックボックストグルのみ）
- **チェックボックス** でタスクの完了/未完了を直接切り替え可能。変更は元の `.md` ファイルに即座に保存される
- **外部変更は自動反映**。ファイルが変更された場合、300ms デバウンス後に自動で再描画される
- **認識できない行はエラー表示**。ヘッダ直下に赤字で `Unknown filter: "..."` と表示される
- **結果はリスト別にグループ表示**。ヘッダにフィルタの説明とヒット件数が表示される
