import { useState } from "react";
import { useCreateProperty } from "../hooks/useProperties";
import { Button } from "./ui/button";
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
import { FiLoader } from "react-icons/fi";
import type { CreatePropertyRequest } from "shared";
import { PROPERTY_TYPE, PROPERTY_TYPE_LABELS } from "shared";

type PropertyModalProps = {
  children: React.ReactNode;
};

export default function PropertyModal({ children }: PropertyModalProps) {
  const createPropertyMutation = useCreateProperty();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreatePropertyRequest>({
    name: "",
    address: "",
    type: PROPERTY_TYPE.RESIDENTIAL,
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
        type: PROPERTY_TYPE.RESIDENTIAL,
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

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
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
                  value as CreatePropertyRequest["type"]
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PROPERTY_TYPE.RESIDENTIAL}>
                  {PROPERTY_TYPE_LABELS[PROPERTY_TYPE.RESIDENTIAL]}
                </SelectItem>
                <SelectItem value={PROPERTY_TYPE.COMMERCIAL}>
                  {PROPERTY_TYPE_LABELS[PROPERTY_TYPE.COMMERCIAL]}
                </SelectItem>
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
              onChange={(e) => handleInputChange("isActive", e.target.checked)}
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
            <Button type="submit" disabled={createPropertyMutation.isPending}>
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
  );
}
