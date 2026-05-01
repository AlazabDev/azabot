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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_auth: {
        Row: {
          created_at: string
          id: number
          password_hash: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: number
          password_hash?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          password_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bot_settings: {
        Row: {
          ai_model: string
          auto_speak: boolean
          bot_name: string
          business_hours: Json
          business_hours_enabled: boolean
          created_at: string
          id: number
          offline_message: string
          position: string
          primary_color: string
          quick_replies: Json
          system_prompt: string
          updated_at: string
          voice_enabled: boolean
          voice_name: string
          welcome_message: string
        }
        Insert: {
          ai_model?: string
          auto_speak?: boolean
          bot_name?: string
          business_hours?: Json
          business_hours_enabled?: boolean
          created_at?: string
          id: number
          offline_message?: string
          position?: string
          primary_color?: string
          quick_replies?: Json
          system_prompt?: string
          updated_at?: string
          voice_enabled?: boolean
          voice_name?: string
          welcome_message?: string
        }
        Update: {
          ai_model?: string
          auto_speak?: boolean
          bot_name?: string
          business_hours?: Json
          business_hours_enabled?: boolean
          created_at?: string
          id?: number
          offline_message?: string
          position?: string
          primary_color?: string
          quick_replies?: Json
          system_prompt?: string
          updated_at?: string
          voice_enabled?: boolean
          voice_name?: string
          welcome_message?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          message_count: number
          metadata: Json
          session_id: string
          status: string
          visitor_email: string | null
          visitor_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          metadata?: Json
          session_id: string
          status?: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          message_count?: number
          metadata?: Json
          session_id?: string
          status?: string
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          events: Json
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          events?: Json
          id?: string
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          events?: Json
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          attachments?: Json
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          attachments?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event: string
          id: string
          integration_id: string | null
          integration_type: string
          request_payload: Json | null
          response_body: string | null
          status: string
          status_code: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event: string
          id?: string
          integration_id?: string | null
          integration_type: string
          request_payload?: Json | null
          response_body?: string | null
          status: string
          status_code?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event?: string
          id?: string
          integration_id?: string | null
          integration_type?: string
          request_payload?: Json | null
          response_body?: string | null
          status?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      bot_settings_public: {
        Row: {
          auto_speak: boolean | null
          bot_name: string | null
          business_hours: Json | null
          business_hours_enabled: boolean | null
          id: number | null
          offline_message: string | null
          position: string | null
          primary_color: string | null
          quick_replies: Json | null
          voice_enabled: boolean | null
          voice_name: string | null
          welcome_message: string | null
        }
        Insert: {
          auto_speak?: boolean | null
          bot_name?: string | null
          business_hours?: Json | null
          business_hours_enabled?: boolean | null
          id?: number | null
          offline_message?: string | null
          position?: string | null
          primary_color?: string | null
          quick_replies?: Json | null
          voice_enabled?: boolean | null
          voice_name?: string | null
          welcome_message?: string | null
        }
        Update: {
          auto_speak?: boolean | null
          bot_name?: string | null
          business_hours?: Json | null
          business_hours_enabled?: boolean | null
          id?: number | null
          offline_message?: string | null
          position?: string | null
          primary_color?: string | null
          quick_replies?: Json | null
          voice_enabled?: boolean | null
          voice_name?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
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
