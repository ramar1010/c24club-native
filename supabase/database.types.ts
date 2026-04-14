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
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      cashout_requests: {
        Row: {
          cash_amount: number | null
          created_at: string | null
          id: string
          minutes_amount: number | null
          paypal_email: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cash_amount?: number | null
          created_at?: string | null
          id?: string
          minutes_amount?: number | null
          paypal_email?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cash_amount?: number | null
          created_at?: string | null
          id?: string
          minutes_amount?: number | null
          paypal_email?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cashout_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      cashout_settings: {
        Row: {
          created_at: string | null
          id: number
          max_cashout_minutes: number | null
          min_cashout_minutes: number | null
          rate_per_minute: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          max_cashout_minutes?: number | null
          min_cashout_minutes?: number | null
          rate_per_minute?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          max_cashout_minutes?: number | null
          min_cashout_minutes?: number | null
          rate_per_minute?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          id: string
          recipient_email: string | null
          sent_at: string | null
          template_name: string | null
        }
        Insert: {
          id?: string
          recipient_email?: string | null
          sent_at?: string | null
          template_name?: string | null
        }
        Update: {
          id?: string
          recipient_email?: string | null
          sent_at?: string | null
          template_name?: string | null
        }
        Relationships: []
      }
      freeze_settings: {
        Row: {
          created_at: string | null
          frozen_earn_rate: number | null
          id: number
          minute_threshold: number | null
          one_time_unfreeze_price: number | null
          updated_at: string | null
          vip_unfreezes_per_month: number | null
        }
        Insert: {
          created_at?: string | null
          frozen_earn_rate?: number | null
          id?: number
          minute_threshold?: number | null
          one_time_unfreeze_price?: number | null
          updated_at?: string | null
          vip_unfreezes_per_month?: number | null
        }
        Update: {
          created_at?: string | null
          frozen_earn_rate?: number | null
          id?: number
          minute_threshold?: number | null
          one_time_unfreeze_price?: number | null
          updated_at?: string | null
          vip_unfreezes_per_month?: number | null
        }
        Relationships: []
      }
      gift_transactions: {
        Row: {
          cash_value: number | null
          created_at: string | null
          id: string
          minutes: number | null
          recipient_id: string | null
          sender_id: string | null
          status: string | null
          stripe_session_id: string | null
          tier_id: number | null
          updated_at: string | null
        }
        Insert: {
          cash_value?: number | null
          created_at?: string | null
          id?: string
          minutes?: number | null
          recipient_id?: string | null
          sender_id?: string | null
          status?: string | null
          stripe_session_id?: string | null
          tier_id?: number | null
          updated_at?: string | null
        }
        Update: {
          cash_value?: number | null
          created_at?: string | null
          id?: string
          minutes?: number | null
          recipient_id?: string | null
          sender_id?: string | null
          status?: string | null
          stripe_session_id?: string | null
          tier_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      male_search_batch_log: {
        Row: {
          female_user_id: string
          join_count: number | null
          last_reset_at: string | null
        }
        Insert: {
          female_user_id: string
          join_count?: number | null
          last_reset_at?: string | null
        }
        Update: {
          female_user_id?: string
          join_count?: number | null
          last_reset_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "male_search_batch_log_female_user_id_fkey"
            columns: ["female_user_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_minutes: {
        Row: {
          ad_points: number | null
          admin_granted_vip: boolean | null
          ce_minutes_checkpoint: number | null
          chance_enhancer: number | null
          created_at: string | null
          freeze_free_until: string | null
          frozen_at: string | null
          frozen_cap_popup_shown: boolean | null
          gifted_minutes: number | null
          id: string
          is_frozen: boolean | null
          is_vip: boolean | null
          minutes: number | null
          updated_at: string | null
          user_id: string | null
          vip_tier: string | null
          vip_unfreezes_reset_at: string | null
          vip_unfreezes_used: number | null
        }
        Insert: {
          ad_points?: number | null
          admin_granted_vip?: boolean | null
          ce_minutes_checkpoint?: number | null
          chance_enhancer?: number | null
          created_at?: string | null
          freeze_free_until?: string | null
          frozen_at?: string | null
          frozen_cap_popup_shown?: boolean | null
          gifted_minutes?: number | null
          id?: string
          is_frozen?: boolean | null
          is_vip?: boolean | null
          minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
          vip_tier?: string | null
          vip_unfreezes_reset_at?: string | null
          vip_unfreezes_used?: number | null
        }
        Update: {
          ad_points?: number | null
          admin_granted_vip?: boolean | null
          ce_minutes_checkpoint?: number | null
          chance_enhancer?: number | null
          created_at?: string | null
          freeze_free_until?: string | null
          frozen_at?: string | null
          frozen_cap_popup_shown?: boolean | null
          gifted_minutes?: number | null
          id?: string
          is_frozen?: boolean | null
          is_vip?: boolean | null
          minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
          vip_tier?: string | null
          vip_unfreezes_reset_at?: string | null
          vip_unfreezes_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "member_minutes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          bio: string | null
          birthdate: string | null
          call_notify_enabled: boolean | null
          call_slug: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          gender: string | null
          id: string
          image_status: string | null
          image_thumb_url: string | null
          image_url: string | null
          is_discoverable: boolean | null
          is_test_account: boolean | null
          last_active_at: string | null
          male_search_notify_mode: string | null
          membership: string | null
          name: string | null
          notify_enabled: boolean | null
          notify_female_searching: boolean | null
          phone_number: string | null
          profession: string | null
          push_token: string | null
          role: string | null
          state: string | null
          title: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          bio?: string | null
          birthdate?: string | null
          call_notify_enabled?: boolean | null
          call_slug?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id: string
          image_status?: string | null
          image_thumb_url?: string | null
          image_url?: string | null
          is_discoverable?: boolean | null
          is_test_account?: boolean | null
          last_active_at?: string | null
          male_search_notify_mode?: string | null
          membership?: string | null
          name?: string | null
          notify_enabled?: boolean | null
          notify_female_searching?: boolean | null
          phone_number?: string | null
          profession?: string | null
          push_token?: string | null
          role?: string | null
          state?: string | null
          title?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          bio?: string | null
          birthdate?: string | null
          call_notify_enabled?: boolean | null
          call_slug?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          image_status?: string | null
          image_thumb_url?: string | null
          image_url?: string | null
          is_discoverable?: boolean | null
          is_test_account?: boolean | null
          last_active_at?: string | null
          male_search_notify_mode?: string | null
          membership?: string | null
          name?: string | null
          notify_enabled?: boolean | null
          notify_female_searching?: boolean | null
          phone_number?: string | null
          profession?: string | null
          push_token?: string | null
          role?: string | null
          state?: string | null
          title?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      push_notification_log: {
        Row: {
          id: string
          last_sent_at: string
          notification_type: string
          user_id: string
        }
        Insert: {
          id?: string
          last_sent_at?: string
          notification_type: string
          user_id: string
        }
        Update: {
          id?: string
          last_sent_at?: string
          notification_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          ban_type: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          reason: string | null
          unban_payment_session: string | null
          unbanned_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ban_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          unban_payment_session?: string | null
          unbanned_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ban_type?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string | null
          unban_payment_session?: string | null
          unbanned_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          reason: string | null
          reported_user_id: string | null
          reporter_id: string | null
          screenshot_url: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          screenshot_url?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string | null
          reported_user_id?: string | null
          reporter_id?: string | null
          screenshot_url?: string | null
        }
        Relationships: []
      }
      vip_settings: {
        Row: {
          created_at: string | null
          pinned_socials: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          pinned_socials?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          pinned_socials?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vip_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: undefined
      }
      get_partner_pinned_socials: {
        Args: { p_partner_id: string }
        Returns: string[]
      }
      increment_male_search_count: {
        Args: { p_female_id: string }
        Returns: undefined
      }
      is_blocked_by: { Args: { partner_id: string }; Returns: boolean }
      send_vip_gifting_reminders: { Args: never; Returns: undefined }
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