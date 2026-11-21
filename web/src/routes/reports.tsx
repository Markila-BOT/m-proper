import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/reports')({
  component: ReportsView,
})

function ReportsView() {
  return (
    <div className="p-6">
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Reports & Analytics
        </h2>
        <p className="text-gray-600">
          Advanced reporting and analytics features coming soon...
        </p>
      </div>
    </div>
  )
}
