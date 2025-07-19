import { Transaction, Property } from "../types";

export function useCSVExport() {
  const exportToCSV = (
    filteredTransactions: Transaction[],
    properties: Property[],
    selectedProperty: string
  ) => {
    const headers = [
      "Date",
      "Description",
      "Category",
      "Type",
      "Amount",
      "Property",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map((t) => {
        const property = properties.find((p) => p.id === t.property);
        return [
          t.date,
          `"${t.description}"`,
          `"${t.category}"`,
          t.type,
          t.amount,
          `"${property ? property.name : "Unknown Property"}"`,
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `landlord-ledger-${
      selectedProperty === "all" ? "all-properties" : "property"
    }-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return { exportToCSV };
}
