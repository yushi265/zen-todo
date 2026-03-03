import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'ZenTodo',
  description: 'A minimalist todo manager for Obsidian',
  base: '/zen-todo/',
  cleanUrls: true,
  lastUpdated: true,

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/getting-started/installation' },
          { text: 'Reference', link: '/reference/settings' },
        ],
        sidebar: [
          {
            text: 'Getting Started',
            items: [
              { text: 'Installation', link: '/getting-started/installation' },
              { text: 'Quick Start', link: '/getting-started/quick-start' },
            ],
          },
          {
            text: 'Guide',
            items: [
              { text: 'Managing Lists', link: '/guide/managing-lists' },
              { text: 'Working with Tasks', link: '/guide/tasks' },
              { text: 'Drag and Drop', link: '/guide/drag-and-drop' },
              { text: 'Archiving Tasks', link: '/guide/archive' },
              { text: 'Inline Embedded View', link: '/guide/inline-view' },
              { text: 'Query View', link: '/guide/query-view' },
              { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
            ],
          },
          {
            text: 'Reference',
            items: [
              { text: 'Settings', link: '/reference/settings' },
              { text: 'Markdown Format', link: '/reference/markdown-format' },
              { text: 'Commands', link: '/reference/commands' },
            ],
          },
          {
            text: 'Development',
            items: [
              { text: 'Contributing', link: '/development/contributing' },
            ],
          },
        ],
      },
    },
    ja: {
      label: '日本語',
      lang: 'ja',
      themeConfig: {
        nav: [
          { text: 'ガイド', link: '/ja/getting-started/installation' },
          { text: 'リファレンス', link: '/ja/reference/settings' },
        ],
        sidebar: [
          {
            text: 'はじめに',
            items: [
              { text: 'インストール', link: '/ja/getting-started/installation' },
              { text: 'クイックスタート', link: '/ja/getting-started/quick-start' },
            ],
          },
          {
            text: 'ガイド',
            items: [
              { text: 'リスト管理', link: '/ja/guide/managing-lists' },
              { text: 'タスク操作', link: '/ja/guide/tasks' },
              { text: 'ドラッグ＆ドロップ', link: '/ja/guide/drag-and-drop' },
              { text: 'タスクのアーカイブ', link: '/ja/guide/archive' },
              { text: 'インライン埋め込みビュー', link: '/ja/guide/inline-view' },
              { text: 'クエリビュー', link: '/ja/guide/query-view' },
              { text: 'キーボードショートカット', link: '/ja/guide/keyboard-shortcuts' },
            ],
          },
          {
            text: 'リファレンス',
            items: [
              { text: '設定', link: '/ja/reference/settings' },
              { text: 'Markdown フォーマット', link: '/ja/reference/markdown-format' },
              { text: 'コマンド', link: '/ja/reference/commands' },
            ],
          },
          {
            text: '開発',
            items: [
              { text: 'コントリビュート', link: '/ja/development/contributing' },
            ],
          },
        ],
      },
    },
  },

  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/yushi265/zen-todo' },
    ],
    editLink: {
      pattern: 'https://github.com/yushi265/zen-todo/edit/main/docs/:path',
    },
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2026 yushi265',
    },
  },
})
