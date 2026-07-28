import { useSyncExternalStore } from 'react'

export type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme'
const THEME_CHANGE_EVENT = 'diffdump:themechange'

function readResolvedTheme(): ResolvedTheme {
  const root = document.documentElement
  if (root.classList.contains('dark')) return 'dark'
  if (root.classList.contains('light')) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onChange)
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  return () => {
    media.removeEventListener('change', onChange)
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
  }
}

export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, readResolvedTheme, () => 'dark')
}

export function toggleTheme() {
  const next: ResolvedTheme = readResolvedTheme() === 'dark' ? 'light' : 'dark'
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(next)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Persisting the preference is best-effort.
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}
