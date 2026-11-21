import { FiPlus, FiChevronRight, FiMapPin, FiUsers } from 'react-icons/fi'
import { useSelectedProperty } from '../../hooks/useProperties'
import { usePropertySidebar } from '../../hooks/usePropertySidebar'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { PropertySidebarSkeleton } from './PropertySidebarSkeleton'
import PropertyModal from '../PropertyModal'
import { PropertyTypeIcon } from '../PropertyTypeIcon'
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
    return (
      <nav
        aria-label="Properties"
        className="flex flex-col w-28 lg:w-80 bg-paper border-r border-rule"
      >
        <div className="hidden lg:block p-6 border-b border-rule">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Properties
            </h2>
            <button
              onClick={onToggleCollapse}
              aria-label="Collapse properties"
              className="p-2 text-ink-soft rounded-[2px] transition-colors hover:text-ink hover:bg-print-wash focus-visible:outline-2 focus-visible:outline-print"
            >
              <FiChevronRight className="w-5 h-5 transform rotate-180" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-4 lg:p-6">
          <div className="text-center text-stamp">
            <p>Error loading properties</p>
            <p className="mt-2 text-sm text-ink-soft">{error.message}</p>
          </div>
        </div>
      </nav>
    )
  }

  if (railCollapsed) {
    return (
      <nav
        aria-label="Properties"
        className="flex flex-col w-28 lg:w-16 bg-paper border-r border-rule"
      >
        {/* The expand control is a desktop control: below lg the rail
            keeps its captions by viewport (no toggle needed — the names
            are already printed), so the toggle (and its rule) hide. */}
        <div className="hidden lg:block p-4 border-b border-rule">
          <button
            onClick={onToggleCollapse}
            aria-label="Expand properties"
            className="p-2 text-ink-soft rounded-[2px] transition-colors hover:text-ink hover:bg-print-wash focus-visible:outline-2 focus-visible:outline-print"
          >
            <FiChevronRight className="w-5 h-5 transform rotate-180" />
          </button>
        </div>

        <div className="flex-1 p-2 space-y-2">
          <button
            onClick={() => setSelectedProperty('all')}
            className={`flex flex-col items-center gap-1 w-full px-1 py-2.5 rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-print ${
              selectedProperty === 'all'
                ? 'bg-print-soft text-print shadow-[inset_2px_0_0_var(--color-print)]'
                : 'text-ink-soft hover:bg-print-wash'
            }`}
            aria-label="All Properties"
            title="All Properties"
          >
            <PropertyTypeIcon
              type={PROPERTY_TYPE.COMMERCIAL}
              className="w-5 h-5"
            />
            <span className={railCaptionClass}>All Properties</span>
          </button>

          {properties.map((property) => (
            <button
              key={property.id}
              onClick={() => setSelectedProperty(property.id)}
              className={`flex flex-col items-center gap-1 w-full px-1 py-2.5 rounded-[2px] transition-colors focus-visible:outline-2 focus-visible:outline-print ${
                selectedProperty === property.id
                  ? 'bg-print-soft text-print shadow-[inset_2px_0_0_var(--color-print)]'
                  : 'text-ink-soft hover:bg-print-wash'
              }`}
              aria-label={property.name}
              title={property.name}
            >
              <PropertyTypeIcon type={property.type} className="w-5 h-5" />
              <span className={railCaptionClass}>{property.name}</span>
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-rule">
          <PropertyModal>
            <button
              className="flex flex-col items-center gap-1 w-full px-1 py-2.5 text-ink-soft rounded-[2px] transition-colors hover:text-print hover:bg-print-wash focus-visible:outline-2 focus-visible:outline-print"
              aria-label="Add Property"
              title="Add Property"
            >
              <FiPlus className="w-5 h-5" />
              <span className={railCaptionClass}>Add Property</span>
            </button>
          </PropertyModal>
        </div>
      </nav>
    )
  }

  return (
    <nav
      aria-label="Properties"
      className="flex flex-col w-80 bg-paper border-r border-rule"
    >
      {/* Header */}
      <div className="p-6 border-b border-rule">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-sans text-caption font-semibold uppercase tracking-[0.18em] text-ink-soft">
            Properties
          </h2>
          <button
            onClick={onToggleCollapse}
            aria-label="Collapse properties"
            className="p-2 text-ink-soft rounded-[2px] transition-colors hover:text-ink hover:bg-print-wash focus-visible:outline-2 focus-visible:outline-print"
          >
            <FiChevronRight className="w-5 h-5 transform rotate-180" />
          </button>
        </div>

        <PropertyModal>
          <button className="flex justify-center items-center h-9 px-4 w-full text-sm font-semibold text-paper bg-ink rounded-[2px] transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-print">
            <span>Add Property</span>
          </button>
        </PropertyModal>
      </div>

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
                  ? 'w-5 h-5 text-print'
                  : 'w-5 h-5 text-ink-soft'
              }
            />
            <div className="flex-1">
              <h3
                className={`text-sm ${
                  selectedProperty === 'all'
                    ? 'font-bold text-ink'
                    : 'font-medium text-ink'
                }`}
              >
                All Properties
              </h3>
              <p className="text-xs text-ink-soft">View combined data</p>
            </div>
          </div>
        </button>
      </div>

      {/* Properties List — a ruled list on paper */}
      <div className="overflow-y-auto flex-1">
        {properties.map((property) => {
          const summary = getSummaryForProperty(property.id)
          const isSelected = selectedProperty === property.id

          return (
            <button
              key={property.id}
              onClick={() => setSelectedProperty(property.id)}
              className={`w-full px-5 py-3.5 text-left border-b border-rule transition-colors focus-visible:outline-2 focus-visible:outline-print ${
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
                        ? 'flex-shrink-0 w-5 h-5 text-print'
                        : 'flex-shrink-0 w-5 h-5 text-ink-soft'
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`truncate ${
                        isSelected
                          ? 'font-bold text-ink'
                          : 'font-medium text-ink'
                      }`}
                    >
                      {property.name}
                    </h3>
                    <div className="flex items-center space-x-1 text-xs text-ink-soft">
                      <FiMapPin className="w-3 h-3" />
                      <span className="truncate">{property.address}</span>
                    </div>
                  </div>
                </div>

                {/* Property Details */}
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-1 text-ink-soft">
                    <FiUsers className="w-3 h-3" />
                    <span>
                      {property.units} {property.units === 1 ? 'unit' : 'units'}
                    </span>
                  </div>
                  <span className="font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft">
                    {property.type}
                  </span>
                </div>

                {/* Financial Summary */}
                {summary && (
                  <div className="pt-2 space-y-1.5 border-t border-rule">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-ink-soft">Net</span>
                      <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                        {formatMoney(summary.netProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-ink-soft">Income</span>
                      <span className="font-mono text-xs text-print tabular-nums">
                        {formatMoney(summary.totalIncome)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-ink-soft">Expenses</span>
                      <span className="font-mono text-xs text-ink-soft tabular-nums">
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
    </nav>
  )
}
