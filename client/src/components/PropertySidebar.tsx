import { FiPlus, FiChevronRight, FiMapPin, FiUsers } from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { Property, PropertySummary } from "../types";

interface PropertySidebarProps {
  properties: Property[];
  selectedProperty: string;
  onSelectProperty: (propertyId: string) => void;
  propertySummaries: PropertySummary[];
  onAddProperty: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function PropertySidebar({
  properties,
  selectedProperty,
  onSelectProperty,
  propertySummaries,
  onAddProperty,
  isCollapsed,
  onToggleCollapse,
}: PropertySidebarProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getSummaryForProperty = (propertyId: string) => {
    return propertySummaries.find((s) => s.property.id === propertyId);
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col w-16 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={onToggleCollapse}
            className="p-2 text-gray-500 rounded-lg transition-colors hover:text-gray-700 hover:bg-gray-100"
          >
            <FiChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-2 space-y-2">
          <button
            onClick={() => onSelectProperty("all")}
            className={`w-full p-3 rounded-lg transition-colors ${
              selectedProperty === "all"
                ? "bg-blue-100 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            title="All Properties"
          >
            <HiOutlineOfficeBuilding className="mx-auto w-5 h-5" />
          </button>

          {properties
            .filter((p) => p.isActive)
            .map((property) => (
              <button
                key={property.id}
                onClick={() => onSelectProperty(property.id)}
                className={`w-full p-3 rounded-lg transition-colors ${
                  selectedProperty === property.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title={property.name}
              >
                <HiOutlineOfficeBuilding className="mx-auto w-5 h-5" />
              </button>
            ))}
        </div>

        <div className="p-2 border-t border-gray-200">
          <button
            onClick={onAddProperty}
            className="p-3 w-full text-gray-500 rounded-lg transition-colors hover:text-blue-600 hover:bg-blue-50"
            title="Add Property"
          >
            <FiPlus className="mx-auto w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-80 bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Properties</h2>
          <button
            onClick={onToggleCollapse}
            className="p-2 text-gray-500 rounded-lg transition-colors hover:text-gray-700 hover:bg-gray-100"
          >
            <FiChevronRight className="w-5 h-5 transform rotate-180" />
          </button>
        </div>

        <button
          onClick={onAddProperty}
          className="flex justify-center items-center px-4 py-2 space-x-2 w-full text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700"
        >
          <FiPlus className="w-4 h-4" />
          <span>Add Property</span>
        </button>
      </div>

      {/* All Properties Option */}
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={() => onSelectProperty("all")}
          className={`w-full p-4 rounded-xl border-2 transition-all ${
            selectedProperty === "all"
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-lg ${
                selectedProperty === "all" ? "bg-blue-100" : "bg-gray-100"
              }`}
            >
              <HiOutlineOfficeBuilding
                className={`w-5 h-5 ${
                  selectedProperty === "all" ? "text-blue-600" : "text-gray-600"
                }`}
              />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-medium text-gray-900">All Properties</h3>
              <p className="text-sm text-gray-500">View combined data</p>
            </div>
          </div>
        </button>
      </div>

      {/* Properties List */}
      <div className="overflow-y-auto flex-1">
        <div className="p-4 space-y-3">
          {properties
            .filter((p) => p.isActive)
            .map((property) => {
              const summary = getSummaryForProperty(property.id);
              const isSelected = selectedProperty === property.id;

              return (
                <button
                  key={property.id}
                  onClick={() => onSelectProperty(property.id)}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? "bg-blue-50 border-blue-500"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Property Header */}
                    <div className="flex items-start space-x-3">
                      <div
                        className={`p-2 rounded-lg flex-shrink-0 ${
                          isSelected ? "bg-blue-100" : "bg-gray-100"
                        }`}
                      >
                        <HiOutlineOfficeBuilding
                          className={`w-5 h-5 ${
                            isSelected ? "text-blue-600" : "text-gray-600"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {property.name}
                        </h3>
                        <div className="flex items-center mt-1 space-x-1 text-xs text-gray-500">
                          <FiMapPin className="w-3 h-3" />
                          <span className="truncate">{property.address}</span>
                        </div>
                      </div>
                    </div>

                    {/* Property Details */}
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-1 text-gray-500">
                        <FiUsers className="w-3 h-3" />
                        <span>
                          {property.units}{" "}
                          {property.units === 1 ? "unit" : "units"}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          property.type === "residential"
                            ? "bg-green-100 text-green-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {property.type}
                      </span>
                    </div>

                    {/* Financial Summary */}
                    {summary && (
                      <div className="pt-2 space-y-2 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            Net Profit
                          </span>
                          <span
                            className={`text-sm font-semibold ${
                              summary.netProfit >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(summary.netProfit)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-emerald-600">
                            Income
                          </span>
                          <span className="text-xs font-medium text-emerald-600">
                            {formatCurrency(summary.totalIncome)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-red-600">Expenses</span>
                          <span className="text-xs font-medium text-red-600">
                            {formatCurrency(summary.totalExpenses)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
