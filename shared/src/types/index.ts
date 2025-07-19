import type { PropertyType } from "../constants";

export type ApiResponse = {
  message: string;
  success: boolean;
};

export type Property = {
  id: string;
  name: string;
  address: string;
  type: PropertyType;
  units?: number;
  isActive: boolean;
  createdAt: string;
};

export type CreatePropertyRequest = {
  name: string;
  address: string;
  type: PropertyType;
  units?: number;
  isActive?: boolean;
};

export type CreatePropertyResponse = ApiResponse & {
  data?: Property;
};
