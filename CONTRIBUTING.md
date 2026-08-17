# Contributing

Thanks for your interest in contributing to kanban. This document covers the development workflow, project structure, and conventions.

**简体中文版本见 [CONTRIBUTING.zh-CN.md](./CONTRIBUTING.zh-CN.md)。**

## Prerequisites

- [Node.js](https://nodejs.org) `^22.18.0 || >=24.12.0`
- [pnpm](https://pnpm.io) `11.20.0` (the workspace pins this via `packageManager`)

## Getting Started

```sh
pnpm install
pnpm dev        # start the Vite dev server with HMR
```

## Available Scripts

| Script            | Description                                  |
| ----------------- | -------------------------------------------- |
| `pnpm dev`        | Start the local dev server (HMR)             |
| `pnpm build`      | Type-check, then build the production bundle |
| `pnpm build-only` | Build the production bundle only             |
| `pnpm preview`    | Preview the production build locally         |
| `pnpm type-check` | Run `vue-tsc --build` type checking          |
| `pnpm lint`       | Run oxlint + eslint with `--fix`             |
| `pnpm format`     | Auto-format `src/`                           |

The production build is **pure static**: `dist/` contains only static files with no runtime server-side code, so it can be hosted anywhere (GitHub Pages, CDN, Nginx, etc.).

## Tech Stack

- **Vue 3** (`<script setup>`, Composition API) + **TypeScript**
- **Vite** via [vite-plus](https://www.npmjs.com/package/vite-plus) (`vp` CLI)
- **UnoCSS** for styling (utility classes, with `@unocss/preset-icons` for Carbon icons)
- **Dexie** — IndexedDB wrapper for persistence
- **vuedraggable** — drag & drop for columns and tasks
- **markdown-it** + **markdown-it-task-lists** + **highlight.js** + **DOMPurify** — Markdown rendering pipeline
- **xlsx** (SheetJS) — Excel export/import for backup

## Project Structure

```
src/
├── App.vue                     # Root layout: toolbar, board switching, columns area
├── main.ts                     # App bootstrap
├── types.ts                    # Board / Column / Task types
├── components/
│   ├── ColumnCard.vue          # Single column: title, tasks, add/delete, mode toggle
│   └── TaskDrawer.vue          # Task detail drawer: split editor/preview with resizable divider
└── composables/
    ├── db.ts                   # Dexie IndexedDB access (boards, columns)
    ├── backup.ts               # Excel export / import
    └── markdown.ts             # Markdown -> sanitized HTML pipeline
```

## Key Conventions

### Persistence model

- Data lives in IndexedDB via Dexie. `App.vue` deep-watches `columns` and persists changes with `saveColumns(boardId, columns)`.
- The `switching` flag prevents the deep watch from writing intermediate state (e.g. a cleared `columns` array) while switching boards.
- The last-used board id is remembered in `localStorage` under `kanban.lastBoardId`.

### Markdown rendering

`src/composables/markdown.ts` is the single source of truth for rendering. It is used both by task cards (with a compact preview) and the task drawer preview:

```
markdown-it (html: false, linkify: true, breaks: true)
  → markdown-it-task-lists
  → highlight.js (fenced code blocks)
  → DOMPurify sanitize
```

Always go through `renderMarkdown()` — never inject raw task content into the DOM.

### Column modes

Each column has a `mode` of `horizontal` (default, full-width layout) or `vertical` (collapsed strip). Title editing and task management are hidden in vertical mode; toggling is done via the header chevron.

### Styling

- Utility-first with UnoCSS; keep custom CSS minimal and scoped (`<style scoped>`).
- The app accent color is user-selectable (default `#9333ea`, persisted in `localStorage` under `kanban.accent`, with more choices in the toolbar `ThemeSwitcher`); destructive actions use red (`#d92d20`).
- Scoped styles for rendered Markdown live under a `.markdown-body :deep(...)` class.

### Type safety

- All data shapes are defined in `src/types.ts`.
- Run `pnpm type-check` before committing.
- IDs are generated with `crypto.randomUUID()`.

## Pull Request Checklist

1. `pnpm type-check` passes.
2. `pnpm lint` is clean.
3. `pnpm build` succeeds.
4. Keep changes focused — one logical change per PR.
5. Update `README.md` if user-facing behavior changes (usage-focused; dev details belong here in CONTRIBUTING.md).

## License

This project is released under the [MIT License](./LICENSE).
