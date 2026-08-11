import { FiHome, FiDownload, FiPlus } from 'react-icons/fi'

type AppHeaderProps = {
  onExport: () => void
  onAddTransaction: () => void
}

export default function AppHeader({
  onExport,
  onAddTransaction,
}: AppHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FiHome className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Landlord Ledger
              </h1>
              <p className="text-sm text-gray-500">
                Property Management Finance
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={onExport}
              className="flex items-center px-4 py-2 space-x-2 text-gray-600 rounded-lg transition-colors hover:text-gray-900 hover:bg-gray-100"
            >
              <FiDownload className="w-4 h-4" />
              <span>Export</span>
            </button>

            <button
              onClick={onAddTransaction}
              className="flex items-center px-4 py-2 space-x-2 text-white bg-blue-600 rounded-lg shadow-sm transition-colors hover:bg-blue-700"
            >
              <FiPlus className="w-4 h-4" />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
