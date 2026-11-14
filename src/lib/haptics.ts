// Web haptics.
// iOS Safari has no Vibration API, but since iOS 18, toggling a native
// <input type="checkbox" switch> fires the system "selection" haptic. We keep one
// hidden switch and click it from inside user gestures. Android uses navigator.vibrate.

let label: HTMLLabelElement | null = null

function ensureSwitch() {
  if (label || typeof document === 'undefined') return label
  label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  return label
}

let enabled = true
export function setHapticsEnabled(on: boolean) {
  enabled = on
}

function tick() {
  if (!enabled) return
  try {
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12)
      return
    }
    ensureSwitch()?.click()
  } catch {
    /* haptics are best-effort */
  }
}

export const haptic = {
  /** Light tap: selection changes, toggles. */
  light: tick,
  /** Success: logging a set or a meal. */
  success() {
    tick()
    setTimeout(tick, 90)
  },
  /** Celebration: closing a ring, PRs. */
  celebrate() {
    tick()
    setTimeout(tick, 80)
    setTimeout(tick, 200)
  },
}
