import { FiBarChart, FiSettings } from 'react-icons/fi'
import { VscGraphLine } from 'react-icons/vsc'
import { TbBuildings } from 'react-icons/tb'

type TabType = 'overview' | 'transactions' | 'reports' | 'properties'

type NavigationTabsProps = {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

export default function NavigationTabs({
  activeTab,
  onTabChange,
}: NavigationTabsProps) {
  const tabs = [
    {
      id: 'overview' as const,
      label: 'Overview',
      icon: FiBarChart,
    },
    {
      id: 'transactions' as const,
      label: 'Transactions',
      icon: VscGraphLine,
    },
    {
      id: 'properties' as const,
      label: 'Properties',
      icon: TbBuildings,
    },
    {
      id: 'reports' as const,
      label: 'Reports',
      icon: FiSettings,
    },
  ]

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive
                    ? 'text-blue-600 border-blue-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="inline mr-2 w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
