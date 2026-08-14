<script setup lang="ts">
import { nextTick, ref } from 'vue'
import draggable from 'vuedraggable'
import ConfirmDropdown from '@/components/ConfirmDropdown.vue'
import type { Column, Task } from '@/types'
import { t } from '@/composables/i18n'
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

// —— Delete (confirmed from the dropdown) ——
function removeColumn() {
  emit('remove', props.column)
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
    class="item w-280px h-fit p-4 bg-[var(--c-bg-soft)] rounded-4"
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
        :placeholder="t('columnNamePlaceholder')"
        class="box-border flex w-full h-2rem indent-2 outline-none rounded-md border border-solid border-[var(--c-border)] placeholder:text-[var(--c-text-placeholder)] focus-visible:ring-[var(--c-accent)] focus-visible:ring-2"
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
      <div
        class="flex items-center justify-center w-5 h-5 rounded-full text-2.5 text-#fff bg-[var(--c-accent)]"
      >
        {{ column.tasks.length }}
      </div>
      <ConfirmDropdown
        v-if="column.mode === 'horizontal'"
        :confirm-text="t('deleteColumn')"
        @confirm="removeColumn"
      >
        <template #default="{ toggle, open }">
          <div
            class="cursor-pointer text-[var(--c-text)] hover:text-[var(--c-danger)] text-3 hover:opacity-70"
            :class="open ? 'text-[var(--c-danger)]' : ''"
            :title="t('deleteColumn')"
            @click="toggle"
            i-carbon:trash-can
          />
        </template>
      </ConfirmDropdown>
    </header>

    <div v-if="column.mode === 'horizontal'" class="min-h-4">
      <draggable v-model="column.tasks" item-key="id" group="tasks" class="min-h-4">
        <template #item="{ element: task }">
          <div
            class="mb-4 p-4 text-3 bg-[var(--c-bg)] rounded-md cursor-pointer hover:shadow-md hover:shadow-[var(--c-shadow)]"
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
        class="btn flex items-center justify-center gap3 h-2rem text-xs text-#fff bg-[var(--c-accent)] border border-solid border-[var(--c-border)] rounded-md cursor-pointer hover:opacity-80"
        @click="startAddTask"
      >
        <div i-carbon:add-large />
        {{ t('addTask') }}
      </div>
      <input
        v-show="isAddingTask"
        ref="taskInput"
        v-model="newTaskContent"
        type="text"
        :placeholder="t('taskContent')"
        class="box-border flex w-full h-2rem indent-2 outline-none rounded-md border border-solid border-[var(--c-border)] placeholder:text-[var(--c-text-placeholder)] focus-visible:ring-[var(--c-accent)] focus-visible:ring-2"
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
  color: var(--c-accent);
  text-decoration: underline;
}

.markdown-body :deep(blockquote) {
  margin: 0.4em 0;
  padding-left: 0.6em;
  border-left: 3px solid var(--c-accent);
  color: var(--c-text-secondary);
}

.markdown-body :deep(pre) {
  margin: 0.4em 0;
  padding: 0.6em;
  overflow-x: auto;
  background: var(--c-bg-code);
  border-radius: 6px;
  font-size: 0.8em;
}

.markdown-body :deep(code) {
  font-family: var(--un-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}

.markdown-body :deep(p code),
.markdown-body :deep(li code) {
  padding: 0.1em 0.3em;
  background: var(--c-bg-code-inline);
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
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  width: 14px;
  height: 14px;
  margin-right: 0.3em;
  cursor: pointer;
  vertical-align: middle;
  border: 1px solid var(--c-border-strong);
  border-radius: 4px;
  background: var(--c-bg);
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.markdown-body :deep(input[type='checkbox']:checked) {
  background: var(--c-accent);
  border-color: var(--c-accent);
}

.markdown-body :deep(input[type='checkbox']:checked::after) {
  content: '';
  position: absolute;
  left: 50%;
  top: 45%;
  width: 4px;
  height: 8px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: translate(-50%, -50%) rotate(45deg);
}

.markdown-body :deep(.task-list-item) {
  list-style: none;
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}
</style>
