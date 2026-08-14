<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { t } from '@/composables/i18n'
import { ACCENT_COLORS, accentColor, setAccentColor } from '@/composables/theme'

const COLOR_NAMES = computed<Record<string, string>>(() => ({
  '#0891b2': t('colorCyan'),
  '#2563eb': t('colorBlue'),
  '#9333ea': t('colorPurple'),
  '#16a34a': t('colorGreen'),
  '#fcb041': t('colorYellow'),
}))

const open = ref(false)
const rootRef = ref<HTMLElement>()

function toggle() {
  open.value = !open.value
}

function select(color: string) {
  if (accentColor.value !== color) {
    setAccentColor(color)
  }
  // Keep the panel open so the user can keep browsing the accordion.
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
