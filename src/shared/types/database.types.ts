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
      exercises: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          muscle_group: Database["public"]["Enums"]["muscle_group"]
          name: string
          video_type: Database["public"]["Enums"]["video_type"]
          video_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          muscle_group?: Database["public"]["Enums"]["muscle_group"]
          name: string
          video_type?: Database["public"]["Enums"]["video_type"]
          video_url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          muscle_group?: Database["public"]["Enums"]["muscle_group"]
          name?: string
          video_type?: Database["public"]["Enums"]["video_type"]
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_plans: {
        Row: {
          created_at: string
          duration_months: number
          duration_type: Database["public"]["Enums"]["duration_type"]
          id: string
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          created_at?: string
          duration_months: number
          duration_type: Database["public"]["Enums"]["duration_type"]
          id?: string
          is_active?: boolean
          name: string
          price: number
        }
        Update: {
          created_at?: string
          duration_months?: number
          duration_type?: Database["public"]["Enums"]["duration_type"]
          id?: string
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: []
      }
      memberships: {
        Row: {
          admin_override: boolean
          end_date: string
          id: string
          override_reason: string | null
          plan_id: string
          profile_id: string
          start_date: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }
        Insert: {
          admin_override?: boolean
          end_date: string
          id?: string
          override_reason?: string | null
          plan_id: string
          profile_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Update: {
          admin_override?: boolean
          end_date?: string
          id?: string
          override_reason?: string | null
          plan_id?: string
          profile_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "membership_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      routine_assignments: {
        Row: {
          assigned_at: string
          id: string
          is_active: boolean
          profile_id: string
          routine_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          is_active?: boolean
          profile_id: string
          routine_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          is_active?: boolean
          profile_id?: string
          routine_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_assignments_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_exercises: {
        Row: {
          exercise_id: string
          id: string
          order_index: number
          reps: number
          rest_seconds: number | null
          routine_id: string
          sets: number
          weight_kg: number | null
        }
        Insert: {
          exercise_id: string
          id?: string
          order_index?: number
          reps?: number
          rest_seconds?: number | null
          routine_id: string
          sets?: number
          weight_kg?: number | null
        }
        Update: {
          exercise_id?: string
          id?: string
          order_index?: number
          reps?: number
          rest_seconds?: number | null
          routine_id?: string
          sets?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_exercises_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_template: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          exercise_id: string
          id: string
          is_baseline: boolean
          logged_at: string
          reps_done: number
          session_id: string
          set_number: number
          weight_used_kg: number
        }
        Insert: {
          exercise_id: string
          id?: string
          is_baseline?: boolean
          logged_at?: string
          reps_done: number
          session_id: string
          set_number: number
          weight_used_kg?: number
        }
        Update: {
          exercise_id?: string
          id?: string
          is_baseline?: boolean
          logged_at?: string
          reps_done?: number
          session_id?: string
          set_number?: number
          weight_used_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          duration_mins: number | null
          id: string
          notes: string | null
          profile_id: string
          routine_id: string | null
          session_date: string
        }
        Insert: {
          created_at?: string
          duration_mins?: number | null
          id?: string
          notes?: string | null
          profile_id: string
          routine_id?: string | null
          session_date?: string
        }
        Update: {
          created_at?: string
          duration_mins?: number | null
          id?: string
          notes?: string | null
          profile_id?: string
          routine_id?: string | null
          session_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      progress_comparison: {
        Row: {
          baseline_date: string | null
          baseline_reps: number | null
          baseline_weight: number | null
          current_date: string | null
          current_reps: number | null
          current_weight: number | null
          delta_reps: number | null
          delta_weight_kg: number | null
          exercise_id: string | null
          exercise_name: string | null
          last_session_date: string | null
          muscle_group: Database["public"]["Enums"]["muscle_group"] | null
          profile_id: string | null
          set_number: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      expire_memberships: { Args: never; Returns: undefined }
      get_active_membership: {
        Args: { p_profile_id: string }
        Returns: {
          admin_override: boolean
          end_date: string
          id: string
          override_reason: string | null
          plan_id: string
          profile_id: string
          start_date: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "memberships"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      duration_type: "monthly" | "biannual" | "annual"
      membership_status: "active" | "expired" | "suspended" | "pending"
      muscle_group:
        | "chest"
        | "back"
        | "shoulders"
        | "biceps"
        | "triceps"
        | "forearms"
        | "core"
        | "quads"
        | "hamstrings"
        | "glutes"
        | "calves"
        | "full_body"
        | "cardio"
        | "other"
      user_role: "admin" | "member"
      video_type: "youtube" | "url"
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
    Enums: {
      duration_type: ["monthly", "biannual", "annual"],
      membership_status: ["active", "expired", "suspended", "pending"],
      muscle_group: [
        "chest",
        "back",
        "shoulders",
        "biceps",
        "triceps",
        "forearms",
        "core",
        "quads",
        "hamstrings",
        "glutes",
        "calves",
        "full_body",
        "cardio",
        "other",
      ],
      user_role: ["admin", "member"],
      video_type: ["youtube", "url"],
    },
  },
} as const
