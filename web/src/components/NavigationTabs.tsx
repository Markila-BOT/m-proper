import { Link } from '@tanstack/react-router'

// The URL is the tab state (ADR-0003): every tab is a router Link to its
// route. The rail is green-ruled — the active tab carries ink and a solid
// print-green underline rule; the rest sit in quieter navy.
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
    <nav aria-label="Sections" className="border-b border-rule bg-paper">
      {/* The one green-ruled row of tabs slides when the viewport is
          narrower than the rule — overflow lives inside the rule, never
          under the body. Wide viewports never see a scrollbar. */}
      <div className="flex gap-7 overflow-x-auto px-6 lg:px-9">
        {tabs.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            className="-mb-px border-b-2 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-print"
            activeProps={{
              className: 'border-print font-bold text-ink',
            }}
            inactiveProps={{
              className:
                'border-transparent text-ink-soft transition-colors hover:border-rule hover:text-ink',
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
