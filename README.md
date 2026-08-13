# kanban

A simple, self-hosted Kanban board that runs **entirely in your browser** — no server, no account, no data leaves your machine.

## Getting Started

You can use the app in two ways:

1. **Open the built site** — serve the static `dist/` output (or a hosted deployment) and open it in any modern browser.
2. **Run it locally with Vite** (requires Node.js ≥ 22 and pnpm):

```sh
pnpm install
pnpm dev
```

Your board is created automatically on first launch — there is nothing to configure.

## Usage Guide

### Boards

A **board** is a collection of columns. The board toolbar (top bar) gives you:

| Action       | How                                                                  |
| ------------ | -------------------------------------------------------------------- |
| Switch board | Pick one from the dropdown on the left                               |
| New Board    | Click **New Board**, enter a name, and press Enter                   |
| Rename       | Click **Rename** and type a new name                                 |
| Delete       | Click **Delete** and confirm — removes the board and all its columns |

Your last-used board is remembered and reopened next time.

### Columns

- **Add a column** — click **Add Column**, type a name, press Enter (or click away).
- **Rename a column** — double-click the column title and edit it.
- **Reorder columns** — drag a column by its header and drop it elsewhere.
- **Collapse / expand** — click the chevron (⌄) in the column header to toggle between the normal horizontal mode and a slim vertical strip.
- **Delete a column** — click the trash icon in the column header (horizontal mode only) and confirm.

### Tasks

- **Add a task** — click **Add Task** at the bottom of a column, type the content, press Enter (or click away).
- **Edit a task** — click a task card to open the **task drawer**, where you can rewrite it as Markdown.
- **Move tasks** — drag a task card and drop it anywhere: reorder within a column or move it to another column.
- **Delete a task** — open the task drawer and click the trash icon in the top-right corner.

### Task Drawer (split view)

Clicking a task opens a right-side drawer with a **side-by-side split**:

- **Left — Edit**: write the task content in Markdown.
- **Right — Preview**: the rendered result updates live as you type.
- **Drag the divider** between the two panes to resize them (20%–80%).

Drawer shortcuts:

| Key                | Action           |
| ------------------ | ---------------- |
| `Esc`              | Close the drawer |
| `Ctrl/Cmd + Enter` | Save and close   |

Click **Save** to persist your changes, or click away / press `Esc` to discard them.

### Markdown

Task content supports Markdown, so cards can contain formatted text:

- Headings, bold/italic/strikethrough, inline code
- Fenced code blocks with syntax highlighting (e.g. ` ```js `)
- Links, images, quotes, tables, horizontal rules
- Task lists: `- [ ] todo`, `- [x] done`
- Single line breaks render as line breaks

Raw HTML is disabled and all output is sanitized.

### Backup & Migration

Since data lives in the browser (IndexedDB), use the export/import tools to back up or move your board:

| Button         | What it does                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Export**     | Downloads the current board as an `.xlsx` file (one sheet per column)                                                       |
| **Export All** | Downloads every board into a single `.xlsx` workbook                                                                        |
| **Import**     | Loads `.xlsx` / `.xls` files. Sheets matching an existing board name are **merged into it**; other sheets create new boards |

> Tip: export regularly — clearing your browser's site data will erase your board.

## Data & Privacy

- All columns and tasks are stored in your browser's **IndexedDB**; nothing is ever sent to a server.
- Data is tied to the browser/profile and device you use — it does not follow you across browsers or machines.

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the project structure, tech stack, available scripts, and contribution guidelines.
