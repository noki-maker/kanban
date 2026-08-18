<script setup lang="ts">
import { nextTick, ref } from 'vue'
import draggable from 'vuedraggable'
import ConfirmDropdown from '@/components/ConfirmDropdown.vue'
import TaskCard from '@/components/TaskCard.vue'
import type { Column, Task } from '@/types'
import { t } from '@/composables/i18n'

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
          <TaskCard :task="task" @open="emit('openTask', task)" />
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
/* Column-specific layout styles only; task card typography lives in TaskCard.vue. */
</style>
