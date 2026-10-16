/**
 * Dịch vụ Sinh Mã QR Vé & Soát Vé / In Vé Điện Tử (Ticket Scanner & Kiosk Print Service)
 * Mã QR trên vé được tối ưu hóa cho máy quét barcode 2D tại Kiosk in vé và đầu đọc soát vé tại cửa phòng chiếu.
 */

export interface TicketValidationResult {
  valid: boolean;
  ticket?: any;
  message: string;
  action: 'ALLOW_ENTRY' | 'ALREADY_CHECKED_IN' | 'NOT_PAID' | 'NOT_FOUND';
  checkedInAt?: string;
  printedAt?: string;
}

export class TicketScannerService {
  /**
   * Sinh đường dẫn ảnh QR Code thật (chuẩn ma trận điểm ISO/IEC 18004)
   * Chứa mã định danh duy nhất của vé để máy quét Kiosk và máy soát vé đọc tức thì (<0.1s)
   */
  public static generateTicketQrUrl(bookingCode: string, size: number = 250): string {
    const cleanCode = (bookingCode || 'CINEMAX-TKT').trim().toUpperCase();
    // Mã hóa dữ liệu tối giản dạng CINEMAX:TKT:{bookingCode} hoặc bookingCode thuần túy
    const payload = `CINEMAX:TKT:${cleanCode}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(
      payload
    )}`;
  }

  /**
   * Kiểm tra và Soát vé tại cửa phòng chiếu (Check-in Scanner)
   * Chống việc 1 vé chụp màn hình vào xem nhiều lần
   */
  public static checkInTicket(rawCode: string): TicketValidationResult {
    if (typeof window === 'undefined') {
      return { valid: false, message: 'Môi trường không hợp lệ', action: 'NOT_FOUND' };
    }

    // Xử lý mã thô từ máy quét (có thể là "CINEMAX:TKT:CNM..." hoặc chỉ "CNM...")
    let cleanCode = rawCode.trim().toUpperCase();
    if (cleanCode.startsWith('CINEMAX:TKT:')) {
      cleanCode = cleanCode.replace('CINEMAX:TKT:', '');
    }

    try {
      const stored = localStorage.getItem('cinemax_user_tickets');
      if (!stored) {
        return { valid: false, message: 'Không tìm thấy vé trong hệ thống', action: 'NOT_FOUND' };
      }

      const tickets: any[] = JSON.parse(stored);
      const ticketIdx = tickets.findIndex(
        (t) => t.bookingCode?.toUpperCase() === cleanCode || t.id === cleanCode
      );

      if (ticketIdx === -1) {
        return { valid: false, message: `Mã vé ${cleanCode} không tồn tại trên hệ thống!`, action: 'NOT_FOUND' };
      }

      const ticket = tickets[ticketIdx];

      // 1. Kiểm tra trạng thái thanh toán
      if (ticket.status !== 'ĐÃ THANH TOÁN' && ticket.status !== 'ĐÃ SOÁT VÉ') {
        return {
          valid: false,
          ticket,
          message: `Vé ${cleanCode} chưa hoàn tất thanh toán (Trạng thái: ${ticket.status})`,
          action: 'NOT_PAID',
        };
      }

      // 2. Kiểm tra xem vé đã qua cửa chưa (Chống gian lận 1 vé vào 2 lần)
      if (ticket.isCheckedIn || ticket.status === 'ĐÃ SOÁT VÉ') {
        return {
          valid: false,
          ticket,
          message: `CẢNH BÁO: Vé ${cleanCode} đã được soát vào cửa lúc ${ticket.checkedInAt || 'trước đó'}! Không được vào lại.`,
          action: 'ALREADY_CHECKED_IN',
          checkedInAt: ticket.checkedInAt,
        };
      }

      // 3. Đánh dấu soát vé thành công
      const checkInTime =
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' • ' +
        new Date().toLocaleDateString('vi-VN');

      tickets[ticketIdx] = {
        ...ticket,
        status: 'ĐÃ SOÁT VÉ',
        isCheckedIn: true,
        checkedInAt: checkInTime,
      };

      localStorage.setItem('cinemax_user_tickets', JSON.stringify(tickets));
      window.dispatchEvent(new Event('cinemax_data_updated'));
      window.dispatchEvent(new Event('storage'));

      return {
        valid: true,
        ticket: tickets[ticketIdx],
        message: `VÉ HỢP LỆ! Chào mừng khách vào xem phim [${ticket.movieTitle}]. Ghế: ${ticket.seatsStr || ticket.seats}`,
        action: 'ALLOW_ENTRY',
        checkedInAt: checkInTime,
      };
    } catch (e: any) {
      return { valid: false, message: e.message || 'Lỗi xử lý kiểm tra vé', action: 'NOT_FOUND' };
    }
  }

  /**
   * Đánh dấu in vé tại Kiosk (Kiosk Ticket Print)
   */
  public static markAsPrinted(rawCode: string): boolean {
    if (typeof window === 'undefined') return false;

    let cleanCode = rawCode.trim().toUpperCase();
    if (cleanCode.startsWith('CINEMAX:TKT:')) {
      cleanCode = cleanCode.replace('CINEMAX:TKT:', '');
    }

    try {
      const stored = localStorage.getItem('cinemax_user_tickets');
      if (!stored) return false;

      const tickets: any[] = JSON.parse(stored);
      const ticketIdx = tickets.findIndex(
        (t) => t.bookingCode?.toUpperCase() === cleanCode || t.id === cleanCode
      );

      if (ticketIdx === -1) return false;

      const printTime =
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' • ' +
        new Date().toLocaleDateString('vi-VN');

      tickets[ticketIdx] = {
        ...tickets[ticketIdx],
        isPrinted: true,
        printedAt: printTime,
      };

      localStorage.setItem('cinemax_user_tickets', JSON.stringify(tickets));
      window.dispatchEvent(new Event('cinemax_data_updated'));
      window.dispatchEvent(new Event('storage'));
      return true;
    } catch (e) {
      return false;
    }
  }
}
