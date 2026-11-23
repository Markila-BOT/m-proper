'use client'

// The searchable select (liquid-glass-ledger, decision 6): a popover
// combobox, not a Radix Select. Radix Select's roving-focus listbox owns the
// keyboard, so a filter input inside it would strand keyboard users; here
// the input keeps focus and the list is navigated through
// aria-activedescendant instead. Typing filters case-insensitively over each
// option's label and keywords; ArrowUp/ArrowDown move (wrapping), Home/End
// jump to the ends, Enter commits the active option, Escape closes and
// returns focus to the trigger, and Tab closes and lets focus move on.
//
// The popover body is OPAQUE paper — it holds text and a scrolling list, so
// it is never a .glass-surface. It may wear the material's edge and
// elevation (PopoverContent does), matching the calendar popover's language.
import { useEffect, useRef, useState } from 'react'
import { FiCheck, FiChevronDown } from 'react-icons/fi'

import { cn } from '@/lib/utils'
import { Label } from './label'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

const fieldLabel =
  'mb-1.5 block font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft'
const triggerButton =
  'flex h-9 w-full items-center justify-between gap-2 rounded-[2px] border border-rule bg-paper px-3 py-2 text-left text-sm text-ink ring-offset-paper placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50'
const filterInput =
  'h-9 w-full rounded-[2px] border border-rule bg-paper px-3 text-base text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-paper sm:text-sm'

type SearchableSelectOption = {
  value: string
  label: string
  keywords?: string[]
}

type SearchableSelectProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  emptyMessage?: string
  required?: boolean
  disabled?: boolean
  className?: string
  // The filter field's accessible name; the visible placeholder follows it.
  searchLabel?: string
}

// Moves the hand to the next (or previous) tabbable control after the
// trigger — what Tab would have done had the popover not closed under it.
function focusTriggerSibling(
  trigger: HTMLButtonElement | null,
  direction: 'next' | 'previous',
) {
  if (!trigger) return
  const tabbables = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  )
  const index = tabbables.indexOf(trigger)
  const target =
    direction === 'next' ? tabbables.at(index + 1) : tabbables.at(index - 1)
  ;(target ?? trigger).focus()
}

function SearchableSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  emptyMessage = 'No categories match.',
  required = false,
  disabled = false,
  className,
  searchLabel = 'Search categories',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // Set on Tab so the close hook moves focus onward instead of back to the
  // trigger; every other close path returns the hand to the trigger.
  const tabIntent = useRef<'next' | 'previous' | null>(null)

  const listId = `${id}-listbox`
  const optionId = (index: number) => `${id}-option-${index}`
  const selected = options.find((option) => option.value === value)

  const needle = query.trim().toLowerCase()
  const matches =
    needle === ''
      ? options
      : options.filter((option) =>
          [option.label, ...(option.keywords ?? [])]
            .join(' ')
            .toLowerCase()
            .includes(needle),
        )

  const activeOption =
    activeIndex >= 0 && activeIndex < matches.length
      ? matches[activeIndex]
      : undefined

  // The active option scrolls into view as the keyboard moves, without
  // dragging the page around it.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    listRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    setQuery('')
    setActiveIndex(-1)
  }

  const choose = (option: SearchableSelectOption) => {
    onChange(option.value)
    setOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (matches.length > 0) {
          setActiveIndex((index) =>
            index < 0 ? 0 : (index + 1) % matches.length,
          )
        }
        break
      case 'ArrowUp':
        event.preventDefault()
        if (matches.length > 0) {
          setActiveIndex((index) =>
            index <= 0 ? matches.length - 1 : index - 1,
          )
        }
        break
      case 'Home':
        event.preventDefault()
        if (matches.length > 0) setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        if (matches.length > 0) setActiveIndex(matches.length - 1)
        break
      case 'Enter':
        event.preventDefault()
        if (activeOption) choose(activeOption)
        break
      case 'Tab':
        // Close, then let the close hook move focus on — never back to the
        // trigger, which would swallow the visitor's Tab.
        tabIntent.current = event.shiftKey ? 'previous' : 'next'
        setOpen(false)
        break
      default:
        break
    }
  }

  return (
    <div className={className}>
      <Label htmlFor={id} className={fieldLabel}>
        {label}
      </Label>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            id={id}
            type="button"
            role="combobox"
            aria-label={label}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-required={required || undefined}
            disabled={disabled}
            data-value={value}
            className={triggerButton}
          >
            <span
              className={cn(
                'min-w-0 truncate',
                selected ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {selected ? selected.label : placeholder}
            </span>
            <FiChevronDown
              className="h-4 w-4 shrink-0 text-print"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-56 max-w-[calc(100vw-2rem)] p-0"
          onOpenAutoFocus={(event) => {
            // The filter input is the hand's first stop, never the trigger.
            event.preventDefault()
            inputRef.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const direction = tabIntent.current
            tabIntent.current = null
            if (direction) {
              focusTriggerSibling(triggerRef.current, direction)
            } else {
              triggerRef.current?.focus()
            }
          }}
        >
          <div className="border-b border-rule p-2">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                activeOption ? optionId(activeIndex) : undefined
              }
              aria-label={searchLabel}
              placeholder={searchLabel}
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(-1)
              }}
              onKeyDown={handleKeyDown}
              className={filterInput}
            />
          </div>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="max-h-[min(15rem,calc(var(--radix-popover-content-available-height)-3.5rem))] overflow-y-auto overscroll-contain p-1"
          >
            {matches.map((option, index) => {
              const isSelected = option.value === value
              return (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  data-option-index={index}
                  onMouseDown={(event) => {
                    // Keep the keyboard in the filter field while the hand
                    // chooses with the pointer.
                    event.preventDefault()
                  }}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex cursor-default select-none items-center gap-2 rounded-[2px] px-2 py-1.5 text-sm text-ink',
                    index === activeIndex && 'bg-print-soft',
                  )}
                >
                  <FiCheck
                    className={cn(
                      'h-4 w-4 shrink-0 text-print',
                      !isSelected && 'invisible',
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">{option.label}</span>
                </li>
              )
            })}
          </ul>
          {matches.length === 0 && (
            <p
              role="status"
              className="border-t border-rule px-3 py-2.5 font-sans text-sm text-ink-soft"
            >
              {emptyMessage}
              {query.trim() !== '' && ` “${query.trim()}” found nothing.`}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

export { SearchableSelect }
export type { SearchableSelectOption }
