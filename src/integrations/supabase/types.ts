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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      branding: {
        Row: {
          accent_color: string
          app_name: string
          body_font: string
          heading_font: string
          id: string
          login_bg_url: string | null
          logo_url: string | null
          primary_color: string
          secondary_color: string
          sidebar_background: string
          sidebar_foreground: string
          sidebar_primary: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          app_name?: string
          body_font?: string
          heading_font?: string
          id?: string
          login_bg_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          sidebar_background?: string
          sidebar_foreground?: string
          sidebar_primary?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          app_name?: string
          body_font?: string
          heading_font?: string
          id?: string
          login_bg_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          sidebar_background?: string
          sidebar_foreground?: string
          sidebar_primary?: string
          updated_at?: string
        }
        Relationships: []
      }
      data_retention_settings: {
        Row: {
          audit_logs_retention_days: number
          created_at: string
          id: string
          inactive_user_retention_days: number
          last_sweep_at: string | null
          sessions_retention_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audit_logs_retention_days?: number
          created_at?: string
          id?: string
          inactive_user_retention_days?: number
          last_sweep_at?: string | null
          sessions_retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audit_logs_retention_days?: number
          created_at?: string
          id?: string
          inactive_user_retention_days?: number
          last_sweep_at?: string | null
          sessions_retention_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      data_subject_requests: {
        Row: {
          admin_notes: string
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: Database["public"]["Enums"]["dsr_kind"]
          message: string
          status: Database["public"]["Enums"]["dsr_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["dsr_kind"]
          message?: string
          status?: Database["public"]["Enums"]["dsr_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["dsr_kind"]
          message?: string
          status?: Database["public"]["Enums"]["dsr_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          audience: Database["public"]["Enums"]["feedback_audience"]
          comment: string | null
          created_at: string
          id: string
          rating: number
          session_id: string
          submitted_by: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["feedback_audience"]
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          session_id: string
          submitted_by: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["feedback_audience"]
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          session_id?: string
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      jwt_config: {
        Row: {
          algorithm: string
          allowed_clock_skew_seconds: number | null
          audience: string
          auto_provision: boolean | null
          claim_email: string | null
          claim_full_name: string | null
          claim_role: string | null
          claim_user_id: string | null
          default_role: Database["public"]["Enums"]["app_role"] | null
          enabled: boolean
          id: string
          issuer: string
          jwks_url: string | null
          login_redirect_url: string | null
          logout_redirect_url: string | null
          public_key: string
          token_param_name: string | null
          updated_at: string
        }
        Insert: {
          algorithm?: string
          allowed_clock_skew_seconds?: number | null
          audience?: string
          auto_provision?: boolean | null
          claim_email?: string | null
          claim_full_name?: string | null
          claim_role?: string | null
          claim_user_id?: string | null
          default_role?: Database["public"]["Enums"]["app_role"] | null
          enabled?: boolean
          id?: string
          issuer?: string
          jwks_url?: string | null
          login_redirect_url?: string | null
          logout_redirect_url?: string | null
          public_key?: string
          token_param_name?: string | null
          updated_at?: string
        }
        Update: {
          algorithm?: string
          allowed_clock_skew_seconds?: number | null
          audience?: string
          auto_provision?: boolean | null
          claim_email?: string | null
          claim_full_name?: string | null
          claim_role?: string | null
          claim_user_id?: string | null
          default_role?: Database["public"]["Enums"]["app_role"] | null
          enabled?: boolean
          id?: string
          issuer?: string
          jwks_url?: string | null
          login_redirect_url?: string | null
          logout_redirect_url?: string | null
          public_key?: string
          token_param_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mentee_profiles: {
        Row: {
          bio: string
          created_at: string
          goals: string | null
          headline: string
          id: string
          interests: string[] | null
          linkedin_url: string
          onboarded_at: string | null
          organization_unit: string | null
          preferred_mentor_areas: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string
          created_at?: string
          goals?: string | null
          headline?: string
          id?: string
          interests?: string[] | null
          linkedin_url?: string
          onboarded_at?: string | null
          organization_unit?: string | null
          preferred_mentor_areas?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string
          created_at?: string
          goals?: string | null
          headline?: string
          id?: string
          interests?: string[] | null
          linkedin_url?: string
          onboarded_at?: string | null
          organization_unit?: string | null
          preferred_mentor_areas?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentee_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_applications: {
        Row: {
          admin_notes: string | null
          bio: string
          created_at: string
          email: string
          expertise: string[]
          full_name: string
          id: string
          linkedin_url: string | null
          phone: string | null
          portfolio_url: string | null
          resume_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_links: Json
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          years_experience: number
        }
        Insert: {
          admin_notes?: string | null
          bio: string
          created_at?: string
          email: string
          expertise?: string[]
          full_name: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          years_experience?: number
        }
        Update: {
          admin_notes?: string | null
          bio?: string
          created_at?: string
          email?: string
          expertise?: string[]
          full_name?: string
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          resume_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          years_experience?: number
        }
        Relationships: []
      }
      mentor_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_recurring: boolean
          mentor_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_recurring?: boolean
          mentor_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_recurring?: boolean
          mentor_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_availability_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_availability_overrides: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          is_unavailable: boolean
          mentor_id: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          is_unavailable?: boolean
          mentor_id: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          is_unavailable?: boolean
          mentor_id?: string
          start_time?: string | null
        }
        Relationships: []
      }
      mentor_mentee_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          mentee_id: string
          mentor_id: string
          notes: string
          program_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentee_id: string
          mentor_id: string
          notes?: string
          program_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentee_id?: string
          mentor_id?: string
          notes?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_mentee_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_profiles: {
        Row: {
          approval_acknowledged_at: string | null
          bio: string | null
          created_at: string
          current_organization: string | null
          current_role: string | null
          experiences: Json
          expertise: string[] | null
          headline: string | null
          id: string
          is_active: boolean
          linkedin_url: string | null
          phone: string | null
          portfolio_url: string | null
          qualifications: Json
          resume_url: string | null
          slug: string | null
          timezone: string
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          approval_acknowledged_at?: string | null
          bio?: string | null
          created_at?: string
          current_organization?: string | null
          current_role?: string | null
          experiences?: Json
          expertise?: string[] | null
          headline?: string | null
          id?: string
          is_active?: boolean
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          qualifications?: Json
          resume_url?: string | null
          slug?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          approval_acknowledged_at?: string | null
          bio?: string | null
          created_at?: string
          current_organization?: string | null
          current_role?: string | null
          experiences?: Json
          expertise?: string[] | null
          headline?: string | null
          id?: string
          is_active?: boolean
          linkedin_url?: string | null
          phone?: string | null
          portfolio_url?: string | null
          qualifications?: Json
          resume_url?: string | null
          slug?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_policy: {
        Row: {
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          is_current: boolean
          summary: string
          updated_at: string
          url: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_current?: boolean
          summary?: string
          updated_at?: string
          url?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_current?: boolean
          summary?: string
          updated_at?: string
          url?: string
          version?: string
        }
        Relationships: []
      }
      program_mentees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          mentee_id: string
          program_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentee_id: string
          program_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentee_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_mentees_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_mentors: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          mentor_id: string
          program_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentor_id: string
          program_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          mentor_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_mentors_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_tags: {
        Row: {
          created_at: string
          id: string
          label: string
          program_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          program_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_tags_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          capacity: number | null
          color: string
          created_at: string
          created_by: string | null
          description: string
          ends_on: string | null
          id: string
          name: string
          slug: string
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_on?: string | null
          id?: string
          name: string
          slug: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_on?: string | null
          id?: string
          name?: string
          slug?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_action_items: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          description: string
          due_date: string | null
          id: string
          mentee_id: string
          mentor_id: string
          session_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string
          due_date?: string | null
          id?: string
          mentee_id: string
          mentor_id: string
          session_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          mentee_id?: string
          mentor_id?: string
          session_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_action_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          cancellation_reason: string
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          duration_minutes: number
          id: string
          meeting_url: string
          mentee_id: string
          mentee_notes: string
          mentor_id: string
          notes: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["session_status"]
          title: string
          topic: string
        }
        Insert: {
          cancellation_reason?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string
          mentee_id: string
          mentee_notes?: string
          mentor_id: string
          notes?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          topic?: string
        }
        Update: {
          cancellation_reason?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          meeting_url?: string
          mentee_id?: string
          mentee_notes?: string
          mentor_id?: string
          notes?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_mentee_id_fkey"
            columns: ["mentee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          ip_address: string
          policy_version: string
          user_agent: string
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string
          policy_version: string
          user_agent?: string
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string
          policy_version?: string
          user_agent?: string
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          email: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          email?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          email: string
          external_id: string | null
          full_name: string
          id: string
          is_disabled: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          email: string
          external_id?: string | null
          full_name?: string
          id: string
          is_disabled?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          email?: string
          external_id?: string | null
          full_name?: string
          id?: string
          is_disabled?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_mentee_book_mentor: {
        Args: { _mentee: string; _mentor: string }
        Returns: boolean
      }
      generate_mentor_slug: {
        Args: { _full_name: string; _user_id: string }
        Returns: string
      }
      get_public_mentor: {
        Args: { _slug_or_id: string }
        Returns: {
          avatar_url: string
          bio: string
          current_organization: string
          current_role: string
          experiences: Json
          expertise: string[]
          full_name: string
          headline: string
          linkedin_url: string
          portfolio_url: string
          qualifications: Json
          slug: string
          user_id: string
          years_experience: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_program_member: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      is_program_mentor: {
        Args: { _program_id: string; _user_id: string }
        Returns: boolean
      }
      list_public_mentors: {
        Args: never
        Returns: {
          avatar_url: string
          bio: string
          expertise: string[]
          full_name: string
          headline: string
          slug: string
          user_id: string
          years_experience: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "mentor" | "mentee"
      application_status: "pending" | "approved" | "rejected"
      dsr_kind: "export" | "correction" | "deletion" | "withdrawal"
      dsr_status: "pending" | "in_review" | "completed" | "rejected"
      feedback_audience: "mentor" | "mentee" | "admin_private"
      session_status: "booked" | "completed" | "cancelled" | "no_show"
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
      app_role: ["admin", "mentor", "mentee"],
      application_status: ["pending", "approved", "rejected"],
      dsr_kind: ["export", "correction", "deletion", "withdrawal"],
      dsr_status: ["pending", "in_review", "completed", "rejected"],
      feedback_audience: ["mentor", "mentee", "admin_private"],
      session_status: ["booked", "completed", "cancelled", "no_show"],
    },
  },
} as const
