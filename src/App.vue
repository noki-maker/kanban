<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import ColumnCard from '@/components/ColumnCard.vue'
import TaskDrawer from '@/components/TaskDrawer.vue'
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
async function createNewBoard() {
  const name = window.prompt('New board name:')
  if (!name?.trim()) return
  const board = await createBoard(name.trim())
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

function onBoardSelect(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  if (id) void switchBoard(id)
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
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Board toolbar -->
    <div
      class="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-#fff border border-solid border-[#919eab33] rounded-lg"
    >
      <select
        :value="currentBoardId"
        class="box-border h-2rem pl-2 pr-6 max-w-56 outline-none rounded-md border border-solid border-[#919eab33] text-xs text-#1f1f1f bg-#fff cursor-pointer focus-visible:ring-[#fda92d] focus-visible:ring-2"
        title="Switch Board"
        @change="onBoardSelect"
      >
        <option v-for="board in boards" :key="board.id" :value="board.id">
          {{ board.name }}
        </option>
      </select>

      <div class="flex items-center gap-2">
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-#fff bg-#fcb041 border border-solid border-[#919eab33] rounded-md cursor-pointer hover:opacity-80"
          @click="createNewBoard"
        >
          <div i-carbon:add-large />
          New Board
        </div>
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-#1f1f1f hover:text-#637381 hover:bg-#f4f6f8 border border-solid border-[#919eab33] rounded-md cursor-pointer"
          @click="renameCurrentBoard"
        >
          <div i-carbon:edit />
          Rename
        </div>
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-#1f1f1f hover:text-#d92d20 hover:bg-#f4f6f8 border border-solid border-[#919eab33] rounded-md cursor-pointer"
          @click="deleteCurrentBoard"
        >
          <div i-carbon:trash-can />
          Delete
        </div>
      </div>

      <div class="flex-auto"></div>

      <div class="flex items-center gap-2">
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-#1f1f1f hover:text-#637381 hover:bg-#f4f6f8 border border-solid border-[#919eab33] rounded-md cursor-pointer"
          @click="exportBoard"
        >
          <div i-carbon:export />
          Export
        </div>
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-#1f1f1f hover:text-#637381 hover:bg-#f4f6f8 border border-solid border-[#919eab33] rounded-md cursor-pointer"
          @click="exportAll"
        >
          <div i-carbon:archive />
          Export All
        </div>
        <div
          class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-#1f1f1f hover:text-#637381 hover:bg-#f4f6f8 border border-solid border-[#919eab33] rounded-md cursor-pointer"
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
          :href="GITHUB_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center text-5 text-#181717 hover:opacity-80"
          title="View source on GitHub"
        >
          <div i-simple-icons:github />
        </a>
        <a
          :href="DISCORD_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center text-5 text-#5865F2 hover:opacity-80"
          title="Join our Discord community"
        >
          <div i-simple-icons:discord />
        </a>
      </div>
    </div>

    <!-- Columns area -->
    <div class="flex w-fit">
      <draggable v-model="columns" item-key="id" class="flex gap-4 h-full">
        <template #item="{ element: column }">
          <ColumnCard :column="column" @remove="removeColumn" @open-task="openTask" />
        </template>
      </draggable>

      <div class="ml-4 !w-280px">
        <div
          v-show="!isAddingColumn"
          class="btn flex items-center justify-center gap3 h-2rem text-xs text-#fff bg-#fcb041 hover:bg-#f4f6f8 border border-solid border-[#919eab33] rounded-md cursor-pointer"
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
          class="box-border flex w-full h-2rem indent-2 outline-none rounded-md border border-solid border-[#919eab33] placeholder:text-#919eab focus-visible:ring-[#fda92d] focus-visible:ring-2"
          @blur="commitColumn"
          @keydown.enter="commitColumn"
        />
      </div>
    </div>

    <TaskDrawer :task="activeTask" @save="saveTask" @close="closeTask" @delete="deleteTask" />
  </div>
</template>
