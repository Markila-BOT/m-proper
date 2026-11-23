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
import type { ExportSliceLabel } from '../hooks/useCSVExport'
import {
  useSelectedProperty,
  usePropertiesWithStates,
} from '../hooks/useProperties'
import { addTransaction } from '../transactions'
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
      // The browser tab names the product, not the repo.
      { title: 'Landlord Ledger' },
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

  // Focus discipline for the add-transaction dialog: the "+ Add
  // transaction" trigger is where focus returns when the dialog closes —
  // Record, Escape, Cancel, the close control, every path. The dialog
  // itself owns the return through Radix's close-auto-focus hook (which
  // fires once the focus trap is gone); the root hands it the trigger.
  const addTriggerRef = useRef<HTMLButtonElement>(null)

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

  // The shell's slice of the ledger: the DISPLAYED slice — the same rows
  // the Transactions page shows, its selected-property scope plus the
  // active filters (which live in the ledger filter store, so the shell
  // reads them without a corridor of props — ADR-0003 stands).
  const { filteredTransactions } = useTransactionFilters(
    transactions,
    selectedProperty,
  )

  // CSV export
  const { exportToCSV } = useCSVExport()

  // The export control's honest name for what it writes. The displayed
  // slice is always a subset of the book, so equal cardinality means
  // equal sets: at rest the display IS the book and the control says so
  // — the footer's backup promise holds exactly. Anything narrower — a
  // property scope, a filter — is the displayed ledger, and the control
  // says that instead.
  const displayedIsBook = filteredTransactions.length === transactions.length
  const exportScopeLabel: ExportSliceLabel = displayedIsBook
    ? 'All entries'
    : 'Displayed ledger'

  // Event handlers — transaction add/delete delegate to the transactions module
  const handleExport = () => {
    exportToCSV(filteredTransactions, properties, exportScopeLabel)
    setExportedScope(exportScopeLabel)
  }

  const handleAddTransaction = () => {
    setIsTransactionFormOpen(true)
  }

  const handleCloseTransactionForm = () => {
    // The dialog's close-auto-focus hook returns focus to the trigger
    // (see TransactionForm) — this handler only closes.
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
      {/* The shell's chrome is one glass pane (ADR-0004): the header and the
          section nav are its rows, sticky over the routed page, carrying only
          chrome text — the name, the export disclosure, the one primary
          control, and the tab labels. The pane is the material's one place on
          the shell: no row paints its own tint, so there is one blur, one
          edge, and one elevation. */}
      <div className="glass-surface glass-chrome glass-edge-b z-40">
        <AppHeader
          exportScopeLabel={exportScopeLabel}
          onExport={handleExport}
          onAddTransaction={handleAddTransaction}
          addTriggerRef={addTriggerRef}
        />
        <NavigationTabs />
      </div>
      {/* The skip link's landing ground (AppLayout owns the link itself):
          the routed page's own region, focusable so the jump is real. The
          outline stays quiet — the region is a destination, not a control.
          It is also the opaque panel every content surface sits on: the
          glass chrome floats above it, never the other way round (ADR-0004). */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 bg-paper focus-visible:outline-none"
      >
        <Outlet />
      </main>
      <TransactionForm
        properties={properties}
        selectedProperty={selectedProperty}
        onAddTransaction={addTransaction}
        isOpen={isTransactionFormOpen}
        onClose={handleCloseTransactionForm}
        returnFocusRef={addTriggerRef}
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
