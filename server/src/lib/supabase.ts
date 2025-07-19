import { createClient } from "@supabase/supabase-js";

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Check if we have valid Supabase credentials
const hasValidCredentials = supabaseUrl && supabaseKey;

export const supabase = hasValidCredentials
  ? createClient(supabaseUrl, supabaseKey)
  : null;

import type { PropertyType } from "shared";

// Database table types
export type Database = {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string;
          name: string;
          address: string;
          type: PropertyType;
          units: number | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          type: PropertyType;
          units?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          type?: PropertyType;
          units?: number | null;
          is_active?: boolean;
          created_at?: string;
        };
      };
    };
  };
};

// Helper function to check if Supabase is configured
export const isSupabaseConfigured = () => {
  if (!hasValidCredentials) {
    console.warn(
      "⚠️  Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
    );
    return false;
  }
  return true;
};
