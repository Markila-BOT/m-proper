import { ReactNode } from "react";
import PropertySidebar from "./PropertySidebar";
import { Property, PropertySummary } from "../types";

interface AppLayoutProps {
  children: ReactNode;
  properties: Property[];
  selectedProperty: string;
  onSelectProperty: (propertyId: string) => void;
  propertySummaries: PropertySummary[];
  onAddProperty: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function AppLayout({
  children,
  properties,
  selectedProperty,
  onSelectProperty,
  propertySummaries,
  onAddProperty,
  isSidebarCollapsed,
  onToggleSidebar,
}: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <PropertySidebar
        properties={properties}
        selectedProperty={selectedProperty}
        onSelectProperty={onSelectProperty}
        propertySummaries={propertySummaries}
        onAddProperty={onAddProperty}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={onToggleSidebar}
      />
      <div className="flex flex-col flex-1">{children}</div>
    </div>
  );
}
