<script setup lang="ts">
import { nextTick, ref, watch, onBeforeMount } from 'vue'
import draggable from 'vuedraggable'
import { getColumns, saveColumns, type Column, type Task } from './composables/db'

const columns = ref<Column[]>([])

let init = true
onBeforeMount(async () => {
  columns.value = await getColumns()
  init = false
})

watch(
  columns,
  (val) => {
    if (init) return
    saveColumns(val)
  },
  { deep: true },
)

const changeTitleRef = ref()
const columnTitle = ref('')
function changeTitleClick(column: Column) {
  if (column.mode === 'vertical') return
  column.isChangeTitle = true
  columnTitle.value = column.title
  nextTick(() => {
    changeTitleRef?.value.focus()
  })
}
function changeTitle(column: Column) {
  if (columnTitle.value.trim().length > 0) {
    column.title = columnTitle.value
  }
  column.isChangeTitle = false
}

function changeMode(column: Column) {
  column.mode = column.mode === 'horizontal' ? 'vertical' : 'horizontal'
}

function deleteColumn(column: Column) {
  const index = columns.value.findIndex((col) => col === column)
  columns.value.splice(index, 1)
}

function deleteColumnTask(column: Column, task: Task) {
  const index = column.tasks.findIndex((t) => t === task)
  column.tasks.splice(index, 1)
}

const addTaskInputRef = ref()
function addTaskClick(column: Column) {
  column.isAddTask = true
  nextTick(() => {
    addTaskInputRef?.value.focus()
  })
}
const newTaskContent = ref('')
function addTask(column: Column) {
  if (newTaskContent.value.trim().length > 0) {
    column.tasks.push({
      id: crypto.randomUUID(),
      content: newTaskContent.value,
    })
  }
  column.isAddTask = false
  newTaskContent.value = ''
}

const isAddColumn = ref(false)
const addColumnInputRef = ref()
function addColumnClick() {
  isAddColumn.value = true
  nextTick(() => {
    addColumnInputRef?.value.focus()
  })
}
const newColumnTitle = ref('')
function addColumn() {
  if (!newColumnTitle.value.trim()) {
    isAddColumn.value = false
    return
  }
  const newColumn: Column = {
    id: crypto.randomUUID(),
    isAddTask: false,
    isChangeTitle: false,
    title: newColumnTitle.value.trim(),
    tasks: [],
    mode: 'horizontal',
  }
  columns.value.push(newColumn)
  isAddColumn.value = false
  newColumnTitle.value = ''
}
</script>

<template>
  <div class="flex w-fit">
    <draggable v-model="columns" item-key="id" class="flex gap-4 h-full">
      <template #item="{ element: column }">
        <div
          class="item w-280px h-fit p-4 bg-#f4f6f8 rounded-4"
          :class="{ 'w-28px': column.mode === 'vertical' }"
        >
          <header
            class="mb-4 flex gap-2 select-none items-center justify-center text-base font-semibold"
            :class="{
              '[writing-mode:vertical-rl] [text-orientation:upright]': column.mode === 'vertical',
            }"
          >
            <div
              v-show="!column.isChangeTitle"
              :class="{
                'cursor-pointer': column.mode === 'horizontal',
              }"
              @dblclick="changeTitleClick(column)"
            >
              {{ column.title }}
            </div>
            <input
              v-show="column.isChangeTitle"
              ref="changeTitleRef"
              v-model="columnTitle"
              name="input"
              type="text"
              placeholder="Column Name"
              class="box-border flex w-full h-2rem indent-2 outline-none rounded-md border border-solid border-[#919eab33] placeholder:text-#919eab focus-visible:ring-[#fda92d] focus-visible:ring-2"
              @blur="changeTitle(column)"
              @keydown.enter="changeTitle(column)"
            />
            <div
              class="cursor-pointer"
              :class="{ 'rotate-180': column.mode === 'vertical' }"
              @click="changeMode(column)"
              i-carbon:chevron-down
            ></div>
            <div class="flex-auto"></div>
            <div class="text-3">{{ column.tasks.length }}</div>
            <div
              v-if="column.mode === 'horizontal'"
              class="cursor-pointer text-#fda92d text-3"
              @dblclick="deleteColumn(column)"
              i-carbon:trash-can
            />
          </header>
          <div v-if="column.mode === 'horizontal'" class="min-h-4">
            <draggable v-model="column.tasks" item-key="id" group="tasks" class="min-h-4">
              <template #item="{ element: task }">
                <div class="flex justify-between mb-4 p-4 text-3 bg-#fff rounded-md">
                  <div class="leading-4 whitespace-pre-line">{{ task.content }}</div>
                  <div
                    v-if="column.mode === 'horizontal'"
                    class="cursor-pointer text-#fda92d text-3"
                    @dblclick="deleteColumnTask(column, task)"
                    i-carbon:trash-can
                  />
                </div>
              </template>
            </draggable>
          </div>
          <footer v-if="column.mode === 'horizontal'">
            <div
              v-show="!column.isAddTask"
              class="btn flex items-center justify-center gap3 h-2rem text-xs text-#fff bg-#fcb041 border border-solid border-[#919eab33] rounded-md cursor-pointer"
              @click="addTaskClick(column)"
            >
              <div i-carbon:add-large />
              Add Task
            </div>
            <input
              v-show="column.isAddTask"
              ref="addTaskInputRef"
              v-model="newTaskContent"
              name="input"
              type="text"
              placeholder="Column Name"
              class="box-border flex w-full h-2rem indent-2 outline-none rounded-md border border-solid border-[#919eab33] placeholder:text-#919eab focus-visible:ring-[#fda92d] focus-visible:ring-2"
              @blur="addTask(column)"
              @keydown.enter="addTask(column)"
            />
          </footer>
        </div>
      </template>
    </draggable>

    <div class="ml-4 !w-280px">
      <div
        v-show="!isAddColumn"
        class="btn flex items-center justify-center gap3 h-2rem text-xs text-#1f1f1f hover:text-#637381 hover:bg-#f4f6f8 border border-solid border-[#919eab33] rounded-md cursor-pointer"
        @click="addColumnClick"
      >
        <div i-carbon:add-large />
        Add Column
      </div>
      <input
        v-show="isAddColumn"
        ref="addColumnInputRef"
        v-model="newColumnTitle"
        name="input"
        type="text"
        placeholder="Column Name"
        class="box-border flex w-full h-2rem indent-2 outline-none rounded-md border border-solid border-[#919eab33] placeholder:text-#919eab focus-visible:ring-[#fda92d] focus-visible:ring-2"
        @blur="addColumn"
        @keydown.enter="addColumn"
      />
    </div>
    <div class="flex-auto"></div>
  </div>
</template>
