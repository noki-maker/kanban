<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import ColumnCard from '@/components/ColumnCard.vue'
import TaskDrawer from '@/components/TaskDrawer.vue'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import { isDark, toggleTheme } from '@/composables/theme'
import { exportAllToExcel, exportToExcel, importFromExcel } from '@/composables/backup'
import {
  createBoard,
  deleteBoard,
  getBoards,
  getColumns,
  renameBoard,
  saveColumns,
} from '@/composables/db'
import type { Board, Column, Task } from '@/types'

const LAST_BOARD_KEY = 'kanban.lastBoardId'
const DEFAULT_BOARD_NAME = 'Kanban'

const boards = ref<Board[]>([])
const currentBoardId = ref('')
const columns = ref<Column[]>([])
const loaded = ref(false)
// While switching boards we must not let the deep watch write the "clearing"
// columns array to the wrong board.
let switching = false

// —— Task detail drawer ——
const activeTask = ref<Task | null>(null)

function openTask(task: Task) {
  activeTask.value = task
}

function saveTask(content: string) {
  if (activeTask.value) activeTask.value.content = content
  activeTask.value = null
}

function closeTask() {
  activeTask.value = null
}

function deleteTask() {
  const task = activeTask.value
  if (!task) return
  if (!window.confirm('Delete this task?')) return
  for (const column of columns.value) {
    const index = column.tasks.findIndex((t) => t.id === task.id)
    if (index !== -1) {
      column.tasks.splice(index, 1)
      break
    }
  }
  activeTask.value = null
}

onMounted(async () => {
  let list = await getBoards()
  if (list.length === 0) {
    list = [await createBoard(DEFAULT_BOARD_NAME)]
  }
  boards.value = list
  const lastId = localStorage.getItem(LAST_BOARD_KEY)
  const lastBoard = list.find((b) => b.id === lastId)
  await loadBoard(lastBoard ? lastBoard.id : list[0]!.id)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})

watch(
  columns,
  (val) => {
    if (!loaded.value || switching || !currentBoardId.value) return
    saveColumns(currentBoardId.value, val)
  },
  { deep: true },
)

async function loadBoard(boardId: string) {
  columns.value = await getColumns(boardId)
  currentBoardId.value = boardId
  loaded.value = true
  localStorage.setItem(LAST_BOARD_KEY, boardId)
}

async function switchBoard(boardId: string) {
  if (boardId === currentBoardId.value || !loaded.value) return
  switching = true
  try {
    await saveColumns(currentBoardId.value, columns.value)
    columns.value = []
    await loadBoard(boardId)
  } finally {
    switching = false
  }
}

// —— Board management ——
const isAddingBoard = ref(false)
const newBoardInput = ref<HTMLInputElement>()
const newBoardName = ref('')

function startAddBoard() {
  isAddingBoard.value = true
  nextTick(() => newBoardInput.value?.focus())
}

async function commitNewBoard() {
  const name = newBoardName.value.trim()
  // Reset state synchronously so a blur triggered by the Enter-submit
  // cannot create the same board twice while awaiting.
  isAddingBoard.value = false
  newBoardName.value = ''
  if (!name) return
  const board = await createBoard(name)
  boards.value.push(board)
  await switchBoard(board.id)
}

async function renameCurrentBoard() {
  const current = boards.value.find((b) => b.id === currentBoardId.value)
  if (!current) return
  const name = window.prompt('Rename board:', current.name)
  if (!name?.trim() || name.trim() === current.name) return
  current.name = name.trim()
  await renameBoard(current.id, name.trim())
}

async function deleteCurrentBoard() {
  const current = boards.value.find((b) => b.id === currentBoardId.value)
  if (!current) return
  if (!window.confirm(`Delete board "${current.name}" and all its columns?`)) return
  switching = true
  try {
    await deleteBoard(current.id)
    const remaining = boards.value.filter((b) => b.id !== current.id)
    if (remaining.length > 0) {
      boards.value = remaining
      await loadBoard(remaining[0]!.id)
    } else {
      const board = await createBoard(DEFAULT_BOARD_NAME)
      boards.value = [board]
      await loadBoard(board.id)
    }
  } finally {
    switching = false
  }
}

// —— Board switcher dropdown ——
const boardMenuOpen = ref(false)
const boardMenuRootRef = ref<HTMLElement>()
const currentBoardName = computed(
  () => boards.value.find((b) => b.id === currentBoardId.value)?.name ?? '',
)

function toggleBoardMenu() {
  boardMenuOpen.value = !boardMenuOpen.value
}

function selectBoard(id: string) {
  if (id !== currentBoardId.value) void switchBoard(id)
  boardMenuOpen.value = false
}

function onDocumentClick(event: MouseEvent) {
  if (boardMenuRootRef.value && !boardMenuRootRef.value.contains(event.target as Node)) {
    boardMenuOpen.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    boardMenuOpen.value = false
  }
}

// —— Add column ——
const isAddingColumn = ref(false)
const newColumnInput = ref<HTMLInputElement>()
const newColumnTitle = ref('')

function startAddColumn() {
  isAddingColumn.value = true
  nextTick(() => newColumnInput.value?.focus())
}

function commitColumn() {
  const title = newColumnTitle.value.trim()
  if (title) {
    columns.value.push({
      id: crypto.randomUUID(),
      boardId: currentBoardId.value,
      title,
      tasks: [],
      mode: 'horizontal',
      order: columns.value.length,
    })
  }
  isAddingColumn.value = false
  newColumnTitle.value = ''
}

// —— Remove column ——
function removeColumn(column: Column) {
  const index = columns.value.findIndex((c) => c === column)
  if (index !== -1) columns.value.splice(index, 1)
}

// —— Export / Import ——
const importInput = ref<HTMLInputElement>()

function exportBoard() {
  const current = boards.value.find((b) => b.id === currentBoardId.value)
  exportToExcel(columns.value, current?.name ?? DEFAULT_BOARD_NAME)
}

async function exportAll() {
  try {
    await exportAllToExcel(boards.value, getColumns)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(`Export failed: ${message}`)
  }
}

function triggerImport() {
  importInput.value?.click()
}

async function handleImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const imported = await importFromExcel(file)
    const valid = imported.filter((b) => !b.error)
    const failed = imported.filter((b) => b.error)
    if (valid.length === 0) {
      window.alert(`Import failed: ${failed[0]?.error ?? 'No board data found in the file.'}`)
      return
    }

    let created = 0
    let merged = 0
    let addedColumns = 0
    let firstCreatedId: string | undefined
    for (const item of valid) {
      if (item.columns.length === 0) continue
      const existing = boards.value.find((b) => b.name.trim() === item.name.trim())
      if (existing) {
        // Merge into an existing board with the same name
        const targetColumns = await getColumns(existing.id)
        const existingIds = new Set(targetColumns.map((c) => c.id))
        let added = 0
        for (const column of item.columns) {
          if (existingIds.has(column.id)) column.id = crypto.randomUUID()
          existingIds.add(column.id)
          column.boardId = existing.id
          column.order = targetColumns.length + added
          targetColumns.push(column)
          added++
        }
        await saveColumns(existing.id, targetColumns)
        if (existing.id === currentBoardId.value) columns.value = targetColumns
        merged++
        addedColumns += added
      } else {
        // Create a new board named after the sheet
        const board = await createBoard(item.name)
        for (const column of item.columns) column.boardId = board.id
        await saveColumns(board.id, item.columns)
        boards.value.push(board)
        if (!firstCreatedId) firstCreatedId = board.id
        created++
        addedColumns += item.columns.length
      }
    }

    if (created === 0 && merged === 0) {
      window.alert('No column data found in the file.')
      return
    }
    if (firstCreatedId) await switchBoard(firstCreatedId)
    const errorNote = failed.length > 0 ? ` Skipped ${failed.length} unrecognized sheet(s).` : ''
    window.alert(
      `Imported ${addedColumns} column(s): ${created} new board(s), ${merged} merged.${errorNote}`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(`Import failed: ${message}`)
  } finally {
    input.value = ''
  }
}

const DISCORD_URL = 'https://discord.gg/cG9xWNW8sk'

const GITHUB_URL = 'https://github.com/noki-maker/kanban'

// —— Theme reveal animation ——
const themeBtnRef = ref<HTMLDivElement>()
const themeAnimating = ref(false)

/** Read the resolved `--c-bg` for a given theme without leaving the DOM in a
 *  changed state (no paint happens between the synchronous class toggles). */
function readThemeBg(dark: boolean): string {
  const root = document.documentElement
  const wasDark = root.classList.contains('dark')
  if (dark !== wasDark) root.classList.toggle('dark', dark)
  const bg = getComputedStyle(root).getPropertyValue('--c-bg').trim() || '#ffffff'
  if (dark !== wasDark) root.classList.toggle('dark', wasDark)
  return bg
}

async function handleThemeToggle() {
  const btn = themeBtnRef.value
  if (!btn || themeAnimating.value) return
  themeAnimating.value = true
  const rect = btn.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const maxRadius = Math.hypot(
    Math.max(cx, window.innerWidth - cx),
    Math.max(cy, window.innerHeight - cy),
  )
  const newBg = readThemeBg(!isDark.value)

  const overlay = document.createElement('div')
  overlay.className = 'theme-reveal-overlay'
  overlay.style.left = `${cx - maxRadius}px`
  overlay.style.top = `${cy - maxRadius}px`
  overlay.style.width = `${maxRadius * 2}px`
  overlay.style.height = `${maxRadius * 2}px`
  overlay.style.background = newBg
  document.body.appendChild(overlay)

  try {
    const expand = overlay.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], {
      duration: 450,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    })
    await expand.finished
    // Full screen is covered by the new-theme color: switch without a flash.
    toggleTheme()
  } finally {
    overlay.remove()
    themeAnimating.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Board toolbar -->
    <div
      class="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-[var(--c-bg)] border border-solid border-[var(--c-border)] rounded-lg"
    >
      <div ref="boardMenuRootRef" class="relative flex items-center">
        <div
          type="button"
          class="box-border flex h-2rem min-w-36 max-w-56 items-center gap-2 rounded-md border border-solid border-[var(--c-border)] bg-[var(--c-bg)] px-2 text-xs text-[var(--c-text)] cursor-pointer transition-colors duration-200 hover:bg-[var(--c-bg-soft)]"
          :class="boardMenuOpen ? 'bg-[var(--c-bg-soft)]' : ''"
          title="Switch Board"
          aria-haspopup="listbox"
          :aria-expanded="boardMenuOpen"
          @click="toggleBoardMenu"
        >
          <span class="truncate">{{ currentBoardName }}</span>
          <div
            class="ml-auto i-carbon:chevron-down text-sm transition-transform duration-200"
            :class="{ 'rotate-180': boardMenuOpen }"
          />
        </div>

        <Transition name="board-menu">
          <div
            v-if="boardMenuOpen"
            class="absolute top-full left-0 z-50 mt-2 w-52 rounded-xl border border-solid border-[var(--c-border)] bg-[var(--c-bg)] p-1.5 shadow-xl shadow-[var(--c-shadow)]"
            role="listbox"
          >
            <div
              v-for="board in boards"
              :key="board.id"
              role="option"
              :aria-selected="board.id === currentBoardId"
              class="box-border flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-xs text-[var(--c-text)] rounded-lg cursor-pointer transition-colors duration-200 hover:bg-[var(--c-bg-soft)]"
              :class="board.id === currentBoardId ? 'bg-[var(--c-bg-soft)]' : ''"
              @click="selectBoard(board.id)"
            >
              <span class="truncate">{{ board.name }}</span>
              <span class="flex-auto" />
              <span
                v-if="board.id === currentBoardId"
                class="i-carbon:checkmark text-sm text-[var(--c-accent)]"
              />
            </div>
          </div>
        </Transition>
      </div>

      <div class="flex items-center gap-2">
        <div
          v-show="!isAddingBoard"
          class="btn flex items-center justify-center gap1 !w-36 h-2rem text-xs text-#fff bg-[var(--c-accent)] border-none rounded-md cursor-pointer hover:opacity-80"
          @click="startAddBoard"
        >
          <div i-carbon:add-large />
          New Board
        </div>
        <input
          ref="newBoardInput"
          v-show="isAddingBoard"
          v-model="newBoardName"
          type="text"
          placeholder="Board Name"
          class="box-border !w-36 h-2rem indent-2 outline-none rounded-md border border-solid border-[var(--c-border)] placeholder:text-[var(--c-text-placeholder)] focus-visible:ring-[var(--c-accent)] focus-visible:ring-inset focus-visible:ring-2"
          @blur="commitNewBoard"
          @keydown.enter="commitNewBoard"
        />
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-[var(--c-text)] hover:text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-soft)] border border-solid border-[var(--c-border)] rounded-md cursor-pointer"
          @click="renameCurrentBoard"
        >
          <div i-carbon:edit />
          Rename
        </div>
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-[var(--c-text)] hover:text-[var(--c-danger)] hover:bg-[var(--c-bg-soft)] border border-solid border-[var(--c-border)] rounded-md cursor-pointer"
          @click="deleteCurrentBoard"
        >
          <div i-carbon:trash-can />
          Delete
        </div>
      </div>

      <div class="flex-auto"></div>

      <div class="flex items-center gap-2">
        <div
          v-show="!isAddingColumn"
          class="btn flex items-center justify-center gap1 !w-36 h-2rem text-xs text-#fff bg-[var(--c-accent)] border-none rounded-md cursor-pointer hover:opacity-80"
          @click="startAddColumn"
        >
          <div i-carbon:add-large />
          Add Column
        </div>
        <input
          v-show="isAddingColumn"
          ref="newColumnInput"
          v-model="newColumnTitle"
          type="text"
          placeholder="Column Name"
          class="box-border !w-36 h-2rem indent-2 outline-none rounded-md border border-solid border-[var(--c-border)] placeholder:text-[var(--c-text-placeholder)] focus-visible:ring-[var(--c-accent)] focus-visible:ring-inset focus-visible:ring-2"
          @blur="commitColumn"
          @keydown.enter="commitColumn"
        />
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-[var(--c-text)] hover:text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-soft)] border border-solid border-[var(--c-border)] rounded-md cursor-pointer"
          @click="exportBoard"
        >
          <div i-carbon:export />
          Export
        </div>
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-[var(--c-text)] hover:text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-soft)] border border-solid border-[var(--c-border)] rounded-md cursor-pointer"
          @click="exportAll"
        >
          <div i-carbon:archive />
          Export All
        </div>
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-[var(--c-text)] hover:text-[var(--c-text-secondary)] hover:bg-[var(--c-bg-soft)] border border-solid border-[var(--c-border)] rounded-md cursor-pointer"
          @click="triggerImport"
        >
          <div i-carbon:download />
          Import
        </div>
        <input
          ref="importInput"
          type="file"
          accept=".xlsx,.xls"
          class="hidden"
          @change="handleImport"
        />

        <a
          :href="DISCORD_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center text-5 text-#5865F2 hover:opacity-80"
          title="Join our Discord community"
        >
          <div i-simple-icons:discord />
        </a>
        <a
          :href="GITHUB_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center text-5 text-[var(--c-github)] hover:opacity-80"
          title="View source on GitHub"
        >
          <div i-simple-icons:github />
        </a>

        <ThemeSwitcher />

        <div
          ref="themeBtnRef"
          class="flex items-center text-5 text-[var(--c-text)] cursor-pointer"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="handleThemeToggle"
        >
          <Transition name="theme-toggle" mode="out-in">
            <div v-if="isDark" key="sun" i-carbon:sun />
            <div v-else key="moon" i-carbon:moon />
          </Transition>
        </div>
      </div>
    </div>

    <!-- Columns area -->
    <div class="flex w-fit">
      <draggable v-model="columns" item-key="id" class="flex gap-4 h-full">
        <template #item="{ element: column }">
          <ColumnCard :column="column" @remove="removeColumn" @open-task="openTask" />
        </template>
      </draggable>
    </div>

    <TaskDrawer :task="activeTask" @save="saveTask" @close="closeTask" @delete="deleteTask" />
  </div>
</template>

<style scoped>
.board-menu-enter-active,
.board-menu-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  transform-origin: top left;
}
.board-menu-enter-from,
.board-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}

.theme-toggle-enter-active {
  transition:
    opacity 0.25s ease-out 0.08s,
    transform 0.3s ease-out 0.08s;
}
.theme-toggle-leave-active {
  transition:
    opacity 0.15s ease-in,
    transform 0.2s ease-in;
}
.theme-toggle-enter-from,
.theme-toggle-leave-to {
  opacity: 0;
  transform: rotate(120deg) scale(0.4);
}

:global(.theme-reveal-overlay) {
  position: fixed;
  z-index: 9999;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform;
}
</style>
