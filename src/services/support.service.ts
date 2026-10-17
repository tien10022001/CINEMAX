import { createClient as baseCreateClient } from '@/lib/supabase/client';
import type { SupportTypeT } from '@/types/database';

const createClient = (): any => baseCreateClient();

export interface CreateSupportInput {
  orderCode?: string;
  type: SupportTypeT | string;
  description: string;
  contactEmailOrPhone: string;
  verifiedOrder?: any;
}

export interface VerifyOrderResult {
  success: boolean;
  found: boolean;
  order?: any;
  message?: string;
}

export class SupportService {
  /**
   * 1. Đối chiếu với dữ liệu hệ thống để xác nhận trước khi gửi yêu cầu
   */
  static async verifyOrder(params: { orderCode?: string; contact: string }): Promise<VerifyOrderResult> {
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          orderCode: params.orderCode,
          contact: params.contact,
        }),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.warn('Lỗi khi gọi API đối chiếu:', err);
      return {
        success: false,
        found: false,
        message: 'Lỗi kết nối khi đối chiếu dữ liệu.',
      };
    }
  }

  /**
   * 2. Tạo đường truyền gửi yêu cầu hỗ trợ lên Admin xét duyệt
   */
  static async createRequest(input: CreateSupportInput) {
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          type: input.type,
          orderCode: input.orderCode,
          contact: input.contactEmailOrPhone,
          description: input.description,
          verifiedOrder: input.verifiedOrder,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể gửi yêu cầu hỗ trợ lên hệ thống.');
      }

      return {
        success: true,
        requestId: data.requestId,
        message: data.message,
      };
    } catch (err: any) {
      console.error('Error creating support request:', err);
      throw new Error(err.message || 'Lỗi kết nối khi truyền dữ liệu lên Admin.');
    }
  }

  /**
   * 3. Lấy toàn bộ danh sách yêu cầu hỗ trợ cho Admin
   */
  static async getAllRequests() {
    try {
      const res = await fetch('/api/support');
      const data = await res.json();
      return data.success ? data.data : [];
    } catch (err) {
      console.error('Error fetching support requests for admin:', err);
      return [];
    }
  }

  /**
   * 4. Admin duyệt yêu cầu hỗ trợ (Xử lý hoàn tất hoặc gửi lại vé)
   */
  static async approveRequest(requestId: string, adminNote = '', isResendTicket = false) {
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isResendTicket ? 'resend_ticket' : 'approve',
          requestId,
          adminNote,
        }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * 5. Admin từ chối yêu cầu hỗ trợ
   */
  static async rejectRequest(requestId: string, adminNote = '') {
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          requestId,
          adminNote,
        }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Chuyển đổi Khách vãng lai sang Thành viên (Liên kết đơn hàng vào tài khoản & Tích điểm)
   */
  static async linkGuestOrderToMember(orderCode: string, userId: string) {
    const supabase = createClient();
    const cleanCode = orderCode.trim().toUpperCase();

    // 1. Kiểm tra đơn hàng hợp lệ (phải đã thanh toán và chưa thuộc về ai)
    const { data: order, error: oErr } = await supabase
      .from('orders')
      .select('id, total_amount, user_id, status')
      .eq('order_code', cleanCode)
      .single();

    if (oErr || !order) {
      return { success: false, message: 'Không tìm thấy đơn hàng với mã này.' };
    }

    if (order.user_id) {
      return { success: false, message: 'Đơn hàng này đã được liên kết với một tài khoản khác trước đó.' };
    }

    if (order.status !== 'paid') {
      return { success: false, message: 'Chỉ đơn hàng đã thanh toán thành công mới được tích điểm hội viên.' };
    }

    // 2. Gắn user_id vào orders
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ user_id: userId })
      .eq('id', order.id);

    if (updateErr) {
      return { success: false, message: 'Lỗi khi liên kết đơn hàng: ' + updateErr.message };
    }

    // 3. Tích lũy 5% điểm thưởng vào profiles
    const pointsEarned = Math.floor(order.total_amount * 0.05);
    if (pointsEarned > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('loyalty_points')
        .eq('id', userId)
        .single();

      const currentPoints = profile?.loyalty_points || 0;
      await supabase
        .from('profiles')
        .update({ loyalty_points: currentPoints + pointsEarned })
        .eq('id', userId);
    }

    return {
      success: true,
      pointsEarned,
      message: `Liên kết đơn hàng thành công! Bạn nhận được ${pointsEarned.toLocaleString('vi-VN')} điểm tích lũy vào tài khoản.`,
    };
  }
}
