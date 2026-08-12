<script setup lang="ts">
import { nextTick, ref } from 'vue'
import draggable from 'vuedraggable'
import type { Column } from '@/types'

const props = defineProps<{ column: Column }>()
const emit = defineEmits<{ remove: [column: Column] }>()

// —— Title editing (per-column state, so shared refs don't scramble focus) ——
const isEditingTitle = ref(false)
const titleInput = ref<HTMLInputElement>()
const editingTitle = ref('')

function startEditTitle() {
  if (props.column.mode === 'vertical') return
  isEditingTitle.value = true
  editingTitle.value = props.column.title
  nextTick(() => titleInput.value?.focus())
}

function commitTitle() {
  const title = editingTitle.value.trim()
  if (title) props.column.title = title
  isEditingTitle.value = false
}

// —— Add task (per-column state) ——
const isAddingTask = ref(false)
const taskInput = ref<HTMLInputElement>()
const newTaskContent = ref('')

function startAddTask() {
  isAddingTask.value = true
  nextTick(() => taskInput.value?.focus())
}

function commitTask() {
  const content = newTaskContent.value.trim()
  if (content) {
    props.column.tasks.push({ id: crypto.randomUUID(), content })
  }
  isAddingTask.value = false
  newTaskContent.value = ''
}

// —— Toggle column mode ——
function toggleMode() {
  props.column.mode = props.column.mode === 'horizontal' ? 'vertical' : 'horizontal'
}

// —— Delete (single click with confirmation) ——
function removeColumn() {
  if (window.confirm(`Delete column "${props.column.title}" and all its tasks?`)) {
    emit('remove', props.column)
  }
}

function removeTask(taskId: string) {
  const index = props.column.tasks.findIndex((t) => t.id === taskId)
  if (index !== -1 && window.confirm('Delete this task?')) {
    props.column.tasks.splice(index, 1)
  }
}
</script>

<template>
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
        v-show="!isEditingTitle"
        :class="{ 'cursor-pointer': column.mode === 'horizontal' }"
        @dblclick="startEditTitle"
      >
        {{ column.title }}
      </div>
      <input
        v-show="isEditingTitle"
        ref="titleInput"
        v-model="editingTitle"
        type="text"
        placeholder="Column name"
        class="box-border flex w-full h-2rem indent-2 outline-none rounded-md border border-solid border-[#919eab33] placeholder:text-#919eab focus-visible:ring-[#fda92d] focus-visible:ring-2"
        @blur="commitTitle"
        @keydown.enter="commitTitle"
      />
      <div
        class="cursor-pointer"
        :class="{ 'rotate-180': column.mode === 'vertical' }"
        @click="toggleMode"
        i-carbon:chevron-down
      ></div>
      <div class="flex-auto"></div>
      <div class="text-3">{{ column.tasks.length }}</div>
      <div
        v-if="column.mode === 'horizontal'"
        class="cursor-pointer text-#fda92d text-3 hover:opacity-70"
        title="Delete column"
        @click="removeColumn"
        i-carbon:trash-can
      />
    </header>

    <div v-if="column.mode === 'horizontal'" class="min-h-4">
      <draggable v-model="column.tasks" item-key="id" group="tasks" class="min-h-4">
        <template #item="{ element: task }">
          <div class="flex justify-between mb-4 p-4 text-3 bg-#fff rounded-md">
            <div class="leading-4 whitespace-pre-line">{{ task.content }}</div>
            <div
              class="cursor-pointer text-#fda92d text-3 hover:opacity-70"
              title="Delete task"
              @click="removeTask(task.id)"
              i-carbon:trash-can
            />
          </div>
        </template>
      </draggable>
    </div>

    <footer v-if="column.mode === 'horizontal'">
      <div
        v-show="!isAddingTask"
        class="btn flex items-center justify-center gap3 h-2rem text-xs text-#fff bg-#fcb041 border border-solid border-[#919eab33] rounded-md cursor-pointer"
        @click="startAddTask"
      >
        <div i-carbon:add-large />
        Add Task
      </div>
      <input
        v-show="isAddingTask"
        ref="taskInput"
        v-model="newTaskContent"
        type="text"
        placeholder="Task content"
        class="box-border flex w-full h-2rem indent-2 outline-none rounded-md border border-solid border-[#919eab33] placeholder:text-#919eab focus-visible:ring-[#fda92d] focus-visible:ring-2"
        @blur="commitTask"
        @keydown.enter="commitTask"
      />
    </footer>
  </div>
</template>
