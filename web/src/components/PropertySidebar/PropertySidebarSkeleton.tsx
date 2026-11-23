import { Skeleton } from '../ui/skeleton'

type PropertySidebarSkeletonProps = {
  count?: number
  isCollapsed?: boolean
}

export function PropertySidebarSkeleton({
  count = 3,
  isCollapsed = false,
}: PropertySidebarSkeletonProps) {
  if (isCollapsed) {
    return (
      <div className="glass-surface glass-chrome glass-edge-r flex h-screen w-28 flex-col lg:w-16">
        <div className="p-4 border-b border-rule">
          <Skeleton className="w-10 h-10" />
        </div>
        <div className="flex-1 overflow-y-auto bg-paper p-2 space-y-2">
          <Skeleton className="mx-auto w-10 h-10" />
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="mx-auto w-10 h-10" />
          ))}
        </div>
        <div className="p-2 border-t border-rule">
          <Skeleton className="mx-auto w-10 h-10" />
        </div>
      </div>
    )
  }

  return (
    <div className="glass-surface glass-chrome glass-edge-r flex h-screen w-80 flex-col">
      {/* Header */}
      <div className="p-6 border-b border-rule">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="w-24 h-4" />
          <Skeleton className="w-10 h-10" />
        </div>
        <Skeleton className="w-full h-9" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-paper">
        {/* All Properties Option */}
        <div className="border-b border-rule">
          <div className="px-5 py-3.5 w-full">
            <div className="flex items-center space-x-3">
              <Skeleton className="w-5 h-5" />
              <div className="flex-1 space-y-2">
                <Skeleton className="w-24 h-4" />
                <Skeleton className="w-32 h-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Properties List */}
        <div className="overflow-y-auto flex-1 bg-paper">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="px-5 py-3.5 w-full border-b border-rule">
              <div className="space-y-2.5">
                {/* Property Header */}
                <div className="flex items-start space-x-3">
                  <Skeleton className="flex-shrink-0 w-5 h-5" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <Skeleton className="w-32 h-4" />
                    <div className="flex items-center space-x-1">
                      <Skeleton className="w-3 h-3" />
                      <Skeleton className="w-24 h-3" />
                    </div>
                  </div>
                </div>

                {/* Property Details */}
                <div className="flex justify-between items-center">
                  <Skeleton className="w-16 h-3" />
                  <Skeleton className="w-20 h-3" />
                </div>

                {/* Financial Summary */}
                <div className="pt-2 space-y-1.5 border-t border-rule">
                  <div className="flex justify-between items-center">
                    <Skeleton className="w-12 h-3" />
                    <Skeleton className="w-20 h-4" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Skeleton className="w-12 h-3" />
                    <Skeleton className="w-16 h-3" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Skeleton className="w-14 h-3" />
                    <Skeleton className="w-16 h-3" />
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
