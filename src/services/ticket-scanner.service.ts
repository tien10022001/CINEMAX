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

  /**
   * Tải vé điện tử dưới dạng PDF chuẩn A5 (cô lập vé, không in giao diện web)
   */
  public static downloadTicketPdf(ticket: {
    bookingCode: string;
    movieTitle: string;
    cinemaName: string;
    roomName?: string;
    showtime: string;
    seats: string | string[];
    totalAmount?: number;
    userName?: string;
    customerName?: string;
    customerPhone?: string;
    userPhone?: string;
    foodsStr?: string;
    ageRating?: string;
    age_rating?: string;
    format?: string;
    isCheckedIn?: boolean;
    status?: string;
  }): void {
    if (typeof window === 'undefined') return;

    const existingFrame = document.getElementById('cinemax-print-ticket-frame');
    if (existingFrame) existingFrame.remove();

    const printFrame = document.createElement('iframe');
    printFrame.id = 'cinemax-print-ticket-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (!frameDoc) {
      window.print();
      return;
    }

    const seatsDisplay = Array.isArray(ticket.seats) ? ticket.seats.join(', ') : (ticket.seats || 'Chưa chọn');
    const ageRating = ticket.ageRating || ticket.age_rating || 'P';
    const formatDisplay = ticket.format || (ticket.roomName?.includes('IMAX') ? 'IMAX LASER 2D' : '2D DIGITAL');
    const qrUrl = this.generateTicketQrUrl(ticket.bookingCode, 220);
    const isUsed = ticket.isCheckedIn || ticket.status === 'ĐÃ SOÁT VÉ';
    const customer = ticket.customerName || ticket.userName || 'Khách xem phim';
    const phone = ticket.customerPhone || ticket.userPhone || '';

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Ve_Xem_Phim_${ticket.bookingCode}</title>
        <style>
          @page { size: A5 portrait; margin: 8mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            color: #111827;
            margin: 0;
            padding: 10px;
          }
          .ticket-card {
            max-width: 460px;
            margin: 0 auto;
            border: 2px dashed #cbd5e1;
            border-radius: 20px;
            padding: 22px;
            background: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .brand-header {
            text-align: center;
            border-bottom: 2px solid #f1f5f9;
            padding-bottom: 14px;
            margin-bottom: 14px;
          }
          .brand-name {
            font-size: 22px;
            font-weight: 900;
            color: #e63845;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .ticket-type {
            font-size: 12px;
            font-weight: 700;
            color: #64748b;
            margin-top: 4px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .movie-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            margin: 10px 0 6px 0;
            text-align: center;
            line-height: 1.3;
          }
          .movie-badges {
            text-align: center;
            margin-bottom: 14px;
          }
          .badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 6px;
            margin: 0 4px;
          }
          .badge-rating { background: #fee2e2; color: #dc2626; }
          .badge-format { background: #e0f2fe; color: #0284c7; }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 13px;
          }
          .info-table td {
            padding: 5px 0;
            border-bottom: 1px solid #f8fafc;
          }
          .info-label {
            color: #64748b;
            font-size: 12px;
            width: 35%;
          }
          .info-val {
            color: #0f172a;
            font-weight: 600;
            text-align: right;
          }
          .seat-box {
            background: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 14px;
            padding: 12px;
            text-align: center;
            margin: 14px 0;
          }
          .seat-label {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 1px;
          }
          .seat-number {
            font-size: 24px;
            font-weight: 900;
            color: #0284c7;
            margin-top: 2px;
          }
          .qr-container {
            text-align: center;
            margin-top: 14px;
            padding-top: 14px;
            border-top: 2px dashed #e2e8f0;
          }
          .qr-img {
            width: 150px;
            height: 150px;
            margin: 0 auto;
            display: block;
            border-radius: 8px;
          }
          .booking-code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 15px;
            font-weight: 900;
            letter-spacing: 2px;
            margin-top: 8px;
            color: #0f172a;
            background: #f1f5f9;
            padding: 5px 12px;
            border-radius: 8px;
            display: inline-block;
          }
          .status-tag {
            font-size: 11px;
            color: #16a34a;
            font-weight: 800;
            margin-top: 6px;
            text-transform: uppercase;
          }
          .notice {
            font-size: 10px;
            color: #94a3b8;
            text-align: center;
            margin-top: 14px;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="ticket-card">
          <div class="brand-header">
            <div class="brand-name">CINEMAX THEATER</div>
            <div class="ticket-type">VÉ XEM PHIM ĐIỆN TỬ (E-TICKET)</div>
          </div>
          
          <div class="movie-title">${ticket.movieTitle}</div>
          <div class="movie-badges">
            <span class="badge badge-rating">${ageRating}</span>
            <span class="badge badge-format">${formatDisplay}</span>
          </div>

          <table class="info-table">
            <tr>
              <td class="info-label">Rạp chiếu:</td>
              <td class="info-val">${ticket.cinemaName}</td>
            </tr>
            <tr>
              <td class="info-label">Phòng chiếu:</td>
              <td class="info-val">${ticket.roomName || 'Phòng chiếu tiêu chuẩn'}</td>
            </tr>
            <tr>
              <td class="info-label">Suất chiếu:</td>
              <td class="info-val" style="font-family: monospace; font-size: 14px;">${ticket.showtime}</td>
            </tr>
            <tr>
              <td class="info-label">Khách hàng:</td>
              <td class="info-val">${customer} ${phone ? `(${phone})` : ''}</td>
            </tr>
            ${ticket.totalAmount !== undefined ? `
            <tr>
              <td class="info-label">Tổng thanh toán:</td>
              <td class="info-val" style="color: #16a34a; font-size: 14px; font-weight: 800;">${ticket.totalAmount.toLocaleString('vi-VN')} đ</td>
            </tr>` : ''}
          </table>

          <div class="seat-box">
            <div class="seat-label">Ghế ngồi đã đặt</div>
            <div class="seat-number">${seatsDisplay}</div>
          </div>

          ${ticket.foodsStr ? `
          <div class="seat-box" style="margin-top: 6px; background: #fffbeb; border-color: #fde68a;">
            <div class="seat-label" style="color: #d97706;">Bắp nước đi kèm</div>
            <div style="font-weight: 700; font-size: 12px; color: #b45309; margin-top: 2px;">${ticket.foodsStr}</div>
          </div>` : ''}

          <div class="qr-container">
            <img src="${qrUrl}" class="qr-img" alt="QR Code" />
            <div><span class="booking-code">${ticket.bookingCode}</span></div>
            <div class="status-tag">
              ● ${isUsed ? 'VÉ ĐÃ DÙNG (USED)' : 'HỢP LỆ — SẴN SÀNG VÀO RẠP'}
            </div>
          </div>

          <div class="notice">
            Mã QR dùng để quét trực tiếp tại cửa soát vé vào phòng chiếu. Quý khách vui lòng lưu file PDF này về điện thoại để xuất trình khi đến rạp.
          </div>
        </div>
      </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (e) {
        console.error('Print ticket frame error:', e);
      }
      setTimeout(() => {
        printFrame.remove();
      }, 3000);
    }, 400);
  }
}
