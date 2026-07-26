// ============================================================================
// Habit Tracker — Database types
//
// Hand-authored to match supabase/migrations/*.sql exactly, in the same shape
// the Supabase CLI emits, so it's a drop-in for `createClient<Database>()`.
//
// Once the schema is applied to a real project, regenerate this file verbatim:
//   supabase gen types typescript --project-id <ref> --schema public > supabase/types/database.types.ts
//   # or, against the local stack:
//   supabase gen types typescript --local --schema public > supabase/types/database.types.ts
//
// NOTE: check-constraint columns (theme, habit type, freq_type, log status)
// generate as plain `string`. Narrowed unions for them are exported at the
// bottom of this file as a convenience — use those in app code.
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          avatar_emoji: string
          theme: string
          week_start: number
          timezone: string
          streak_freeze_balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string
          avatar_emoji?: string
          theme?: string
          week_start?: number
          timezone?: string
          streak_freeze_balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          avatar_emoji?: string
          theme?: string
          week_start?: number
          timezone?: string
          streak_freeze_balance?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string
          color: string
          category: string
          type: string
          target: number | null
          unit: string | null
          freq_type: string
          freq_target: number | null
          freq_days: number[] | null
          is_bad: boolean
          sort_order: number
          archived_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string
          color?: string
          category?: string
          type?: string
          target?: number | null
          unit?: string | null
          freq_type?: string
          freq_target?: number | null
          freq_days?: number[] | null
          is_bad?: boolean
          sort_order?: number
          archived_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string
          color?: string
          category?: string
          type?: string
          target?: number | null
          unit?: string | null
          freq_type?: string
          freq_target?: number | null
          freq_days?: number[] | null
          is_bad?: boolean
          sort_order?: number
          archived_at?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          id: string
          user_id: string
          habit_id: string
          log_date: string
          status: string
          value: number | null
          note: string | null
          completed_at: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          habit_id: string
          log_date: string
          status?: string
          value?: number | null
          note?: string | null
          completed_at?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          habit_id?: string
          log_date?: string
          status?: string
          value?: number | null
          note?: string | null
          completed_at?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habit_stats"
            referencedColumns: ["habit_id"]
          },
          {
            foreignKeyName: "habit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          id: string
          user_id: string
          habit_id: string
          time_of_day: string
          days_of_week: number[]
          enabled: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          habit_id: string
          time_of_day: string
          days_of_week?: number[]
          enabled?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          habit_id?: string
          time_of_day?: string
          days_of_week?: number[]
          enabled?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habit_stats"
            referencedColumns: ["habit_id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          id: string
          user_id: string
          habit_id: string | null
          kind: string
          achieved_at: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          habit_id?: string | null
          kind: string
          achieved_at?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          habit_id?: string | null
          kind?: string
          achieved_at?: string
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "achievements_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habit_stats"
            referencedColumns: ["habit_id"]
          },
          {
            foreignKeyName: "achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      habit_stats: {
        Row: {
          habit_id: string | null
          user_id: string | null
          name: string | null
          icon: string | null
          color: string | null
          current_streak: number | null
          longest_streak: number | null
          rate_90d: number | null
          total_completions: number | null
        }
        Relationships: [
          {
            foreignKeyName: "habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      habit_is_expected: {
        Args: { p_freq_type: string; p_freq_days: number[]; p_day: string }
        Returns: boolean
      }
      current_streak: {
        Args: { p_habit_id: string; p_today?: string }
        Returns: number
      }
      longest_streak: {
        Args: { p_habit_id: string; p_today?: string }
        Returns: number
      }
      completion_rate: {
        Args: { p_habit_id: string; p_from: string; p_to: string }
        Returns: number
      }
      heatmap: {
        Args: { p_from: string; p_to: string }
        Returns: { log_date: string; completions: number }[]
      }
      use_streak_freeze: {
        Args: { p_habit_id: string; p_date?: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ----------------------------------------------------------------------------
// Convenience helpers (mirror the Supabase CLI output)
// ----------------------------------------------------------------------------
type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Insert: infer I } ? I : never

export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T] extends { Update: infer U } ? U : never

export type FunctionArgs<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T]["Args"]

export type FunctionReturns<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T]["Returns"]

// Row aliases for ergonomic imports
export type Profile = Tables<"profiles">
export type Habit = Tables<"habits">
export type HabitLog = Tables<"habit_logs">
export type Reminder = Tables<"reminders">
export type Achievement = Tables<"achievements">
export type HabitStats = Tables<"habit_stats">

// ----------------------------------------------------------------------------
// Narrowed unions for check-constraint columns.
// The DB stores these as text; use these types in app code for safety.
// Keep in sync with the CHECK constraints in 20260723000001_core_schema.sql.
// ----------------------------------------------------------------------------
export type Theme = "system" | "light" | "dark"
export type HabitType = "binary" | "quantity" | "duration"
export type HabitFreqType = "daily" | "weekly_count" | "specific_days" | "interval"
export type LogStatus = "completed" | "skipped" | "frozen"

/** 0 = Sunday … 6 = Saturday (used by freq_days and reminders.days_of_week) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6
