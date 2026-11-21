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
  // hairline, and the page column carries the shell's chrome.
  return (
    <div className="flex min-h-screen bg-paper">
      <PropertySidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />
      <div className="flex flex-col flex-1 min-w-[22rem]">{children}</div>
    </div>
  )
}
