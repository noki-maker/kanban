<script setup lang="ts">
import { computed } from 'vue'
import { locale, setLocale, t } from '@/composables/i18n'
import type { Locale } from '@/composables/i18n'

const nextLocale = computed<Locale>(() => (locale.value === 'zh' ? 'en' : 'zh'))

function toggle() {
  setLocale(nextLocale.value)
}
</script>

<template>
  <div
    class="flex size-5 shrink-0 items-center justify-center rounded-md text-xl font-medium text-[var(--c-text)] cursor-pointer select-none transition-colors duration-200"
    :title="t('language')"
    @click="toggle"
  >
    <Transition name="lang-toggle" mode="out-in">
      <span v-if="locale === 'zh'" key="zh">中</span>
      <span v-else key="en">EN</span>
    </Transition>
  </div>
</template>

<style scoped>
.lang-toggle-enter-active {
  transition:
    opacity 0.25s ease-out 0.08s,
    transform 0.3s ease-out 0.08s;
}
.lang-toggle-leave-active {
  transition:
    opacity 0.15s ease-in,
    transform 0.2s ease-in;
}
.lang-toggle-enter-from,
.lang-toggle-leave-to {
  opacity: 0;
  transform: rotate(120deg) scale(0.4);
}
</style>
