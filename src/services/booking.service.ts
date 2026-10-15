import { createClient as baseCreateClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

const createClient = (): any => baseCreateClient();

export type SeatWithStatus = {
  id: string; // seat_id
  row_label: string;
  seat_number: number;
  grid_row: number;
  grid_col: number;
  seat_type: string;
  seat_group: string | null;
  status: 'available' | 'held' | 'sold' | 'blocked';
  held_until: string | null;
};

export type HoldSeatsParams = {
  showtimeId: string;
  seatIds: string[];
  userId?: string | null;
  channel?: 'online' | 'pos';
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export type HoldSeatsResult = {
  success: boolean;
  order_id: string;
  order_code: string;
  guest_access_hash?: string;
  subtotal: number;
  expires_at: string;
  message?: string;
};

export class BookingService {
  /**
   * Lấy sơ đồ ghế và trạng thái theo suất chiếu thực tế
   */
  static async getShowtimeSeats(showtimeId: string): Promise<SeatWithStatus[]> {
    const supabase = createClient();

    // 1. Lấy trạng thái ghế từ showtime_seats
    const { data: showtimeSeats, error: ssErr } = await supabase
      .from('showtime_seats')
      .select('seat_id, status, held_until')
      .eq('showtime_id', showtimeId);

    if (ssErr) {
      console.error('Error fetching showtime_seats:', ssErr);
      return [];
    }

    // 2. Lấy thông tin tọa độ ghế từ seats
    const seatIds = (showtimeSeats || []).map((ss: any) => ss.seat_id);
    if (seatIds.length === 0) return [];

    const { data: seats, error: sErr } = await supabase
      .from('seats')
      .select('id, row_label, seat_number, grid_row, grid_col, seat_type, seat_group')
      .in('id', seatIds)
      .order('grid_row', { ascending: true })
      .order('grid_col', { ascending: true });

    if (sErr) {
      console.error('Error fetching seats info:', sErr);
      return [];
    }

    const ssMap = new Map((showtimeSeats || []).map((item: any) => [item.seat_id, item]));

    return (seats || []).map((seat: any) => {
      const ss: any = ssMap.get(seat.id);
      return {
        id: seat.id,
        row_label: seat.row_label,
        seat_number: seat.seat_number,
        grid_row: seat.grid_row,
        grid_col: seat.grid_col,
        seat_type: seat.seat_type,
        seat_group: seat.seat_group,
        status: ss ? ss.status : 'available',
        held_until: ss?.held_until || null,
      };
    });
  }

  /**
   * Lấy danh sách Combo bắp nước thực tế từ bảng products
   */
  static async getProducts() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_modifiers (*)
      `)
      .eq('active', true)
      .order('base_price', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Lấy danh sách mã giảm giá hợp lệ từ bảng coupons
   */
  static async getCoupons() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('active', true)
      .gte('ends_at', new Date().toISOString());

    if (error) {
      console.error('Error fetching coupons:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Gọi Stored Procedure nguyên tử hold_seats để khóa ghế 10 phút và tạo đơn
   */
  static async holdSeats(params: HoldSeatsParams): Promise<HoldSeatsResult> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('hold_seats', {
      p_showtime_id: params.showtimeId,
      p_seat_ids: params.seatIds,
      p_user_id: params.userId || null,
      p_channel: params.channel || 'online',
      p_contact_name: params.contactName,
      p_contact_email: params.contactEmail,
      p_contact_phone: params.contactPhone,
    });

    if (error) {
      console.error('Error calling hold_seats RPC:', error);
      throw new Error(error.message || 'Không thể giữ ghế. Vui lòng chọn ghế khác!');
    }

    const res = data as any;
    return {
      success: true,
      order_id: res.order_id,
      order_code: res.order_code,
      guest_access_hash: res.guest_access_hash,
      subtotal: Number(res.subtotal),
      expires_at: res.expires_at,
    };
  }

  /**
   * Hủy đơn giữ chỗ và giải phóng ghế tức thì
   */
  static async cancelOrder(orderId: string): Promise<boolean> {
    const supabase = createClient();

    // 1. Cập nhật showtime_seats sang available
    await supabase
      .from('showtime_seats')
      .update({ status: 'available', held_until: null, order_id: null })
      .eq('order_id', orderId);

    // 2. Đổi trạng thái đơn sang cancelled
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    return !error;
  }
}
