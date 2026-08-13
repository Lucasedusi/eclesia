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
      accounts_payable: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cashbox_id: string | null
          category_id: string | null
          church_id: string
          congregation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_id: string | null
          description: string
          document_number: string | null
          due_date: string
          financial_transaction_id: string | null
          has_attachment: boolean
          id: string
          metadata: Json
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          payable_number: string | null
          payment_method_id: string | null
          payment_reference: string | null
          status: string
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cashbox_id?: string | null
          category_id?: string | null
          church_id: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          description: string
          document_number?: string | null
          due_date: string
          financial_transaction_id?: string | null
          has_attachment?: boolean
          id?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payable_number?: string | null
          payment_method_id?: string | null
          payment_reference?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cashbox_id?: string | null
          category_id?: string | null
          church_id?: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          description?: string
          document_number?: string | null
          due_date?: string
          financial_transaction_id?: string | null
          has_attachment?: boolean
          id?: string
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payable_number?: string | null
          payment_method_id?: string | null
          payment_reference?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_cashbox_id_fkey"
            columns: ["cashbox_id"]
            isOneToOne: false
            referencedRelation: "financial_cashboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "financial_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "financial_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          allow_sensitive_documents: boolean
          app_name: string
          church_id: string
          created_at: string
          dashboard_settings: Json
          default_city: string | null
          default_country: string
          default_state: string | null
          deleted_at: string | null
          display_church_name: string | null
          document_settings: Json
          enable_audit_logs: boolean
          enable_member_auto_code: boolean
          enable_notifications: boolean
          favicon_url: string | null
          id: string
          logo_url: string | null
          max_upload_size_mb: number
          member_code_next_number: number
          member_code_padding: number
          member_code_prefix: string | null
          notification_channels: Json
          primary_color: string | null
          report_settings: Json
          secondary_color: string | null
          status: string
          updated_at: string
        }
        Insert: {
          allow_sensitive_documents?: boolean
          app_name?: string
          church_id: string
          created_at?: string
          dashboard_settings?: Json
          default_city?: string | null
          default_country?: string
          default_state?: string | null
          deleted_at?: string | null
          display_church_name?: string | null
          document_settings?: Json
          enable_audit_logs?: boolean
          enable_member_auto_code?: boolean
          enable_notifications?: boolean
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          max_upload_size_mb?: number
          member_code_next_number?: number
          member_code_padding?: number
          member_code_prefix?: string | null
          notification_channels?: Json
          primary_color?: string | null
          report_settings?: Json
          secondary_color?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          allow_sensitive_documents?: boolean
          app_name?: string
          church_id?: string
          created_at?: string
          dashboard_settings?: Json
          default_city?: string | null
          default_country?: string
          default_state?: string | null
          deleted_at?: string | null
          display_church_name?: string | null
          document_settings?: Json
          enable_audit_logs?: boolean
          enable_member_auto_code?: boolean
          enable_notifications?: boolean
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          max_upload_size_mb?: number
          member_code_next_number?: number
          member_code_padding?: number
          member_code_prefix?: string | null
          notification_channels?: Json
          primary_color?: string | null
          report_settings?: Json
          secondary_color?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_profile_id: string | null
          church_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          module: string
          new_values: Json | null
          old_values: Json | null
          severity: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_profile_id?: string | null
          church_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module: string
          new_values?: Json | null
          old_values?: Json | null
          severity?: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_profile_id?: string | null
          church_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          module?: string
          new_values?: Json | null
          old_values?: Json | null
          severity?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      church_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          access_id: string | null
          access_scope: string
          cancelled_at: string | null
          church_id: string
          congregation_id: string | null
          created_at: string
          deleted_at: string | null
          email: string
          email_normalized: string
          expires_at: string
          id: string
          invited_at: string
          invited_by: string
          invited_name: string
          ministry_id: string | null
          notes: string | null
          permission_overrides: Json
          region_id: string | null
          role: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          access_id?: string | null
          access_scope: string
          cancelled_at?: string | null
          church_id: string
          congregation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          email_normalized: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by: string
          invited_name: string
          ministry_id?: string | null
          notes?: string | null
          permission_overrides?: Json
          region_id?: string | null
          role: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          access_id?: string | null
          access_scope?: string
          cancelled_at?: string | null
          church_id?: string
          congregation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          email_normalized?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string
          invited_name?: string
          ministry_id?: string | null
          notes?: string | null
          permission_overrides?: Json
          region_id?: string | null
          role?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "church_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_invitations_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "user_church_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_invitations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_invitations_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_invitations_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "church_invitations_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          address: string | null
          city: string | null
          complement: string | null
          country: string
          created_at: string
          deleted_at: string | null
          district: string | null
          document: string | null
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          notes: string | null
          number: string | null
          phone: string | null
          senior_pastor_name: string | null
          senior_pastor_spouse_name: string | null
          state: string | null
          status: string
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          document?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          senior_pastor_name?: string | null
          senior_pastor_spouse_name?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          document?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          senior_pastor_name?: string | null
          senior_pastor_spouse_name?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      congregation_documents: {
        Row: {
          category: string
          church_id: string
          congregation_id: string
          deleted_at: string | null
          deleted_by: string | null
          file_size: number
          id: string
          mime_type: string
          original_file_name: string
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string
          upload_status: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          church_id: string
          congregation_id: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_size: number
          id?: string
          mime_type: string
          original_file_name: string
          storage_bucket?: string
          storage_path: string
          title: string
          updated_at?: string
          upload_status?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string
          church_id?: string
          congregation_id?: string
          deleted_at?: string | null
          deleted_by?: string | null
          file_size?: number
          id?: string
          mime_type?: string
          original_file_name?: string
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string
          upload_status?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "congregation_documents_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congregation_documents_congregation_same_church_fk"
            columns: ["church_id", "congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["church_id", "id"]
          },
          {
            foreignKeyName: "congregation_documents_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congregation_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      congregations: {
        Row: {
          address: string | null
          church_id: string
          city: string | null
          code: string | null
          complement: string | null
          country: string
          created_at: string
          deleted_at: string | null
          display_order: number
          district: string | null
          email: string | null
          id: string
          is_headquarters: boolean
          name: string
          notes: string | null
          number: string | null
          pastor_name: string | null
          pastor_spouse_name: string | null
          phone: string | null
          region_id: string | null
          state: string | null
          status: string
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          church_id: string
          city?: string | null
          code?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          district?: string | null
          email?: string | null
          id?: string
          is_headquarters?: boolean
          name: string
          notes?: string | null
          number?: string | null
          pastor_name?: string | null
          pastor_spouse_name?: string | null
          phone?: string | null
          region_id?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          church_id?: string
          city?: string | null
          code?: string | null
          complement?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          display_order?: number
          district?: string | null
          email?: string | null
          id?: string
          is_headquarters?: boolean
          name?: string
          notes?: string | null
          number?: string | null
          pastor_name?: string | null
          pastor_spouse_name?: string | null
          phone?: string | null
          region_id?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "congregations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "congregations_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checkins: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          checkin_code: string | null
          checkin_method: string
          church_id: string
          created_at: string
          deleted_at: string | null
          device_info: string | null
          event_group_id: string | null
          event_id: string
          event_registration_id: string
          id: string
          metadata: Json
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_code?: string | null
          checkin_method?: string
          church_id: string
          created_at?: string
          deleted_at?: string | null
          device_info?: string | null
          event_group_id?: string | null
          event_id: string
          event_registration_id: string
          id?: string
          metadata?: Json
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          checkin_code?: string | null
          checkin_method?: string
          church_id?: string
          created_at?: string
          deleted_at?: string | null
          device_info?: string | null
          event_group_id?: string | null
          event_id?: string
          event_registration_id?: string
          id?: string
          metadata?: Json
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_checked_in_by_fkey"
            columns: ["checked_in_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_event_group_id_fkey"
            columns: ["event_group_id"]
            isOneToOne: false
            referencedRelation: "event_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_congregation_quotas: {
        Row: {
          church_id: string
          congregation_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          event_id: string
          id: string
          notes: string | null
          quota_total: number
          updated_at: string
        }
        Insert: {
          church_id: string
          congregation_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          quota_total?: number
          updated_at?: string
        }
        Update: {
          church_id?: string
          congregation_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          quota_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_congregation_quotas_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_congregation_quotas_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_congregation_quotas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_congregation_quotas_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_documents: {
        Row: {
          church_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          document_type: string
          event_group_id: string | null
          event_id: string
          event_payment_id: string | null
          event_registration_id: string | null
          file_name: string
          file_size: number | null
          file_url: string | null
          id: string
          is_sensitive: boolean
          metadata: Json
          mime_type: string | null
          status: string
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          church_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          document_type?: string
          event_group_id?: string | null
          event_id: string
          event_payment_id?: string | null
          event_registration_id?: string | null
          file_name: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_sensitive?: boolean
          metadata?: Json
          mime_type?: string | null
          status?: string
          storage_bucket?: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          document_type?: string
          event_group_id?: string | null
          event_id?: string
          event_payment_id?: string | null
          event_registration_id?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_sensitive?: boolean
          metadata?: Json
          mime_type?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_documents_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_event_group_id_fkey"
            columns: ["event_group_id"]
            isOneToOne: false
            referencedRelation: "event_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_event_payment_id_fkey"
            columns: ["event_payment_id"]
            isOneToOne: false
            referencedRelation: "event_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_groups: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          event_id: string
          female_count: number
          id: string
          male_count: number
          notes: string | null
          origin_church_name: string | null
          origin_city: string
          origin_field_name: string | null
          origin_state: string
          pastor_name: string | null
          pastor_phone: string | null
          responsible_email: string | null
          responsible_name: string
          responsible_phone: string | null
          status: string
          total_registrations: number
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_id: string
          female_count?: number
          id?: string
          male_count?: number
          notes?: string | null
          origin_church_name?: string | null
          origin_city: string
          origin_field_name?: string | null
          origin_state?: string
          pastor_name?: string | null
          pastor_phone?: string | null
          responsible_email?: string | null
          responsible_name: string
          responsible_phone?: string | null
          status?: string
          total_registrations?: number
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_id?: string
          female_count?: number
          id?: string
          male_count?: number
          notes?: string | null
          origin_church_name?: string | null
          origin_city?: string
          origin_field_name?: string | null
          origin_state?: string
          pastor_name?: string | null
          pastor_phone?: string | null
          responsible_email?: string | null
          responsible_name?: string
          responsible_phone?: string | null
          status?: string
          total_registrations?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_groups_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_items: {
        Row: {
          allow_quantity: boolean
          available_quantity: number | null
          church_id: string
          cost_price: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          event_id: string
          id: string
          is_active: boolean
          is_required: boolean
          item_type: string
          max_quantity: number | null
          min_quantity: number
          name: string
          notes: string | null
          price: number
          settings: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          allow_quantity?: boolean
          available_quantity?: number | null
          church_id: string
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          item_type?: string
          max_quantity?: number | null
          min_quantity?: number
          name: string
          notes?: string | null
          price?: number
          settings?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allow_quantity?: boolean
          available_quantity?: number | null
          church_id?: string
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          item_type?: string
          max_quantity?: number | null
          min_quantity?: number
          name?: string
          notes?: string | null
          price?: number
          settings?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_items_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payments: {
        Row: {
          amount: number
          church_id: string
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          due_date: string | null
          event_group_id: string | null
          event_id: string
          event_registration_id: string | null
          id: string
          installment_number: number
          installments_total: number
          metadata: Json
          notes: string | null
          paid_at: string | null
          payer_document: string | null
          payer_name: string | null
          payment_method: string
          payment_number: string | null
          payment_status: string
          receipt_file_url: string | null
          receipt_storage_path: string | null
          transaction_reference: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          church_id: string
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          event_group_id?: string | null
          event_id: string
          event_registration_id?: string | null
          id?: string
          installment_number?: number
          installments_total?: number
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payer_document?: string | null
          payer_name?: string | null
          payment_method?: string
          payment_number?: string | null
          payment_status?: string
          receipt_file_url?: string | null
          receipt_storage_path?: string | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          church_id?: string
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          due_date?: string | null
          event_group_id?: string | null
          event_id?: string
          event_registration_id?: string | null
          id?: string
          installment_number?: number
          installments_total?: number
          metadata?: Json
          notes?: string | null
          paid_at?: string | null
          payer_document?: string | null
          payer_name?: string | null
          payment_method?: string
          payment_number?: string | null
          payment_status?: string
          receipt_file_url?: string | null
          receipt_storage_path?: string | null
          transaction_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_payments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_event_group_id_fkey"
            columns: ["event_group_id"]
            isOneToOne: false
            referencedRelation: "event_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registration_items: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          event_group_id: string | null
          event_id: string
          event_item_id: string
          event_registration_id: string | null
          id: string
          item_name: string
          item_type: string
          metadata: Json
          observation: string | null
          quantity: number
          size: string | null
          total_price: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_group_id?: string | null
          event_id: string
          event_item_id: string
          event_registration_id?: string | null
          id?: string
          item_name: string
          item_type: string
          metadata?: Json
          observation?: string | null
          quantity?: number
          size?: string | null
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_group_id?: string | null
          event_id?: string
          event_item_id?: string
          event_registration_id?: string | null
          id?: string
          item_name?: string
          item_type?: string
          metadata?: Json
          observation?: string | null
          quantity?: number
          size?: string | null
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registration_items_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_items_event_group_id_fkey"
            columns: ["event_group_id"]
            isOneToOne: false
            referencedRelation: "event_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_items_event_item_id_fkey"
            columns: ["event_item_id"]
            isOneToOne: false
            referencedRelation: "event_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registration_items_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          church_id: string
          confirmed_at: string | null
          congregation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          event_group_id: string | null
          event_id: string
          id: string
          member_id: string | null
          metadata: Json
          notes: string | null
          paid_amount: number
          participant_birth_date: string | null
          participant_city: string | null
          participant_document: string | null
          participant_email: string | null
          participant_gender: string | null
          participant_name: string
          participant_phone: string | null
          participant_state: string | null
          participant_type: string
          payment_status: string
          qr_code_value: string | null
          registered_at: string
          registration_number: string | null
          remaining_amount: number | null
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          church_id: string
          confirmed_at?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_group_id?: string | null
          event_id: string
          id?: string
          member_id?: string | null
          metadata?: Json
          notes?: string | null
          paid_amount?: number
          participant_birth_date?: string | null
          participant_city?: string | null
          participant_document?: string | null
          participant_email?: string | null
          participant_gender?: string | null
          participant_name: string
          participant_phone?: string | null
          participant_state?: string | null
          participant_type?: string
          payment_status?: string
          qr_code_value?: string | null
          registered_at?: string
          registration_number?: string | null
          remaining_amount?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          church_id?: string
          confirmed_at?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_group_id?: string | null
          event_id?: string
          id?: string
          member_id?: string | null
          metadata?: Json
          notes?: string | null
          paid_amount?: number
          participant_birth_date?: string | null
          participant_city?: string | null
          participant_document?: string | null
          participant_email?: string | null
          participant_gender?: string | null
          participant_name?: string
          participant_phone?: string | null
          participant_state?: string | null
          participant_type?: string
          payment_status?: string
          qr_code_value?: string | null
          registered_at?: string
          registration_number?: string | null
          remaining_amount?: number | null
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_group_id_fkey"
            columns: ["event_group_id"]
            isOneToOne: false
            referencedRelation: "event_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string | null
          allow_installments: boolean
          allow_waitlist: boolean
          banner_url: string | null
          capacity: number | null
          church_id: string
          city: string | null
          complement: string | null
          congregation_id: string | null
          country: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          district: string | null
          ends_at: string | null
          event_type: string
          host_city: string | null
          host_state: string | null
          id: string
          location_name: string | null
          max_installments: number
          ministry_id: string | null
          name: string
          notes: string | null
          number: string | null
          quota_mode: string
          registration_ends_at: string | null
          registration_mode: string
          registration_starts_at: string | null
          requires_gender_totals: boolean
          requires_group_responsible: boolean
          requires_pastor_info: boolean
          requires_payment: boolean
          settings: Json
          slug: string | null
          starts_at: string
          state: string | null
          status: string
          updated_at: string
          uses_registration_batches: boolean
          visibility: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          allow_installments?: boolean
          allow_waitlist?: boolean
          banner_url?: string | null
          capacity?: number | null
          church_id: string
          city?: string | null
          complement?: string | null
          congregation_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          district?: string | null
          ends_at?: string | null
          event_type?: string
          host_city?: string | null
          host_state?: string | null
          id?: string
          location_name?: string | null
          max_installments?: number
          ministry_id?: string | null
          name: string
          notes?: string | null
          number?: string | null
          quota_mode?: string
          registration_ends_at?: string | null
          registration_mode?: string
          registration_starts_at?: string | null
          requires_gender_totals?: boolean
          requires_group_responsible?: boolean
          requires_pastor_info?: boolean
          requires_payment?: boolean
          settings?: Json
          slug?: string | null
          starts_at: string
          state?: string | null
          status?: string
          updated_at?: string
          uses_registration_batches?: boolean
          visibility?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          allow_installments?: boolean
          allow_waitlist?: boolean
          banner_url?: string | null
          capacity?: number | null
          church_id?: string
          city?: string | null
          complement?: string | null
          congregation_id?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          district?: string | null
          ends_at?: string | null
          event_type?: string
          host_city?: string | null
          host_state?: string | null
          id?: string
          location_name?: string | null
          max_installments?: number
          ministry_id?: string | null
          name?: string
          notes?: string | null
          number?: string | null
          quota_mode?: string
          registration_ends_at?: string | null
          registration_mode?: string
          registration_starts_at?: string | null
          requires_gender_totals?: boolean
          requires_group_responsible?: boolean
          requires_pastor_info?: boolean
          requires_payment?: boolean
          settings?: Json
          slug?: string | null
          starts_at?: string
          state?: string | null
          status?: string
          updated_at?: string
          uses_registration_batches?: boolean
          visibility?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_cashboxes: {
        Row: {
          account_number: string | null
          agency: string | null
          bank_name: string | null
          cashbox_type: string
          church_id: string
          code: string | null
          congregation_id: string | null
          created_at: string
          created_by: string | null
          current_balance: number
          deleted_at: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          opening_balance: number
          pix_key: string | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          cashbox_type?: string
          church_id: string
          code?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          opening_balance?: number
          pix_key?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          cashbox_type?: string
          church_id?: string
          code?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          opening_balance?: number
          pix_key?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_cashboxes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cashboxes_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_cashboxes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          category_group: string
          category_type: string
          church_id: string
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_id: string | null
          description: string | null
          generate_receipt: boolean
          id: string
          is_default: boolean
          is_offering: boolean
          is_report_delivery_item: boolean
          is_tithe: boolean
          name: string
          parent_id: string | null
          requires_member: boolean
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category_group?: string
          category_type?: string
          church_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          description?: string | null
          generate_receipt?: boolean
          id?: string
          is_default?: boolean
          is_offering?: boolean
          is_report_delivery_item?: boolean
          is_tithe?: boolean
          name: string
          parent_id?: string | null
          requires_member?: boolean
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category_group?: string
          category_type?: string
          church_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          description?: string | null
          generate_receipt?: boolean
          id?: string
          is_default?: boolean
          is_offering?: boolean
          is_report_delivery_item?: boolean
          is_tithe?: boolean
          name?: string
          parent_id?: string | null
          requires_member?: boolean
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "financial_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_departments: {
        Row: {
          church_id: string
          code: string | null
          congregation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_type: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          church_id: string
          code?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_type?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          code?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_type?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_departments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_departments_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_departments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_documents: {
        Row: {
          accounts_payable_id: string | null
          church_id: string
          congregation_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string | null
          financial_receipt_id: string | null
          financial_transaction_id: string | null
          id: string
          is_sensitive: boolean
          metadata: Json
          mime_type: string | null
          status: string
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          accounts_payable_id?: string | null
          church_id: string
          congregation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          document_type?: string
          file_name: string
          file_size?: number | null
          file_url?: string | null
          financial_receipt_id?: string | null
          financial_transaction_id?: string | null
          id?: string
          is_sensitive?: boolean
          metadata?: Json
          mime_type?: string | null
          status?: string
          storage_bucket?: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          accounts_payable_id?: string | null
          church_id?: string
          congregation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string | null
          financial_receipt_id?: string | null
          financial_transaction_id?: string | null
          id?: string
          is_sensitive?: boolean
          metadata?: Json
          mime_type?: string | null
          status?: string
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_documents_accounts_payable_id_fkey"
            columns: ["accounts_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_documents_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_documents_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_documents_financial_receipt_id_fkey"
            columns: ["financial_receipt_id"]
            isOneToOne: false
            referencedRelation: "financial_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_documents_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_payment_methods: {
        Row: {
          church_id: string
          code: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_default: boolean
          method_type: string
          name: string
          requires_receipt_upload: boolean
          requires_reference: boolean
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          church_id: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          method_type?: string
          name: string
          requires_receipt_upload?: boolean
          requires_reference?: boolean
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          code?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          method_type?: string
          name?: string
          requires_receipt_upload?: boolean
          requires_reference?: boolean
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_payment_methods_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_payment_methods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_receipts: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          church_id: string
          congregation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          financial_transaction_id: string
          id: string
          issued_at: string
          metadata: Json
          person_name: string | null
          print_count: number
          printed_at: string | null
          printed_by: string | null
          printer_name: string | null
          receipt_content: string | null
          receipt_html: string | null
          receipt_number: string
          receipt_status: string
          receipt_title: string | null
          receipt_type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          church_id: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_transaction_id: string
          id?: string
          issued_at?: string
          metadata?: Json
          person_name?: string | null
          print_count?: number
          printed_at?: string | null
          printed_by?: string | null
          printer_name?: string | null
          receipt_content?: string | null
          receipt_html?: string | null
          receipt_number: string
          receipt_status?: string
          receipt_title?: string | null
          receipt_type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          church_id?: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          financial_transaction_id?: string
          id?: string
          issued_at?: string
          metadata?: Json
          person_name?: string | null
          print_count?: number
          printed_at?: string | null
          printed_by?: string | null
          printer_name?: string | null
          receipt_content?: string | null
          receipt_html?: string | null
          receipt_number?: string
          receipt_status?: string
          receipt_title?: string | null
          receipt_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_receipts_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receipts_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receipts_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receipts_financial_transaction_id_fkey"
            columns: ["financial_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_receipts_printed_by_fkey"
            columns: ["printed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cashbox_id: string | null
          category_id: string
          church_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          congregation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department_id: string | null
          description: string | null
          document_number: string | null
          generate_receipt: boolean
          has_attachment: boolean
          id: string
          is_unregistered_person: boolean
          member_id: string | null
          metadata: Json
          notes: string | null
          payment_method_id: string | null
          payment_reference: string | null
          person_name: string | null
          receipt_printed: boolean
          reference_month: number | null
          reference_year: number | null
          source_type: string
          status: string
          transaction_date: string
          transaction_number: string | null
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cashbox_id?: string | null
          category_id: string
          church_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          description?: string | null
          document_number?: string | null
          generate_receipt?: boolean
          has_attachment?: boolean
          id?: string
          is_unregistered_person?: boolean
          member_id?: string | null
          metadata?: Json
          notes?: string | null
          payment_method_id?: string | null
          payment_reference?: string | null
          person_name?: string | null
          receipt_printed?: boolean
          reference_month?: number | null
          reference_year?: number | null
          source_type?: string
          status?: string
          transaction_date?: string
          transaction_number?: string | null
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cashbox_id?: string | null
          category_id?: string
          church_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department_id?: string | null
          description?: string | null
          document_number?: string | null
          generate_receipt?: boolean
          has_attachment?: boolean
          id?: string
          is_unregistered_person?: boolean
          member_id?: string | null
          metadata?: Json
          notes?: string | null
          payment_method_id?: string | null
          payment_reference?: string | null
          person_name?: string | null
          receipt_printed?: boolean
          reference_month?: number | null
          reference_year?: number | null
          source_type?: string
          status?: string
          transaction_date?: string
          transaction_number?: string | null
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_cashbox_id_fkey"
            columns: ["cashbox_id"]
            isOneToOne: false
            referencedRelation: "financial_cashboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "financial_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "financial_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      member_documents: {
        Row: {
          church_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          document_type: string
          file_name: string
          file_size: number | null
          id: string
          is_sensitive: boolean
          member_id: string
          mime_type: string | null
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          church_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          document_type: string
          file_name: string
          file_size?: number | null
          id?: string
          is_sensitive?: boolean
          member_id: string
          mime_type?: string | null
          storage_bucket?: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          document_type?: string
          file_name?: string
          file_size?: number | null
          id?: string
          is_sensitive?: boolean
          member_id?: string
          mime_type?: string | null
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_documents_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_documents_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_documents_member_same_church_fk"
            columns: ["church_id", "member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["church_id", "id"]
          },
        ]
      }
      member_history: {
        Row: {
          church_id: string
          congregation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          event_date: string
          history_type: string
          id: string
          is_sensitive: boolean
          member_id: string
          metadata: Json
          new_value: string | null
          old_value: string | null
          title: string
          updated_at: string
        }
        Insert: {
          church_id: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          event_date?: string
          history_type: string
          id?: string
          is_sensitive?: boolean
          member_id: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          event_date?: string
          history_type?: string
          id?: string
          is_sensitive?: boolean
          member_id?: string
          metadata?: Json
          new_value?: string | null
          old_value?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_history_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_history_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_history_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_history_member_same_church_fk"
            columns: ["church_id", "member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["church_id", "id"]
          },
        ]
      }
      member_import_batches: {
        Row: {
          church_id: string
          completed_at: string | null
          confirmed_at: string | null
          congregation_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          error_rows: number
          failure_code: string | null
          failure_message: string | null
          file_sha256: string
          file_size_bytes: number
          id: string
          imported_rows: number
          normalization_version: number
          original_filename: string
          rolled_back_at: string | null
          rolled_back_by: string | null
          settings_snapshot: Json
          skipped_rows: number
          source_system: string
          status: string
          total_rows: number
          updated_at: string
          valid_rows: number
          validated_at: string | null
          warning_rows: number
          worksheet_name: string
        }
        Insert: {
          church_id: string
          completed_at?: string | null
          confirmed_at?: string | null
          congregation_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          error_rows?: number
          failure_code?: string | null
          failure_message?: string | null
          file_sha256: string
          file_size_bytes: number
          id?: string
          imported_rows?: number
          normalization_version?: number
          original_filename: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          settings_snapshot?: Json
          skipped_rows?: number
          source_system?: string
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
          validated_at?: string | null
          warning_rows?: number
          worksheet_name: string
        }
        Update: {
          church_id?: string
          completed_at?: string | null
          confirmed_at?: string | null
          congregation_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          error_rows?: number
          failure_code?: string | null
          failure_message?: string | null
          file_sha256?: string
          file_size_bytes?: number
          id?: string
          imported_rows?: number
          normalization_version?: number
          original_filename?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          settings_snapshot?: Json
          skipped_rows?: number
          source_system?: string
          status?: string
          total_rows?: number
          updated_at?: string
          valid_rows?: number
          validated_at?: string | null
          warning_rows?: number
          worksheet_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_import_batches_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_import_batches_congregation_same_church_fk"
            columns: ["church_id", "congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["church_id", "id"]
          },
          {
            foreignKeyName: "member_import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_import_batches_rolled_back_by_fkey"
            columns: ["rolled_back_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_import_items: {
        Row: {
          baptism_date: string | null
          batch_id: string
          birth_date: string | null
          church_id: string
          city: string | null
          classification: string
          cpf: string | null
          created_at: string
          decision: string
          father_name: string | null
          full_name: string
          gender: string | null
          gender_raw: string | null
          holy_spirit_baptism_date: string | null
          id: string
          imported_at: string | null
          imported_member_code: string | null
          imported_member_id: string | null
          issues: Json
          marital_status: string | null
          marital_status_raw: string | null
          mother_name: string | null
          natural_city: string | null
          natural_state: string | null
          normalized_name_key: string
          phone_raw: string | null
          planned_member_id: string
          received_date: string | null
          role_id: string | null
          role_raw: string
          role_title_variant: string
          row_number: number
          source_data: Json
          state: string | null
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
          conversion_date: string | null
        }
        Insert: {
          baptism_date?: string | null
          batch_id: string
          birth_date?: string | null
          church_id: string
          city?: string | null
          classification: string
          cpf?: string | null
          created_at?: string
          decision?: string
          father_name?: string | null
          full_name: string
          gender?: string | null
          gender_raw?: string | null
          holy_spirit_baptism_date?: string | null
          id?: string
          imported_at?: string | null
          imported_member_code?: string | null
          imported_member_id?: string | null
          issues?: Json
          marital_status?: string | null
          marital_status_raw?: string | null
          mother_name?: string | null
          natural_city?: string | null
          natural_state?: string | null
          normalized_name_key: string
          phone_raw?: string | null
          planned_member_id?: string
          received_date?: string | null
          role_id?: string | null
          role_raw: string
          role_title_variant?: string
          row_number: number
          source_data: Json
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
          conversion_date?: string | null
        }
        Update: {
          baptism_date?: string | null
          batch_id?: string
          birth_date?: string | null
          church_id?: string
          city?: string | null
          classification?: string
          cpf?: string | null
          created_at?: string
          decision?: string
          father_name?: string | null
          full_name?: string
          gender?: string | null
          gender_raw?: string | null
          holy_spirit_baptism_date?: string | null
          id?: string
          imported_at?: string | null
          imported_member_code?: string | null
          imported_member_id?: string | null
          issues?: Json
          marital_status?: string | null
          marital_status_raw?: string | null
          mother_name?: string | null
          natural_city?: string | null
          natural_state?: string | null
          normalized_name_key?: string
          phone_raw?: string | null
          planned_member_id?: string
          received_date?: string | null
          role_id?: string | null
          role_raw?: string
          role_title_variant?: string
          row_number?: number
          source_data?: Json
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
          conversion_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_import_items_batch_same_church_fk"
            columns: ["church_id", "batch_id"]
            isOneToOne: false
            referencedRelation: "member_import_batches"
            referencedColumns: ["church_id", "id"]
          },
          {
            foreignKeyName: "member_import_items_imported_member_id_fkey"
            columns: ["imported_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_import_items_role_same_church_fk"
            columns: ["church_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["church_id", "id"]
          },
        ]
      }
      member_ministries: {
        Row: {
          church_id: string
          congregation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          is_leader: boolean
          is_primary: boolean
          member_id: string
          ministry_id: string
          notes: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          church_id: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          is_leader?: boolean
          is_primary?: boolean
          member_id: string
          ministry_id: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          is_leader?: boolean
          is_primary?: boolean
          member_id?: string
          ministry_id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_ministries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ministries_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ministries_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_ministries_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      member_pastoral_notes: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          member_id: string
          notes: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          member_id: string
          notes: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          member_id?: string
          notes?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_pastoral_notes_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pastoral_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pastoral_notes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_pastoral_notes_member_same_church_fk"
            columns: ["church_id", "member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["church_id", "id"]
          },
          {
            foreignKeyName: "member_pastoral_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_roles: {
        Row: {
          church_id: string
          congregation_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          is_primary: boolean
          member_id: string
          notes: string | null
          role_id: string
          start_date: string | null
          status: string
          title_variant: string
          updated_at: string
        }
        Insert: {
          church_id: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          is_primary?: boolean
          member_id: string
          notes?: string | null
          role_id: string
          start_date?: string | null
          status?: string
          title_variant?: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          is_primary?: boolean
          member_id?: string
          notes?: string | null
          role_id?: string
          start_date?: string | null
          status?: string
          title_variant?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_roles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_congregation_same_church_fk"
            columns: ["church_id", "congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["church_id", "id"]
          },
          {
            foreignKeyName: "member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_member_same_church_fk"
            columns: ["church_id", "member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["church_id", "id"]
          },
          {
            foreignKeyName: "member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_roles_role_same_church_fk"
            columns: ["church_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["church_id", "id"]
          },
        ]
      }
      member_sensitive_identity: {
        Row: {
          church_id: string
          cpf: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          issuing_agency: string | null
          member_id: string
          rg: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          church_id: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          issuing_agency?: string | null
          member_id: string
          rg?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          church_id?: string
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          issuing_agency?: string | null
          member_id?: string
          rg?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_sensitive_identity_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_sensitive_identity_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_sensitive_identity_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_sensitive_identity_member_same_church_fk"
            columns: ["church_id", "member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["church_id", "id"]
          },
          {
            foreignKeyName: "member_sensitive_identity_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          baptism_church: string | null
          baptism_date: string | null
          birth_date: string | null
          church_id: string
          city: string | null
          complement: string | null
          congregation_id: string
          conversion_date: string | null
          country: string
          created_at: string
          deleted_at: string | null
          district: string | null
          education_level: string | null
          email: string | null
          father_name: string | null
          full_name: string
          gender: string | null
          has_holy_spirit_baptism: boolean
          history_migration_status: string | null
          history_migration_updated_at: string | null
          history_migration_updated_by: string | null
          holy_spirit_baptism_date: string | null
          id: string
          inactive_reason: string | null
          letter_destination_church: string | null
          letter_origin_church: string | null
          marital_status: string | null
          member_code: string | null
          member_status: string
          member_type: string
          mother_name: string | null
          nationality: string | null
          natural_city: string | null
          natural_state: string | null
          notes: string | null
          number: string | null
          physical_file_number: string | null
          preferred_name: string | null
          previous_church: string | null
          profession: string | null
          received_by: string | null
          received_date: string | null
          source_import_batch_id: string | null
          spouse_name: string | null
          state: string | null
          transfer_date: string | null
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          baptism_church?: string | null
          baptism_date?: string | null
          birth_date?: string | null
          church_id: string
          city?: string | null
          complement?: string | null
          congregation_id: string
          conversion_date?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          education_level?: string | null
          email?: string | null
          father_name?: string | null
          full_name: string
          gender?: string | null
          has_holy_spirit_baptism?: boolean
          history_migration_status?: string | null
          history_migration_updated_at?: string | null
          history_migration_updated_by?: string | null
          holy_spirit_baptism_date?: string | null
          id?: string
          inactive_reason?: string | null
          letter_destination_church?: string | null
          letter_origin_church?: string | null
          marital_status?: string | null
          member_code?: string | null
          member_status?: string
          member_type?: string
          mother_name?: string | null
          nationality?: string | null
          natural_city?: string | null
          natural_state?: string | null
          notes?: string | null
          number?: string | null
          physical_file_number?: string | null
          preferred_name?: string | null
          previous_church?: string | null
          profession?: string | null
          received_by?: string | null
          received_date?: string | null
          source_import_batch_id?: string | null
          spouse_name?: string | null
          state?: string | null
          transfer_date?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          baptism_church?: string | null
          baptism_date?: string | null
          birth_date?: string | null
          church_id?: string
          city?: string | null
          complement?: string | null
          congregation_id?: string
          conversion_date?: string | null
          country?: string
          created_at?: string
          deleted_at?: string | null
          district?: string | null
          education_level?: string | null
          email?: string | null
          father_name?: string | null
          full_name?: string
          gender?: string | null
          has_holy_spirit_baptism?: boolean
          history_migration_status?: string | null
          history_migration_updated_at?: string | null
          history_migration_updated_by?: string | null
          holy_spirit_baptism_date?: string | null
          id?: string
          inactive_reason?: string | null
          letter_destination_church?: string | null
          letter_origin_church?: string | null
          marital_status?: string | null
          member_code?: string | null
          member_status?: string
          member_type?: string
          mother_name?: string | null
          nationality?: string | null
          natural_city?: string | null
          natural_state?: string | null
          notes?: string | null
          number?: string | null
          physical_file_number?: string | null
          preferred_name?: string | null
          previous_church?: string | null
          profession?: string | null
          received_by?: string | null
          received_date?: string | null
          source_import_batch_id?: string | null
          spouse_name?: string | null
          state?: string | null
          transfer_date?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_history_migration_updated_by_fkey"
            columns: ["history_migration_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_source_import_batch_id_fkey"
            columns: ["source_import_batch_id"]
            isOneToOne: false
            referencedRelation: "member_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      ministries: {
        Row: {
          category: string
          church_id: string
          congregation_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_global: boolean
          leader_member_id: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          church_id: string
          congregation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_global?: boolean
          leader_member_id?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          church_id?: string
          congregation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_global?: boolean
          leader_member_id?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministries_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministries_leader_member_id_fkey"
            columns: ["leader_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_sensitive: boolean
          key: string
          module: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_sensitive?: boolean
          key: string
          module: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_sensitive?: boolean
          key?: string
          module?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accepted_terms_at: string | null
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          is_platform_admin: boolean
          last_seen_at: string | null
          locale: string
          phone: string | null
          status: string
          timezone: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          accepted_terms_at?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_platform_admin?: boolean
          last_seen_at?: string | null
          locale?: string
          phone?: string | null
          status?: string
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          accepted_terms_at?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_platform_admin?: boolean
          last_seen_at?: string | null
          locale?: string
          phone?: string | null
          status?: string
          timezone?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      regions: {
        Row: {
          church_id: string
          coordinator_name: string | null
          coordinator_phone: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          display_order: number
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          church_id: string
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          coordinator_name?: string | null
          coordinator_phone?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      report_deliveries: {
        Row: {
          calculation_mode: string
          church_id: string
          congregation_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivered_by: string | null
          delivery_number: string | null
          finalized_at: string | null
          finalized_by: string | null
          gross_amount: number
          id: string
          metadata: Json
          net_congregation_amount: number
          net_pastoral_prebend_amount: number
          notes: string | null
          pastoral_prebend_amount: number
          pastoral_prebend_tithe_amount: number
          period_end: string
          period_start: string
          reference_month: number
          reference_year: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          total_central_income: number
          total_congregation_expense: number
          total_expense: number
          total_income: number
          updated_at: string
        }
        Insert: {
          calculation_mode?: string
          church_id: string
          congregation_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_number?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          gross_amount?: number
          id?: string
          metadata?: Json
          net_congregation_amount?: number
          net_pastoral_prebend_amount?: number
          notes?: string | null
          pastoral_prebend_amount?: number
          pastoral_prebend_tithe_amount?: number
          period_end: string
          period_start: string
          reference_month: number
          reference_year: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_central_income?: number
          total_congregation_expense?: number
          total_expense?: number
          total_income?: number
          updated_at?: string
        }
        Update: {
          calculation_mode?: string
          church_id?: string
          congregation_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_number?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          gross_amount?: number
          id?: string
          metadata?: Json
          net_congregation_amount?: number
          net_pastoral_prebend_amount?: number
          notes?: string | null
          pastoral_prebend_amount?: number
          pastoral_prebend_tithe_amount?: number
          period_end?: string
          period_start?: string
          reference_month?: number
          reference_year?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          total_central_income?: number
          total_congregation_expense?: number
          total_expense?: number
          total_income?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_deliveries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_deliveries_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_delivery_items: {
        Row: {
          affects_pastoral_prebend: boolean
          applies_to_central_church: boolean
          applies_to_congregation: boolean
          base_amount: number
          calculated_amount: number
          calculation_base: string
          category_id: string | null
          central_transaction_id: string | null
          church_id: string
          congregation_id: string
          congregation_transaction_id: string | null
          created_at: string
          created_by: string | null
          deducts_from_pastoral_prebend: boolean
          deleted_at: string | null
          fixed_amount: number | null
          generate_central_income: boolean
          generate_congregation_expense: boolean
          id: string
          manual_amount: number | null
          metadata: Json
          notes: string | null
          percentage_value: number | null
          report_delivery_id: string
          report_delivery_rule_id: string | null
          rule_code: string | null
          rule_description: string | null
          rule_name: string
          rule_nature: string
          rule_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          affects_pastoral_prebend?: boolean
          applies_to_central_church?: boolean
          applies_to_congregation?: boolean
          base_amount?: number
          calculated_amount?: number
          calculation_base: string
          category_id?: string | null
          central_transaction_id?: string | null
          church_id: string
          congregation_id: string
          congregation_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          deducts_from_pastoral_prebend?: boolean
          deleted_at?: string | null
          fixed_amount?: number | null
          generate_central_income?: boolean
          generate_congregation_expense?: boolean
          id?: string
          manual_amount?: number | null
          metadata?: Json
          notes?: string | null
          percentage_value?: number | null
          report_delivery_id: string
          report_delivery_rule_id?: string | null
          rule_code?: string | null
          rule_description?: string | null
          rule_name: string
          rule_nature: string
          rule_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          affects_pastoral_prebend?: boolean
          applies_to_central_church?: boolean
          applies_to_congregation?: boolean
          base_amount?: number
          calculated_amount?: number
          calculation_base?: string
          category_id?: string | null
          central_transaction_id?: string | null
          church_id?: string
          congregation_id?: string
          congregation_transaction_id?: string | null
          created_at?: string
          created_by?: string | null
          deducts_from_pastoral_prebend?: boolean
          deleted_at?: string | null
          fixed_amount?: number | null
          generate_central_income?: boolean
          generate_congregation_expense?: boolean
          id?: string
          manual_amount?: number | null
          metadata?: Json
          notes?: string | null
          percentage_value?: number | null
          report_delivery_id?: string
          report_delivery_rule_id?: string | null
          rule_code?: string | null
          rule_description?: string | null
          rule_name?: string
          rule_nature?: string
          rule_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_delivery_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_items_central_transaction_id_fkey"
            columns: ["central_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_items_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_items_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_items_congregation_transaction_id_fkey"
            columns: ["congregation_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_items_report_delivery_id_fkey"
            columns: ["report_delivery_id"]
            isOneToOne: false
            referencedRelation: "report_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_items_report_delivery_rule_id_fkey"
            columns: ["report_delivery_rule_id"]
            isOneToOne: false
            referencedRelation: "report_delivery_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      report_delivery_rules: {
        Row: {
          affects_pastoral_prebend: boolean
          applies_to_central_church: boolean
          applies_to_congregation: boolean
          calculation_base: string
          category_id: string | null
          church_id: string
          code: string | null
          congregation_id: string | null
          created_at: string
          created_by: string | null
          deducts_from_pastoral_prebend: boolean
          deleted_at: string | null
          description: string | null
          effective_from: string
          effective_until: string | null
          fixed_amount: number | null
          generate_central_income: boolean
          generate_congregation_expense: boolean
          id: string
          is_default: boolean
          is_required: boolean
          metadata: Json
          name: string
          percentage_value: number | null
          rule_nature: string
          rule_type: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          affects_pastoral_prebend?: boolean
          applies_to_central_church?: boolean
          applies_to_congregation?: boolean
          calculation_base?: string
          category_id?: string | null
          church_id: string
          code?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deducts_from_pastoral_prebend?: boolean
          deleted_at?: string | null
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          fixed_amount?: number | null
          generate_central_income?: boolean
          generate_congregation_expense?: boolean
          id?: string
          is_default?: boolean
          is_required?: boolean
          metadata?: Json
          name: string
          percentage_value?: number | null
          rule_nature?: string
          rule_type?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          affects_pastoral_prebend?: boolean
          applies_to_central_church?: boolean
          applies_to_congregation?: boolean
          calculation_base?: string
          category_id?: string | null
          church_id?: string
          code?: string | null
          congregation_id?: string | null
          created_at?: string
          created_by?: string | null
          deducts_from_pastoral_prebend?: boolean
          deleted_at?: string | null
          description?: string | null
          effective_from?: string
          effective_until?: string | null
          fixed_amount?: number | null
          generate_central_income?: boolean
          generate_congregation_expense?: boolean
          id?: string
          is_default?: boolean
          is_required?: boolean
          metadata?: Json
          name?: string
          percentage_value?: number | null
          rule_nature?: string
          rule_type?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_delivery_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_rules_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_rules_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_delivery_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          permission_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          permission_id: string
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          permission_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          abbreviation: string | null
          category: string
          church_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          display_order: number
          female_abbreviation: string | null
          female_name: string | null
          id: string
          is_leadership: boolean
          is_ministerial: boolean
          level: number
          name: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          abbreviation?: string | null
          category?: string
          church_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          female_abbreviation?: string | null
          female_name?: string | null
          id?: string
          is_leadership?: boolean
          is_ministerial?: boolean
          level?: number
          name: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          abbreviation?: string | null
          category?: string
          church_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          female_abbreviation?: string | null
          female_name?: string | null
          id?: string
          is_leadership?: boolean
          is_ministerial?: boolean
          level?: number
          name?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_church_access: {
        Row: {
          accepted_at: string | null
          access_scope: string
          church_id: string
          congregation_id: string | null
          created_at: string
          deleted_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          last_access_at: string | null
          ministry_id: string | null
          notes: string | null
          profile_id: string
          region_id: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          access_scope?: string
          church_id: string
          congregation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          last_access_at?: string | null
          ministry_id?: string | null
          notes?: string | null
          profile_id: string
          region_id?: string | null
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          access_scope?: string
          church_id?: string
          congregation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          last_access_at?: string | null
          ministry_id?: string | null
          notes?: string | null
          profile_id?: string
          region_id?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_church_access_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_church_access_congregation_id_fkey"
            columns: ["congregation_id"]
            isOneToOne: false
            referencedRelation: "congregations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_church_access_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_church_access_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_church_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_church_access_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_overrides: {
        Row: {
          access_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effect: string
          id: string
          permission_id: string
          updated_at: string
        }
        Insert: {
          access_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effect: string
          id?: string
          permission_id: string
          updated_at?: string
        }
        Update: {
          access_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effect?: string
          id?: string
          permission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_access_id_fkey"
            columns: ["access_id"]
            isOneToOne: false
            referencedRelation: "user_church_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_church_invitation: { Args: { p_token: string }; Returns: string }
      can_access_church: { Args: { p_church_id: string }; Returns: boolean }
      can_access_congregation: {
        Args: { p_church_id: string; p_congregation_id: string }
        Returns: boolean
      }
      can_access_member: {
        Args: {
          p_church_id: string
          p_congregation_id: string
          p_member_id: string
        }
        Returns: boolean
      }
      can_access_region: {
        Args: { p_church_id: string; p_region_id: string }
        Returns: boolean
      }
      cancel_church_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      cancel_member_import: { Args: { p_batch_id: string }; Returns: Json }
      change_member_lifecycle: {
        Args: {
          p_action: string
          p_destination_church?: string
          p_end_roles?: boolean
          p_event_date?: string
          p_member_id: string
          p_reason?: string
          p_sensitive?: boolean
          p_target_congregation_id?: string
        }
        Returns: Json
      }
      change_member_lifecycle_v2: {
        Args: {
          p_action: string
          p_destination_church?: string
          p_end_roles?: boolean
          p_event_date?: string
          p_expected_end_date?: string
          p_member_id: string
          p_reactivate_role?: boolean
          p_reason?: string
          p_sensitive?: boolean
          p_target_congregation_id?: string
        }
        Returns: Json
      }
      complete_church_onboarding: { Args: { p_payload: Json }; Returns: string }
      create_church_invitation: {
        Args: {
          p_church_id: string
          p_congregation_id?: string
          p_email: string
          p_ministry_id?: string
          p_name: string
          p_notes?: string
          p_permission_overrides?: Json
          p_region_id?: string
          p_role: string
          p_scope: string
        }
        Returns: string
      }
      create_member_atomic: {
        Args: { p_church_id: string; p_payload: Json }
        Returns: {
          member_code: string
          member_id: string
        }[]
      }
      execute_member_import: { Args: { p_batch_id: string }; Returns: Json }
      get_member_import_duplicate_candidates: {
        Args: { p_candidates: Json; p_church_id: string }
        Returns: {
          archived: boolean
          birth_date: string
          candidate_key: string
          congregation_id: string
          full_name: string
          member_id: string
        }[]
      }
      get_member_import_history_stats: {
        Args: { p_church_id: string }
        Returns: Json
      }
      get_member_stats: { Args: { p_church_id: string }; Returns: Json }
      get_my_access_context: {
        Args: { p_preferred_church_id?: string }
        Returns: Json
      }
      get_my_permissions: {
        Args: { p_church_id: string }
        Returns: {
          permission_key: string
        }[]
      }
      has_permission: {
        Args: { p_church_id: string; p_permission_key: string }
        Returns: boolean
      }
      is_valid_cpf: { Args: { p_value: string }; Returns: boolean }
      log_audit: {
        Args: {
          p_action: string
          p_church_id: string
          p_description?: string
          p_entity_id?: string
          p_entity_label?: string
          p_entity_type?: string
          p_metadata?: Json
          p_module: string
          p_new_values?: Json
          p_old_values?: Json
          p_severity?: string
        }
        Returns: undefined
      }
      manage_member_role: {
        Args: {
          p_end_date?: string
          p_is_primary?: boolean
          p_link_id?: string
          p_member_id: string
          p_notes?: string
          p_operation: string
          p_role_id?: string
          p_start_date?: string
        }
        Returns: string
      }
      normalize_member_import_name: {
        Args: { p_value: string }
        Returns: string
      }
      prepare_member_import: {
        Args: { p_items: Json; p_payload: Json }
        Returns: string
      }
      prepare_member_import_official: {
        Args: { p_items: Json; p_payload: Json }
        Returns: string
      }
      renew_church_invitation: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      resolve_member_import_item: {
        Args: { p_batch_id: string; p_item_id: string; p_resolution: string }
        Returns: Json
      }
      resolve_member_import_official_item: {
        Args: { p_batch_id: string; p_item_id: string; p_resolution: string }
        Returns: Json
      }
      resolve_member_import_mapping: {
        Args: {
          p_batch_id: string
          p_kind: string
          p_raw_value: string
          p_value: string
        }
        Returns: Json
      }
      rollback_member_import: { Args: { p_batch_id: string }; Returns: Json }
      safe_uuid: { Args: { p_value: string }; Returns: string }
      set_access_permission_override: {
        Args: {
          p_access_id: string
          p_effect: string
          p_permission_key: string
        }
        Returns: undefined
      }
      update_church_access: {
        Args: {
          p_access_id: string
          p_congregation_id?: string
          p_ministry_id?: string
          p_notes?: string
          p_region_id?: string
          p_role: string
          p_scope: string
          p_status: string
        }
        Returns: undefined
      }
      update_member_atomic: {
        Args: {
          p_expected_updated_at: string
          p_member_id: string
          p_payload: Json
        }
        Returns: string
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
