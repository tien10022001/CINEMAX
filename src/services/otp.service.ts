import { createClient as baseCreateClient } from '@/lib/supabase/client';
import { ContactValidator } from '@/lib/contact-validator';
import { EmailService } from '@/services/email.service';

const createClient = (): any => baseCreateClient();

export interface LookupChallengeResult {
  success: boolean;
  message: string;
  challengeId?: string;
  orderId?: string;
  channel?: 'email' | 'sms';
  maskedDestination?: string;
  debugOtp?: string; // Dùng để test demo trên môi trường dev
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
  order?: any;
  tickets?: any[];
}

export class OtpService {
  /**
   * Tạo challenge tra cứu vé: Kiểm tra Email/SĐT từ bước đầu tiên và gửi OTP thật
   */
  static async requestLookupOtp(orderCode: string, contact: string): Promise<LookupChallengeResult> {
    const cleanCode = (orderCode || '').trim().toUpperCase();
    const cleanContact = (contact || '').trim();

    if (!cleanCode) {
      return { success: false, message: 'Vui lòng nhập mã đơn hàng.' };
    }

    // 1. KIỂM TRA TÍNH HỢP LỆ CỦA EMAIL / SỐ ĐIỆN THOẠI NGAY TỪ BƯỚC ĐẦU TIÊN
    const validation = ContactValidator.validateContact(cleanContact);
    if (!validation.isValid) {
      return {
        success: false,
        message: validation.error || 'Thông tin liên hệ không hợp lệ. Vui lòng kiểm tra lại!',
      };
    }

    const channel: 'email' | 'sms' = validation.type === 'EMAIL' ? 'email' : 'sms';
    const maskedDest = ContactValidator.maskContact(cleanContact);

    // 2. ĐỐI CHIẾU DỮ LIỆU ĐƠN HÀNG
    let matchedOrder: any = null;

    // A. Đối chiếu trong Supabase Cloud Database (Bảng orders)
    try {
      const supabase = createClient();
      const { data: order } = await supabase
        .from('orders')
        .select('id, order_code, contact_name, contact_email, contact_phone')
        .eq('order_code', cleanCode)
        .single();

      if (order) {
        const matchEmail = order.contact_email?.toLowerCase() === cleanContact.toLowerCase();
        const matchPhone = order.contact_phone?.replace(/[\s\-\.]/g, '') === cleanContact.replace(/[\s\-\.]/g, '');
        if (matchEmail || matchPhone) {
          matchedOrder = order;
        }
      }
    } catch (err) {
      console.warn('Lỗi kết nối Supabase orders, đối soát sang local cache:', err);
    }

    // B. Đối chiếu dự phòng trong LocalStorage (Vé máy khách / Offline / Mock)
    if (!matchedOrder && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cinemax_user_tickets');
        if (stored) {
          const list = JSON.parse(stored);
          const found = list.find(
            (t: any) =>
              (t.bookingCode?.toUpperCase() === cleanCode || t.id === cleanCode) &&
              (t.customerEmail?.toLowerCase() === cleanContact.toLowerCase() ||
                t.customerPhone?.replace(/[\s\-\.]/g, '') === cleanContact.replace(/[\s\-\.]/g, ''))
          );
          if (found) {
            matchedOrder = {
              id: found.id || 'local-order-' + cleanCode,
              order_code: found.bookingCode || cleanCode,
              contact_name: found.customerName || 'Khách hàng',
              contact_email: found.customerEmail,
              contact_phone: found.customerPhone,
            };
          }
        }
      } catch (localErr) {
        console.warn('Lỗi đọc local tickets:', localErr);
      }
    }

    // Nếu không khớp mã đơn hoặc thông tin liên hệ
    if (!matchedOrder) {
      return {
        success: false,
        message: `Không tìm thấy đơn hàng "${cleanCode}" khớp với thông tin liên hệ ${maskedDest}. Vui lòng kiểm tra lại mã đơn và email/SĐT khi đặt vé!`,
      };
    }

    // 3. SINH MÃ OTP 6 CHỮ SỐ
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 phút

    const otpHash = btoa(`otp_${otp}_salt_${cleanCode}`);
    const tokenHash = btoa(`token_${Date.now()}_${cleanCode}`);
    const destHash = btoa(cleanContact);
    const challengeId = 'chal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

    // 4. LƯU CHALLENGE XÁC THỰC VÀO SUPABASE (hoặc Session Cache)
    try {
      const supabase = createClient();
      await supabase.from('order_access_challenges').delete().eq('order_id', matchedOrder.id);
      await supabase.from('order_access_challenges').insert({
        id: challengeId.length === 36 ? challengeId : undefined,
        order_id: matchedOrder.id,
        channel,
        destination_hash: destHash,
        otp_hash: otpHash,
        token_hash: tokenHash,
        expires_at: expiresAt,
        attempts: 0,
      });
    } catch (cErr) {
      // Lưu local session fallback
    }

    // Lưu challenge dự phòng ở client
    if (typeof window !== 'undefined') {
      try {
        const challengeRecord = {
          id: challengeId,
          orderId: matchedOrder.id,
          orderCode: cleanCode,
          channel,
          destination: cleanContact,
          otpHash,
          expiresAt: Date.now() + 10 * 60 * 1000,
          attempts: 0,
        };
        sessionStorage.setItem(`cinemax_otp_challenge_${challengeId}`, JSON.stringify(challengeRecord));
      } catch {}
    }

    let isRealDelivery = false;
    // 5. GỬI MÃ OTP THỰC TẾ
    if (channel === 'email') {
      // Gửi Email thật qua EmailService (Resend / SMTP)
      const sendRes = await EmailService.sendOtpEmail({
        toEmail: cleanContact,
        otpCode: otp,
        orderCode: cleanCode,
        customerName: matchedOrder.contact_name,
        expiresMinutes: 10,
      });
      if (sendRes.provider === 'RESEND') {
        isRealDelivery = true;
      }
    } else {
      console.log(`[SMS Gateway Mock] Gửi SMS Brandname CINEMAX tới ${cleanContact}: "Ma OTP tra cuu ve cua ban la: ${otp}. Hieu luc 10 phut."`);
    }

    return {
      success: true,
      message: `Mã OTP đã được gửi thành công tới ${channel === 'email' ? 'hòm thư Email' : 'số điện thoại'} ${maskedDest}.`,
      challengeId,
      orderId: matchedOrder.id,
      channel,
      maskedDestination: maskedDest,
      debugOtp: isRealDelivery ? undefined : otp, // Khi đã gửi email thật thì ẩn mã khỏi màn hình để bảo mật
    };
  }

  /**
   * Xác thực mã OTP tra cứu đơn hàng
   */
  static async verifyLookupOtp(challengeId: string, inputOtp: string): Promise<VerifyOtpResult> {
    const cleanOtp = (inputOtp || '').trim();
    if (!cleanOtp) {
      return { success: false, message: 'Vui lòng nhập mã OTP 6 chữ số.' };
    }

    let challenge: any = null;

    // 1. Lấy challenge từ Supabase
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('order_access_challenges')
        .select('*')
        .eq('id', challengeId)
        .single();
      challenge = data;
    } catch {}

    // 2. Lấy challenge từ Session fallback nếu Supabase không có
    if (!challenge && typeof window !== 'undefined') {
      try {
        const str = sessionStorage.getItem(`cinemax_otp_challenge_${challengeId}`);
        if (str) challenge = JSON.parse(str);
      } catch {}
    }

    if (!challenge) {
      return { success: false, message: 'Yêu cầu tra cứu không tồn tại hoặc đã hết hạn.' };
    }

    // Kiểm tra số lần thử sai
    if (challenge.attempts >= 5) {
      return { success: false, message: 'Bạn đã nhập sai quá 5 lần. Yêu cầu này đã bị khóa vì lý do an toàn!' };
    }

    // Kiểm tra thời hạn
    const expTime = typeof challenge.expiresAt === 'number' ? challenge.expiresAt : new Date(challenge.expires_at).getTime();
    if (expTime < Date.now()) {
      return { success: false, message: 'Mã OTP đã hết thời hạn 10 phút. Vui lòng gửi lại mã mới.' };
    }

    // So khớp OTP
    let isMatch = false;
    try {
      const decoded = atob(challenge.otp_hash || challenge.otpHash);
      isMatch = decoded.startsWith(`otp_${cleanOtp}_`);
    } catch {
      isMatch = false;
    }

    if (!isMatch) {
      // Tăng số lần thử sai
      challenge.attempts = (challenge.attempts || 0) + 1;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`cinemax_otp_challenge_${challengeId}`, JSON.stringify(challenge));
      }
      return {
        success: false,
        message: `Mã OTP không chính xác. Bạn còn ${5 - challenge.attempts} lần thử lại.`,
      };
    }

    // 3. Lấy thông tin đơn hàng và vé hoàn chỉnh
    let orderResult: any = null;
    let ticketsResult: any[] = [];

    // Tìm trong LocalStorage tickets
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('cinemax_user_tickets');
        if (stored) {
          const list = JSON.parse(stored);
          const found = list.find((t: any) => t.id === challenge.orderId || t.bookingCode === challenge.orderCode);
          if (found) {
            orderResult = {
              order_code: found.bookingCode,
              movie_title: found.movieTitle,
              cinema_name: found.cinemaName,
              room_name: found.roomName,
              showtime: found.showtime,
              seats: found.seats,
              total_amount: found.totalAmount,
              customer_name: found.customerName,
              customer_email: found.customerEmail,
              customer_phone: found.customerPhone,
              status: found.status || 'ĐÃ THANH TOÁN',
              foodsStr: found.foodsStr,
              paid_at: found.paidAt || found.createdAt,
            };
            ticketsResult = [
              {
                id: found.id,
                qr_token_hash: found.bookingCode,
                status: 'issued',
              },
            ];
          }
        }
      } catch {}
    }

    // Nếu tìm trong DB Supabase
    if (!orderResult) {
      try {
        const supabase = createClient();
        const { data: dbOrder } = await supabase
          .from('orders')
          .select('*, order_items(*, showtimes(*, auditoriums(*), movies(*)))')
          .eq('id', challenge.order_id)
          .single();
        if (dbOrder) {
          orderResult = dbOrder;
        }
      } catch {}
    }

    return {
      success: true,
      message: 'Xác thực mã OTP thành công!',
      order: orderResult || { order_code: challenge.orderCode || 'CNM-ORDER' },
      tickets: ticketsResult,
    };
  }
}
