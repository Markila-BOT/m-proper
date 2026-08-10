// web/src/lib/api-client.ts
// Hand-maintained client aligned with api/openapi.json.
// Regenerate guidance: pnpm run generate:api-client

import type { CreatePropertyRequest, Property } from "#/lib/domain";

export type ApiEnvelope<T = unknown> = {
  message: string;
  success: boolean;
  data?: T;
};

function getApiBaseUrl(): string {
  return (
    import.meta.env.VITE_API_BASE_URL ??
    import.meta.env.API_BASE_URL ??
    "http://localhost:3000"
  );
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  return (await response.json()) as ApiEnvelope<T>;
}

export const propertiesApi = {
  async getAll(): Promise<Property[]> {
    const response = await fetch(`${getApiBaseUrl()}/properties`);
    const result = await parseEnvelope<Property[]>(response);
    if (!result.success) {
      throw new Error(result.message);
    }
    return result.data ?? [];
  },

  async create(property: CreatePropertyRequest): Promise<Property> {
    const response = await fetch(`${getApiBaseUrl()}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(property),
    });
    const result = await parseEnvelope<Property>(response);
    if (!result.success) {
      throw new Error(result.message);
    }
    if (!result.data) {
      throw new Error("No data returned from server");
    }
    return result.data;
  },

  async delete(id: string): Promise<boolean> {
    const response = await fetch(`${getApiBaseUrl()}/properties/${id}`, {
      method: "DELETE",
    });
    const result = await parseEnvelope(response);
    if (!result.success) {
      throw new Error(result.message);
    }
    return true;
  },
};

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
