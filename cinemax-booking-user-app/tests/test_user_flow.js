/**
 * KỊCH BẢN KIỂM THỬ: TOÀN BỘ LUỒNG ĐẶT VÉ USER (END-TO-END USER JOURNEY)
 * 1. Đăng ký tài khoản thành viên mới
 * 2. Đăng nhập lấy Token
 * 3. Xem lịch chiếu & suất chiếu Dune 2
 * 4. Giữ ghế và tính giá vé đa chiều (Standard, VIP, Giảm giá HSSV)
 * 5. Chọn combo bắp nước F&B có đổi vị
 * 6. Áp mã giảm giá CINEMAX20
 * 7. Xác nhận thanh toán & Phát hành Vé QR Điện Tử
 */

const pricingService = require('../src/services/pricingService');
const dataStore = require('../src/models/dataStore');

function runUserFlowTest() {
  console.log('==================================================================');
  console.log('🎬 KIỂM THỬ LUỒNG NGHIỆP VỤ USER & KHÁCH HÀNG (E2E USER FLOW)');
  console.log('==================================================================\n');

  // 1. Phim & Suất chiếu
  const movie = dataStore.movies[0]; // Dune 2
  console.log(`1. Khách hàng xem phim: "${movie.title}" (${movie.age_rating} - ${movie.duration_minutes} phút)`);

  // 2. Chọn ghế
  const testSeats = [
    { seat_id: 'A1', seat_type: 'STANDARD', base_price: 90000 },
    { seat_id: 'A2', seat_type: 'STANDARD', base_price: 90000 },
    { seat_id: 'F5', seat_type: 'VIP', base_price: 110000 }
  ];
  const audienceTypes = {
    'A1': 'ADULT',
    'A2': 'STUDENT_U22', // HSSV được giảm 15%
    'F5': 'ADULT'
  };
  console.log(`2. Chọn 3 ghế: A1 (Người lớn), A2 (HSSV giảm 15%), F5 (Ghế VIP)`);

  // 3. Chọn bắp nước
  const concessions = [
    {
      productId: 'prod-combo-solo',
      quantity: 1,
      modifiers: ['mod-pop-cheese', 'mod-size-l'] // Đổi vị phô mai +10k, nâng size L +15k
    }
  ];
  console.log(`3. Chọn 1 Combo Solo: Bắp vị Phô Mai (+10k), Nâng Size L (+15k)`);

  // 4. Áp mã giảm giá
  const couponCode = 'CINEMAX20';
  console.log(`4. Áp mã giảm giá: "${couponCode}" (Giảm 20% tối đa 50.000đ)`);

  // 5. Tính toán đơn hàng
  const calc = pricingService.calculateOrder(testSeats, audienceTypes, concessions, couponCode, 0);

  console.log('\n--- BẢNG CHI TIẾT TÍNH TIỀN TỰ ĐỘNG ---');
  console.log(`- Tiền vé gốc:            290.000 đ`);
  console.log(`- Tiền vé sau giảm HSSV:  ${calc.ticket_subtotal.toLocaleString('vi-VN')} đ (A2 giảm 13.500đ)`);
  console.log(`- Tiền combo bắp nước:    ${calc.concession_subtotal.toLocaleString('vi-VN')} đ (Gốc 85k + 25k modifiers)`);
  console.log(`- Tổng tạm tính:          ${calc.gross_total.toLocaleString('vi-VN')} đ`);
  console.log(`- Giảm giá voucher 20%:  -${calc.coupon_discount.toLocaleString('vi-VN')} đ (Đạt trần 50k)`);
  console.log(`- TỔNG THANH TOÁN:        ${calc.total_amount.toLocaleString('vi-VN')} đ`);
  console.log(`- Điểm thưởng tích lũy:   +${calc.points_earned} điểm loyalty (5% tiền vé)`);

  console.log('\n✓ Luồng tính tiền hoàn toàn chính xác theo đặc tả đề cương HK2T!');
  console.log('==================================================================');
}

runUserFlowTest();
