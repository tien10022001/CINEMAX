/**
 * HẰNG SỐ CẤU HÌNH HỆ THỐNG CINEMAX
 * Chuẩn kiến trúc rạp đơn theo đề cương HK2T
 */

module.exports = {
  // Cấu hình thời gian
  HOLD_DURATION_MINUTES: 10,
  HOLD_DURATION_MS: 10 * 60 * 1000, // 10 phút giữ ghế
  CLEANING_BUFFER_MINUTES: 15,       // 15 phút dọn rạp giữa 2 ca
  CANCELLATION_DEADLINE_MINUTES: 60, // Hủy/đổi vé trước giờ chiếu ít nhất 60 phút

  // Tỷ lệ tích điểm hội viên
  LOYALTY_RATE: 0.05, // 5% giá trị vé
  LOYALTY_REDEMPTION_RATE: 1, // 1 điểm = 1.000 VNĐ

  // Giá vé gốc theo hạng ghế (VND)
  BASE_SEAT_PRICES: {
    STANDARD: 90000,
    VIP: 110000,
    COUPLE: 210000, // Giá cho trọn cặp ghế đôi
    WHEELCHAIR: 70000
  },

  // Hệ số giá theo đối tượng khán giả
  AUDIENCE_MULTIPLIERS: {
    ADULT: 1.0,         // Người lớn: 100%
    STUDENT_U22: 0.85,  // HSSV / U22: giảm 15%
    CHILD: 0.75,        // Trẻ em: giảm 25%
    SENIOR: 0.75        // Người cao tuổi: giảm 25%
  },

  // Trạng thái ghế
  SEAT_STATUS: {
    AVAILABLE: 'available',
    HELD: 'held',
    SOLD: 'sold',
    BLOCKED: 'blocked'
  },

  // Phân loại độ tuổi phim
  AGE_RATINGS: {
    P: 'Phổ biến cho mọi đối tượng',
    K: 'Khán giả dưới 13 tuổi có người giám hộ đi kèm',
    T13: 'Khán giả từ 13 tuổi trở lên',
    T16: 'Khán giả từ 16 tuổi trở lên',
    T18: 'Khán giả từ 18 tuổi trở lên'
  }
};
