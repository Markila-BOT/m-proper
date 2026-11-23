'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'

import { cn } from '@/lib/utils'

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

// An occluding surface in the glass world (ADR-0004): it floats above the
// content, so it may carry the material's edge and elevation — but it holds
// text and a scrollable calendar, so the body is OPAQUE paper. It is not a
// .glass-surface: no tint, no blur, no scrolling descendant behind glass.
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(
  (
    {
      className,
      align = 'start',
      sideOffset = 6,
      collisionPadding = 8,
      ...props
    },
    ref,
  ) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'popover-surface z-50 w-auto rounded-[2px] border border-[color:var(--glass-edge)] bg-paper p-3 text-ink shadow-[var(--glass-shadow)] outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  ),
)
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverAnchor, PopoverContent }
