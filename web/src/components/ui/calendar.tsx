'use client'

// The calendar primitive (liquid-glass-ledger, decision 5): react-day-picker
// v9 wearing the passbook world. Single and range modes are the DayPicker
// modes passed through; the caption is the plain month-and-year label with
// the two chevron controls (no dropdowns), days print in tabular mono, and
// the grid keeps react-day-picker's own keyboard model — arrows, PageUp/
// PageDown, Home/End, Enter — with autoFocus handing the keyboard to the
// selected day when the popover opens.
//
// The day buttons carry data-date as a small honest test hook: the date the
// button names, written from local parts (never toISOString), so the
// acceptance steps can observe which day the keyboard holds.
import { useEffect, useRef } from 'react'
import type { ComponentProps } from 'react'
import { DayPicker } from 'react-day-picker'
import type { DayButtonProps } from 'react-day-picker'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

import { cn } from '@/lib/utils'
import { localDateString } from '@/lib/format'

const navButton =
  'pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-[2px] text-ink-soft transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-print aria-disabled:opacity-40'

function CalendarChevron({
  orientation,
  className,
}: {
  orientation?: 'up' | 'down' | 'left' | 'right'
  className?: string
}) {
  const Icon = orientation === 'right' ? FiChevronRight : FiChevronLeft
  return <Icon className={cn('h-4 w-4', className)} aria-hidden="true" />
}

function CalendarDayButton({
  day,
  modifiers,
  className,
  ...props
}: DayButtonProps) {
  // react-day-picker's focus model moves the DOM focus to the day whose
  // `focused` modifier is true; the replacement button must keep that. The
  // handoff waits one frame because a picker opened inside a modal sheet
  // mounts its popover focus scope after this effect — focusing earlier
  // would be pulled back by the sheet's trap before the popover pauses it.
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!modifiers.focused) return
    const frame = requestAnimationFrame(() => ref.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      type="button"
      data-date={localDateString(day.date)}
      className={cn(className)}
      {...props}
    />
  )
}

function Calendar({ className, ...props }: ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays
      autoFocus
      className={cn('font-sans text-ink', className)}
      classNames={{
        root: 'w-fit',
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'relative flex w-full flex-col gap-2',
        nav: 'pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous: navButton,
        button_next: navButton,
        month_caption: 'flex h-8 items-center justify-center px-10',
        caption_label:
          'font-mono text-ledger font-semibold tabular-nums text-ink',
        month_grid: 'w-full border-collapse',
        weekdays: '',
        weekday:
          'h-8 w-9 text-center font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft',
        weeks: '',
        week: '',
        day: 'h-9 w-9 p-0 text-center align-middle',
        day_button:
          'mx-auto flex h-9 w-9 items-center justify-center rounded-[2px] font-mono text-ledger tabular-nums text-ink transition-colors duration-150 hover:bg-print-wash focus-visible:outline-2 focus-visible:outline-print disabled:cursor-not-allowed',
        selected: '[&>button]:bg-print [&>button]:text-paper',
        range_start: '[&>button]:rounded-r-none',
        range_middle:
          '[&>button]:rounded-none [&>button]:!bg-print-wash [&>button]:!text-ink',
        range_end: '[&>button]:rounded-l-none',
        today:
          '[&>button]:font-bold [&>button]:underline [&>button]:decoration-1 [&>button]:underline-offset-2',
        outside: '[&>button]:text-ink-faint [&>button]:opacity-70',
        disabled:
          '[&>button]:cursor-not-allowed [&>button]:text-ink-faint [&>button]:opacity-40',
        focused:
          '[&>button]:outline-2 [&>button]:outline-offset-1 [&>button]:outline-print',
        hidden: 'invisible',
        footer: '',
      }}
      components={{
        Chevron: CalendarChevron,
        DayButton: CalendarDayButton,
      }}
      {...props}
    />
  )
}

export { Calendar }
