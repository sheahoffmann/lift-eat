// Service worker registration with auto-update. Home-screen apps on iPhone often
// resume instead of reloading, so also check for a new version whenever the app
// comes back to the foreground; when one is found it activates and the page reloads.
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => registration.update().catch(() => {})
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    setInterval(check, 30 * 60 * 1000)
  },
})
