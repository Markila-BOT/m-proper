import React, { useState } from "react";
import { FiPlus, FiX, FiLoader } from "react-icons/fi";
import { HiOutlineOfficeBuilding } from "react-icons/hi";
import { FiMapPin } from "react-icons/fi";
import { useCreateProperty } from "../hooks/useProperties";
import type { CreatePropertyRequest } from "shared";

interface PropertyFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PropertyForm({ isOpen, onClose }: PropertyFormProps) {
  const createPropertyMutation = useCreateProperty();
  const [formData, setFormData] = useState<CreatePropertyRequest>({
    name: "",
    address: "",
    type: "residential",
    units: 1,
    isActive: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address) return;

    try {
      await createPropertyMutation.mutateAsync(formData);

      setFormData({
        name: "",
        address: "",
        type: "residential",
        units: 1,
        isActive: true,
      });
      onClose();
    } catch (error) {
      console.error("Failed to create property:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black bg-opacity-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <HiOutlineOfficeBuilding className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Add Property
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={createPropertyMutation.isPending}
            className="p-2 text-gray-400 rounded-lg transition-colors hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Property Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Greenview Executive Village Apartments"
              required
              disabled={createPropertyMutation.isPending}
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              Address
            </label>
            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2" />
              <input
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                className="py-2 pr-4 pl-10 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="123 Main Street, City, State"
                required
                disabled={createPropertyMutation.isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Property Type
              </label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: e.target.value as "residential" | "commercial",
                  }))
                }
                className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={createPropertyMutation.isPending}
              >
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">
                Number of Units
              </label>
              <input
                type="number"
                min="1"
                value={formData.units || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    units: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  }))
                }
                className="px-3 py-2 w-full rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={createPropertyMutation.isPending}
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              disabled={createPropertyMutation.isPending}
            />
            <label
              htmlFor="isActive"
              className="block ml-2 text-sm text-gray-700"
            >
              Property is active
            </label>
          </div>

          <div className="flex pt-4 space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={createPropertyMutation.isPending}
              className="flex-1 px-4 py-2 text-gray-700 rounded-lg border border-gray-300 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPropertyMutation.isPending}
              className="flex flex-1 justify-center items-center px-4 py-2 space-x-2 text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {createPropertyMutation.isPending ? (
                <>
                  <FiLoader className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FiPlus className="w-4 h-4" />
                  <span>Add Property</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
