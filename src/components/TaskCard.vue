<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import type { Task } from '@/types'
import { resolveAttachmentRefs } from '@/composables/attachments'
import { renderMarkdown } from '@/composables/markdown'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ open: [task: Task] }>()

// —— Async markdown rendering (attachment refs resolve to object URLs) ——
const html = ref('')
let renderToken = 0
watchEffect(() => {
  const token = ++renderToken
  void resolveAttachmentRefs(props.task.content).then((resolved) => {
    if (token !== renderToken) return
    html.value = renderMarkdown(resolved)
  })
})

// —— Open task detail (single click with confirmation) ——
const dragStart = ref<{ x: number; y: number } | null>(null)

function onTaskPointerDown(event: PointerEvent) {
  dragStart.value = { x: event.clientX, y: event.clientY }
}

function onTaskClick(event: MouseEvent) {
  // A drag (vuedraggable) also ends in a click; ignore it by comparing movement.
  const start = dragStart.value
  if (start && (Math.abs(event.clientX - start.x) > 4 || Math.abs(event.clientY - start.y) > 4)) {
    return
  }
  // Clicking a task-list checkbox toggles the todo, not the drawer.
  if ((event.target as HTMLElement).closest('input[type="checkbox"]')) return
  emit('open', props.task)
}

// Toggle a task-list checkbox and persist it back into the markdown source.
// Rendered checkboxes keep DOM order matching the task markers in the source,
// so the nth rendered checkbox maps to the nth task marker.
function onTaskCheckboxChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.type !== 'checkbox') return
  const checkboxes = Array.from(
    (event.currentTarget as HTMLElement).querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    ),
  )
  const index = checkboxes.indexOf(target)
  if (index === -1) return
  const marker = target.checked ? '[x]' : '[ ]'
  let current = 0
  props.task.content = props.task.content.replace(
    /^(\s*(?:[-+*]|\d+\.)\s+)\[[ xX]\](?=\s)/gm,
    (match, prefix: string) => (current++ === index ? `${prefix}${marker}` : match),
  )
}
</script>

<template>
  <div
    class="mb-4 p-4 text-3 bg-[var(--c-bg)] rounded-md cursor-pointer hover:shadow-md hover:shadow-[var(--c-shadow)]"
    @pointerdown="onTaskPointerDown"
    @click="onTaskClick"
    @change="onTaskCheckboxChange"
  >
    <div class="markdown-body max-h-24 overflow-hidden break-words" v-html="html" />
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
  margin: 0;
  padding-left: 0;
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
