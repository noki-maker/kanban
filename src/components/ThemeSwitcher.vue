<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { t } from '@/composables/i18n'
import {
  ACCENT_COLORS,
  DEFAULT_ACCENT,
  accentColor,
  normalizeHexColor,
  setAccentColor,
} from '@/composables/theme'

const COLOR_NAMES = computed<Record<string, string>>(() => ({
  '#0891b2': t('colorCyan'),
  '#2563eb': t('colorBlue'),
  '#9333ea': t('colorPurple'),
  '#16a34a': t('colorGreen'),
  '#fcb041': t('colorYellow'),
}))

const open = ref(false)
const rootRef = ref<HTMLElement>()

const isCustom = computed(() => !ACCENT_COLORS.includes(accentColor.value))
const currentHex = computed(() => normalizeHexColor(accentColor.value) ?? DEFAULT_ACCENT)
const hexDraft = ref(currentHex.value)

watch(currentHex, (value) => {
  hexDraft.value = value
})

function toggle() {
  open.value = !open.value
}

function select(color: string) {
  if (accentColor.value !== color) {
    setAccentColor(color)
  }
  // Keep the panel open so the user can keep browsing the accordion.
}

function onPickerInput(event: Event) {
  setAccentColor((event.target as HTMLInputElement).value)
}

function commitHex() {
  const normalized = normalizeHexColor(hexDraft.value)
  if (normalized) {
    setAccentColor(normalized)
  } else {
    // Invalid input: fall back to the currently applied color.
    hexDraft.value = currentHex.value
  }
}

function onDocumentClick(event: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    open.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    open.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="rootRef" class="relative flex items-center">
    <div
      type="button"
      class="relative flex items-center justify-center text-5 text-[var(--c-text)] rounded-md cursor-pointer transition-colors duration-200 hover:bg-[var(--c-bg-soft)]"
      :class="open ? 'bg-[var(--c-bg-soft)]' : ''"
      :title="t('chooseColor')"
      :aria-label="t('chooseAccent')"
      :aria-expanded="open"
      @click="toggle"
    >
      <div i-carbon:color-palette />
    </div>

    <Transition name="theme-switcher">
      <div
        v-if="open"
        class="absolute top-full right-0 z-50 mt-2 w-52 rounded-xl border border-solid border-[var(--c-border)] bg-[var(--c-bg)] p-1.5 shadow-xl shadow-[var(--c-shadow)]"
      >
        <div
          v-for="color in ACCENT_COLORS"
          :key="color"
          class="rounded-lg"
          :class="accentColor === color ? 'bg-[var(--c-bg-soft)]' : ''"
          :style="{
            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
            color,
          }"
        >
          <div
            class="box-border flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-xs text-[var(--c-text)] rounded-lg cursor-pointer transition-colors duration-200 hover:bg-[var(--c-bg-soft)]"
            @click="select(color)"
          >
            <span
              class="size-4 shrink-0 rounded-full ring-2 ring-[var(--c-border)]"
              :style="{ backgroundColor: color }"
            />
            <span class="font-mono text-[11px] leading-none">{{ COLOR_NAMES[color] }}</span>
            <span class="flex-auto" />
            <span
              v-if="accentColor === color"
              class="i-carbon:checkmark text-sm"
              :style="{ color }"
            />
          </div>
        </div>

        <div class="my-1 h-px bg-[var(--c-border)]" />

        <div class="rounded-lg" :class="isCustom ? 'bg-[var(--c-bg-soft)]' : ''">
          <div
            class="box-border flex w-full items-center gap-2.5 px-2 py-1.5 text-left text-xs text-[var(--c-text)] rounded-lg"
          >
            <input
              type="color"
              class="size-4 shrink-0 cursor-pointer appearance-none rounded-full ring-1 transition-[box-shadow] duration-200 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0"
              :class="isCustom ? 'ring-[var(--c-accent)]' : 'ring-[var(--c-border)]'"
              :value="currentHex"
              :title="t('customColor')"
              :aria-label="t('customColor')"
              @input="onPickerInput"
            />
            <span class="text-[11px] leading-none">{{ t('customColor') }}</span>
            <span class="flex-auto" />
            <input
              v-model="hexDraft"
              type="text"
              spellcheck="false"
              placeholder="#RRGGBB"
              class="box-border w-16 rounded-md border border-solid border-[var(--c-border)] bg-transparent px-1 py-0.5 font-mono text-[11px] text-[var(--c-text)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--c-accent)]"
              @change="commitHex"
              @keydown.enter="commitHex"
            />
            <span
              v-if="isCustom"
              class="i-carbon:checkmark text-sm"
              :style="{ color: accentColor }"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.theme-switcher-enter-active,
.theme-switcher-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  transform-origin: top right;
}
.theme-switcher-enter-from,
.theme-switcher-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
