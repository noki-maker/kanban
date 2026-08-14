<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ConfirmDropdown from '@/components/ConfirmDropdown.vue'
import type { Task } from '@/types'
import { renderMarkdown } from '@/composables/markdown'

const props = defineProps<{ task: Task | null }>()
const emit = defineEmits<{ close: []; save: [content: string]; delete: [] }>()

const draft = ref('')
const textareaEl = ref<HTMLTextAreaElement>()
const splitEl = ref<HTMLDivElement>()
const isResizing = ref(false)
const leftPct = ref(50)

watch(
  () => props.task,
  (task) => {
    draft.value = task?.content ?? ''
    if (task) {
      nextTick(() => textareaEl.value?.focus())
    }
  },
)

onMounted(() => window.addEventListener('keydown', onWindowKeydown))
onUnmounted(() => window.removeEventListener('keydown', onWindowKeydown))

function onWindowKeydown(event: KeyboardEvent) {
  if (!props.task) return
  if (event.key === 'Escape') {
    emit('close')
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    save()
  }
}

const rendered = computed(() => renderMarkdown(draft.value))

function onDeleteTask() {
  emit('delete')
}

function save() {
  emit('save', draft.value.trim())
}

function onOverlayClick() {
  emit('close')
}

function startResize(event: PointerEvent) {
  isResizing.value = true
  const divider = event.currentTarget as HTMLElement
  divider.setPointerCapture(event.pointerId)
  document.body.classList.add('user-select-none')
}

function onResizeMove(event: PointerEvent) {
  if (!isResizing.value) return
  const container = splitEl.value?.parentElement
  if (!container) return
  const rect = container.getBoundingClientRect()
  const pct = ((event.clientX - rect.left) / rect.width) * 100
  leftPct.value = Math.min(80, Math.max(20, pct))
}

function endResize(event: PointerEvent) {
  if (!isResizing.value) return
  isResizing.value = false
  const divider = event.currentTarget as HTMLElement
  if (divider.hasPointerCapture(event.pointerId)) {
    divider.releasePointerCapture(event.pointerId)
  }
  document.body.classList.remove('user-select-none')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="task" class="drawer-root">
        <div class="drawer-overlay" @click="onOverlayClick" />
        <div class="drawer-panel">
          <header
            class="flex items-center gap-2 px-4 py-3 border-b border-solid border-[var(--c-border)]"
          >
            <button
              class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-#fff bg-[var(--c-accent)] border border-solid border-[var(--c-border)] rounded-md cursor-pointer hover:opacity-80"
              type="button"
              @click="save"
            >
              <div i-carbon:checkmark />
              Save
            </button>
            <div class="flex-auto"></div>
            <ConfirmDropdown confirm-text="Delete Task" @confirm="onDeleteTask">
              <template #default="{ toggle, open }">
                <div
                  class="cursor-pointer text-4 text-[var(--c-text)] hover:text-[var(--c-danger)] hover:opacity-70"
                  :class="open ? 'text-[var(--c-danger)]' : ''"
                  title="Delete Task"
                  @click="toggle"
                  i-carbon:trash-can
                />
              </template>
            </ConfirmDropdown>
            <div
              class="cursor-pointer text-4 text-[var(--c-text)] hover:opacity-70"
              title="Close (Esc)"
              @click="emit('close')"
              i-carbon:close
            />
          </header>

          <div
            ref="splitEl"
            class="flex flex-1 min-h-0"
            :class="{ 'cursor-col-resize': isResizing }"
          >
            <!-- Left: editor -->
            <div
              class="flex min-w-0 flex-col"
              :class="{ 'select-none': isResizing }"
              :style="{ width: leftPct + '%' }"
            >
              <textarea
                ref="textareaEl"
                name="textarea"
                v-model="draft"
                class="min-h-0 w-full box-border m-1 flex-1 resize-none text-sm leading-6 font-mono text-[var(--c-text)] bg-[var(--c-bg)] placeholder:text-[var(--c-text-placeholder)] border-0 focus:outline-none"
                placeholder="Write markdown here…"
              />
            </div>

            <div
              class="divider shrink-0 cursor-col-resize"
              title="Drag to resize"
              @pointerdown="startResize"
              @pointermove="onResizeMove"
              @pointerup="endResize"
              @pointercancel="endResize"
            />

            <!-- Right: live preview -->
            <div
              class="flex min-w-0 flex-1 flex-col bg-[var(--c-bg-preview)]"
              :class="{ 'select-none': isResizing }"
            >
              <div class="min-h-0 flex-1 overflow-auto">
                <div class="markdown-body px-4 pb-4" v-html="rendered" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-root {
  position: fixed;
  inset: 0;
  z-index: 50;
}

.drawer-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.drawer-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 80vw;
  display: flex;
  flex-direction: column;
  background: var(--c-bg);
  box-shadow: -8px 0 24px rgba(31, 31, 31, 0.12);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel {
  transition: transform 0.25s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-enter-from .drawer-panel,
.drawer-leave-to .drawer-panel {
  transform: translateX(100%);
}

/* Resize divider */
.divider {
  position: relative;
  width: 6px;
  background: transparent;
  transition: background 0.15s ease;
}

.divider:hover {
  background: color-mix(in srgb, var(--c-accent) 25%, transparent);
}

.divider:active {
  background: var(--c-accent);
}

.divider::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  transform: translateX(-50%);
  background: var(--c-border);
}

.divider:hover::before {
  background: transparent;
}

/* Rendered markdown typography */
.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 0.6em 0 0.4em;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-body :deep(h1) {
  font-size: 1.5rem;
}

.markdown-body :deep(h2) {
  font-size: 1.3rem;
}

.markdown-body :deep(h3) {
  font-size: 1.15rem;
}

.markdown-body :deep(h4) {
  font-size: 1rem;
}

.markdown-body :deep(p) {
  margin: 0.5em 0;
  line-height: 1.6;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.markdown-body :deep(li) {
  margin: 0.25em 0;
  line-height: 1.6;
}

.markdown-body :deep(a) {
  color: var(--c-accent);
  text-decoration: underline;
}

.markdown-body :deep(blockquote) {
  margin: 0.6em 0;
  padding-left: 0.8em;
  border-left: 3px solid var(--c-accent);
  color: var(--c-text-secondary);
}

.markdown-body :deep(pre) {
  margin: 0.6em 0;
  padding: 0.8em;
  overflow-x: auto;
  background: var(--c-bg-code);
  border-radius: 6px;
  font-size: 0.85rem;
}

.markdown-body :deep(code) {
  font-family: var(--un-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}

.markdown-body :deep(p code),
.markdown-body :deep(li code) {
  padding: 0.15em 0.35em;
  background: var(--c-bg-code-inline);
  border-radius: 4px;
  font-size: 0.9em;
}

.markdown-body :deep(table) {
  margin: 0.6em 0;
  border-collapse: collapse;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 0.4em 0.7em;
  border: 1px solid var(--c-border-strong);
}

.markdown-body :deep(hr) {
  margin: 0.8em 0;
  border: none;
  border-top: 1px solid var(--c-border-strong);
}

.markdown-body :deep(input[type='checkbox']) {
  margin-right: 0.4em;
  cursor: pointer;
}

.markdown-body :deep(.task-list-item) {
  list-style: none;
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}
</style>
