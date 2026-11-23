'use client'

// The two calendar pickers (liquid-glass-ledger, decision 5): a Radix
// Popover holding the react-day-picker calendar, plus a typed calendar-string
// field validated by lib/format's parseCalendarDate companion. Typing is
// free; Enter or blur commits. A value that is not a real YYYY-MM-DD day
// shows a message that names the problem and the recovery, and the field
// reverts to the last stored value — so "the stored date is unchanged" is
// directly observable. Selecting a day commits and closes; Escape closes and
// focus returns to the trigger.
//
// The popover body is OPAQUE paper (it holds text and a scrolling calendar),
// never .glass-surface: the material's edge and elevation may show, the tint
// and blur may not.
import { useEffect, useRef, useState } from 'react'
import { FiCalendar } from 'react-icons/fi'
import type { DateRange as DayPickerRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import {
  calendarDateIssue,
  localDateString,
  parseCalendarDate,
} from '#/lib/format'
import type { CalendarDateIssue } from '#/lib/format'
import { Label } from './label'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Calendar } from './calendar'

const fieldLabel =
  'mb-1.5 block font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft'
const fieldInput =
  'h-9 w-full rounded-[2px] border border-rule bg-paper px-3 font-mono text-base tabular-nums text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-paper sm:text-sm'
const triggerButton =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-rule bg-paper text-ink-soft transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-print'
const popoverBody =
  'w-auto max-w-[calc(100vw-2rem)] overflow-auto p-3 max-h-[var(--radix-popover-content-available-height)]'

// The recovery example the message offers: the last stored day when it is a
// real one, otherwise today's local date. Never a UTC-derived day.
function recoveryExample(stored: string): string {
  return parseCalendarDate(stored) ? stored : localDateString()
}

function issueMessage(
  issue: CalendarDateIssue,
  text: string,
  { stored, min, max }: { stored: string; min?: string; max?: string },
): string {
  const example = recoveryExample(stored)
  if (issue === 'required') {
    return `A date is required. Use YYYY-MM-DD, for example ${example}.`
  }
  if (issue === 'before') {
    const earliest = min && parseCalendarDate(min) ? min : example
    return `${text} is before the earliest allowed date. Use YYYY-MM-DD, for example ${earliest}.`
  }
  if (issue === 'after') {
    const latest = max && parseCalendarDate(max) ? max : example
    return `${text} is after the latest allowed date. Use YYYY-MM-DD, for example ${latest}.`
  }
  // The shape is right but the day does not exist (2025-02-30) — name that,
  // then the recovery; a value of another shape gets the format named.
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return `${text} is not a real date. Use YYYY-MM-DD, for example ${example}.`
  }
  return `"${text}" is not a date in YYYY-MM-DD form. Use YYYY-MM-DD, for example ${example}.`
}

type DatePickerProps = {
  // The form's own field id: the label points at this input.
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  min?: string
  max?: string
  disabled?: boolean
  className?: string
}

function DatePicker({
  id,
  label,
  value,
  onChange,
  required = false,
  min,
  max,
  disabled = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const hintId = `${id}-format`
  const errorId = `${id}-error`

  // The parent's stored value is the source of truth: a commit (or a
  // calendar pick) lands there, and the field follows it.
  useEffect(() => {
    setText(value)
    setError(null)
  }, [value])

  const commit = () => {
    const issue = calendarDateIssue(text, { required, min, max })
    if (issue === null) {
      setError(null)
      if (text !== value) onChange(text)
      return
    }
    setError(issueMessage(issue, text, { stored: value, min, max }))
    // The rejected text never becomes the stored value: the field reverts
    // to the last stored day while the message names what went wrong.
    setText(value)
  }

  const selectDay = (day: Date | undefined) => {
    if (!day) return
    const next = localDateString(day)
    setText(next)
    setError(null)
    onChange(next)
    setOpen(false)
  }

  const clear = () => {
    setText('')
    setError(null)
    onChange('')
    setOpen(false)
  }

  const selected = parseCalendarDate(value) ?? undefined
  const openingDay = selected ?? parseCalendarDate(text) ?? new Date()

  return (
    <div className={className}>
      <Label htmlFor={id} className={fieldLabel}>
        {label}
      </Label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="YYYY-MM-DD"
          value={text}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          onChange={(event) => {
            setText(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }
          }}
          onBlur={commit}
          className={fieldInput}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              aria-label="Open calendar"
              disabled={disabled}
              className={triggerButton}
            >
              <FiCalendar className="h-4 w-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className={popoverBody}
            onOpenAutoFocus={(event) => {
              // The calendar's own autoFocus hands the keyboard to the
              // selected day; Radix's default would land on the first
              // focusable control (the previous-month chevron) instead.
              event.preventDefault()
            }}
            onCloseAutoFocus={(event) => {
              // Escape and every other close path return the hand to the
              // trigger, never to the body.
              event.preventDefault()
              triggerRef.current?.focus()
            }}
          >
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={openingDay}
              onSelect={selectDay}
            />
            <div className="mt-2 flex justify-end border-t border-rule pt-2">
              <button
                type="button"
                onClick={clear}
                className="rounded-[2px] px-2 py-1 font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
              >
                Clear
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <p id={hintId} className="mt-1.5 font-sans text-caption text-ink-soft">
        Calendar date · YYYY-MM-DD
      </p>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 font-mono text-[11px] font-semibold text-stamp"
        >
          {error}
        </p>
      )}
    </div>
  )
}

type DateRange = { start: string; end: string }

type DateRangePickerProps = {
  start: string
  end: string
  onChange: (range: DateRange) => void
  disabled?: boolean
  className?: string
}

// One calendar below md, two at md and up. The calendar is the only place
// this query is read; the fields and the trigger never change shape.
function useWideViewport() {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return wide
}

function DateRangePicker({
  start,
  end,
  onChange,
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [startText, setStartText] = useState(start)
  const [endText, setEndText] = useState(end)
  const [error, setError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wide = useWideViewport()
  const errorId = 'ledger-range-error'
  const startHintId = 'ledger-start-date-format'
  const endHintId = 'ledger-end-date-format'

  useEffect(() => {
    setStartText(start)
    setEndText(end)
    setError(null)
  }, [start, end])

  const commitBound = (bound: 'start' | 'end') => {
    const text = bound === 'start' ? startText : endText
    const stored = bound === 'start' ? start : end
    const issue = calendarDateIssue(text)
    if (issue === null) {
      setError(null)
      if (text !== stored) {
        onChange(
          bound === 'start' ? { start: text, end } : { start, end: text },
        )
      }
      return
    }
    setError(issueMessage(issue, text, { stored }))
    if (bound === 'start') setStartText(start)
    else setEndText(end)
  }

  const selectRange = (range: DayPickerRange | undefined) => {
    const nextStart = range?.from ? localDateString(range.from) : ''
    const nextEnd = range?.to ? localDateString(range.to) : ''
    setStartText(nextStart)
    setEndText(nextEnd)
    setError(null)
    onChange({ start: nextStart, end: nextEnd })
    if (nextStart && nextEnd) setOpen(false)
  }

  const clear = () => {
    setStartText('')
    setEndText('')
    setError(null)
    onChange({ start: '', end: '' })
    setOpen(false)
  }

  const from = parseCalendarDate(start) ?? undefined
  const to = parseCalendarDate(end) ?? undefined
  const rangeLabel =
    start && end
      ? `${start} – ${end}`
      : start
        ? `${start} – …`
        : end
          ? `… – ${end}`
          : 'Any date'

  return (
    <div className={className}>
      <span className={fieldLabel}>Date range</span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor="ledger-start-date" className="sr-only">
            From
          </label>
          <input
            id="ledger-start-date"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="YYYY-MM-DD"
            aria-label="From"
            value={startText}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${startHintId} ${errorId}` : startHintId}
            onChange={(event) => {
              setStartText(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitBound('start')
              }
            }}
            onBlur={() => commitBound('start')}
            className={cn(fieldInput, 'w-[8.5rem] px-2')}
          />
          <span aria-hidden="true" className="text-ink-soft">
            –
          </span>
          <label htmlFor="ledger-end-date" className="sr-only">
            To
          </label>
          <input
            id="ledger-end-date"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="YYYY-MM-DD"
            aria-label="To"
            value={endText}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${endHintId} ${errorId}` : endHintId}
            onChange={(event) => {
              setEndText(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitBound('end')
              }
            }}
            onBlur={() => commitBound('end')}
            className={cn(fieldInput, 'w-[8.5rem] px-2')}
          />
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              aria-label="Choose date range"
              disabled={disabled}
              className={cn(triggerButton, 'w-auto gap-2 px-2.5')}
            >
              <FiCalendar className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap font-mono text-ledger tabular-nums">
                {rangeLabel}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className={popoverBody}
            onOpenAutoFocus={(event) => {
              // The range calendar's autoFocus owns the keyboard; see the
              // single picker's note.
              event.preventDefault()
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              triggerRef.current?.focus()
            }}
          >
            <Calendar
              mode="range"
              selected={from ? { from, to } : undefined}
              defaultMonth={from ?? new Date()}
              numberOfMonths={wide ? 2 : 1}
              resetOnSelect
              onSelect={selectRange}
            />
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-rule pt-2">
              <p className="font-sans text-caption text-ink-soft">
                Start and end · YYYY-MM-DD
              </p>
              <button
                type="button"
                onClick={clear}
                className="rounded-[2px] px-2 py-1 font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
              >
                Clear
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <p id={startHintId} className="sr-only">
        From date · YYYY-MM-DD
      </p>
      <p id={endHintId} className="sr-only">
        To date · YYYY-MM-DD
      </p>
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 font-mono text-[11px] font-semibold text-stamp"
        >
          {error}
        </p>
      )}
    </div>
  )
}

export { DatePicker, DateRangePicker }
export type { DateRange }
