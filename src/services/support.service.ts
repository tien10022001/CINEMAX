import { createClient as baseCreateClient } from '@/lib/supabase/client';
import type { SupportTypeT } from '@/types/database';

const createClient = (): any => baseCreateClient();

export interface CreateSupportInput {
  orderCode?: string;
  type: SupportTypeT;
  description: string;
  contactEmailOrPhone: string;
}

export class SupportService {
  /**
   * Tạo yêu cầu hỗ trợ (mất vé, đổi suất, sự cố thanh toán) lưu vào bảng support_requests
   */
  static async createRequest(input: CreateSupportInput) {
    const supabase = createClient();
    let orderId: string | null = null;

    if (input.orderCode?.trim()) {
      const { data: order } = await supabase
        .from('orders')
        .select('id')
        .eq('order_code', input.orderCode.trim().toUpperCase())
        .single();
      if (order) orderId = order.id;
    }

    // Nếu không có orderId liên kết, lấy 1 order đầu tiên hoặc để id mặc định nếu DB yêu cầu NOT NULL
    if (!orderId) {
      const { data: firstOrder } = await supabase.from('orders').select('id').limit(1).single();
      orderId = firstOrder?.id || null;
    }

    if (!orderId) {
      throw new Error('Hệ thống chưa có đơn hàng nào để tạo khiếu nại.');
    }

    const { data, error } = await supabase.from('support_requests').insert({
      order_id: orderId,
      type: input.type,
      description: `[Liên hệ: ${input.contactEmailOrPhone}] ${input.description}`,
      status: 'pending',
    }).select('id').single();

    if (error) {
      console.error('Error creating support request:', error);
      throw new Error(error.message || 'Không thể gửi yêu cầu hỗ trợ');
    }

    return {
      success: true,
      requestId: data?.id,
      message: 'Yêu cầu hỗ trợ của bạn đã được tiếp nhận thành công. Nhân viên rạp sẽ liên hệ lại sớm nhất!',
    };
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
