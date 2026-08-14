<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { getAllData, type BoardWithColumns } from '@/composables/db'
import { t } from '@/composables/i18n'
import type { SearchResult } from '@/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ select: [result: SearchResult]; close: [] }>()

const query = ref('')
const activeIndex = ref(0)
const inputEl = ref<HTMLInputElement>()
const itemEls = ref<HTMLElement[]>([])
const snapshot = ref<BoardWithColumns[]>([])

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    query.value = ''
    activeIndex.value = 0
    snapshot.value = await getAllData()
    await nextTick()
    inputEl.value?.focus()
  },
)

const results = computed<SearchResult[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  const out: SearchResult[] = []
  for (const board of snapshot.value) {
    if (board.name.toLowerCase().includes(q)) {
      out.push({ kind: 'board', board })
    }
    for (const column of board.columns) {
      if (column.title.toLowerCase().includes(q)) {
        out.push({ kind: 'column', board, column })
      }
      for (const task of column.tasks) {
        if (task.content.toLowerCase().includes(q)) {
          out.push({ kind: 'task', board, column, task })
        }
      }
    }
  }
  return out
})

// Keep the active item in bounds when the query shrinks the result list
watch(
  () => results.value.length,
  (len) => {
    if (activeIndex.value >= len) activeIndex.value = Math.max(0, len - 1)
  },
)

watch(activeIndex, () => {
  nextTick(() => itemEls.value[activeIndex.value]?.scrollIntoView({ block: 'nearest' }))
})

function onKeydown(event: KeyboardEvent) {
  const len = results.value.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = len === 0 ? 0 : (activeIndex.value + 1) % len
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = len === 0 ? 0 : (activeIndex.value - 1 + len) % len
  } else if (event.key === 'Enter') {
    const result = results.value[activeIndex.value]
    if (result) {
      event.preventDefault()
      select(result)
    }
  }
}

function setItemEl(el: unknown, index: number) {
  if (el) itemEls.value[index] = el as HTMLElement
}

function select(result: SearchResult) {
  emit('select', result)
  emit('close')
}

function resultKey(result: SearchResult): string {
  const id =
    result.kind === 'task'
      ? result.task.id
      : result.kind === 'column'
        ? result.column.id
        : result.board.id
  return `${result.kind}:${id}`
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

const MAX_SNIPPET = 120

/** Collapse the task content to a short single-line fragment around the match. */
function snippet(text: string): string {
  const flat = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
  const q = query.value.trim()
  if (!q) return flat.length > MAX_SNIPPET ? flat.slice(0, MAX_SNIPPET) + '…' : flat
  const idx = flat.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return flat.length > MAX_SNIPPET ? flat.slice(0, MAX_SNIPPET) + '…' : flat
  const start = Math.max(0, idx - Math.floor((MAX_SNIPPET - q.length) / 2))
  const end = Math.min(flat.length, start + MAX_SNIPPET)
  let out = flat.slice(start, end)
  if (start > 0) out = '…' + out
  if (end < flat.length) out += '…'
  return out
}

/** Escape then wrap the first case-insensitive query match in <mark>. */
function highlight(text: string): string {
  const q = query.value.trim()
  if (!q) return escapeHtml(text)
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return escapeHtml(text)
  return (
    escapeHtml(text.slice(0, idx)) +
    `<mark>${escapeHtml(text.slice(idx, idx + q.length))}</mark>` +
    escapeHtml(text.slice(idx + q.length))
  )
}

function primaryText(result: SearchResult): string {
  if (result.kind === 'task') return snippet(result.task.content)
  if (result.kind === 'column') return result.column.title
  return result.board.name
}
</script>

<template>
  <Teleport to="body">
    <Transition name="search">
      <div
        v-if="open"
        class="search-root"
        role="dialog"
        aria-modal="true"
        :aria-label="t('searchPlaceholder')"
        @mousedown.self="emit('close')"
        @keydown="onKeydown"
      >
        <div class="search-panel">
          <div class="search-input-row">
            <div class="i-carbon:search search-input-icon" />
            <input
              ref="inputEl"
              v-model="query"
              type="text"
              :placeholder="t('searchPlaceholder')"
              class="search-input"
              aria-autocomplete="list"
              aria-controls="search-results"
            />
            <button
              type="button"
              class="search-close"
              :aria-label="t('searchCloseHint')"
              :title="t('searchCloseHint')"
              @click="emit('close')"
            >
              <div class="i-carbon:close" />
            </button>
          </div>

          <ul v-show="results.length > 0" id="search-results" class="search-results" role="listbox">
            <li
              v-for="(result, index) in results"
              :key="resultKey(result)"
              :ref="(el) => setItemEl(el, index)"
              role="option"
              :aria-selected="index === activeIndex"
              tabindex="-1"
              class="search-item"
              :class="{ 'search-item-active': index === activeIndex }"
              @mouseenter="activeIndex = index"
              @click="select(result)"
            >
              <div class="search-item-icon">
                <div v-if="result.kind === 'task'" class="i-carbon:task" />
                <div v-else-if="result.kind === 'column'" class="i-carbon:list-boxes" />
                <div v-else class="i-carbon:grid" />
              </div>
              <div class="search-item-body">
                <div class="search-item-primary" v-html="highlight(primaryText(result))" />
                <div class="search-item-secondary">
                  {{ result.board.name
                  }}<template v-if="result.kind !== 'board'"> / {{ result.column.title }}</template>
                </div>
              </div>
              <div
                v-if="result.kind === 'task'"
                class="i-carbon:chevron-right search-item-chevron"
              />
            </li>
          </ul>

          <div v-if="results.length === 0" class="search-empty">
            <div class="i-carbon:search search-empty-icon" />
            <p class="search-empty-text">
              {{ query.trim() ? t('searchNoResults') : t('searchHint') }}
            </p>
          </div>

          <footer class="search-footer">
            <div class="search-hint-group">
              <span class="kbd">↑</span>
              <span class="kbd">↓</span>
              <span class="search-hint-text">{{ t('searchNavHint') }}</span>
            </div>
            <div class="search-hint-group">
              <span class="kbd">
                <span class="i-carbon:text-new-line -scale-x-100" style="font-size: 1rem" />
              </span>
              <span class="search-hint-text">{{ t('searchOpenHint') }}</span>
            </div>
            <div class="search-hint-group">
              <span class="kbd">ESC</span>
              <span class="search-hint-text">{{ t('searchCloseHint') }}</span>
            </div>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.search-root {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 18vh 1rem 1rem;
  background: rgba(0, 0, 0, 0.35);
}

.search-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 42rem;
  max-height: 60vh;
  overflow: hidden;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 0.75rem;
  box-shadow: 0 12px 48px var(--c-shadow);
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--c-border);
}

.search-input-icon {
  flex-shrink: 0;
  font-size: 1.125rem;
  color: var(--c-text-secondary);
}

.search-input {
  box-sizing: border-box;
  min-width: 0;
  flex: 1;
  background: transparent;
  border: none;
  font-size: 0.875rem;
  color: var(--c-text);
  outline: none;
}

.search-input::placeholder {
  color: var(--c-text-placeholder);
}

.search-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  font-size: 1rem;
  color: var(--c-text-secondary);
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.search-close:hover {
  color: var(--c-text);
  background: var(--c-bg-soft);
}

.search-results {
  overflow-y: auto;
  padding: 0.375rem;
  margin: 0;
  list-style: none;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.search-item-active {
  background: color-mix(in srgb, var(--c-accent) 12%, transparent);
}

.search-item-active .search-item-primary {
  color: var(--c-accent);
}

.search-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  font-size: 0.875rem;
  color: var(--c-text-secondary);
  background: var(--c-bg-soft);
  border-radius: 0.375rem;
}

.search-item-active .search-item-icon {
  color: var(--c-accent);
}

.search-item-body {
  min-width: 0;
  flex: 1;
}

.search-item-primary {
  overflow: hidden;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--c-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-item-primary :deep(mark) {
  padding: 0 1px;
  color: var(--c-text);
  background: color-mix(in srgb, var(--c-accent) 30%, transparent);
  border-radius: 2px;
}

.search-item-secondary {
  margin-top: 0.125rem;
  overflow: hidden;
  font-size: 0.6875rem;
  line-height: 1.2;
  color: var(--c-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-item-chevron {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--c-text-placeholder);
}

.search-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
}

.search-empty-icon {
  font-size: 1.5rem;
  color: var(--c-text-placeholder);
}

.search-empty-text {
  margin: 0;
  font-size: 0.75rem;
  color: var(--c-text-secondary);
}

.search-footer {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  background: var(--c-bg-soft);
  border-top: 1px solid var(--c-border);
}

.search-hint-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.search-hint-text {
  margin-left: 0.375rem;
  font-size: 0.75rem;
  color: var(--c-text-secondary);
}

.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 1.5rem;
  min-width: 1.5rem;
  padding: 0 0.3rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  color: var(--c-text-secondary);
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-bottom-width: 2px;
  border-radius: 0.25rem;
}

.search-enter-active,
.search-leave-active {
  transition: opacity 0.15s ease;
}

.search-enter-active .search-panel,
.search-leave-active .search-panel {
  transition: transform 0.18s ease;
}

.search-enter-from,
.search-leave-to {
  opacity: 0;
}

.search-enter-from .search-panel,
.search-leave-to .search-panel {
  transform: translateY(-8px) scale(0.98);
}
</style>
