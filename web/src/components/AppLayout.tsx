import type { ReactNode } from 'react'
import PropertySidebar from './PropertySidebar'

type AppLayoutProps = {
  children: ReactNode
  isSidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export default function AppLayout({
  children,
  isSidebarCollapsed,
  onToggleSidebar,
}: AppLayoutProps) {
  // The ground is the paper itself; the rail rules its right edge with a
  // hairline, and the page column carries the shell's chrome. The column
  // floors at zero — the paper never clips, and a wide ledger sheet
  // scrolls inside its own ruled region instead of under the body.
  //
  // The shell's last line is its honesty note: the record lives in this
  // browser, and the CSV export is the backup. One quiet rule above it,
  // rendered once, on every page.
  return (
    <div className="flex min-h-screen bg-paper">
      <PropertySidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />
      <div className="flex flex-col flex-1 min-w-0">
        {children}
        <footer className="border-t border-rule px-6 py-3 lg:px-9">
          <p className="font-sans text-caption font-semibold uppercase tracking-[0.14em] text-ink-soft">
            Recorded in this browser · CSV is your backup
          </p>
        </footer>
      </div>
    </div>
  )
}
