import { ref, watch } from 'vue'

const THEME_KEY = 'kanban.theme'
const ACCENT_KEY = 'kanban.accent'
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

// —— Accent color ——
export const DEFAULT_ACCENT = '#9333ea'
export const ACCENT_COLORS = ['#9333ea', '#2563eb', '#0891b2', '#16a34a', '#fcb041']

function readStoredAccent(): string | null {
  try {
    const stored = localStorage.getItem(ACCENT_KEY)
    return stored && ACCENT_COLORS.includes(stored) ? stored : null
  } catch {
    return null
  }
}

export const accentColor = ref(readStoredAccent() ?? DEFAULT_ACCENT)

// Keep the browser tab favicon in sync with the accent color. The template
// mirrors `public/favicon.svg` (a kanban icon) with a dynamic stroke color.
const FAVICON_TEMPLATE = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9.4c0-2.24 0-3.36.436-4.216a4 4 0 0 1 1.748-1.748C6.04 3 7.16 3 9.4 3h5.2c2.24 0 3.36 0 4.216.436a4 4 0 0 1 1.748 1.748C21 6.04 21 7.16 21 9.4v5.2c0 2.24 0 3.36-.436 4.216a4 4 0 0 1-1.748 1.748C17.96 21 16.84 21 14.6 21H9.4c-2.24 0-3.36 0-4.216-.436a4 4 0 0 1-1.748-1.748C3 17.96 3 16.84 3 14.6zM17 7v4m-5-4v8M7 7v6"/></svg>`

function applyFavicon(color: string) {
  const href = `data:image/svg+xml;utf8,${encodeURIComponent(FAVICON_TEMPLATE(color))}`
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.append(link)
  }
  link.href = href
}

function applyAccent(color: string) {
  document.documentElement.style.setProperty('--c-accent', color)
  applyFavicon(color)
  try {
    localStorage.setItem(ACCENT_KEY, color)
  } catch {
    // localStorage unavailable (e.g. private mode): keep in-memory only.
  }
}

// First load: the inline FOUC script in index.html usually already set the
// variable, but keep the DOM and storage in sync regardless.
applyAccent(accentColor.value)

watch(accentColor, (color) => {
  applyAccent(color)
})

export function setAccentColor(color: string) {
  accentColor.value = color
}
