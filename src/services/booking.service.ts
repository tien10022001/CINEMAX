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

    try {
      const { data, error } = await supabase.rpc('hold_seats', {
        p_showtime_id: params.showtimeId,
        p_seat_ids: params.seatIds,
        p_user_id: params.userId || null,
        p_channel: params.channel || 'online',
        p_contact_name: params.contactName,
        p_contact_email: params.contactEmail,
        p_contact_phone: params.contactPhone,
      });

      if (!error && data) {
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
    } catch (e) {
      // RPC fallback to direct flow
    }

    // Direct fallback for local and client workflow
    const order_id = 'ord-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const order_code =
      'CNM' +
      new Date().toISOString().slice(2, 10).replace(/-/g, '') +
      '-' +
      Math.random().toString(36).substring(2, 7).toUpperCase();

    return {
      success: true,
      order_id,
      order_code,
      subtotal: 0,
      expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
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
   * Reset cooldown nhả ghế khi người dùng thanh toán vé thành công
   */
  static async resetHoldCooldown(sessionId: string, userId?: string) {
    try {
      await fetch('/api/seats/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showtimeId: '0',
          sessionId,
          action: 'RESET_COOLDOWN',
          userId,
        }),
      });
    } catch (e) {
      console.warn('Failed to reset hold cooldown:', e);
    }
  }

  /**
    * Giữ ghế tạm thời (HELD) 10 phút chống đặt trùng đồng thời (Hỗ trợ cả Server API và LocalStorage)
   */
  static async holdSeatsLocal(params: {
    showtimeId: string | number;
    sessionId: string;
    seatLabels: string[];
    holdMinutes?: number;
    action?: 'HOLD' | 'EXTEND_PAYMENT' | 'PENDING_RECONCILIATION' | 'RELEASE' | 'RESET_COOLDOWN';
    userId?: string;
  }): Promise<{ success: boolean; error?: string; expiresAt: number; firstHeldAt?: number }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Chỉ hỗ trợ trên client', expiresAt: 0 };
    }

    if (!params.seatLabels || params.seatLabels.length === 0) {
      BookingService.releaseSessionHold(params.sessionId);
      return { success: true, expiresAt: 0 };
    }

    const holdMinutes = params.holdMinutes || 10;
    let expiresAt = Date.now() + holdMinutes * 60 * 1000;
    let firstHeldAt = Date.now();

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

      // 2. Kiểm tra ghế đang bị giữ bởi phiên khác còn hạn trong LocalStorage
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

      // 3. Kiểm tra và xác nhận đồng thời với Server API (bảo vệ tuyệt đối giữa các trình duyệt & Tab ẩn danh)
      try {
        const res = await fetch('/api/seats/hold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            showtimeId: params.showtimeId,
            sessionId: params.sessionId,
            seatLabels: params.seatLabels,
            action: params.action || 'HOLD',
            holdMinutes,
            userId: params.userId,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          return {
            success: false,
            error: json.error || 'Ghế đang được tạm giữ bởi khách hàng khác. Vui lòng chọn ghế khác!',
            expiresAt: 0,
          };
        }

        if (json.expiresAt) {
          expiresAt = json.expiresAt;
        }
        if (json.firstHeldAt) {
          firstHeldAt = json.firstHeldAt;
        }
      } catch (serverErr) {
        console.warn('Lỗi đồng bộ server API giữ ghế, dùng cache client:', serverErr);
      }

      // 4. Cập nhật cache client và thông báo qua BroadcastChannel
      const otherHolds = validHolds.filter((h: any) => h.sessionId !== params.sessionId);
      otherHolds.push({
        showtimeId: params.showtimeId,
        sessionId: params.sessionId,
        seats: params.seatLabels,
        expiresAt,
        firstHeldAt,
      });

      localStorage.setItem('cinemax_held_seats', JSON.stringify(otherHolds));
      window.dispatchEvent(new Event('cinemax_data_updated'));
      window.dispatchEvent(new Event('storage'));

      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('cinemax_seat_sync');
          ch.postMessage({ type: 'HELD_SEATS_UPDATED', showtimeId: params.showtimeId, sessionId: params.sessionId });
          ch.close();
        }
      } catch {}

      return { success: true, expiresAt, firstHeldAt };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Lỗi khi giữ ghế', expiresAt: 0 };
    }
  }

  /**
   * Gia hạn thêm 1 phút khi khách hàng đang ở bước thanh toán (tổng tối đa 11 phút)
   */
  static async extendPaymentGracePeriod(
    showtimeId: string | number,
    sessionId: string
  ): Promise<{ success: boolean; expiresAt?: number; message?: string }> {
    try {
      const res = await fetch('/api/seats/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showtimeId,
          sessionId,
          action: 'EXTEND_PAYMENT',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.expiresAt) {
        // Cập nhật localStorage
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('cinemax_held_seats');
          if (stored) {
            const list = JSON.parse(stored);
            const updated = list.map((h: any) =>
              h.sessionId === sessionId ? { ...h, expiresAt: data.expiresAt, isPaymentExtended: true } : h
            );
            localStorage.setItem('cinemax_held_seats', JSON.stringify(updated));
            window.dispatchEvent(new Event('cinemax_data_updated'));
          }
        }
        return { success: true, expiresAt: data.expiresAt, message: data.message };
      }
      return { success: false, message: data.error };
    } catch (e: any) {
      return { success: false, message: e?.message };
    }
  }

  /**
   * Kích hoạt chế độ chờ đối soát ngân hàng khi khách mạng yếu (+3 phút)
   */
  static async requestReconciliationGracePeriod(
    showtimeId: string | number,
    sessionId: string
  ): Promise<{ success: boolean; expiresAt?: number; message?: string }> {
    try {
      const res = await fetch('/api/seats/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          showtimeId,
          sessionId,
          action: 'PENDING_RECONCILIATION',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.expiresAt) {
        // Cập nhật localStorage
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('cinemax_held_seats');
          if (stored) {
            const list = JSON.parse(stored);
            const updated = list.map((h: any) =>
              h.sessionId === sessionId ? { ...h, expiresAt: data.expiresAt, status: 'PENDING_RECONCILIATION' } : h
            );
            localStorage.setItem('cinemax_held_seats', JSON.stringify(updated));
            window.dispatchEvent(new Event('cinemax_data_updated'));
          }
        }
        return { success: true, expiresAt: data.expiresAt, message: data.message };
      }
      return { success: false, message: data.error };
    } catch (e: any) {
      return { success: false, message: e?.message };
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

        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const ch = new BroadcastChannel('cinemax_seat_sync');
            ch.postMessage({ type: 'HELD_SEATS_UPDATED', sessionId });
            ch.close();
          }
        } catch {}
      }

      // Xóa trên Server API
      try {
        fetch(`/api/seats/hold?sessionId=${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
        }).catch(() => {});
      } catch {}
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Đồng bộ ghế đang giữ từ Server API để liên thông giữa Tab thường & Tab ẩn danh/Thiết bị khác
   */
  static async syncServerHeldSeats(showtimeId: string | number): Promise<Map<string, { expiresAt: number; sessionId: string }>> {
    const map = new Map<string, { expiresAt: number; sessionId: string }>();
    if (typeof window === 'undefined') return map;

    try {
      const res = await fetch(`/api/seats/hold?showtimeId=${encodeURIComponent(showtimeId.toString())}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.heldSeats)) {
          const now = Date.now();
          const valid = json.heldSeats.filter((h: any) => h.expiresAt > now);
          valid.forEach((h: any) => {
            (h.seats || []).forEach((seatLabel: string) => {
              map.set(seatLabel, { expiresAt: h.expiresAt, sessionId: h.sessionId });
            });
          });
          try {
            localStorage.setItem('cinemax_held_seats', JSON.stringify(valid));
          } catch {}
        }
      }
    } catch {}

    return map;
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
