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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campaigns: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          goal_amount: number
          id: string
          image_url: string | null
          institution_id: string | null
          is_active: boolean | null
          raised_amount: number
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          goal_amount?: number
          id?: string
          image_url?: string | null
          institution_id?: string | null
          is_active?: boolean | null
          raised_amount?: number
          start_date?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          goal_amount?: number
          id?: string
          image_url?: string | null
          institution_id?: string | null
          is_active?: boolean | null
          raised_amount?: number
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          created_at: string
          id: string
          relation_type: string
          source_user_id: string
          status: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          relation_type?: string
          source_user_id: string
          status?: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relation_type?: string
          source_user_id?: string
          status?: string
          target_user_id?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          campaign_id: string
          created_at: string
          id: string
          is_anonymous: boolean | null
          message: string | null
          user_id: string
        }
        Insert: {
          amount: number
          campaign_id: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          message?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          campaign_id?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean | null
          message?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          points: number
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          points?: number
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          event_type: string
          id: string
          image_url: string | null
          institution_id: string | null
          is_virtual: boolean | null
          location: string | null
          max_attendees: number | null
          start_date: string
          title: string
          updated_at: string
          virtual_link: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          image_url?: string | null
          institution_id?: string | null
          is_virtual?: boolean | null
          location?: string | null
          max_attendees?: number | null
          start_date: string
          title: string
          updated_at?: string
          virtual_link?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          image_url?: string | null
          institution_id?: string | null
          is_virtual?: boolean | null
          location?: string | null
          max_attendees?: number | null
          start_date?: string
          title?: string
          updated_at?: string
          virtual_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean | null
          likes_count: number | null
          replies_count: number | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          likes_count?: number | null
          replies_count?: number | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean | null
          likes_count?: number | null
          replies_count?: number | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_events: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          outcome: string | null
          source_user_id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome?: string | null
          source_user_id: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome?: string | null
          source_user_id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      institutions: {
        Row: {
          accent_color: string | null
          created_at: string
          custom_domain: string | null
          description: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          secondary_color: string | null
          slug: string
          tagline: string | null
          updated_at: string
          white_label_enabled: boolean | null
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          tagline?: string | null
          updated_at?: string
          white_label_enabled?: boolean | null
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          custom_domain?: string | null
          description?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string
          white_label_enabled?: boolean | null
        }
        Relationships: []
      }
      mailing_campaigns: {
        Row: {
          created_at: string
          created_by: string
          id: string
          message: string
          segment_filters: Json
          sent_at: string | null
          sent_count: number | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          message: string
          segment_filters?: Json
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          message?: string
          segment_filters?: Json
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          ai: boolean
          campaign: boolean
          created_at: string
          desktop_enabled: boolean
          event: boolean
          general: boolean
          id: string
          mentorship: boolean
          message: boolean
          opportunity: boolean
          reengagement: boolean
          referral: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ai?: boolean
          campaign?: boolean
          created_at?: string
          desktop_enabled?: boolean
          event?: boolean
          general?: boolean
          id?: string
          mentorship?: boolean
          message?: boolean
          opportunity?: boolean
          reengagement?: boolean
          referral?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ai?: boolean
          campaign?: boolean
          created_at?: string
          desktop_enabled?: boolean
          event?: boolean
          general?: boolean
          id?: string
          mentorship?: boolean
          message?: boolean
          opportunity?: boolean
          reengagement?: boolean
          referral?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          company: string
          created_at: string
          deadline: string | null
          description: string | null
          employment_type: string | null
          id: string
          institution_id: string | null
          is_active: boolean | null
          location: string | null
          posted_by: string | null
          salary_range: string | null
          skills_required: string[] | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          company: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          location?: string | null
          posted_by?: string | null
          salary_range?: string | null
          skills_required?: string[] | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          company?: string
          created_at?: string
          deadline?: string | null
          description?: string | null
          employment_type?: string | null
          id?: string
          institution_id?: string | null
          is_active?: boolean | null
          location?: string | null
          posted_by?: string | null
          salary_range?: string | null
          skills_required?: string[] | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string
          id: string
          image_url: string | null
          likes_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          likes_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          batch: string | null
          bio: string | null
          company: string | null
          created_at: string
          department: string | null
          designation: string | null
          engagement_score: number | null
          experience_years: number | null
          full_name: string
          id: string
          industry: string | null
          institution_id: string | null
          interests: string[] | null
          is_hiring: boolean | null
          is_mentor: boolean | null
          is_verified: boolean | null
          last_login: string | null
          location: string | null
          passing_year: number | null
          profile_completion: number | null
          skills: string[] | null
          social_links: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          batch?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          engagement_score?: number | null
          experience_years?: number | null
          full_name?: string
          id?: string
          industry?: string | null
          institution_id?: string | null
          interests?: string[] | null
          is_hiring?: boolean | null
          is_mentor?: boolean | null
          is_verified?: boolean | null
          last_login?: string | null
          location?: string | null
          passing_year?: number | null
          profile_completion?: number | null
          skills?: string[] | null
          social_links?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          batch?: string | null
          bio?: string | null
          company?: string | null
          created_at?: string
          department?: string | null
          designation?: string | null
          engagement_score?: number | null
          experience_years?: number | null
          full_name?: string
          id?: string
          industry?: string | null
          institution_id?: string | null
          interests?: string[] | null
          is_hiring?: boolean | null
          is_mentor?: boolean | null
          is_verified?: boolean | null
          last_login?: string | null
          location?: string | null
          passing_year?: number | null
          profile_completion?: number | null
          skills?: string[] | null
          social_links?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_requests: {
        Row: {
          alumni_id: string
          company: string
          created_at: string
          id: string
          message: string | null
          position: string | null
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          alumni_id: string
          company: string
          created_at?: string
          id?: string
          message?: string | null
          position?: string | null
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          alumni_id?: string
          company?: string
          created_at?: string
          id?: string
          message?: string | null
          position?: string | null
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          content: string | null
          created_at: string
          expires_at: string
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      success_stories: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_approved: boolean | null
          is_featured: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_approved?: boolean | null
          is_featured?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_approved?: boolean | null
          is_featured?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: []
      }
      user_embeddings: {
        Row: {
          embedding: Json
          id: string
          profile_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          embedding?: Json
          id?: string
          profile_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          embedding?: Json
          id?: string
          profile_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
          verification_data: Json | null
          verification_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
          verification_data?: Json | null
          verification_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
          verification_data?: Json | null
          verification_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_engagement: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_points: number
          p_user_id: string
        }
        Returns: undefined
      }
      log_login_engagement: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "institution_admin"
        | "alumni"
        | "student"
        | "moderator"
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
      app_role: [
        "super_admin",
        "institution_admin",
        "alumni",
        "student",
        "moderator",
      ],
    },
  },
} as const
