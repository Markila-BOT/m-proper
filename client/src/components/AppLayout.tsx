import { ReactNode } from "react";
import PropertySidebar from "./PropertySidebar";

interface AppLayoutProps {
  children: ReactNode;
  onAddProperty: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function AppLayout({
  children,
  onAddProperty,
  isSidebarCollapsed,
  onToggleSidebar,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <PropertySidebar
        onAddProperty={onAddProperty}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />
      <div className="flex flex-col flex-1">{children}</div>
    </div>
  );
}
