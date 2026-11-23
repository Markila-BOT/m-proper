import { FiPlus, FiChevronRight, FiMapPin, FiUsers } from 'react-icons/fi'
import { useSelectedProperty } from '../../hooks/useProperties'
import { usePropertySidebar } from '../../hooks/usePropertySidebar'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { PropertySidebarSkeleton } from './PropertySidebarSkeleton'
import PropertyModal from '../PropertyModal'
import { PropertyTypeIcon } from '../PropertyTypeIcon'
import { UnreachableState } from '../UnreachableState'
import { formatMoney } from '../../lib/format'
import { PROPERTY_TYPE } from '#/lib/domain'

type PropertySidebarProps = {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

// The caption that names each rail entry below lg — the passbook names
// every line. Tiny print under the icon, truncated like any narrow
// printed column; at lg it hides and the desktop rail keeps its hover
// tooltips and full-width names.
const railCaptionClass =
  'w-full truncate text-center font-sans text-caption font-medium lg:hidden'

// The rail is the shell's third chrome surface, and the blur boundary is
// structural (ADR-0004): the entry list scrolls, so the list is an opaque
// paper panel and the glass lives only on the rail's own chrome blocks —
// the header (name, collapse, add) and the footer action. No glass element
// here has a scrolling descendant, and the rail's frame carries the solid
// edge the pane shows the page.
const railFrame = 'glass-edge-r sticky top-0 flex h-dvh flex-col'
const railHeader = 'glass-surface glass-chrome border-b border-rule'
const railFooter = 'glass-surface glass-chrome-b border-t border-rule'
const railScroll = 'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-paper'

export default function PropertySidebar({
  isCollapsed,
  onToggleCollapse,
}: PropertySidebarProps) {
  const { selectedProperty, setSelectedProperty } = useSelectedProperty()
  const { properties, propertySummaries, isLoading, error } =
    usePropertySidebar()

  // The rail's breakpoint behavior: below lg it stays a named index —
  // each entry prints its name as a tiny caption under its icon (a touch
  // user cannot hover a tooltip), on a rail just wide enough to carry
  // that print; at lg the captions hide and the rail is exactly the
  // desktop control it was — w-16 icon-only with hover tooltips, or the
  // expanded w-80 list, with the collapse toggle.
  const isDesktop = useIsDesktop()
  const railCollapsed = !isDesktop || isCollapsed

  const getSummaryForProperty = (propertyId: string) => {
    return propertySummaries.find((s) => s.property.id === propertyId)
  }

  // Show loading skeleton
  if (isLoading) {
    return <PropertySidebarSkeleton count={3} isCollapsed={railCollapsed} />
  }

  // Show error state
  if (error) {
    // The rail's mount of the one shared unreachable state: where the
    // entry index would print, the state names what happened — no empty
    // list pretending the ledger is merely blank. The state line is
    // content, not chrome: it sits on the opaque paper panel, never on
    // glass.
    return (
      <nav aria-label="Properties" className={`${railFrame} w-28 lg:w-80`}>
        <div className={`${railHeader} hidden p-6 lg:block`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Properties
            </h2>
            <button
              onClick={onToggleCollapse}
              aria-label="Collapse properties"
              className="rounded-[2px] p-2 text-ink-soft transition-colors hover:bg-print-wash hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
            >
              <FiChevronRight className="h-5 w-5 rotate-180" />
            </button>
          </div>
        </div>
        <div className={`${railScroll} p-4 lg:p-6`}>
          <UnreachableState />
        </div>
      </nav>
    )
  }

  if (railCollapsed) {
    return (
      <nav aria-label="Properties" className={`${railFrame} w-28 lg:w-16`}>
        {/* The expand control is a desktop control: below lg the rail
            keeps its captions by viewport (no toggle needed — the names
            are already printed), so the toggle (and its rule) hide. */}
        <div className={`${railHeader} hidden p-4 lg:block`}>
          <button
            onClick={onToggleCollapse}
            aria-label="Expand properties"
            className="rounded-[2px] p-2 text-ink-soft transition-colors hover:bg-print-wash hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
          >
            <FiChevronRight className="h-5 w-5 rotate-180" />
          </button>
        </div>

        {/* The entry list scrolls, so it is paper: the rail's glass is its
            chrome blocks and the scrolling list is a paper panel between
            them (decision 3). */}
        <div className={`${railScroll} space-y-2 p-2`}>
          <button
            onClick={() => setSelectedProperty('all')}
            className={`flex w-full flex-col items-center gap-1 rounded-[2px] px-1 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-print ${
              selectedProperty === 'all'
                ? 'bg-print-soft text-print shadow-[inset_2px_0_0_var(--color-print)]'
                : 'text-ink-soft hover:bg-print-wash'
            }`}
            aria-label="All Properties"
            title="All Properties"
          >
            <PropertyTypeIcon
              type={PROPERTY_TYPE.COMMERCIAL}
              className="h-5 w-5"
            />
            <span className={railCaptionClass}>All Properties</span>
          </button>

          {properties.map((property) => (
            <button
              key={property.id}
              onClick={() => setSelectedProperty(property.id)}
              className={`flex w-full flex-col items-center gap-1 rounded-[2px] px-1 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-print ${
                selectedProperty === property.id
                  ? 'bg-print-soft text-print shadow-[inset_2px_0_0_var(--color-print)]'
                  : 'text-ink-soft hover:bg-print-wash'
              }`}
              aria-label={property.name}
              title={property.name}
            >
              <PropertyTypeIcon type={property.type} className="h-5 w-5" />
              <span className={railCaptionClass}>{property.name}</span>
            </button>
          ))}
        </div>

        <div className={`${railFooter} p-2`}>
          <PropertyModal>
            <button
              className="flex w-full flex-col items-center gap-1 rounded-[2px] px-1 py-2.5 text-ink-soft transition-colors hover:bg-print-wash hover:text-print focus-visible:outline-2 focus-visible:outline-print"
              aria-label="Add Property"
              title="Add Property"
            >
              <FiPlus className="h-5 w-5" />
              <span className={railCaptionClass}>Add Property</span>
            </button>
          </PropertyModal>
        </div>
      </nav>
    )
  }

  return (
    <nav aria-label="Properties" className={`${railFrame} w-80`}>
      {/* Header — the rail's chrome on the pane: its name, the collapse
          control, and the one add action. No record text lives here, and
          nothing in it scrolls. */}
      <div className={`${railHeader} p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
            Properties
          </h2>
          <button
            onClick={onToggleCollapse}
            aria-label="Collapse properties"
            className="rounded-[2px] p-2 text-ink-soft transition-colors hover:bg-print-wash hover:text-ink focus-visible:outline-2 focus-visible:outline-print"
          >
            <FiChevronRight className="h-5 w-5 rotate-180" />
          </button>
        </div>

        {/* One ink primary per screen: the masthead's "+ Add
            transaction" keeps the ink; this control steps down to the
            quiet outline treatment — hairline rule, soft ink, the print
            wash on hover — a way to add a property, not the page's one
            loudest claim. */}
        <PropertyModal>
          <button className="flex h-9 w-full items-center justify-center rounded-[2px] border border-rule bg-paper px-4 text-sm font-semibold text-ink-soft transition-colors hover:bg-print-wash hover:text-ink focus-visible:outline-2 focus-visible:outline-print">
            <span>Add Property</span>
          </button>
        </PropertyModal>
      </div>

      {/* The entries carry money — figures never sit on glass. Everything
          from here down is an opaque paper panel: the scrolling subtree is
          opaque too, and it sits outside the glass chrome, not inside it
          (decision 3). */}
      <div className="flex min-h-0 flex-1 flex-col bg-paper">
        {/* All Properties Option */}
        <div className="border-b border-rule">
          <button
            onClick={() => setSelectedProperty('all')}
            className={`w-full px-5 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-print ${
              selectedProperty === 'all'
                ? 'bg-print-soft shadow-[inset_3px_0_0_var(--color-print)]'
                : 'hover:bg-print-wash'
            }`}
          >
            <div className="flex items-center space-x-3">
              <PropertyTypeIcon
                type={PROPERTY_TYPE.COMMERCIAL}
                className={
                  selectedProperty === 'all'
                    ? 'h-5 w-5 text-print'
                    : 'h-5 w-5 text-ink-soft'
                }
              />
              <div className="flex-1">
                {/* A span, not a heading: entry names never nest an h3
                    inside a button — heading-mode navigation stays the
                    page's own, and the rail's visual hierarchy is
                    untouched. */}
                <span
                  className={`block text-sm ${
                    selectedProperty === 'all'
                      ? 'font-bold text-ink'
                      : 'font-medium text-ink'
                  }`}
                >
                  All Properties
                </span>
                <p className="text-xs text-ink-soft">View combined data</p>
              </div>
            </div>
          </button>
        </div>

        {/* Properties List — a ruled list on paper */}
        <div className={`${railScroll}`}>
          {properties.map((property) => {
            const summary = getSummaryForProperty(property.id)
            const isSelected = selectedProperty === property.id

            return (
              <button
                key={property.id}
                onClick={() => setSelectedProperty(property.id)}
                className={`w-full border-b border-rule px-5 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-print ${
                  isSelected
                    ? 'bg-print-soft shadow-[inset_3px_0_0_var(--color-print)]'
                    : 'hover:bg-print-wash'
                }`}
              >
                <div className="space-y-2.5">
                  {/* Property Header */}
                  <div className="flex items-start space-x-3">
                    <PropertyTypeIcon
                      type={property.type}
                      className={
                        isSelected
                          ? 'h-5 w-5 flex-shrink-0 text-print'
                          : 'h-5 w-5 flex-shrink-0 text-ink-soft'
                      }
                    />
                    <div className="min-w-0 flex-1">
                      {/* A span at the 16px step the entry name always
                        printed (an h3's default): same size, same weight
                        per state — the heading simply stops living inside
                        a button. */}
                      <span
                        className={`block truncate text-base ${
                          isSelected
                            ? 'font-bold text-ink'
                            : 'font-medium text-ink'
                        }`}
                      >
                        {property.name}
                      </span>
                      <div className="flex items-center space-x-1 text-xs text-ink-soft">
                        <FiMapPin className="h-3 w-3" />
                        <span className="truncate">{property.address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Property Details */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1 text-ink-soft">
                      <FiUsers className="h-3 w-3" />
                      <span>
                        {property.units}{' '}
                        {property.units === 1 ? 'unit' : 'units'}
                      </span>
                    </div>
                    <span className="font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft">
                      {property.type}
                    </span>
                  </div>

                  {/* Financial Summary */}
                  {summary && (
                    <div className="space-y-1.5 border-t border-rule pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-soft">Net</span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-ink">
                          {formatMoney(summary.netProfit)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-soft">Income</span>
                        <span className="font-mono text-xs tabular-nums text-print">
                          {formatMoney(summary.totalIncome)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-ink-soft">Expenses</span>
                        <span className="font-mono text-xs tabular-nums text-ink-soft">
                          {formatMoney(summary.totalExpenses)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
