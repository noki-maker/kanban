import { ref, watch } from 'vue'

const THEME_KEY = 'kanban.theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
}

function initialIsDark(): boolean {
  const stored = readStoredTheme()
  if (stored) return stored === 'dark'
  // The inline script in index.html may already have set the class (FOUC guard);
  // fall back to the system preference.
  return document.documentElement.classList.contains('dark') || darkQuery.matches
}

export const isDark = ref(initialIsDark())

export function toggleTheme() {
  isDark.value = !isDark.value
}

watch(isDark, (dark) => {
  document.documentElement.classList.toggle('dark', dark)
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  } catch {
    // localStorage unavailable (e.g. private mode): keep in-memory only.
  }
})
