import { Hono } from "hono";
import type {
  CreatePropertyRequest,
  CreatePropertyResponse,
  Property,
} from "shared";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const properties = new Hono();

// Mock data for testing when Supabase is not configured
let mockProperties: Property[] = [];

// POST /properties - Create a new property
properties.post("/", async (c): Promise<Response> => {
  try {
    const body: CreatePropertyRequest = await c.req.json();

    // Basic validation
    if (!body.name || !body.address || !body.type) {
      const response: CreatePropertyResponse = {
        message:
          "Missing required fields: name, address, and type are required",
        success: false,
      };
      return c.json(response, 400);
    }

    if (!["residential", "commercial"].includes(body.type)) {
      const response: CreatePropertyResponse = {
        message: 'Invalid property type. Must be "residential" or "commercial"',
        success: false,
      };
      return c.json(response, 400);
    }

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      // Mock mode for testing
      const mockProperty: Property = {
        id: `mock-${Date.now()}`,
        name: body.name,
        address: body.address,
        type: body.type,
        units: body.units,
        isActive: body.isActive ?? true,
        createdAt: new Date().toISOString(),
      };

      mockProperties.push(mockProperty);

      const response: CreatePropertyResponse = {
        message: "Property created successfully (mock mode)",
        success: true,
        data: mockProperty,
      };
      return c.json(response, 201);
    }

    // Prepare data for Supabase (convert camelCase to snake_case)
    const insertData = {
      name: body.name,
      address: body.address,
      type: body.type,
      units: body.units || null,
      is_active: body.isActive ?? true,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase!
      .from("properties")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      const response: CreatePropertyResponse = {
        message: `Failed to create property: ${error.message}`,
        success: false,
      };
      return c.json(response, 500);
    }

    // Convert snake_case back to camelCase for frontend
    const property: Property = {
      id: data.id,
      name: data.name,
      address: data.address,
      type: data.type,
      units: data.units || undefined,
      isActive: data.is_active,
      createdAt: data.created_at,
    };

    const response: CreatePropertyResponse = {
      message: "Property created successfully",
      success: true,
      data: property,
    };

    return c.json(response, 201);
  } catch (error) {
    console.error("Server error:", error);
    const response: CreatePropertyResponse = {
      message: "Internal server error",
      success: false,
    };
    return c.json(response, 500);
  }
});

// GET /properties - Get all properties
properties.get("/", async (c): Promise<Response> => {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      // Sort mock data: active properties first, then by creation date (newest first)
      const sortedMockProperties = mockProperties.sort((a, b) => {
        // First sort by active status (active first)
        if (a.isActive !== b.isActive) {
          return b.isActive ? 1 : -1; // Active properties come first
        }
        // Then sort by creation date (newest first)
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

      return c.json({
        message: "Properties fetched successfully (mock mode)",
        success: true,
        data: sortedMockProperties,
      });
    }

    const { data, error } = await supabase!
      .from("properties")
      .select("*")
      .order("is_active", { ascending: false }) // Active properties first
      .order("created_at", { ascending: false }); // Then by creation date (newest first)

    if (error) {
      console.error("Supabase error:", error);
      return c.json(
        {
          message: `Failed to fetch properties: ${error.message}`,
          success: false,
        },
        500
      );
    }

    // Convert snake_case to camelCase
    const properties: Property[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      type: row.type,
      units: row.units || undefined,
      isActive: row.is_active,
      createdAt: row.created_at,
    }));

    return c.json({
      message: "Properties fetched successfully",
      success: true,
      data: properties,
    });
  } catch (error) {
    console.error("Server error:", error);
    return c.json({ message: "Internal server error", success: false }, 500);
  }
});

export default properties;
