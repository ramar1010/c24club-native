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
      bounty_attributions: {
        Row: {
          expires_at: string
          female_id: string
          id: string
          interaction_type: string
          last_interaction_at: string
          male_id: string
        }
        Insert: {
          expires_at: string
          female_id: string
          id?: string
          interaction_type: string
          last_interaction_at?: string
          male_id: string
        }
        Update: {
          expires_at?: string
          female_id?: string
          id?: string
          interaction_type?: string
          last_interaction_at?: string
          male_id?: string
        }
        Relationships: []
      }
      bounty_earnings: {
        Row: {
          amount_minutes: number
          clawed_back: boolean
          created_at: string
          female_id: string
          id: string
          male_id: string
          paid_out: boolean
          source: string
          stripe_subscription_id: string
        }
        Insert: {
          amount_minutes: number
          clawed_back?: boolean
          created_at?: string
          female_id: string
          id?: string
          male_id: string
          paid_out?: boolean
          source: string
          stripe_subscription_id: string
        }
        Update: {
          amount_minutes?: number
          clawed_back?: boolean
          created_at?: string
          female_id?: string
          id?: string
          male_id?: string
          paid_out?: boolean
          source?: string
          stripe_subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_earnings_male_id_fkey"
            columns: ["male_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      cashout_requests: {
        Row: {
          cash_amount: number | null
          created_at: string | null
          id: string
          minutes_amount: number | null
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          participant_1: string
          participant_2: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_1: string
          participant_2: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          participant_1?: string
          participant_2?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_call_invites: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          invitee_id: string
          inviter_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          invitee_id: string
          inviter_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_call_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_call_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
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
          minutes_amount: number | null
          price_cents: number | null
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
          minutes_amount?: number | null
          price_cents?: number | null
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
          minutes_amount?: number | null
          price_cents?: number | null
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
      iap_purchases: {
        Row: {
          action: string | null
          created_at: string
          id: string
          original_transaction_id: string | null
          platform: string
          purchase_token_hash: string | null
          sku: string
          subscription_end: string | null
          user_id: string
          vip_tier: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          id?: string
          original_transaction_id?: string | null
          platform: string
          purchase_token_hash?: string | null
          sku: string
          subscription_end?: string | null
          user_id: string
          vip_tier?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          id?: string
          original_transaction_id?: string | null
          platform?: string
          purchase_token_hash?: string | null
          sku?: string
          subscription_end?: string | null
          user_id?: string
          vip_tier?: string | null
        }
        Relationships: []
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
      member_interests: {
        Row: {
          created_at: string | null
          icebreaker_message: string | null
          id: string
          interested_in_user_id: string
          notified: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          icebreaker_message?: string | null
          id?: string
          interested_in_user_id: string
          notified?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          icebreaker_message?: string | null
          id?: string
          interested_in_user_id?: string
          notified?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_interests_interested_in_user_id_fkey"
            columns: ["interested_in_user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
          last_streak_login_at: string | null
          login_streak: number
          minutes: number | null
          nsfw_strikes: number
          subscription_end: string | null
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
          last_streak_login_at?: string | null
          login_streak?: number
          minutes?: number | null
          nsfw_strikes?: number
          subscription_end?: string | null
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
          last_streak_login_at?: string | null
          login_streak?: number
          minutes?: number | null
          nsfw_strikes?: number
          subscription_end?: string | null
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
      member_redemptions: {
        Row: {
          cashout_amount: number | null
          cashout_paypal: string | null
          cashout_status: string | null
          created_at: string
          id: string
          minutes_cost: number | null
          notes: string | null
          reward_id: string
          reward_image_url: string | null
          reward_rarity: string | null
          reward_title: string
          reward_type: string | null
          selected_color: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_name: string | null
          shipping_state: string | null
          shipping_tracking_url: string | null
          shipping_zip: string | null
          status: string
          user_id: string
        }
        Insert: {
          cashout_amount?: number | null
          cashout_paypal?: string | null
          cashout_status?: string | null
          created_at?: string
          id?: string
          minutes_cost?: number | null
          notes?: string | null
          reward_id: string
          reward_image_url?: string | null
          reward_rarity?: string | null
          reward_title: string
          reward_type?: string | null
          selected_color?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_state?: string | null
          shipping_tracking_url?: string | null
          shipping_zip?: string | null
          status?: string
          user_id: string
        }
        Update: {
          cashout_amount?: number | null
          cashout_paypal?: string | null
          cashout_status?: string | null
          created_at?: string
          id?: string
          minutes_cost?: number | null
          notes?: string | null
          reward_id?: string
          reward_image_url?: string | null
          reward_rarity?: string | null
          reward_title?: string
          reward_type?: string | null
          selected_color?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_name?: string | null
          shipping_state?: string | null
          shipping_tracking_url?: string | null
          shipping_zip?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
          notify_likes: boolean | null
          nsfw_strike_count: number
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
          notify_likes?: boolean | null
          nsfw_strike_count?: number
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
          notify_likes?: boolean | null
          nsfw_strike_count?: number
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
      room_signals: {
        Row: {
          created_at: string | null
          id: string
          payload: Json
          room_id: string
          sender_channel: string
          signal_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload: Json
          room_id: string
          sender_channel: string
          signal_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json
          room_id?: string
          sender_channel?: string
          signal_type?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          channel1: string | null
          channel2: string | null
          connected_at: string | null
          created_at: string | null
          id: string
          member1: string | null
          member1_gender: string | null
          member1_voice_mode: boolean | null
          member2: string | null
          member2_gender: string | null
          member2_voice_mode: boolean | null
          status: string | null
        }
        Insert: {
          channel1?: string | null
          channel2?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          member1?: string | null
          member1_gender?: string | null
          member1_voice_mode?: boolean | null
          member2?: string | null
          member2_gender?: string | null
          member2_voice_mode?: boolean | null
          status?: string | null
        }
        Update: {
          channel1?: string | null
          channel2?: string | null
          connected_at?: string | null
          created_at?: string | null
          id?: string
          member1?: string | null
          member1_gender?: string | null
          member1_voice_mode?: boolean | null
          member2?: string | null
          member2_gender?: string | null
          member2_voice_mode?: boolean | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_member1_fkey"
            columns: ["member1"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_member2_fkey"
            columns: ["member2"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          ban_source: string | null
          ban_type: string | null
          banned_by: string | null
          created_at: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          reason: string | null
          unban_payment_session: string | null
          unbanned_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ban_source?: string | null
          ban_type?: string | null
          banned_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          reason?: string | null
          unban_payment_session?: string | null
          unbanned_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ban_source?: string | null
          ban_type?: string | null
          banned_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
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
      waiting_queue: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          member_gender: string | null
          member_id: string
          voice_mode: boolean | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          member_gender?: string | null
          member_id: string
          voice_mode?: boolean | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          member_gender?: string | null
          member_id?: string
          voice_mode?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "waiting_queue_member_id_fkey"
            columns: ["member_id"]
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
      award_bounty_for_subscription: {
        Args: {
          p_is_renewal: boolean
          p_male_id: string
          p_stripe_subscription_id: string
          p_tier: string
        }
        Returns: Json
      }
      delete_my_account: { Args: never; Returns: Json }
      delete_user_account_data: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: undefined
      }
      get_bounty_summary: { Args: never; Returns: Json }
      get_partner_nsfw_strikes: { Args: { _user_id: string }; Returns: number }
      get_partner_pinned_socials: {
        Args: { p_partner_id: string }
        Returns: string[]
      }
      get_user_free_msg_status: {
        Args: { target_user_id: string }
        Returns: Json
      }
      increment_male_search_count: {
        Args: { p_female_id: string }
        Returns: undefined
      }
      increment_nsfw_strike: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      is_blocked_by: { Args: { partner_id: string }; Returns: boolean }
      record_bounty_interaction: {
        Args: { p_interaction_type: string; p_male_id: string }
        Returns: boolean
      }
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