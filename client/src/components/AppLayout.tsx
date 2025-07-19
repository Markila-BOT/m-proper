import { ReactNode } from "react";
import PropertySidebar from "./PropertySidebar";

type AppLayoutProps = {
  children: ReactNode;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
};

export default function AppLayout({
  children,
  isSidebarCollapsed,
  onToggleSidebar,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <PropertySidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />
      <div className="flex flex-col flex-1">{children}</div>
    </div>
  );
}
