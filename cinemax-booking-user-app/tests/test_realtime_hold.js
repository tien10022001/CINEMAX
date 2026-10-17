/**
 * KỊCH BẢN KIỂM THỬ: GIỮ GHẾ REAL-TIME & CHỐNG RACE CONDITION
 * 1. Test giữ ghế bình thường trong 10 phút
 * 2. Test đồng thời 2 phiên tranh chấp 1 ghế (Race Condition) -> Chỉ 1 người thành công
 * 3. Test tự động gom cặp ghế đôi (Couple seat auto-pair H1+H2)
 * 4. Test chống để trống 1 ghế đơn độc (Orphan Seat Rule)
 * 5. Test tự động giải phóng ghế sau khi hết hạn
 */

const seatHoldManager = require('../src/services/seatHoldManager');
const dataStore = require('../src/models/dataStore');

async function runTests() {
  console.log('==================================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ REAL-TIME SEAT HOLDING & RACE CONDITION');
  console.log('==================================================================\n');

  const testShowtimeId = 'st-test-01';
  dataStore.generateShowtimeSeats(testShowtimeId, 80, 80);

  let passed = 0;
  let failed = 0;

  // TEST 1: Giữ ghế đơn hợp lệ
  console.log('TEST 1: Giữ ghế đơn hợp lệ (A1, A2)');
  const res1 = await seatHoldManager.holdSeats(testShowtimeId, ['A1', 'A2'], 'session_user_A');
  if (res1.success && res1.heldSeats.length === 2 && res1.remainingSeconds === 600) {
    console.log('  ✓ PASS: Giữ ghế thành công, thời gian giữ: 600s (10 phút)\n');
    passed++;
  } else {
    console.error('  ✗ FAIL: Không giữ được ghế hợp lệ', res1);
    failed++;
  }

  // TEST 2: Race condition - 2 người tranh chấp cùng 1 ghế tại cùng mili-giây
  console.log('TEST 2: Tranh chấp đồng thời ghế B5 (Anti-Race Condition Test)');
  const [userB, userC] = await Promise.all([
    seatHoldManager.holdSeats(testShowtimeId, ['B5', 'B6'], 'session_user_B'),
    seatHoldManager.holdSeats(testShowtimeId, ['B5', 'B6'], 'session_user_C')
  ]);

  const oneSuccess = (userB.success && !userC.success) || (!userB.success && userC.success);
  if (oneSuccess) {
    const winner = userB.success ? 'User B' : 'User C';
    const loser = userB.success ? 'User C' : 'User B';
    console.log(`  ✓ PASS: Race condition được xử lý hoàn hảo!`);
    console.log(`    - ${winner} thắng và giữ ghế B5, B6`);
    console.log(`    - ${loser} bị từ chối với thông báo: "${(!userB.success ? userB.error : userC.error)}"\n`);
    passed++;
  } else {
    console.error('  ✗ FAIL: Race condition xảy ra lỗi!', { userB, userC });
    failed++;
  }

  // TEST 3: Tự động gom cặp Ghế Đôi (Couple seats)
  console.log('TEST 3: Tự động khóa cặp Ghế Đôi (Chọn H1 -> Tự động giữ cả H1 và H2)');
  const resCouple = await seatHoldManager.holdSeats(testShowtimeId, ['H1'], 'session_user_D');
  if (resCouple.success && resCouple.heldSeats.some(s => s.seat_id === 'H1') && resCouple.heldSeats.some(s => s.seat_id === 'H2')) {
    console.log('  ✓ PASS: Ghế đôi H1 đã tự động kích hoạt giữ trọn cặp H1 & H2!\n');
    passed++;
  } else {
    console.error('  ✗ FAIL: Không tự động gom cặp ghế đôi', resCouple);
    failed++;
  }

  // TEST 4: Quy tắc Orphan Seat (Chống bỏ trống 1 ghế đơn độc)
  console.log('TEST 4: Kiểm tra quy tắc chống để trống 1 ghế đơn lẻ (Orphan Seat Rule)');
  // Hàng C: thử chọn C2 và C3, để lại C1 trơ trọi ở đầu hàng
  const resOrphan = await seatHoldManager.holdSeats(testShowtimeId, ['C2', 'C3'], 'session_user_E');
  if (!resOrphan.success && resOrphan.error.includes('Không được để trống 1 ghế đơn lẻ')) {
    console.log(`  ✓ PASS: Hệ thống chặn thành công lỗi để trống ghế đơn: "${resOrphan.error}"\n`);
    passed++;
  } else {
    console.error('  ✗ FAIL: Chưa chặn được ghế đơn độc', resOrphan);
    failed++;
  }

  // TEST 5: Tự động giải phóng ghế khi hết hạn 10 phút
  console.log('TEST 5: Tự động dọn dẹp ghế hết hạn (Timeout Expiry Worker)');
  const seats = dataStore.getShowtimeSeats(testShowtimeId);
  const targetSeat = seats.find(s => s.seat_id === 'D1');
  targetSeat.status = 'held';
  targetSeat.held_until = Date.now() - 5000; // Đã hết hạn cách đây 5 giây
  targetSeat.held_by = 'expired_session';

  seatHoldManager.cleanupExpiredHolds();

  if (targetSeat.status === 'available' && targetSeat.held_by === null) {
    console.log('  ✓ PASS: Ghế D1 hết hạn đã tự động được trả về trạng thái "available"!\n');
    passed++;
  } else {
    console.error('  ✗ FAIL: Ghế hết hạn không được giải phóng', targetSeat);
    failed++;
  }

  console.log('==================================================================');
  console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed} PASSED / ${passed + failed} TOTAL`);
  console.log('==================================================================');

  // Đóng worker interval để script exit sạch sẽ
  clearInterval(seatHoldManager.cleanupInterval);
}

runTests().catch(console.error);
