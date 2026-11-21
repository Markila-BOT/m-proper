import { Link } from '@tanstack/react-router'
import { FiBarChart, FiSettings } from 'react-icons/fi'
import { VscGraphLine } from 'react-icons/vsc'
import { TbBuildings } from 'react-icons/tb'

// The URL is the tab state (ADR-0003): every tab is a router Link to its
// route, and the router's active/inactive props carry today's exact look.
const tabs = [
  {
    to: '/overview',
    label: 'Overview',
    icon: FiBarChart,
  },
  {
    to: '/transactions',
    label: 'Transactions',
    icon: VscGraphLine,
  },
  {
    to: '/properties',
    label: 'Properties',
    icon: TbBuildings,
  },
  {
    to: '/reports',
    label: 'Reports',
    icon: FiSettings,
  },
] as const

export default function NavigationTabs() {
  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon

            return (
              <Link
                key={tab.to}
                to={tab.to}
                className="py-4 px-1 border-b-2 font-medium text-sm"
                activeProps={{
                  className: 'text-blue-600 border-blue-500',
                }}
                inactiveProps={{
                  className:
                    'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300',
                }}
              >
                <Icon className="inline mr-2 w-4 h-4" />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
