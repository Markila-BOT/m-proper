// web/src/hooks/useMediaQuery.ts
// A live media query as state, SSR-safe the same way useIsDesktop is: the
// server paints the fallback and the client corrects on hydration. The
// critique pass reads the sm breakpoint here — the destructive confirm
// composes as an inline stamp at sm and a bottom sheet below it.
import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => serverFallback,
  )
}
