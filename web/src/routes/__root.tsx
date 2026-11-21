import { useEffect, useRef, useState } from 'react'
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
import { propertyScopeLabel } from '../components/Summary'
import AppLayout from '../components/AppLayout'
import AppHeader from '../components/AppHeader'
import NavigationTabs from '../components/NavigationTabs'
import TransactionForm from '../components/TransactionForm'

// How long the export's stamp acknowledgment stays on the page.
const EXPORT_ACK_MS = 4000

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

  // The export's acknowledgment: a small stamp lands on the page naming
  // the slice that was written, then clears itself. A repeat export
  // within the window re-stamps (the timer resets), so the mark always
  // tells the truth about the most recent write.
  const [exportedScope, setExportedScope] = useState<string | null>(null)
  const exportAckTimer = useRef<number | null>(null)
  useEffect(() => {
    if (exportedScope === null) return
    exportAckTimer.current = window.setTimeout(
      () => setExportedScope(null),
      EXPORT_ACK_MS,
    )
    return () => {
      if (exportAckTimer.current !== null) {
        window.clearTimeout(exportAckTimer.current)
      }
    }
  }, [exportedScope])

  // The shell's slice of the ledger: the selected property's transactions.
  // The interactive filters belong to the Transactions view (ADR-0003).
  const { filteredTransactions } = useTransactionFilters(
    transactions,
    selectedProperty,
  )

  // CSV export
  const { exportToCSV } = useCSVExport()

  // The export control's disclosed scope: the shell's selected-property
  // slice — the same slice handleExport writes. The data flow is
  // unchanged; the control names it.
  const exportScopeLabel =
    selectedProperty === 'all'
      ? 'All properties'
      : propertyScopeLabel(selectedProperty, properties)

  // Event handlers — transaction add/delete delegate to the transactions module
  const handleExport = () => {
    exportToCSV(filteredTransactions, properties, selectedProperty)
    setExportedScope(exportScopeLabel)
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
        exportScopeLabel={exportScopeLabel}
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
      {exportedScope !== null && (
        <div
          role="status"
          className="fixed bottom-20 inset-x-4 z-40 flex justify-end sm:inset-x-auto sm:bottom-6 sm:right-6"
        >
          <p className="-rotate-2 rounded-[2px] border-[1.5px] border-stamp bg-paper px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-stamp shadow-lg">
            Exported · {exportedScope}
          </p>
        </div>
      )}
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
