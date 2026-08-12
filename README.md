# kanban

A simple, self-hosted Kanban board that runs **entirely in your browser**.

## Key Features

- **100% client-side** — no backend server, no database service, no account needed.
- **Pure static build** — the output of `pnpm build` is a folder of static files that can be hosted anywhere (GitHub Pages, any CDN, Nginx, or even a USB stick).
- **Local persistence** — all columns and tasks are stored in your browser's own IndexedDB. Your data never leaves your machine.
- **Drag & drop** — reorder columns and move tasks across columns freely.
- **No data to migrate** — your board is tied to the browser/profile you use; it requires no sign-up.

> Note: Because data lives in browser storage, it is per-browser/per-device. Clearing site data will erase your board.

## Tech Stack

- Vue 3 + TypeScript
- Vite (vite-plus)
- UnoCSS
- Dexie (IndexedDB wrapper)
- vuedraggable

## Project Setup

```sh
pnpm install
```

### Develop (local dev server, HMR)

```sh
pnpm dev
```

### Build for production (pure static files)

```sh
pnpm build
```

The static output is written to `dist/`. Serve it with any static file server — there is no runtime server-side code.

### Type-Check

```sh
pnpm type-check
```

## Usage

- Double-click a column title to rename it.
- Click the chevron icon to collapse/expand a column (vertical mode).
- Click **Add Task** to create a task in a column.
- Double-click the trash icon to delete a task or column.
- Click **Add Column** to append a new column.

All changes are saved to IndexedDB automatically.
