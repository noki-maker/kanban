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
- **Vditor** — Markdown editor inside the task drawer (with context-menu actions and image upload)
- **fflate** — zip compression for the `.zip` backup format

## Project Structure

```
src/
├── App.vue                     # Root layout: toolbar, board switching, columns area
├── main.ts                     # App bootstrap
├── types.ts                    # Board / Column / Task / Attachment types
├── components/
│   ├── ColumnCard.vue          # Single column: title, tasks, add/delete, mode toggle
│   ├── TaskCard.vue            # Task card: async-rendered markdown preview with attachment images
│   └── TaskDrawer.vue          # Task detail drawer: Vditor IR editor with context menu & image upload
└── composables/
    ├── db.ts                   # Dexie IndexedDB access (boards, columns, attachments)
    ├── backup.ts               # Legacy backup import helpers
    ├── archive.ts              # Zip backup export / import (fflate)
    ├── attachments.ts          # attach:// refs, blob object URLs, cascade cleanup helpers
    └── markdown.ts             # Markdown -> sanitized HTML pipeline
```

## Key Conventions

### Persistence model

- Data lives in IndexedDB via Dexie. `App.vue` deep-watches `columns` and persists changes with `saveColumns(boardId, columns)`.
- Image attachments live in their own `attachments` table (`version(3)`), keyed by `taskId` for cascade cleanup.
- Deleting a task / column / board cascades to its attachments: `deleteTaskAttachments()` revokes the cached blob object URLs first, then `deleteAttachmentsByTaskIds()` / `deleteBoard()` remove the rows.
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

### Attachments & images

- Markdown references images as `![name](attach://<id>)`; the binary lives in the `attachments` IndexedDB table.
- Before rendering, `resolveAttachmentRefs()` replaces those refs with cached blob object URLs; the DOMPurify config in `markdown.ts` whitelists `blob:` URLs so the rendered `<img>` survives sanitization.
- `attachments.ts` owns the URL cache: `getAttachmentUrl()` creates/caches, `revokeAttachmentUrl()` / `deleteTaskAttachments()` release them on delete, `clearAttachmentCache()` for hard resets.
- The zip backup (`archive.ts`) stores `data.json` plus each attachment blob; on import the original board/task ids are preserved so refs keep working.

### Column modes

Each column has a `mode` of `horizontal` (default, full-width layout) or `vertical` (collapsed strip). Title editing and task management are hidden in vertical mode; toggling is done via the header chevron.

### Styling

- Utility-first with UnoCSS; keep custom CSS minimal and scoped (`<style scoped>`).
- The app accent color is user-selectable (default `#9333ea`, persisted in `localStorage` under `kanban.accent`, with more choices in the toolbar `ThemeSwitcher`); destructive actions use red (`#d92d20`).
- Scoped styles for rendered Markdown live under a `.markdown-body :deep(...)` class.

### Type safety

- All data shapes are defined in `src/types.ts` (including `Attachment`, which stores its binary as a `Blob`).
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
