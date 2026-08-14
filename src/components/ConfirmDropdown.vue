<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{
  confirmText?: string
}>()

const emit = defineEmits<{ confirm: [] }>()

const open = ref(false)
const rootRef = ref<HTMLElement>()

function toggle() {
  open.value = !open.value
}

function confirm() {
  open.value = false
  emit('confirm')
}

function onDocumentClick(event: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    open.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
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
    <slot :toggle="toggle" :open="open" />
    <Transition name="confirm-menu">
      <div
        v-if="open"
        class="absolute top-full right-0 z-50 mt-2 min-w-36 rounded-xl border border-solid border-[var(--c-border)] bg-[var(--c-bg)] p-1.5 shadow-xl shadow-[var(--c-shadow)]"
        role="menu"
      >
        <div
          role="menuitem"
          class="box-border flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-[var(--c-danger)] rounded-lg cursor-pointer transition-colors duration-200 hover:bg-[var(--c-danger)] hover:text-#fff"
          @click="confirm"
        >
          <div class="i-carbon:trash-can text-sm" />
          {{ confirmText ?? 'Delete' }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.confirm-menu-enter-active,
.confirm-menu-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
  transform-origin: top right;
}
.confirm-menu-enter-from,
.confirm-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
