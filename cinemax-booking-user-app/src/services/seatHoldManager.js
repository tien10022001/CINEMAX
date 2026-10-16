/**
 * QUẢN LÝ GIỮ GHẾ REAL-TIME CHỐNG RACE CONDITION
 * 1. Khóa nguyên tử Mutex cho từng suất chiếu
 * 2. Tự động gom cặp cho Ghế Đôi (Couple seats)
 * 3. Kiểm tra chống bỏ trống ghế đơn lẻ (Orphan Seat Rule)
 * 4. Đếm ngược 10 phút (HOLD_DURATION_MS)
 * 5. Tự động quét và giải phóng ghế hết hạn mỗi giây
 */

const dataStore = require('../models/dataStore');
const { HOLD_DURATION_MS, SEAT_STATUS } = require('../config/constants');

class SeatHoldManager {
  constructor() {
    // Khóa Mutex đồng bộ per-showtime: showtimeId -> Promise
    this.locks = new Map();
    // Socket broadcast callback
    this.broadcastCallback = null;

    // Chạy worker dọn dẹp ghế hết hạn mỗi 1000ms
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredHolds();
    }, 1000);
  }

  setBroadcastCallback(cb) {
    this.broadcastCallback = cb;
  }

  /**
   * Cơ chế Mutex: Đảm bảo các yêu cầu giữ ghế cùng suất chiếu xếp hàng tuần tự
   * Triệt tiêu 100% Race Condition
   */
  async acquireLock(showtimeId) {
    while (this.locks.get(showtimeId)) {
      await this.locks.get(showtimeId);
    }
    let resolveLock;
    const lockPromise = new Promise(resolve => {
      resolveLock = resolve;
    });
    this.locks.set(showtimeId, lockPromise);
    return () => {
      this.locks.delete(showtimeId);
      resolveLock();
    };
  }

  /**
   * Giữ ghế Real-time (10 phút)
   */
  async holdSeats(showtimeId, requestedSeatIds, sessionId, userId = null) {
    const release = await this.acquireLock(showtimeId);
    try {
      const seats = dataStore.getShowtimeSeats(showtimeId);
      const now = Date.now();

      // 1. Kiểm tra cặp ghế đôi: Nếu chọn 1 ghế đôi, tự động thêm ghế còn lại trong cặp
      const fullSeatIdsToHold = new Set(requestedSeatIds);
      requestedSeatIds.forEach(id => {
        const seat = seats.find(s => s.seat_id === id);
        if (seat && seat.seat_type === 'COUPLE' && seat.seat_group) {
          const partnerSeats = seats.filter(s => s.seat_group === seat.seat_group);
          partnerSeats.forEach(ps => fullSeatIdsToHold.add(ps.seat_id));
        }
      });

      const finalSeatIds = Array.from(fullSeatIdsToHold);

      // 2. Kiểm tra tính khả dụng: Ghế đã Bán hoặc Ghế đang được phiên khác giữ
      const unavailable = [];
      finalSeatIds.forEach(id => {
        const seat = seats.find(s => s.seat_id === id);
        if (!seat) {
          unavailable.push({ seat_id: id, reason: 'Ghế không tồn tại' });
        } else if (seat.status === SEAT_STATUS.SOLD) {
          unavailable.push({ seat_id: id, reason: 'Ghế đã được bán' });
        } else if (
          seat.status === SEAT_STATUS.HELD &&
          seat.held_by !== sessionId &&
          seat.held_until &&
          seat.held_until > now
        ) {
          unavailable.push({ seat_id: id, reason: 'Ghế đang được người khác giữ chỗ' });
        }
      });

      if (unavailable.length > 0) {
        return {
          success: false,
          error: 'Một hoặc nhiều ghế đã không còn khả dụng',
          conflicts: unavailable
        };
      }

      // 3. Quy tắc chống để trống 1 ghế đơn độc (Orphan Seat Rule)
      const orphanCheck = this.validateOrphanSeats(seats, finalSeatIds, sessionId);
      if (!orphanCheck.valid) {
        return {
          success: false,
          error: orphanCheck.message,
          orphanSeats: orphanCheck.orphanSeats
        };
      }

      // 4. Áp dụng giữ ghế: Gán held_until = now + 10 phút
      const heldUntil = now + HOLD_DURATION_MS;
      const updatedSeats = [];

      finalSeatIds.forEach(id => {
        const seat = seats.find(s => s.seat_id === id);
        if (seat) {
          seat.status = SEAT_STATUS.HELD;
          seat.held_until = heldUntil;
          seat.held_by = sessionId;
          seat.held_user_id = userId;
          updatedSeats.push(seat);
        }
      });

      // 5. Broadcast sự kiện qua WebSocket cho tất cả người dùng xem cùng suất chiếu
      if (this.broadcastCallback) {
        this.broadcastCallback(showtimeId, {
          event: 'SEATS_HELD',
          showtimeId,
          heldSeats: updatedSeats.map(s => ({
            seat_id: s.seat_id,
            status: s.status,
            held_until: s.held_until,
            held_by: s.held_by,
            is_mine: false // Client tự đối chiếu sessionId
          }))
        });
      }

      return {
        success: true,
        message: 'Giữ ghế thành công trong 10 phút',
        heldSeats: updatedSeats,
        heldUntil: heldUntil,
        remainingSeconds: Math.floor(HOLD_DURATION_MS / 1000)
      };
    } finally {
      release();
    }
  }

  /**
   * Bỏ giữ ghế (Deselect hoặc hủy phiên)
   */
  async releaseSeats(showtimeId, seatIdsToRelease, sessionId) {
    const release = await this.acquireLock(showtimeId);
    try {
      const seats = dataStore.getShowtimeSeats(showtimeId);
      const releasedSeats = [];

      seatIdsToRelease.forEach(id => {
        const seat = seats.find(s => s.seat_id === id);
        // Chỉ cho phép phiên sở hữu giải phóng ghế của mình
        if (seat && seat.status === SEAT_STATUS.HELD && seat.held_by === sessionId) {
          seat.status = SEAT_STATUS.AVAILABLE;
          seat.held_until = null;
          seat.held_by = null;
          seat.held_user_id = null;
          releasedSeats.push(seat);
        }
      });

      if (releasedSeats.length > 0 && this.broadcastCallback) {
        this.broadcastCallback(showtimeId, {
          event: 'SEATS_RELEASED',
          showtimeId,
          releasedSeats: releasedSeats.map(s => s.seat_id)
        });
      }

      return {
        success: true,
        releasedCount: releasedSeats.length
      };
    } finally {
      release();
    }
  }

  /**
   * Worker dọn dẹp ghế hết hạn giữ (Chạy mỗi 1s)
   */
  cleanupExpiredHolds() {
    const now = Date.now();
    for (const [showtimeId, seats] of Object.entries(dataStore.showtimeSeats)) {
      const expiredSeats = [];
      seats.forEach(seat => {
        if (
          seat.status === SEAT_STATUS.HELD &&
          seat.held_until &&
          seat.held_until <= now
        ) {
          seat.status = SEAT_STATUS.AVAILABLE;
          seat.held_until = null;
          seat.held_by = null;
          seat.held_user_id = null;
          expiredSeats.push(seat.seat_id);
        }
      });

      if (expiredSeats.length > 0 && this.broadcastCallback) {
        this.broadcastCallback(showtimeId, {
          event: 'SEATS_EXPIRED',
          showtimeId,
          expiredSeats: expiredSeats
        });
      }
    }
  }

  /**
   * Xác nhận đặt vé thành công: Chuyển ghế sang 'sold'
   */
  async confirmSold(showtimeId, seatIds, orderId, sessionId) {
    const release = await this.acquireLock(showtimeId);
    try {
      const seats = dataStore.getShowtimeSeats(showtimeId);
      const confirmedSeats = [];

      seatIds.forEach(id => {
        const seat = seats.find(s => s.seat_id === id);
        if (seat) {
          seat.status = SEAT_STATUS.SOLD;
          seat.held_until = null;
          seat.held_by = null;
          seat.order_id = orderId;
          confirmedSeats.push(seat);
        }
      });

      if (this.broadcastCallback) {
        this.broadcastCallback(showtimeId, {
          event: 'SEATS_SOLD',
          showtimeId,
          soldSeats: confirmedSeats.map(s => s.seat_id),
          orderId
        });
      }

      return { success: true, confirmedCount: confirmedSeats.length };
    } finally {
      release();
    }
  }

  /**
   * Kiểm tra quy tắc chống để trống 1 ghế đơn độc (Orphan Seat Rule)
   * Không được để lại khoảng trống duy nhất 1 ghế ở đầu hàng hoặc giữa 2 ghế đã chiếm
   */
  validateOrphanSeats(seats, requestedSeatIds, sessionId) {
    // Gom ghế theo từng hàng A..H
    const rowMap = {};
    seats.forEach(s => {
      if (!rowMap[s.row_label]) rowMap[s.row_label] = [];
      rowMap[s.row_label].push(s);
    });

    for (const [rowLabel, rowSeats] of Object.entries(rowMap)) {
      rowSeats.sort((a, b) => a.seat_number - b.seat_number);

      // Mô phỏng trạng thái sau khi đặt
      const state = rowSeats.map(s => {
        if (requestedSeatIds.includes(s.seat_id)) return 'TAKEN';
        if (s.status === SEAT_STATUS.SOLD) return 'TAKEN';
        if (s.status === SEAT_STATUS.HELD && s.held_by !== sessionId) return 'TAKEN';
        return 'FREE';
      });

      // Kiểm tra các cụm 'FREE' liên tiếp
      let currentFreeCount = 0;
      for (let i = 0; i < state.length; i++) {
        if (state[i] === 'FREE') {
          currentFreeCount++;
        } else {
          // Kết thúc 1 dải FREE
          if (currentFreeCount === 1) {
            // Kiểm tra xem trước đó có phải đầu hàng hoặc TAKEN không
            return {
              valid: false,
              message: `Không được để trống 1 ghế đơn lẻ ở hàng ${rowLabel}. Vui lòng chọn ghế liền kề.`,
              orphanSeats: [`${rowLabel}${i}`]
            };
          }
          currentFreeCount = 0;
        }
      }
      if (currentFreeCount === 1) {
        return {
          valid: false,
          message: `Không được để trống 1 ghế đơn lẻ ở cuối hàng ${rowLabel}. Vui lòng chọn ghế liền kề.`,
          orphanSeats: [`${rowLabel}${state.length}`]
        };
      }
    }

    return { valid: true };
  }
}

module.exports = new SeatHoldManager();
