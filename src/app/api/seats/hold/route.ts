import { NextRequest, NextResponse } from 'next/server';

interface HeldSeatRecord {
  showtimeId: string;
  sessionId: string;
  seats: string[];
  expiresAt: number;
}

// In-memory global store across all incoming requests
let heldSeatsStore: HeldSeatRecord[] = [];

function cleanExpiredHolds() {
  const now = Date.now();
  heldSeatsStore = heldSeatsStore.filter((h) => h.expiresAt > now);
}

// GET: Lấy danh sách ghế đang bị giữ chỗ theo suất chiếu
export async function GET(request: NextRequest) {
  try {
    cleanExpiredHolds();
    const { searchParams } = new URL(request.url);
    const showtimeId = searchParams.get('showtimeId');

    let result = heldSeatsStore;
    if (showtimeId) {
      result = heldSeatsStore.filter((h) => h.showtimeId.toString() === showtimeId.toString());
    }

    return NextResponse.json({
      success: true,
      heldSeats: result,
      now: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Đặt giữ chỗ ghế tạm thời khi người dùng click chọn
export async function POST(request: NextRequest) {
  try {
    cleanExpiredHolds();
    const body = await request.json();
    const { showtimeId, sessionId, seatLabels, holdMinutes = 10 } = body;

    if (!showtimeId || !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu showtimeId hoặc sessionId' },
        { status: 400 }
      );
    }

    const stIdStr = showtimeId.toString();
    const seatsArray: string[] = Array.isArray(seatLabels) ? seatLabels : [];

    // Nếu gửi danh sách rỗng -> Giải phóng ghế của session này
    if (seatsArray.length === 0) {
      heldSeatsStore = heldSeatsStore.filter((h) => h.sessionId !== sessionId);
      return NextResponse.json({ success: true, message: 'Đã giải phóng ghế', expiresAt: 0 });
    }

    // Kiểm tra xem có ghế nào đang bị phiên khác giữ không
    const now = Date.now();
    for (const h of heldSeatsStore) {
      if (h.showtimeId.toString() === stIdStr && h.sessionId !== sessionId && h.expiresAt > now) {
        for (const s of h.seats || []) {
          if (seatsArray.includes(s)) {
            return NextResponse.json(
              {
                success: false,
                error: `Ghế ${s} đang được tạm giữ bởi khách hàng khác. Vui lòng chọn ghế khác!`,
                conflictedSeat: s,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // Cập nhật hoặc thêm mới phiên giữ ghế
    const expiresAt = now + holdMinutes * 60 * 1000;
    heldSeatsStore = heldSeatsStore.filter((h) => h.sessionId !== sessionId);
    heldSeatsStore.push({
      showtimeId: stIdStr,
      sessionId,
      seats: seatsArray,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      expiresAt,
      seats: seatsArray,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Hủy phiên giữ ghế khi khách đóng tab hoặc hoàn tất
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      heldSeatsStore = heldSeatsStore.filter((h) => h.sessionId !== sessionId);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
