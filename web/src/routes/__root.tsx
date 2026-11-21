import { useState } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

import { useLocalStorage, useTransactionFilters, useCSVExport } from '../hooks'
import {
  useSelectedProperty,
  usePropertiesWithStates,
} from '../hooks/useProperties'
import { addTransaction } from '../transactions'
import AppLayout from '../components/AppLayout'
import AppHeader from '../components/AppHeader'
import NavigationTabs from '../components/NavigationTabs'
import TransactionForm from '../components/TransactionForm'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'm-proper' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-[50vh] items-center justify-center p-8 text-muted-foreground">
      <p>Page not found</p>
    </div>
  ),
})

// The routed shell (ADR-0003): the URL picks the view behind the Outlet;
// the shared chrome — sidebar, header, navigation, the add-transaction
// modal — composes around it and forwards nothing to the views.
function RootComponent() {
  // Local storage management
  const { transactions } = useLocalStorage()

  const { selectedProperty } = useSelectedProperty()
  const { properties } = usePropertiesWithStates()

  // UI state
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // The shell's slice of the ledger: the selected property's transactions.
  // The interactive filters belong to the Transactions view (ADR-0003).
  const { filteredTransactions } = useTransactionFilters(
    transactions,
    selectedProperty,
  )

  // CSV export
  const { exportToCSV } = useCSVExport()

  // Event handlers — transaction add/delete delegate to the transactions module
  const handleExport = () => {
    exportToCSV(filteredTransactions, properties, selectedProperty)
  }

  const handleAddTransaction = () => {
    setIsTransactionFormOpen(true)
  }

  const handleCloseTransactionForm = () => {
    setIsTransactionFormOpen(false)
  }

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  return (
    <AppLayout
      isSidebarCollapsed={isSidebarCollapsed}
      onToggleSidebar={handleToggleSidebar}
    >
      <AppHeader
        onExport={handleExport}
        onAddTransaction={handleAddTransaction}
      />
      <NavigationTabs />
      <main className="flex-1">
        <Outlet />
      </main>
      <TransactionForm
        properties={properties}
        selectedProperty={selectedProperty}
        onAddTransaction={addTransaction}
        isOpen={isTransactionFormOpen}
        onClose={handleCloseTransactionForm}
      />
    </AppLayout>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
