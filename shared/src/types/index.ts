export type ApiResponse = {
  message: string;
  success: boolean;
};

export interface Property {
  id: string;
  name: string;
  address: string;
  type: "residential" | "commercial";
  units?: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreatePropertyRequest {
  name: string;
  address: string;
  type: "residential" | "commercial";
  units?: number;
  isActive?: boolean;
}

export interface CreatePropertyResponse extends ApiResponse {
  data?: Property;
}
