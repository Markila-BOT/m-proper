import { Link } from '@tanstack/react-router'

// The URL is the tab state (ADR-0003): every tab is a router Link to its
// route. The rail is the bottom row of the shell's glass chrome pane
// (ADR-0004) — it paints no tint of its own. The active tab carries ink and
// a solid print-green underline rule; the rest sit in quieter navy.
//
// Reports is not a tab: it does not exist yet, so the nav does not point
// at it. Its route stays reachable by direct URL as the honest placeholder
// it is, unlinked until the page is built.
const tabs = [
  { to: '/overview', label: 'Overview' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/properties', label: 'Properties' },
] as const

export default function NavigationTabs() {
  return (
    <nav aria-label="Sections">
      {/* Three short labels never need a scroll container: the row wraps
          instead, so the glass pane holds no scrolling subtree (the blur
          boundary is structural — decision 3). Wide viewports stay one line. */}
      <div className="flex flex-wrap gap-x-7 px-6 lg:px-9">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            // No font weight on the base: the active tab's documented 600
            // and the inactive 500 each own their state alone, so no two
            // weight utilities ever compete on one element.
            className="-mb-px border-b-2 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-print"
            activeProps={{
              className: 'border-print font-semibold text-ink',
            }}
            inactiveProps={{
              className:
                'border-transparent font-medium text-ink-soft transition-colors hover:border-rule hover:text-ink',
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
