import { Skeleton } from '../ui/skeleton'

type PropertySidebarSkeletonProps = {
  count?: number
  isCollapsed?: boolean
}

// The skeleton wears the rail's real structure: glass only on the chrome
// blocks, the entry list on the opaque paper panel, no scrolling subtree
// inside a glass surface (ADR-0004 — the boundary is structural).
const railFrame = 'glass-edge-r sticky top-0 flex h-dvh flex-col'
const railHeader = 'glass-surface glass-chrome border-b border-rule'
const railFooter = 'glass-surface glass-chrome-b border-t border-rule'
const railScroll = 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-paper'

export function PropertySidebarSkeleton({
  count = 3,
  isCollapsed = false,
}: PropertySidebarSkeletonProps) {
  if (isCollapsed) {
    return (
      <div className={`${railFrame} w-28 lg:w-16`}>
        <div className={`${railHeader} hidden p-4 lg:block`}>
          <Skeleton className="h-10 w-10" />
        </div>
        <div className={`${railScroll} space-y-2 p-2`}>
          <Skeleton className="mx-auto h-10 w-10" />
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="mx-auto h-10 w-10" />
          ))}
        </div>
        <div className={`${railFooter} p-2`}>
          <Skeleton className="mx-auto h-10 w-10" />
        </div>
      </div>
    )
  }

  return (
    <div className={`${railFrame} w-80`}>
      {/* Header */}
      <div className={`${railHeader} p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-10" />
        </div>
        <Skeleton className="h-9 w-full" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-paper">
        {/* All Properties Option */}
        <div className="border-b border-rule">
          <div className="w-full px-5 py-3.5">
            <div className="flex items-center space-x-3">
              <Skeleton className="h-5 w-5" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* Properties List */}
        <div className={railScroll}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="w-full border-b border-rule px-5 py-3.5">
              <div className="space-y-2.5">
                {/* Property Header */}
                <div className="flex items-start space-x-3">
                  <Skeleton className="h-5 w-5 flex-shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex items-center space-x-1">
                      <Skeleton className="h-3 w-3" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>

                {/* Property Details */}
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>

                {/* Financial Summary */}
                <div className="space-y-1.5 border-t border-rule pt-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-14" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
