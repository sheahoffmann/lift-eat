// Appearance: follow the system, or force dark/light. Per-device preference.
import { useEffect, useState } from 'react'

export type ThemePref = 'system' | 'dark' | 'light'
const KEY = 'lift-eat:theme'

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

function apply(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref)
  useEffect(() => {
    apply(pref)
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      /* ignore */
    }
  }, [pref])
  return [pref, setPref] as const
}

// Apply before first paint to avoid a flash.
apply(readPref())
