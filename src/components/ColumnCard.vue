<script setup lang="ts">
import { nextTick, ref } from 'vue'
import draggable from 'vuedraggable'
import type { Column, Task } from '@/types'
import { renderMarkdown } from '@/composables/markdown'

const props = defineProps<{ column: Column }>()
const emit = defineEmits<{ remove: [column: Column]; openTask: [task: Task] }>()

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

// —— Open task detail (single click with confirmation) ——
const dragStart = ref<{ x: number; y: number } | null>(null)

function onTaskPointerDown(event: PointerEvent) {
  dragStart.value = { x: event.clientX, y: event.clientY }
}

function onTaskClick(event: MouseEvent, task: Task) {
  // A drag (vuedraggable) also ends in a click; ignore it by comparing movement.
  const start = dragStart.value
  if (start && (Math.abs(event.clientX - start.x) > 4 || Math.abs(event.clientY - start.y) > 4)) {
    return
  }
  emit('openTask', task)
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
        class="cursor-pointer text-#1f1f1f hover:text-#d92d20 text-3 hover:opacity-70"
        title="Delete Column"
        @click="removeColumn"
        i-carbon:trash-can
      />
    </header>

    <div v-if="column.mode === 'horizontal'" class="min-h-4">
      <draggable v-model="column.tasks" item-key="id" group="tasks" class="min-h-4">
        <template #item="{ element: task }">
          <div
            class="mb-4 p-4 text-3 bg-#fff rounded-md cursor-pointer hover:shadow-md hover:shadow-#919eab22"
            @pointerdown="onTaskPointerDown"
            @click="onTaskClick($event, task)"
          >
            <div
              class="markdown-body max-h-24 overflow-hidden break-words"
              v-html="renderMarkdown(task.content)"
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

<style scoped>
/* Compact markdown typography for task cards */
.markdown-body :deep(p) {
  margin: 0.25em 0;
  line-height: 1.5;
}

.markdown-body :deep(p:first-child) {
  margin-top: 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.25em 0;
  padding-left: 1.25em;
}

.markdown-body :deep(li) {
  margin: 0.15em 0;
  line-height: 1.5;
}

.markdown-body :deep(a) {
  color: #fda92d;
  text-decoration: underline;
}

.markdown-body :deep(blockquote) {
  margin: 0.4em 0;
  padding-left: 0.6em;
  border-left: 3px solid #fda92d;
  color: #637381;
}

.markdown-body :deep(pre) {
  margin: 0.4em 0;
  padding: 0.6em;
  overflow-x: auto;
  background: #f6f8fa;
  border-radius: 6px;
  font-size: 0.8em;
}

.markdown-body :deep(code) {
  font-family: var(--un-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}

.markdown-body :deep(p code),
.markdown-body :deep(li code) {
  padding: 0.1em 0.3em;
  background: #f0f2f5;
  border-radius: 4px;
  font-size: 0.9em;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 0.5em 0 0.3em;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-body :deep(h1) {
  font-size: 1.1rem;
}

.markdown-body :deep(h2) {
  font-size: 1rem;
}

.markdown-body :deep(h3) {
  font-size: 0.95rem;
}

.markdown-body :deep(h4) {
  font-size: 0.9rem;
}

.markdown-body :deep(input[type='checkbox']) {
  margin-right: 0.3em;
  cursor: pointer;
}

.markdown-body :deep(.task-list-item) {
  list-style: none;
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}
</style>
