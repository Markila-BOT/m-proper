import { Skeleton } from "./skeleton";

interface PropertySkeletonProps {
  count?: number;
  isCollapsed?: boolean;
}

export function PropertySkeleton({
  count = 3,
  isCollapsed = false,
}: PropertySkeletonProps) {
  if (isCollapsed) {
    return (
      <div className="flex flex-col w-16 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
        <div className="flex-1 p-2 space-y-2">
          <Skeleton className="w-10 h-10 rounded-lg mx-auto" />
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="w-10 h-10 rounded-lg mx-auto" />
          ))}
        </div>
        <div className="p-2 border-t border-gray-200">
          <Skeleton className="w-10 h-10 rounded-lg mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-80 bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
        <Skeleton className="w-full h-10 rounded-lg" />
      </div>

      {/* All Properties Option */}
      <div className="p-4 border-b border-gray-200">
        <div className="w-full p-4 rounded-xl border-2 border-gray-200">
          <div className="flex items-center space-x-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
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
              className="w-full p-4 rounded-xl border-2 border-gray-200"
            >
              <div className="space-y-3">
                {/* Property Header */}
                <div className="flex items-start space-x-3">
                  <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex items-center space-x-1">
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </div>

                {/* Property Details */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1">
                    <Skeleton className="w-3 h-3 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>

                {/* Financial Summary */}
                <div className="pt-2 space-y-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex justify-between items-center">
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
  );
}
