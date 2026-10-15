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
   * Giải phóng tất cả các ghế đã hết hạn giữ chỗ (held_until < now)
   */
  static async releaseExpiredHolds(): Promise<number> {
    let releasedCount = 0;

    // 1. Giải phóng trong Supabase Database qua Stored Procedure release_expired_holds
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('release_expired_holds');
      if (!error && typeof data === 'number') {
        releasedCount += data;
      }
    } catch (e) {
      // Supabase rpc fallback
    }

    // 2. Giải phóng trong LocalStorage (Client cache)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cinemax_held_seats');
        if (stored) {
          const list = JSON.parse(stored);
          const now = Date.now();
          const valid = list.filter((h: any) => h.expiresAt > now);
          if (valid.length !== list.length) {
            releasedCount += (list.length - valid.length);
            localStorage.setItem('cinemax_held_seats', JSON.stringify(valid));
            window.dispatchEvent(new Event('cinemax_data_updated'));
          }
        }
      } catch (e) {
        console.error('Error cleaning up local held seats:', e);
      }
    }

    return releasedCount;
  }

  /**
   * Lấy danh sách ghế đang bị giữ chỗ (HELD) chưa hết hạn theo suất chiếu
   */
  static getLocalHeldSeats(showtimeId: string | number): Map<string, { expiresAt: number; sessionId: string }> {
    const map = new Map<string, { expiresAt: number; sessionId: string }>();
    if (typeof window === 'undefined') return map;

    try {
      const stored = localStorage.getItem('cinemax_held_seats');
      if (stored) {
        const list = JSON.parse(stored);
        const now = Date.now();
        list.forEach((h: any) => {
          if (h.showtimeId?.toString() === showtimeId?.toString() && h.expiresAt > now) {
            (h.seats || []).forEach((seatLabel: string) => {
              map.set(seatLabel, { expiresAt: h.expiresAt, sessionId: h.sessionId });
            });
          }
        });
      }
    } catch (e) {
      console.error('Error reading local held seats:', e);
    }

    return map;
  }

  /**
   * Giữ ghế tạm thời (HELD) 10 phút chống đặt trùng đồng thời
   */
  static holdSeatsLocal(params: {
    showtimeId: string | number;
    sessionId: string;
    seatLabels: string[];
    holdMinutes?: number;
  }): { success: boolean; error?: string; expiresAt: number } {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Chỉ hỗ trợ trên client', expiresAt: 0 };
    }

    const holdMinutes = params.holdMinutes || 10;
    const expiresAt = Date.now() + holdMinutes * 60 * 1000;

    try {
      // 1. Kiểm tra vé đã thanh toán
      const storedTickets = localStorage.getItem('cinemax_user_tickets');
      const tickets = storedTickets ? JSON.parse(storedTickets) : [];
      const bookedSeats = new Set<string>();
      tickets.forEach((t: any) => {
        if (t.showtimeId?.toString() === params.showtimeId?.toString()) {
          if (Array.isArray(t.seats)) t.seats.forEach((s: string) => bookedSeats.add(s.trim()));
          else if (typeof t.seats === 'string') t.seats.split(',').forEach((s: string) => bookedSeats.add(s.trim()));
        }
      });

      for (const seat of params.seatLabels) {
        if (bookedSeats.has(seat)) {
          return {
            success: false,
            error: `Ghế ${seat} đã được đặt thành công bởi người khác. Vui lòng chọn ghế khác!`,
            expiresAt: 0,
          };
        }
      }

      // 2. Kiểm tra ghế đang bị giữ bởi phiên khác còn hạn
      const storedHolds = localStorage.getItem('cinemax_held_seats');
      const holds = storedHolds ? JSON.parse(storedHolds) : [];
      const now = Date.now();
      const validHolds = holds.filter((h: any) => h.expiresAt > now);

      for (const h of validHolds) {
        if (h.showtimeId?.toString() === params.showtimeId?.toString() && h.sessionId !== params.sessionId) {
          for (const s of h.seats || []) {
            if (params.seatLabels.includes(s)) {
              return {
                success: false,
                error: `Ghế ${s} đang được tạm giữ trong phiên thanh toán khác. Vui lòng chọn ghế khác!`,
                expiresAt: 0,
              };
            }
          }
        }
      }

      // 3. Cập nhật hoặc thêm phiên giữ ghế mới
      const otherHolds = validHolds.filter((h: any) => h.sessionId !== params.sessionId);
      otherHolds.push({
        showtimeId: params.showtimeId,
        sessionId: params.sessionId,
        seats: params.seatLabels,
        expiresAt,
      });

      localStorage.setItem('cinemax_held_seats', JSON.stringify(otherHolds));
      window.dispatchEvent(new Event('cinemax_data_updated'));
      window.dispatchEvent(new Event('storage'));

      return { success: true, expiresAt };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Lỗi khi giữ ghế', expiresAt: 0 };
    }
  }

  /**
   * Giải phóng ghế của một phiên cụ thể
   */
  static releaseSessionHold(sessionId: string) {
    if (typeof window === 'undefined') return;
    try {
      const storedHolds = localStorage.getItem('cinemax_held_seats');
      if (storedHolds) {
        const holds = JSON.parse(storedHolds);
        const filtered = holds.filter((h: any) => h.sessionId !== sessionId);
        localStorage.setItem('cinemax_held_seats', JSON.stringify(filtered));
        window.dispatchEvent(new Event('cinemax_data_updated'));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error(e);
    }
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
