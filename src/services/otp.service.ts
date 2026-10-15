import { createClient as baseCreateClient } from '@/lib/supabase/client';

const createClient = (): any => baseCreateClient();

export interface LookupChallengeResult {
  success: boolean;
  message: string;
  challengeId?: string;
  orderId?: string;
  debugOtp?: string; // Dùng để test demo trên môi trường dev khi chưa tích hợp SMS/Email Gateway thật
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  order?: any;
  tickets?: any[];
}

export class OtpService {
  /**
   * Tạo challenge tra cứu vé Zero-Leakage (Bảo vệ thông tin khách hàng)
   */
  static async requestLookupOtp(orderCode: string, contact: string): Promise<LookupChallengeResult> {
    const supabase = createClient();
    const cleanCode = orderCode.trim().toUpperCase();
    const cleanContact = contact.trim();

    // 1. Tìm đơn hàng khớp mã đơn và email hoặc số điện thoại
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_code, contact_email, contact_phone')
      .eq('order_code', cleanCode)
      .single();

    // Zero-Leakage: Luôn phản hồi thông báo thành công chung
    const genericResponse: LookupChallengeResult = {
      success: true,
      message: 'Nếu mã đơn hàng và thông tin liên hệ chính xác, mã xác thực OTP đã được gửi đến bạn.',
    };

    if (error || !order) {
      return genericResponse;
    }

    // Kiểm tra liên hệ có khớp email hoặc phone không
    const matchEmail = order.contact_email?.toLowerCase() === cleanContact.toLowerCase();
    const matchPhone = order.contact_phone === cleanContact;
    if (!matchEmail && !matchPhone) {
      return genericResponse;
    }

    // 2. Sinh mã OTP 6 số ngẫu nhiên
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 phút

    // Đơn giản hóa hash lưu trữ cho demo MVP
    const otpHash = btoa(`otp_${otp}_salt_${cleanCode}`);
    const tokenHash = btoa(`token_${Date.now()}_${cleanCode}`);
    const destHash = btoa(cleanContact);

    // Xóa các challenge cũ của đơn hàng này
    await supabase.from('order_access_challenges').delete().eq('order_id', order.id);

    // Lưu challenge mới
    const { data: challenge, error: cErr } = await supabase
      .from('order_access_challenges')
      .insert({
        order_id: order.id,
        channel: matchEmail ? 'email' : 'sms',
        destination_hash: destHash,
        otp_hash: otpHash,
        token_hash: tokenHash,
        expires_at: expiresAt,
        attempts: 0,
      })
      .select('id')
      .single();

    if (cErr || !challenge) {
      console.error('Error creating challenge:', cErr);
      return genericResponse;
    }

    return {
      success: true,
      message: genericResponse.message,
      challengeId: challenge.id,
      orderId: order.id,
      debugOtp: otp, // Trả về để hiện gợi ý thử nghiệm trên giao diện
    };
  }

  /**
   * Xác thực mã OTP tra cứu đơn hàng
   */
  static async verifyLookupOtp(challengeId: string, inputOtp: string): Promise<VerifyOtpResult> {
    const supabase = createClient();

    // 1. Lấy challenge
    const { data: challenge, error } = await supabase
      .from('order_access_challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (error || !challenge) {
      return { success: false, message: 'Yêu cầu tra cứu không tồn tại hoặc đã hết hạn.' };
    }

    // 2. Kiểm tra số lần thử sai
    if (challenge.attempts >= 5) {
      return { success: false, message: 'Bạn đã nhập sai quá 5 lần. Yêu cầu tra cứu này đã bị khóa vì lý do bảo mật!' };
    }

    // 3. Kiểm tra thời hạn
    if (new Date(challenge.expires_at) < new Date()) {
      return { success: false, message: 'Mã OTP đã hết thời hạn 10 phút. Vui lòng yêu cầu mã mới.' };
    }

    // 4. So khớp OTP
    const cleanOtp = inputOtp.trim();
    let isMatch = false;
    try {
      const decoded = atob(challenge.otp_hash);
      isMatch = decoded.startsWith(`otp_${cleanOtp}_`);
    } catch {
      isMatch = false;
    }

    if (!isMatch) {
      // Tăng số lần thử sai
      await supabase
        .from('order_access_challenges')
        .update({ attempts: challenge.attempts + 1 })
        .eq('id', challengeId);

      return {
        success: false,
        message: `Mã OTP không chính xác. Bạn còn ${4 - challenge.attempts} lần thử lại.`,
      };
    }

    // 5. Xác minh thành công -> Đánh dấu verified
    await supabase
      .from('order_access_challenges')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', challengeId);

    // 6. Lấy thông tin đơn hàng và vé chi tiết
    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          showtimes (
            starts_at,
            ends_at,
            auditoriums (name),
            movies (title, poster_url)
          )
        )
      `)
      .eq('id', challenge.order_id)
      .single();

    const { data: tickets } = await supabase
      .from('tickets')
      .select(`
        id,
        qr_token_hash,
        status,
        order_items!inner (
          order_id,
          item_snapshot
        )
      `)
      .eq('order_items.order_id', challenge.order_id);

    return {
      success: true,
      message: 'Xác thực mã OTP thành công!',
      order,
      tickets: tickets || [],
    };
  }
}
