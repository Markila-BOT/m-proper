import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('rounded-[2px] animate-pulse bg-print-wash', className)}
      {...props}
    />
  )
}

export { Skeleton }
