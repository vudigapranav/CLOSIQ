/**
 * CLOSIQ — generated Supabase database types.
 *
 * Generated from the live project (wibinjtekmadwtbxygrd) AFTER the M18
 * infrastructure migrations. Regenerate at any time rather than
 * hand-editing (`supabase gen types typescript`).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      garments: {
        Row: {
          ai_confidence: number | null
          brand: string | null
          category: string
          color: string
          created_at: string
          date_added: string
          fabric: string
          favorite: boolean
          fit: string | null
          formality: string
          garment_id: string
          hex_color: string
          id: string
          image_url: string
          is_seed_item: boolean
          last_worn_date: string | null
          layering_role: string | null
          name: string
          pairing_notes: string | null
          seasons: string[]
          secondary_colors: string[] | null
          source_profile: string | null
          storage_path: string | null
          style: string | null
          subcategory: string
          tags: string[]
          updated_at: string
          user_id: string
          wardrobe_profile: string
          wear_count: number
        }
        Insert: {
          ai_confidence?: number | null
          brand?: string | null
          category: string
          color?: string
          created_at?: string
          date_added?: string
          fabric?: string
          favorite?: boolean
          fit?: string | null
          formality?: string
          garment_id: string
          hex_color?: string
          id?: string
          image_url?: string
          is_seed_item?: boolean
          last_worn_date?: string | null
          layering_role?: string | null
          name: string
          pairing_notes?: string | null
          seasons?: string[]
          secondary_colors?: string[] | null
          source_profile?: string | null
          storage_path?: string | null
          style?: string | null
          subcategory?: string
          tags?: string[]
          updated_at?: string
          user_id: string
          wardrobe_profile: string
          wear_count?: number
        }
        Update: {
          ai_confidence?: number | null
          brand?: string | null
          category?: string
          color?: string
          created_at?: string
          date_added?: string
          fabric?: string
          favorite?: boolean
          fit?: string | null
          formality?: string
          garment_id?: string
          hex_color?: string
          id?: string
          image_url?: string
          is_seed_item?: boolean
          last_worn_date?: string | null
          layering_role?: string | null
          name?: string
          pairing_notes?: string | null
          seasons?: string[]
          secondary_colors?: string[] | null
          source_profile?: string | null
          storage_path?: string | null
          style?: string | null
          subcategory?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
          wardrobe_profile?: string
          wear_count?: number
        }
        Relationships: []
      }
      outfit_history: {
        Row: {
          created_at: string
          garment_ids: string[]
          id: string
          last_seen_at: string
          signature: string
          user_id: string
        }
        Insert: {
          created_at?: string
          garment_ids?: string[]
          id?: string
          last_seen_at?: string
          signature: string
          user_id: string
        }
        Update: {
          created_at?: string
          garment_ids?: string[]
          id?: string
          last_seen_at?: string
          signature?: string
          user_id?: string
        }
        Relationships: []
      }
      planner_events: {
        Row: {
          created_at: string
          event_date: string
          event_id: string
          event_time: string
          id: string
          notes: string | null
          occasion: string
          outfit: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_date: string
          event_id: string
          event_time?: string
          id?: string
          notes?: string | null
          occasion?: string
          outfit?: Json | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_date?: string
          event_id?: string
          event_time?: string
          id?: string
          notes?: string | null
          occasion?: string
          outfit?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          body_type: string | null
          created_at: string
          id: string
          is_demo: boolean
          location_permission_status: string
          name: string
          onboarding_completed: boolean
          skin_tone: string | null
          style_preferences: string[]
          temperature_unit: string
          updated_at: string
        }
        Insert: {
          body_type?: string | null
          created_at?: string
          id: string
          is_demo?: boolean
          location_permission_status?: string
          name?: string
          onboarding_completed?: boolean
          skin_tone?: string | null
          style_preferences?: string[]
          temperature_unit?: string
          updated_at?: string
        }
        Update: {
          body_type?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          location_permission_status?: string
          name?: string
          onboarding_completed?: boolean
          skin_tone?: string | null
          style_preferences?: string[]
          temperature_unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_outfits: {
        Row: {
          created_at: string
          date_created: string
          explanation: Json
          formality_label: string
          id: string
          items: Json
          missing_categories: string[]
          occasion: string
          outfit_id: string
          style_score: number | null
          temperature: number | null
          title: string
          updated_at: string
          user_id: string
          vibe: string
          worn_today: boolean
        }
        Insert: {
          created_at?: string
          date_created?: string
          explanation?: Json
          formality_label?: string
          id?: string
          items?: Json
          missing_categories?: string[]
          occasion?: string
          outfit_id: string
          style_score?: number | null
          temperature?: number | null
          title?: string
          updated_at?: string
          user_id: string
          vibe?: string
          worn_today?: boolean
        }
        Update: {
          created_at?: string
          date_created?: string
          explanation?: Json
          formality_label?: string
          id?: string
          items?: Json
          missing_categories?: string[]
          occasion?: string
          outfit_id?: string
          style_score?: number | null
          temperature?: number | null
          title?: string
          updated_at?: string
          user_id?: string
          vibe?: string
          worn_today?: boolean
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          layering_preference: string
          updated_at: string
          user_id: string
          wardrobe_profile: string
        }
        Insert: {
          created_at?: string
          layering_preference?: string
          updated_at?: string
          user_id: string
          wardrobe_profile?: string
        }
        Update: {
          created_at?: string
          layering_preference?: string
          updated_at?: string
          user_id?: string
          wardrobe_profile?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
