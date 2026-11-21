// web/src/hooks/useIsDesktop.ts
// Tailwind's lg breakpoint (64rem) as live state, SSR-safe: the server
// paints the desktop rail, and narrow viewports correct it on hydration.
// The passbook's mobile composition reads this — below lg the property
// rail ships icon-only and the desktop collapse toggle stays a desktop
// control.
import { useSyncExternalStore } from 'react'

const query =
  typeof window === 'undefined'
    ? null
    : window.matchMedia('(min-width: 1024px)')

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      query?.addEventListener('change', onChange)
      return () => query?.removeEventListener('change', onChange)
    },
    () => (query ? query.matches : true),
    () => true,
  )
}
