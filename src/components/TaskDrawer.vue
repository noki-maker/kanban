<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ConfirmDropdown from '@/components/ConfirmDropdown.vue'
import type { Task } from '@/types'
import { addAttachment } from '@/composables/db'
import { ATTACH_PREFIX, getAttachmentUrl } from '@/composables/attachments'
import { locale, t } from '@/composables/i18n'
import { isDark } from '@/composables/theme'

const props = defineProps<{ task: Task | null; columnName?: string }>()
const emit = defineEmits<{ close: []; save: [content: string]; delete: [] }>()

const editorEl = ref<HTMLDivElement>()
let vditor: import('vditor').default | null = null
let vditorClass: typeof import('vditor').default | null = null

const cdn = import.meta.env.BASE_URL + 'vditor'

watch(
  () => props.task,
  (task) => {
    if (!task) {
      destroyEditor()
      return
    }
    void createEditor(task.content)
  },
)

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown)
  window.addEventListener('mousedown', onWindowPointerDown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  window.removeEventListener('mousedown', onWindowPointerDown)
  destroyEditor()
})

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const saveShortcutLabel = isMac ? '⌘S' : 'Ctrl + S'

function onWindowKeydown(event: KeyboardEvent) {
  if (!props.task) return
  if (event.key === 'Escape') {
    if (emojiPanel.value.visible) {
      closeEmojiPanel()
    } else if (contextMenu.value.visible) {
      closeContextMenu()
    } else {
      emit('close')
    }
  } else if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase()
    if (key === 's') {
      event.preventDefault()
      save()
    } else if (key === 'enter') {
      event.preventDefault()
      save()
      emit('close')
    }
  }
}

function onDeleteTask() {
  emit('delete')
}

function onOverlayClick() {
  emit('close')
}

function currentValue() {
  return vditor ? vditor.getValue() : ''
}

function save() {
  emit('save', currentValue().trim())
}

function applyTheme() {
  if (!vditor || !vditorClass) return
  const dark = isDark.value
  // The second argument is the content theme: switching only `theme` won't
  // change the .vditor-reset colors, so body text stays dark (invisible) in
  // dark mode.
  vditor.setTheme(dark ? 'dark' : 'classic', dark ? 'dark' : 'light')
  vditorClass.setCodeTheme(dark ? 'github-dark' : 'github', cdn)
}

function focusEditorAtEnd() {
  if (!vditor) return
  const { ir, sv, wysiwyg } = vditor.vditor
  const element = ir?.element ?? sv?.element ?? wysiwyg?.element
  if (!element) return
  element.focus()
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  // In IR mode every block ends with a <wbr> cursor marker; placing the cursor
  // before the last marker puts it at the end of the content.
  const wbrs = element.querySelectorAll('wbr')
  const lastWbr = wbrs[wbrs.length - 1]
  if (lastWbr) {
    range.setStartBefore(lastWbr)
    range.collapse(true)
  } else {
    range.selectNodeContents(element)
    range.collapse(false)
  }
  selection.removeAllRanges()
  selection.addRange(range)
}

// Toolbar actions are exposed via the context menu: the hidden Vditor toolbar
// is kept to bind events, and clicking a menu item simulates clicking the
// matching button so Vditor's native formatting logic is reused.
interface ContextMenuItem {
  /** Key of the Vditor toolbar elements */
  name: string
  /** i18n text key (used by non-heading items) */
  i18nKey?: Parameters<typeof t>[0]
  /** Heading level, used to click buttons inside the headings panel */
  level?: number
}

const contextMenu = ref({ visible: false, x: 0, y: 0 })
const emojiPanel = ref({ visible: false, x: 0, y: 0 })

const ctxRows = computed<ContextMenuItem[][]>(() => [
  [{ name: 'emoji', i18nKey: 'emoji' }],
  // Vditor's image/upload button is the built-in `upload` menu item; `image`
  // would fall through to a custom item without the file input.
  [{ name: 'upload', i18nKey: 'image' }],
  [{ name: 'check', i18nKey: 'taskList' }],
  [{ name: 'bold', i18nKey: 'bold' }],
  [{ name: 'italic', i18nKey: 'italic' }],
  [{ name: 'strike', i18nKey: 'strike' }],
  [{ name: 'link', i18nKey: 'link' }],
])

function closeContextMenu() {
  contextMenu.value.visible = false
}

function closeEmojiPanel() {
  emojiPanel.value.visible = false
}

// Prevent the default behavior on right-click so the editor's selected text
// isn't cleared, letting menu commands act on the selection (e.g. bold).
function onEditorMouseDown(event: MouseEvent) {
  if (event.button === 2) event.preventDefault()
}

function onEditorContextMenu(event: MouseEvent) {
  event.preventDefault()
  const menuWidth = 264
  const menuHeight = 240
  contextMenu.value = {
    visible: true,
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
  }
}

function onWindowPointerDown(event: MouseEvent) {
  const target = event.target as Element
  if (!target?.closest?.('.editor-context-menu')) closeContextMenu()
  if (!target?.closest?.('.editor-emoji-panel')) closeEmojiPanel()
}

function iconFor(name: string) {
  const html = vditor?.vditor.toolbar?.elements?.[name]?.firstElementChild?.innerHTML ?? ''
  // The upload button embeds its hidden file input next to the icon; keep
  // only the SVG so the input is not injected into the context menu.
  return html.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? html
}

// Emoji panel data: reuse the hint.emoji configured for Vditor (key → value).
// The vditor instance is a plain (non-reactive) variable, so explicitly depend
// on the panel's visibility to only evaluate when it's open (the editor is
// guaranteed to be initialized then), with optional chaining as a fallback.
const emojiList = computed(() => {
  if (!vditor || !emojiPanel.value.visible) return []
  const emoji = vditor?.vditor?.options?.hint?.emoji ?? {}
  return Object.entries(emoji).map(([key, value]) => ({ key, value }))
})

function openEmojiPanel() {
  // Pop up the emoji picker near the context menu position
  const panelWidth = 300
  const panelHeight = 288
  emojiPanel.value = {
    visible: true,
    x: Math.max(8, Math.min(contextMenu.value.x, window.innerWidth - panelWidth - 8)),
    y: Math.max(8, Math.min(contextMenu.value.y, window.innerHeight - panelHeight - 8)),
  }
  closeContextMenu()
}

function runMenuAction(item: ContextMenuItem) {
  if (item.name === 'emoji') {
    openEmojiPanel()
    return
  }
  closeContextMenu()
  const elements = vditor?.vditor.toolbar?.elements
  if (!elements) return
  if (item.name === 'upload') {
    // The hidden Vditor toolbar keeps the file input for the image button;
    // clicking it opens the file picker and triggers the upload handler.
    elements.upload?.querySelector<HTMLInputElement>('input[type="file"]')?.click()
    return
  }
  if (item.level) {
    elements.headings
      ?.querySelector<HTMLButtonElement>(`button[data-tag="h${item.level}"]`)
      ?.click()
  } else {
    elements[item.name]?.firstElementChild?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    )
  }
}

function insertEmoji(key: string, value: string) {
  closeEmojiPanel()
  const panel = vditor?.vditor.toolbar?.elements?.emoji
  if (!panel) return
  const dataKey = value.includes('.') ? `:${key}:` : key
  panel.querySelector<HTMLButtonElement>(`button[data-key="${dataKey}"]`)?.click()
  requestAnimationFrame(() => {
    const { ir, sv, wysiwyg } = vditor?.vditor ?? {}
    ;(ir?.element ?? sv?.element ?? wysiwyg?.element)?.focus()
  })
}

// Images are stored as binary attachments and referenced in markdown as
// `![name](attach://<id>)`. Those refs aren't loadable URLs, so replace the
// `src` of every rendered image with a Blob-backed object URL. IR mode
// re-renders the DOM on each input, so this also runs from the `input` hook.
async function resolveAttachmentImages() {
  const { ir, sv, wysiwyg } = vditor?.vditor ?? {}
  const element = ir?.element ?? sv?.element ?? wysiwyg?.element
  if (!element) return
  const images = Array.from(element.querySelectorAll<HTMLImageElement>('img[src^="attach://"]'))
  await Promise.all(
    images.map(async (img) => {
      const id = img.getAttribute('src')?.slice(ATTACH_PREFIX.length)
      if (!id) return
      const url = await getAttachmentUrl(id)
      if (url) img.src = url
    }),
  )
}

async function createEditor(content: string) {
  if (vditor) {
    vditor.setValue(content, true)
    focusEditorAtEnd()
    void resolveAttachmentImages()
    return
  }
  if (!editorEl.value) {
    await nextTick()
  }
  if (!editorEl.value) return
  const { default: Vditor } = await import('vditor')
  vditorClass = Vditor
  const dark = isDark.value
  vditor = new Vditor(editorEl.value, {
    mode: 'ir',
    height: '100%',
    value: content,
    placeholder: t('writeMarkdown'),
    lang: locale.value === 'zh' ? 'zh_CN' : 'en_US',
    theme: dark ? 'dark' : 'classic',
    icon: 'ant',
    cache: { enable: false },
    cdn,
    upload: {
      accept: 'image/*',
      multiple: true,
      filename: (name) => name,
      // Store the file as a binary attachment and insert an `attach://` ref.
      // Vditor shows the returned string as a tip; returning null means the
      // handler did all the work.
      handler: async (files) => {
        if (!props.task) return null
        for (const file of files) {
          const attachment = await addAttachment({
            taskId: props.task.id,
            fileName: file.name || 'image.png',
            mime: file.type || 'application/octet-stream',
            blob: file,
          })
          vditor?.insertValue(`\n![${attachment.fileName}](${ATTACH_PREFIX}${attachment.id})\n`)
        }
        void resolveAttachmentImages()
        return null
      },
    },
    toolbar: ['emoji', 'upload', 'bold', 'italic', 'strike', 'link', 'check'],
    outline: { enable: false, position: 'right' },
    preview: {
      theme: { current: dark ? 'dark' : 'light' },
      hljs: { enable: true, style: dark ? 'github-dark' : 'github', lineNumber: false },
      markdown: { toc: true, mark: true, footnotes: true },
      math: { engine: 'KaTeX', inlineDigit: false },
      actions: [],
    },
    hint: {
      emojiPath: `${cdn}/dist/images/emoji`,
      emoji: {
        smile: '😄',
        laugh: '😆',
        grin: '😁',
        wink: '😉',
        blush: '😊',
        cool: '😎',
        sunglasses: '😎',
        rofl: '🤣',
        heart_eyes: '😍',
        kiss: '😘',
        thinking: '🤔',
        confused: '😕',
        sweat: '😅',
        cry: '😢',
        sob: '😭',
        angry: '😠',
        tired: '😫',
        sleepy: '😴',
        mask: '😷',
        eyes: '👀',
        wave: '👋',
        thumbsup: '👍',
        thumbsdown: '👎',
        ok_hand: '👌',
        clap: '👏',
        pray: '🙏',
        fist: '✊',
        muscle: '💪',
        heart: '❤️',
        broken_heart: '💔',
        fire: '🔥',
        star: '⭐',
        sparkles: '✨',
        rainbow: '🌈',
        sun: '☀️',
        moon: '🌙',
        zap: '⚡',
        snowflake: '❄️',
        gift: '🎁',
        balloon: '🎈',
        rocket: '🚀',
        tada: '🎉',
        party: '🎊',
        trophy: '🏆',
        medal: '🏅',
        book: '📖',
        pencil: '✏️',
        bulb: '💡',
        hourglass: '⏳',
        warning: '⚠️',
        check: '✅',
        x: '❌',
        question: '❓',
        exclamation: '❗',
        coffee: '☕',
        beer: '🍺',
        pizza: '🍕',
        apple: '🍎',
        cat: '🐱',
        dog: '🐶',
        bird: '🐦',
        frog: '🐸',
      },
    },
    input: () => {
      void resolveAttachmentImages()
    },
    after: () => {
      focusEditorAtEnd()
      void resolveAttachmentImages()
    },
  })
}

function destroyEditor() {
  closeContextMenu()
  closeEmojiPanel()
  if (vditor) {
    vditor.destroy()
    vditor = null
  }
}

watch(isDark, () => applyTheme())

watch(locale, () => {
  if (!props.task || !vditor) return
  const content = vditor.getValue()
  destroyEditor()
  void createEditor(content)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="task" class="drawer-root font-mono">
        <div class="drawer-overlay" @click="onOverlayClick" />
        <div class="drawer-panel">
          <header
            class="flex items-center gap-2 px-4 py-3 border-b border-solid border-[var(--c-border)]"
          >
            <div
              v-if="columnName"
              class="flex items-center gap-1 px-1 h-2rem text-xs text-[var(--c-text-secondary)]"
            >
              <div i-carbon:column />
              <span class="max-w-40 truncate">{{ columnName }}</span>
            </div>
            <button
              class="btn flex items-center justify-center gap1 px-3 h-2rem text-xs text-#fff bg-[var(--c-accent)] border border-solid border-[var(--c-border)] rounded-md cursor-pointer hover:opacity-80"
              type="button"
              :title="saveShortcutLabel"
              @click="save"
            >
              <div i-carbon:checkmark />
              {{ t('save') }}
            </button>
            <div class="flex-auto"></div>
            <ConfirmDropdown :confirm-text="t('deleteTask')" @confirm="onDeleteTask">
              <template #default="{ toggle, open }">
                <div
                  class="cursor-pointer text-4 text-[var(--c-text)] hover:text-[var(--c-danger)] hover:opacity-70"
                  :class="open ? 'text-[var(--c-danger)]' : ''"
                  :title="t('deleteTask')"
                  @click="toggle"
                  i-carbon:trash-can
                />
              </template>
            </ConfirmDropdown>
            <div
              class="cursor-pointer text-4 text-[var(--c-text)] hover:opacity-70"
              :title="t('close')"
              @click="emit('close')"
              i-carbon:close
            />
          </header>

          <div
            ref="editorEl"
            class="vditor-host flex-1 min-h-0"
            @contextmenu="onEditorContextMenu"
            @mousedown="onEditorMouseDown"
          />
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="ctx-fade">
      <div
        v-if="contextMenu.visible"
        class="editor-context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @mousedown.stop
        @contextmenu.prevent
      >
        <div v-for="(row, ri) in ctxRows" :key="ri" class="ctx-row">
          <button
            v-for="item in row"
            :key="item.level ? `${item.name}${item.level}` : item.name"
            class="ctx-item"
            type="button"
            @click="runMenuAction(item)"
          >
            <span
              v-if="!item.level"
              class="ctx-icon"
              aria-hidden="true"
              v-html="iconFor(item.name)"
            />
            <span>{{ item.level ? `H${item.level}` : item.i18nKey ? t(item.i18nKey) : '' }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="ctx-fade">
      <div
        v-if="emojiPanel.visible"
        class="editor-emoji-panel"
        :style="{ left: emojiPanel.x + 'px', top: emojiPanel.y + 'px' }"
        @mousedown.stop
        @contextmenu.prevent
      >
        <div class="emoji-grid">
          <button
            v-for="e in emojiList"
            :key="e.key"
            class="emoji-item"
            type="button"
            :title="e.key"
            @click="insertEmoji(e.key, e.value)"
          >
            <img v-if="e.value.includes('.')" class="emoji-img" :src="e.value" alt="" />
            <span v-else class="emoji-char">{{ e.value }}</span>
          </button>
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

.vditor-host {
  min-height: 0;
  flex: 1;
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
</style>

<style>
.editor-context-menu {
  position: fixed;
  z-index: 100;
  min-width: 200px;
  padding: 6px;
  box-sizing: border-box;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(31, 31, 31, 0.18);
  font-size: 13px;
  line-height: 1.2;
  user-select: none;
}

.ctx-row {
  display: flex;
  gap: 2px;
}

.ctx-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 0;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--c-text);
  font: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.ctx-item:hover,
.ctx-item:focus-visible {
  background: var(--c-bg-soft);
  color: var(--c-accent);
  outline: none;
}

.ctx-icon {
  display: inline-flex;
  flex: none;
  width: 16px;
  height: 16px;
}

.ctx-icon svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.ctx-fade-enter-active,
.ctx-fade-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.ctx-fade-enter-from,
.ctx-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.editor-emoji-panel {
  position: fixed;
  z-index: 101;
  width: 300px;
  max-height: 288px;
  padding: 8px;
  box-sizing: border-box;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(31, 31, 31, 0.18);
  overflow-y: auto;
  user-select: none;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}

.emoji-item {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.emoji-item:hover,
.emoji-item:focus-visible {
  background: var(--c-bg-soft);
  outline: none;
}

.emoji-img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.emoji-char {
  display: inline-flex;
  line-height: 1;
}
</style>
