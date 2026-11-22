// web/src/components/UnreachableState.tsx
// The one shared unreachable state. Three surfaces once printed the
// silent zero when the properties fetch rejected — an empty rail, an
// empty register, ₱0.00 totals, indistinguishable from an empty ledger
// while the fetch failed saying nothing. One state now names what
// happened at all three mounts: an ink status line in the caption idiom,
// part of the page itself (never a modal, never a toast that vanishes),
// naming the problem and the recovery. It is a status condition, not a
// state mark — the ink voice, never stamp red.
//
// Every mount renders this same component, so `data-unreachable` keys it
// structurally and role="status" lets assistive tech announce it; the
// acceptance suite asserts that marker, never the prose, leaving the
// exact words to the voice.

type UnreachableStateProps = {
  // The mount's own placement (the totals strip passes ml-auto so the
  // state takes the scope-note slot); the voice stays the component's.
  className?: string
}

export function UnreachableState({ className = '' }: UnreachableStateProps) {
  return (
    <p
      role="status"
      data-unreachable="properties"
      className={`font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink ${className}`}
    >
      The ledger server is unreachable — start the API, then reload.
    </p>
  )
}

export default UnreachableState
