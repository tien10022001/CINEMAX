import { NextRequest, NextResponse } from 'next/server';

// Bộ nhớ tạm lưu trữ trạng thái giữ ghế real-time theo showtime
// Map: `${showtimeId}:${seatCode}` -> { sessionId, heldUntil: number, userId?: string }
const globalSeatHolds = new Map<string, { sessionId: string; heldUntil: number; userId?: string }>();

// Dọn dẹp ghế hết hạn định kỳ
function cleanExpired() {
  const now = Date.now();
  for (const [key, hold] of globalSeatHolds.entries()) {
    if (hold.heldUntil <= now) {
      globalSeatHolds.delete(key);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    cleanExpired();
    const body = await req.json();
    const { showtimeId, seatCodes, sessionId, userId } = body;

    if (!showtimeId || !seatCodes || !Array.isArray(seatCodes) || !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin showtimeId, seatCodes hoặc sessionId.' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const holdDurationMs = 10 * 60 * 1000; // 10 phút

    // 1. Tự động gom cặp ghế đôi (Hàng H: H1-H2, H3-H4, H5-H6, H7-H8, H9-H10)
    const seatsToHold = new Set<string>(seatCodes);
    seatCodes.forEach((code: string) => {
      const match = code.match(/^H(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        const partnerNum = num % 2 === 1 ? num + 1 : num - 1;
        seatsToHold.add(`H${partnerNum}`);
      }
    });

    const finalSeats = Array.from(seatsToHold);

    // 2. Kiểm tra tranh chấp ghế (Race condition check)
    for (const seat of finalSeats) {
      const key = `${showtimeId}:${seat.toUpperCase()}`;
      const existingHold = globalSeatHolds.get(key);
      if (existingHold && existingHold.heldUntil > now && existingHold.sessionId !== sessionId) {
        return NextResponse.json(
          {
            success: false,
            error: `Ghế ${seat} đang được người khác giữ chỗ. Vui lòng chọn ghế khác.`
          },
          { status: 409 }
        );
      }
    }

    // 3. Khóa ghế thành công trong 10 phút
    const heldUntil = now + holdDurationMs;
    for (const seat of finalSeats) {
      const key = `${showtimeId}:${seat.toUpperCase()}`;
      globalSeatHolds.set(key, { sessionId, heldUntil, userId });
    }

    return NextResponse.json({
      success: true,
      message: 'Giữ ghế thành công trong 10 phút!',
      heldSeats: finalSeats,
      heldUntil: new Date(heldUntil).toISOString(),
      remainingSeconds: 600
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Lỗi xử lý giữ ghế.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { showtimeId, seatCodes, sessionId } = body;

    if (!showtimeId || !seatCodes || !sessionId) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin giải phóng ghế.' }, { status: 400 });
    }

    for (const seat of seatCodes) {
      const key = `${showtimeId}:${seat.toUpperCase()}`;
      const existing = globalSeatHolds.get(key);
      if (existing && existing.sessionId === sessionId) {
        globalSeatHolds.delete(key);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Đã giải phóng ghế thành công.'
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
