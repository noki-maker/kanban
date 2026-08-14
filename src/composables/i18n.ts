import { ref, watch } from 'vue'
import en from '@/locales/en'
import zh from '@/locales/zh'

export type Locale = 'en' | 'zh'
type Messages = typeof en

const LOCALE_KEY = 'kanban.locale'
const messages: Record<Locale, Messages> = { en, zh }

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (stored === 'en' || stored === 'zh') return stored
  } catch {
    // localStorage unavailable: fall through to the default.
  }
  return 'en'
}

export const locale = ref<Locale>(readStoredLocale())

function applyLocale(value: Locale) {
  document.documentElement.lang = value
  document.title = messages[value].appTitle
}

applyLocale(locale.value)

export function setLocale(next: Locale) {
  locale.value = next
}

export function t(key: keyof Messages, params?: Record<string, string | number>): string {
  let text: string = messages[locale.value][key]
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value))
    }
  }
  return text
}

watch(locale, (value) => {
  applyLocale(value)
  try {
    localStorage.setItem(LOCALE_KEY, value)
  } catch {
    // localStorage unavailable (e.g. private mode): keep in-memory only.
  }
})
