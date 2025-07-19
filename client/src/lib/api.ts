import type {
  Property,
  CreatePropertyRequest,
  CreatePropertyResponse,
} from "shared";

const API_BASE_URL = "http://localhost:3000";

// Generic API response type
type ApiResponse<T = unknown> = {
  message: string;
  success: boolean;
  data?: T;
};

// Properties API
export const propertiesApi = {
  // Get all properties
  async getAll(): Promise<Property[]> {
    const response = await fetch(`${API_BASE_URL}/properties`);
    const result: ApiResponse<Property[]> = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    return result.data || [];
  },

  // Create a new property
  async create(property: CreatePropertyRequest): Promise<Property> {
    const response = await fetch(`${API_BASE_URL}/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(property),
    });

    const result: CreatePropertyResponse = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    if (!result.data) {
      throw new Error("No data returned from server");
    }

    return result.data;
  },
};

// Query keys for React Query
export const queryKeys = {
  properties: {
    all: ["properties"] as const,
    lists: () => [...queryKeys.properties.all, "list"] as const,
    list: (filters: string) =>
      [...queryKeys.properties.lists(), { filters }] as const,
    details: () => [...queryKeys.properties.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.properties.details(), id] as const,
  },
};
