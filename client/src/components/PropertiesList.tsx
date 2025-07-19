import { useState } from "react";
import {
  usePropertiesWithStates,
  useCreateProperty,
} from "../hooks/useProperties";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { FiPlus, FiHome, FiLoader, FiAlertCircle } from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import type { CreatePropertyRequest } from "shared";

export default function PropertiesList() {
  const { properties, isLoading, error, isEmpty } = usePropertiesWithStates();
  const createPropertyMutation = useCreateProperty();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreatePropertyRequest>({
    name: "",
    address: "",
    type: "residential",
    units: undefined,
    isActive: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createPropertyMutation.mutateAsync(formData);
      setIsDialogOpen(false);
      setFormData({
        name: "",
        address: "",
        type: "residential",
        units: undefined,
        isActive: true,
      });
    } catch (error) {
      console.error("Failed to create property:", error);
    }
  };

  const handleInputChange = (
    field: keyof CreatePropertyRequest,
    value: string | number | boolean | undefined
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="flex items-center space-x-2">
          <FiLoader className="w-5 h-5 text-blue-600 animate-spin" />
          <span className="text-gray-600">Loading properties...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="flex items-center space-x-2 text-red-600">
          <FiAlertCircle className="w-5 h-5" />
          <span>Error loading properties: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Properties</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <FiPlus className="w-4 h-4" />
              <span>Add Property</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Property</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Property Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter property name"
                  required
                />
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  placeholder="Enter property address"
                  required
                />
              </div>

              <div>
                <Label htmlFor="type">Property Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    handleInputChange(
                      "type",
                      value as "residential" | "commercial"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="units">Number of Units (Optional)</Label>
                <Input
                  id="units"
                  type="number"
                  value={formData.units || ""}
                  onChange={(e) =>
                    handleInputChange(
                      "units",
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  placeholder="Enter number of units"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    handleInputChange("isActive", e.target.checked)
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isActive">Active Property</Label>
              </div>

              <div className="flex justify-end pt-4 space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createPropertyMutation.isPending}
                >
                  {createPropertyMutation.isPending ? (
                    <>
                      <FiLoader className="mr-2 w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Property"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col justify-center items-center p-8">
            <FiHome className="mb-4 w-12 h-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              No properties found
            </h3>
            <p className="mb-4 text-center text-gray-500">
              Get started by adding your first property to track income and
              expenses.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <FiPlus className="mr-2 w-4 h-4" />
              Add Property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card
              key={property.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    {property.type === "residential" ? (
                      <FiHome className="w-5 h-5 text-blue-600" />
                    ) : (
                      <HiOutlineOfficeBuilding className="w-5 h-5 text-green-600" />
                    )}
                    <CardTitle className="text-lg">{property.name}</CardTitle>
                  </div>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      property.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {property.isActive ? "Active" : "Inactive"}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">{property.address}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Type: {property.type}</span>
                    {property.units && (
                      <span className="text-gray-500">
                        {property.units} units
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    Created: {new Date(property.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
