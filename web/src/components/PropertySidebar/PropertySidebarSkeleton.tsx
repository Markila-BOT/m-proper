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
      <div className="flex flex-col w-16 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
        <div className="flex-1 p-2 space-y-2">
          <Skeleton className="mx-auto w-10 h-10 rounded-lg" />
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="mx-auto w-10 h-10 rounded-lg" />
          ))}
        </div>
        <div className="p-2 border-t border-gray-200">
          <Skeleton className="mx-auto w-10 h-10 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-80 bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="w-24 h-6" />
          <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
        <Skeleton className="w-full h-10 rounded-lg" />
      </div>

      {/* All Properties Option */}
      <div className="p-4 border-b border-gray-200">
        <div className="p-4 w-full rounded-xl border-2 border-gray-200">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-32 h-3" />
            </div>
          </div>
        </div>
      </div>

      {/* Properties List */}
      <div className="overflow-y-auto flex-1">
        <div className="p-4 space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="p-4 w-full rounded-xl border-2 border-gray-200"
            >
              <div className="space-y-3">
                {/* Property Header */}
                <div className="flex items-start space-x-3">
                  <Skeleton className="flex-shrink-0 w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <Skeleton className="w-32 h-4" />
                    <div className="flex items-center space-x-1">
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <Skeleton className="w-24 h-3" />
                    </div>
                  </div>
                </div>

                {/* Property Details */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <Skeleton className="w-16 h-3" />
                  </div>
                  <Skeleton className="w-20 h-5 rounded-full" />
                </div>

                {/* Financial Summary */}
                <div className="pt-2 space-y-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <Skeleton className="w-16 h-3" />
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
