# 贡献指南

感谢你对 kanban 的关注。本文档介绍开发流程、项目结构与代码约定。

English version: [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 环境要求

- [Node.js](https://nodejs.org) `^22.18.0 || >=24.12.0`
- [pnpm](https://pnpm.io) `11.20.0`（工作区通过 `packageManager` 固定版本）

## 快速开始

```sh
pnpm install
pnpm dev        # 启动 Vite 开发服务器（支持 HMR）
```

## 可用脚本

| 脚本              | 说明                               |
| ----------------- | ---------------------------------- |
| `pnpm dev`        | 启动本地开发服务器（HMR）          |
| `pnpm build`      | 先进行类型检查，再构建生产包       |
| `pnpm build-only` | 仅构建生产包                       |
| `pnpm preview`    | 本地预览生产构建产物               |
| `pnpm type-check` | 运行 `vue-tsc --build` 类型检查    |
| `pnpm lint`       | 运行 oxlint + eslint（带 `--fix`） |
| `pnpm format`     | 自动格式化 `src/`                  |

生产构建为**纯静态**：`dist/` 仅包含静态文件，没有任何运行时服务端代码，因此可托管在任何地方（GitHub Pages、CDN、Nginx 等）。

## 技术栈

- **Vue 3**（`<script setup>`、Composition API）+ **TypeScript**
- **Vite**，经由 [vite-plus](https://www.npmjs.com/package/vite-plus)（`vp` CLI）
- **UnoCSS** 负责样式（工具类，使用 `@unocss/preset-icons` 加载 Carbon 图标）
- **Dexie** — IndexedDB 封装，用于持久化
- **vuedraggable** — 列与任务的拖拽
- **markdown-it** + **markdown-it-task-lists** + **highlight.js** + **DOMPurify** — Markdown 渲染管线
- **xlsx**（SheetJS）— Excel 导入 / 导出，用于备份

## 项目结构

```
src/
├── App.vue                     # 根布局：工具栏、看板切换、列区域
├── main.ts                     # 应用入口
├── types.ts                    # Board / Column / Task 类型定义
├── components/
│   ├── ColumnCard.vue          # 单列：标题、任务、添加/删除、模式切换
│   └── TaskDrawer.vue          # 任务详情抽屉：编辑/预览分栏，可拖拽调整比例
└── composables/
    ├── db.ts                   # Dexie IndexedDB 访问（boards, columns）
    ├── backup.ts               # Excel 导出 / 导入
    └── markdown.ts             # Markdown -> 消毒后 HTML 的渲染管线
```

## 关键约定

### 持久化模型

- 数据通过 Dexie 存放在 IndexedDB 中。`App.vue` 深度监听 `columns`，并通过 `saveColumns(boardId, columns)` 持久化变更。
- `switching` 标志用于在切换看板时阻止深度监听写入中间状态（例如被清空的 `columns` 数组）。
- 上次使用的看板 id 会记录在 `localStorage` 的 `kanban.lastBoardId` 中。

### Markdown 渲染

`src/composables/markdown.ts` 是渲染的唯一事实来源。任务卡片（紧凑预览）与任务抽屉预览都使用它：

```
markdown-it (html: false, linkify: true, breaks: true)
  → markdown-it-task-lists
  → highlight.js (fenced code blocks)
  → DOMPurify sanitize
```

始终经由 `renderMarkdown()` 渲染——绝不把原始任务内容直接注入 DOM。

### 列模式

每列有一个 `mode`：`horizontal`（默认，全宽布局）或 `vertical`（折叠窄条）。垂直模式下隐藏标题编辑与任务管理；通过列头部的箭头按钮切换。

### 样式

- 以 UnoCSS 工具类为主；自定义 CSS 尽量精简并保持作用域（`<style scoped>`）。
- 应用强调色可由用户选择（默认 `#0891b2`，持久化在 `localStorage` 的 `kanban.accent` 中，工具栏 `ThemeSwitcher` 提供更多选项）；危险操作使用红色（`#d92d20`）。
- 渲染出的 Markdown 作用域样式位于 `.markdown-body :deep(...)` 类下。

### 类型安全

- 所有数据结构定义在 `src/types.ts`。
- 提交前运行 `pnpm type-check`。
- ID 使用 `crypto.randomUUID()` 生成。

## Pull Request 检查清单

1. `pnpm type-check` 通过。
2. `pnpm lint` 无告警。
3. `pnpm build` 成功。
4. 保持改动聚焦——一个 PR 只做一件逻辑变更。
5. 若用户可见行为发生变化，更新 `README.md`（README 侧重用法；开发细节请写在此处）。

## 许可证

本项目基于 [MIT 许可证](./LICENSE) 发布。
