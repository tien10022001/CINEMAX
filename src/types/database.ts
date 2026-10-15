export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRoleT = 'admin' | 'staff' | 'user';
export type AccountStatusT = 'active' | 'blocked';
export type StaffPermT = 'POS' | 'CHECKIN' | 'CONCESSION' | 'SUPERVISOR';
export type ContentTypeT = 'banner' | 'post' | 'promotion';
export type ContentStatusT = 'draft' | 'published' | 'archived';
export type AgeRatingT = 'P' | 'K' | 'T13' | 'T16' | 'T18';
export type MovieStatusT = 'draft' | 'coming_soon' | 'now_showing' | 'ended';
export type ScreenTypeT = '2D' | '3D' | 'IMAX' | '4DX';
export type RoomStatusT = 'active' | 'maintenance';
export type SeatTypeT = 'STANDARD' | 'VIP' | 'COUPLE' | 'WHEELCHAIR';
export type SeatStatusT = 'ACTIVE' | 'BLOCKED';
export type ShowtimeStatusT = 'scheduled' | 'open' | 'closed' | 'cancelled' | 'finished';
export type AudienceTypeT = 'ADULT' | 'STUDENT_U22' | 'CHILD' | 'SENIOR';
export type ShowtimeSeatStatusT = 'available' | 'held' | 'sold' | 'blocked';
export type ProductTypeT = 'FOOD' | 'BEVERAGE' | 'COMBO';
export type MovementTypeT = 'IMPORT' | 'SALE' | 'LOSS' | 'ADJUSTMENT';
export type DiscountTypeT = 'PERCENT' | 'FIXED';
export type CouponScopeT = 'ALL' | 'TICKET_ONLY' | 'COMBO_ONLY';
export type OrderChannelT = 'online' | 'pos';
export type OrderStatusT = 'pending' | 'paid' | 'cancelled' | 'expired' | 'refunded';
export type OrderItemTypeT = 'ticket' | 'product';
export type PaymentProviderT = 'CASH' | 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CARD';
export type PaymentStatusT = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type TicketStatusT = 'issued' | 'used' | 'cancelled' | 'refunded';
export type ShiftStatusT = 'open' | 'submitted' | 'closed';
export type RefundTypeT = 'CUSTOMER_REQUEST' | 'SYSTEM_SHOWTIME_CANCEL' | 'EXCHANGE';
export type RefundStatusT = 'pending' | 'approved' | 'rejected' | 'completed';
export type InvoiceStatusT = 'pending' | 'issued' | 'rejected';
export type SupportTypeT = 'lost_ticket' | 'contact_change' | 'payment_pending' | 'cancellation' | 'seat_exchange';
export type SupportStatusT = 'pending' | 'in_progress' | 'resolved' | 'closed';
export type ChallengeChannelT = 'email' | 'sms';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRoleT
          full_name: string
          phone: string | null
          loyalty_points: number
          membership_tier: string
          status: AccountStatusT
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: UserRoleT
          full_name: string
          phone?: string | null
          loyalty_points?: number
          membership_tier?: string
          status?: AccountStatusT
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: UserRoleT
          full_name?: string
          phone?: string | null
          loyalty_points?: number
          membership_tier?: string
          status?: AccountStatusT
          created_at?: string
          updated_at?: string
        }
      }
      staff_permissions: {
        Row: {
          id: string
          staff_id: string
          permission: StaffPermT
          active: boolean
          assigned_by: string | null
          assigned_at: string
        }
        Insert: {
          id?: string
          staff_id: string
          permission: StaffPermT
          active?: boolean
          assigned_by?: string | null
          assigned_at?: string
        }
        Update: {
          id?: string
          staff_id?: string
          permission?: StaffPermT
          active?: boolean
          assigned_by?: string | null
          assigned_at?: string
        }
      }
      cinema_settings: {
        Row: {
          setting_key: string
          setting_value: Json
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          setting_key: string
          setting_value: Json
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          setting_key?: string
          setting_value?: Json
          updated_by?: string | null
          updated_at?: string
        }
      }
      content_items: {
        Row: {
          id: string
          type: ContentTypeT
          title: string
          body: string | null
          image_url: string | null
          link_url: string | null
          published_at: string | null
          expires_at: string | null
          status: ContentStatusT
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: ContentTypeT
          title: string
          body?: string | null
          image_url?: string | null
          link_url?: string | null
          published_at?: string | null
          expires_at?: string | null
          status?: ContentStatusT
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: ContentTypeT
          title?: string
          body?: string | null
          image_url?: string | null
          link_url?: string | null
          published_at?: string | null
          expires_at?: string | null
          status?: ContentStatusT
          created_at?: string
          updated_at?: string
        }
      }
      genres: {
        Row: {
          id: string
          name: string
          slug: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      movies: {
        Row: {
          id: string
          title: string
          slug: string
          synopsis: string | null
          director: string | null
          cast_list: string | null
          language: string | null
          duration_minutes: number
          age_rating: AgeRatingT
          poster_url: string | null
          banner_url: string | null
          trailer_url: string | null
          release_date: string | null
          end_date: string | null
          status: MovieStatusT
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          synopsis?: string | null
          director?: string | null
          cast_list?: string | null
          language?: string | null
          duration_minutes: number
          age_rating?: AgeRatingT
          poster_url?: string | null
          banner_url?: string | null
          trailer_url?: string | null
          release_date?: string | null
          end_date?: string | null
          status?: MovieStatusT
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          synopsis?: string | null
          director?: string | null
          cast_list?: string | null
          language?: string | null
          duration_minutes?: number
          age_rating?: AgeRatingT
          poster_url?: string | null
          banner_url?: string | null
          trailer_url?: string | null
          release_date?: string | null
          end_date?: string | null
          status?: MovieStatusT
          created_at?: string
          updated_at?: string
        }
      }
      movie_genres: {
        Row: {
          movie_id: string
          genre_id: string
        }
        Insert: {
          movie_id: string
          genre_id: string
        }
        Update: {
          movie_id?: string
          genre_id?: string
        }
      }
      auditoriums: {
        Row: {
          id: string
          name: string
          screen_type: ScreenTypeT
          sound_system: string
          total_seats: number
          cleaning_buffer_minutes: number
          status: RoomStatusT
          seat_map_version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          screen_type?: ScreenTypeT
          sound_system?: string
          total_seats: number
          cleaning_buffer_minutes?: number
          status?: RoomStatusT
          seat_map_version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          screen_type?: ScreenTypeT
          sound_system?: string
          total_seats?: number
          cleaning_buffer_minutes?: number
          status?: RoomStatusT
          seat_map_version?: number
          created_at?: string
          updated_at?: string
        }
      }
      seats: {
        Row: {
          id: string
          auditorium_id: string
          row_label: string
          seat_number: number
          grid_row: number
          grid_col: number
          seat_type: SeatTypeT
          seat_group: string | null
          status: SeatStatusT
          block_reason: string | null
        }
        Insert: {
          id?: string
          auditorium_id: string
          row_label: string
          seat_number: number
          grid_row: number
          grid_col: number
          seat_type?: SeatTypeT
          seat_group?: string | null
          status?: SeatStatusT
          block_reason?: string | null
        }
        Update: {
          id?: string
          auditorium_id?: string
          row_label?: string
          seat_number?: number
          grid_row?: number
          grid_col?: number
          seat_type?: SeatTypeT
          seat_group?: string | null
          status?: SeatStatusT
          block_reason?: string | null
        }
      }
      showtimes: {
        Row: {
          id: string
          movie_id: string
          auditorium_id: string
          format: string
          language_version: string
          starts_at: string
          ends_at: string
          booking_opens_at: string | null
          booking_closes_at: string | null
          status: ShowtimeStatusT
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          movie_id: string
          auditorium_id: string
          format?: string
          language_version?: string
          starts_at: string
          ends_at: string
          booking_opens_at?: string | null
          booking_closes_at?: string | null
          status?: ShowtimeStatusT
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          movie_id?: string
          auditorium_id?: string
          format?: string
          language_version?: string
          starts_at?: string
          ends_at?: string
          booking_opens_at?: string | null
          booking_closes_at?: string | null
          status?: ShowtimeStatusT
          created_at?: string
          updated_at?: string
        }
      }
      showtime_prices: {
        Row: {
          id: string
          showtime_id: string
          seat_type: SeatTypeT
          audience_type: AudienceTypeT
          price: number
          currency: string
        }
        Insert: {
          id?: string
          showtime_id: string
          seat_type: SeatTypeT
          audience_type?: AudienceTypeT
          price: number
          currency?: string
        }
        Update: {
          id?: string
          showtime_id?: string
          seat_type?: SeatTypeT
          audience_type?: AudienceTypeT
          price?: number
          currency?: string
        }
      }
      showtime_seats: {
        Row: {
          showtime_id: string
          seat_id: string
          status: ShowtimeSeatStatusT
          held_until: string | null
          order_id: string | null
        }
        Insert: {
          showtime_id: string
          seat_id: string
          status?: ShowtimeSeatStatusT
          held_until?: string | null
          order_id?: string | null
        }
        Update: {
          showtime_id?: string
          seat_id?: string
          status?: ShowtimeSeatStatusT
          held_until?: string | null
          order_id?: string | null
        }
      }
      products: {
        Row: {
          id: string
          name: string
          product_type: ProductTypeT
          base_price: number
          inventory_tracking: boolean
          available_stock: number
          active: boolean
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          product_type: ProductTypeT
          base_price: number
          inventory_tracking?: boolean
          available_stock?: number
          active?: boolean
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          product_type?: ProductTypeT
          base_price?: number
          inventory_tracking?: boolean
          available_stock?: number
          active?: boolean
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      product_components: {
        Row: {
          combo_id: string
          component_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          component_id: string
          quantity: number
        }
        Update: {
          combo_id?: string
          component_id?: string
          quantity?: number
        }
      }
      product_modifiers: {
        Row: {
          id: string
          product_id: string
          modifier_group: string
          option_name: string
          extra_price: number
          is_default: boolean
          active: boolean
        }
        Insert: {
          id?: string
          product_id: string
          modifier_group: string
          option_name: string
          extra_price?: number
          is_default?: boolean
          active?: boolean
        }
        Update: {
          id?: string
          product_id?: string
          modifier_group?: string
          option_name?: string
          extra_price?: number
          is_default?: boolean
          active?: boolean
        }
      }
      inventory_movements: {
        Row: {
          id: string
          product_id: string
          movement_type: MovementTypeT
          quantity: number
          reason: string
          reference_order_item_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          movement_type: MovementTypeT
          quantity: number
          reason: string
          reference_order_item_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          movement_type?: MovementTypeT
          quantity?: number
          reason?: string
          reference_order_item_id?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      coupons: {
        Row: {
          id: string
          code: string
          discount_type: DiscountTypeT
          discount_value: number
          max_discount: number | null
          min_order_amount: number
          apply_scope: CouponScopeT
          starts_at: string
          ends_at: string
          usage_limit: number | null
          per_user_limit: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          discount_type: DiscountTypeT
          discount_value: number
          max_discount?: number | null
          min_order_amount?: number
          apply_scope?: CouponScopeT
          starts_at: string
          ends_at: string
          usage_limit?: number | null
          per_user_limit?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          discount_type?: DiscountTypeT
          discount_value?: number
          max_discount?: number | null
          min_order_amount?: number
          apply_scope?: CouponScopeT
          starts_at?: string
          ends_at?: string
          usage_limit?: number | null
          per_user_limit?: number
          active?: boolean
          created_at?: string
        }
      }
      coupon_redemptions: {
        Row: {
          id: string
          coupon_id: string
          order_id: string
          user_id: string | null
          redeemed_at: string
        }
        Insert: {
          id?: string
          coupon_id: string
          order_id: string
          user_id?: string | null
          redeemed_at?: string
        }
        Update: {
          id?: string
          coupon_id?: string
          order_id?: string
          user_id?: string | null
          redeemed_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          order_code: string
          user_id: string | null
          guest_access_hash: string | null
          channel: OrderChannelT
          created_by: string | null
          status: OrderStatusT
          contact_name: string
          contact_email: string
          contact_phone: string
          subtotal: number
          discount_amount: number
          loyalty_points_used: number
          loyalty_discount_amount: number
          total_amount: number
          coupon_id: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_code: string
          user_id?: string | null
          guest_access_hash?: string | null
          channel?: OrderChannelT
          created_by?: string | null
          status?: OrderStatusT
          contact_name: string
          contact_email: string
          contact_phone: string
          subtotal: number
          discount_amount?: number
          loyalty_points_used?: number
          loyalty_discount_amount?: number
          total_amount: number
          coupon_id?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_code?: string
          user_id?: string | null
          guest_access_hash?: string | null
          channel?: OrderChannelT
          created_by?: string | null
          status?: OrderStatusT
          contact_name?: string
          contact_email?: string
          contact_phone?: string
          subtotal?: number
          discount_amount?: number
          loyalty_points_used?: number
          loyalty_discount_amount?: number
          total_amount?: number
          coupon_id?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          item_type: OrderItemTypeT
          showtime_id: string | null
          seat_id: string | null
          product_id: string | null
          audience_type: AudienceTypeT | null
          selected_modifiers: Json | null
          quantity: number
          unit_price: number
          line_total: number
          item_snapshot: Json
        }
        Insert: {
          id?: string
          order_id: string
          item_type: OrderItemTypeT
          showtime_id?: string | null
          seat_id?: string | null
          product_id?: string | null
          audience_type?: AudienceTypeT | null
          selected_modifiers?: Json | null
          quantity: number
          unit_price: number
          line_total: number
          item_snapshot: Json
        }
        Update: {
          id?: string
          order_id?: string
          item_type?: OrderItemTypeT
          showtime_id?: string | null
          seat_id?: string | null
          product_id?: string | null
          audience_type?: AudienceTypeT | null
          selected_modifiers?: Json | null
          quantity?: number
          unit_price?: number
          line_total?: number
          item_snapshot?: Json
        }
      }
      order_item_fulfillments: {
        Row: {
          id: string
          order_item_id: string
          quantity: number
          delivered_at: string
          delivered_by: string | null
        }
        Insert: {
          id?: string
          order_item_id: string
          quantity: number
          delivered_at?: string
          delivered_by?: string | null
        }
        Update: {
          id?: string
          order_item_id?: string
          quantity?: number
          delivered_at?: string
          delivered_by?: string | null
        }
      }
      shifts: {
        Row: {
          id: string
          staff_id: string
          pos_terminal: string
          shift_type: string
          opened_at: string
          closed_at: string | null
          opening_cash: number
          expected_cash: number
          counted_cash: number | null
          variance_reason: string | null
          supervisor_id: string | null
          approved_at: string | null
          status: ShiftStatusT
        }
        Insert: {
          id?: string
          staff_id: string
          pos_terminal: string
          shift_type?: string
          opened_at?: string
          closed_at?: string | null
          opening_cash?: number
          expected_cash?: number
          counted_cash?: number | null
          variance_reason?: string | null
          supervisor_id?: string | null
          approved_at?: string | null
          status?: ShiftStatusT
        }
        Update: {
          id?: string
          staff_id?: string
          pos_terminal?: string
          shift_type?: string
          opened_at?: string
          closed_at?: string | null
          opening_cash?: number
          expected_cash?: number
          counted_cash?: number | null
          variance_reason?: string | null
          supervisor_id?: string | null
          approved_at?: string | null
          status?: ShiftStatusT
        }
      }
      payments: {
        Row: {
          id: string
          order_id: string
          shift_id: string | null
          received_by: string | null
          provider: PaymentProviderT
          provider_txn_id: string | null
          amount: number
          status: PaymentStatusT
          payload: Json | null
          paid_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          shift_id?: string | null
          received_by?: string | null
          provider: PaymentProviderT
          provider_txn_id?: string | null
          amount: number
          status?: PaymentStatusT
          payload?: Json | null
          paid_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          shift_id?: string | null
          received_by?: string | null
          provider?: PaymentProviderT
          provider_txn_id?: string | null
          amount?: number
          status?: PaymentStatusT
          payload?: Json | null
          paid_at?: string | null
          created_at?: string
        }
      }
      tickets: {
        Row: {
          id: string
          order_item_id: string
          qr_token_hash: string
          status: TicketStatusT
          age_check_passed: boolean
          checked_in_at: string | null
          checked_in_by: string | null
        }
        Insert: {
          id?: string
          order_item_id: string
          qr_token_hash: string
          status?: TicketStatusT
          age_check_passed?: boolean
          checked_in_at?: string | null
          checked_in_by?: string | null
        }
        Update: {
          id?: string
          order_item_id?: string
          qr_token_hash?: string
          status?: TicketStatusT
          age_check_passed?: boolean
          checked_in_at?: string | null
          checked_in_by?: string | null
        }
      }
      refunds: {
        Row: {
          id: string
          order_id: string
          payment_id: string | null
          refund_type: RefundTypeT
          requested_by: string | null
          reason: string
          amount: number
          status: RefundStatusT
          approved_by: string | null
          provider_ref: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          payment_id?: string | null
          refund_type?: RefundTypeT
          requested_by?: string | null
          reason: string
          amount: number
          status?: RefundStatusT
          approved_by?: string | null
          provider_ref?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          payment_id?: string | null
          refund_type?: RefundTypeT
          requested_by?: string | null
          reason?: string
          amount?: number
          status?: RefundStatusT
          approved_by?: string | null
          provider_ref?: string | null
          created_at?: string
          resolved_at?: string | null
        }
      }
      invoice_requests: {
        Row: {
          id: string
          order_id: string
          tax_code: string
          company_name: string
          address: string
          email: string
          status: InvoiceStatusT
          invoice_ref: string | null
          requested_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          tax_code: string
          company_name: string
          address: string
          email: string
          status?: InvoiceStatusT
          invoice_ref?: string | null
          requested_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          tax_code?: string
          company_name?: string
          address?: string
          email?: string
          status?: InvoiceStatusT
          invoice_ref?: string | null
          requested_at?: string
          resolved_at?: string | null
        }
      }
      support_requests: {
        Row: {
          id: string
          order_id: string
          type: SupportTypeT
          description: string
          status: SupportStatusT
          created_by: string | null
          guest_access_hash: string | null
          assigned_to: string | null
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          type: SupportTypeT
          description: string
          status?: SupportStatusT
          created_by?: string | null
          guest_access_hash?: string | null
          assigned_to?: string | null
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          type?: SupportTypeT
          description?: string
          status?: SupportStatusT
          created_by?: string | null
          guest_access_hash?: string | null
          assigned_to?: string | null
          created_at?: string
          resolved_at?: string | null
        }
      }
      order_access_challenges: {
        Row: {
          id: string
          order_id: string
          channel: ChallengeChannelT
          destination_hash: string
          otp_hash: string
          token_hash: string
          expires_at: string
          attempts: number
          verified_at: string | null
        }
        Insert: {
          id?: string
          order_id: string
          channel?: ChallengeChannelT
          destination_hash: string
          otp_hash: string
          token_hash: string
          expires_at: string
          attempts?: number
          verified_at?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          channel?: ChallengeChannelT
          destination_hash?: string
          otp_hash?: string
          token_hash?: string
          expires_at?: string
          attempts?: number
          verified_at?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          entity_type: string
          entity_id: string
          before_data: Json | null
          after_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          entity_type: string
          entity_id: string
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string
          before_data?: Json | null
          after_data?: Json | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hold_seats: {
        Args: {
          p_showtime_id: string
          p_seat_ids: string[]
          p_user_id: string | null
          p_channel: OrderChannelT
          p_contact_name: string
          p_contact_email: string
          p_contact_phone: string
        }
        Returns: Json
      }
      confirm_order_payment: {
        Args: {
          p_order_id: string
          p_provider: PaymentProviderT
          p_provider_txn_id: string
          p_shift_id?: string | null
          p_received_by?: string | null
        }
        Returns: Json
      }
      check_in_ticket: {
        Args: {
          p_qr_hash: string
          p_staff_id: string
          p_age_check_passed?: boolean
        }
        Returns: Json
      }
      release_expired_holds: {
        Args: Record<string, never>
        Returns: number
      }
      close_shift: {
        Args: {
          p_shift_id: string
          p_counted_cash: number
          p_variance_reason?: string | null
        }
        Returns: Json
      }
    }
    Enums: {
      user_role_t: UserRoleT
      account_status_t: AccountStatusT
      staff_perm_t: StaffPermT
      content_type_t: ContentTypeT
      content_status_t: ContentStatusT
      age_rating_t: AgeRatingT
      movie_status_t: MovieStatusT
      screen_type_t: ScreenTypeT
      room_status_t: RoomStatusT
      seat_type_t: SeatTypeT
      seat_status_t: SeatStatusT
      showtime_status_t: ShowtimeStatusT
      audience_type_t: AudienceTypeT
      showtime_seat_status_t: ShowtimeSeatStatusT
      product_type_t: ProductTypeT
      movement_type_t: MovementTypeT
      discount_type_t: DiscountTypeT
      coupon_scope_t: CouponScopeT
      order_channel_t: OrderChannelT
      order_status_t: OrderStatusT
      order_item_type_t: OrderItemTypeT
      payment_provider_t: PaymentProviderT
      payment_status_t: PaymentStatusT
      ticket_status_t: TicketStatusT
      shift_status_t: ShiftStatusT
      refund_type_t: RefundTypeT
      refund_status_t: RefundStatusT
      invoice_status_t: InvoiceStatusT
      support_type_t: SupportTypeT
      support_status_t: SupportStatusT
      challenge_channel_t: ChallengeChannelT
    }
  }
}
