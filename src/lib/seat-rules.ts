import { Seat } from './types';

export interface OrphanSeatCheckResult {
  hasOrphanSeats: boolean;
  orphanSeats: string[]; // e.g. ["A3", "A5"]
  orphanDetails: {
    seatLabel: string;
    rowLabel: string;
    seatNumber: number;
    reason: 'flanked_by_occupied' | 'isolated_at_aisle' | 'isolated_at_edge';
  }[];
  suggestionMessage?: string;
}

/**
 * Phân tích và phát hiện các ghế trống đơn lẻ (orphan / single seats) trong một hàng ghế
 * Tuân thủ quy tắc nghiệp vụ CINEMAX:
 * 1. Ghế trống đơn lẻ nằm kẹp giữa 2 ghế đã đặt/giữ
 * 2. Ghế trống đơn lẻ nằm kẹp giữa 1 ghế đã đặt/giữ và mép tường hoặc lối đi (Aisle)
 */
export function checkOrphanSeatsInRow(
  rowLabel: string,
  rowSeats: Seat[],
  selectedSeatsInRow: Seat[],
  currentlyBookedLabels: Set<string>,
  currentlyHeldLabels: Set<string>,
  currentlyBlockedLabels: Set<string>
): OrphanSeatCheckResult {
  const isCoupleRow =
    rowLabel === 'H' ||
    rowSeats.some((s) => s.seat_type?.code === 'COUPLE');

  // Quy tắc nghiệp vụ CINEMAX: Cảnh báo ghế trống đơn lẻ KHÔNG ÁP DỤNG với ghế đôi (Couple)
  if (isCoupleRow) {
    return {
      hasOrphanSeats: false,
      orphanSeats: [],
      orphanDetails: [],
    };
  }

  // Chia hàng thành các cụm ghế (Blocks) phân tách bởi lối đi giữa (Center Aisle)
  // Với ghế thường/VIP (1-10): Block 1 = [1, 2, 3, 4, 5], Block 2 = [6, 7, 8, 9, 10]
  const blocks: number[][] = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];

  const orphanDetails: OrphanSeatCheckResult['orphanDetails'] = [];

  for (const block of blocks) {
    const blockLength = block.length;

    // Xác định trạng thái của từng ghế trong block sau khi người dùng chọn
    // true = CHIẾM CHỖ (đã bán, đang giữ, bị khóa, hoặc người dùng đang chọn)
    // false = TRỐNG (khả dụng và người dùng KHÔNG chọn)
    const isOccupiedMap = new Map<number, boolean>();
    const isInitiallyOccupiedMap = new Map<number, boolean>();

    for (const seatNum of block) {
      const label = isCoupleRow ? `ĐÔI ${seatNum}` : `${rowLabel}${seatNum}`;
      const isBooked = currentlyBookedLabels.has(label);
      const isHeld = currentlyHeldLabels.has(label);
      const isBlocked = currentlyBlockedLabels.has(label);
      const isSelected = selectedSeatsInRow.some((s) => s.seat_number === seatNum);

      const initiallyOccupied = isBooked || isHeld || isBlocked;
      const finalOccupied = initiallyOccupied || isSelected;

      isInitiallyOccupiedMap.set(seatNum, initiallyOccupied);
      isOccupiedMap.set(seatNum, finalOccupied);
    }

    // Kiểm tra từng ghế trống trong block xem có bị cô lập không
    for (let i = 0; i < blockLength; i++) {
      const seatNum = block[i];
      const isOccupied = isOccupiedMap.get(seatNum);

      // Chỉ xét các ghế hiện đang TRỐNG (false)
      if (isOccupied) continue;

      const isLeftOccupied = i === 0 ? true : !!isOccupiedMap.get(block[i - 1]);
      const isRightOccupied = i === blockLength - 1 ? true : !!isOccupiedMap.get(block[i + 1]);

      // Nếu cả hai bên đều bị chiếm chỗ (hoặc là mép hàng/lối đi và bên kia bị chiếm)
      if (isLeftOccupied && isRightOccupied) {
        // Kiểm tra xem ghế trống này có phải do chính lựa chọn của khách gây ra hay không
        // Nếu trước khi khách chọn thì ghế này đã là orphan rồi thì không trách khách
        const wasLeftInitOccupied = i === 0 ? true : !!isInitiallyOccupiedMap.get(block[i - 1]);
        const wasRightInitOccupied = i === blockLength - 1 ? true : !!isInitiallyOccupiedMap.get(block[i + 1]);
        const wasAlreadyOrphan = wasLeftInitOccupied && wasRightInitOccupied;

        if (!wasAlreadyOrphan) {
          const seatLabel = isCoupleRow ? `ĐÔI ${seatNum}` : `${rowLabel}${seatNum}`;
          let reason: OrphanSeatCheckResult['orphanDetails'][0]['reason'] = 'flanked_by_occupied';

          if (i === 0) {
            reason = 'isolated_at_edge';
          } else if (i === blockLength - 1) {
            reason = 'isolated_at_aisle';
          }

          orphanDetails.push({
            seatLabel,
            rowLabel,
            seatNumber: seatNum,
            reason,
          });
        }
      }
    }
  }

  const orphanSeats = orphanDetails.map((d) => d.seatLabel);

  let suggestionMessage = '';
  if (orphanSeats.length > 0) {
    suggestionMessage = `Lựa chọn của bạn đang để lại ghế trống đơn lẻ (${orphanSeats.join(', ')}). Rạp khuyến khích bạn chọn thêm ghế này hoặc chọn cụm ghế liền kề để thuận tiện cho các khách hàng khác!`;
  }

  return {
    hasOrphanSeats: orphanSeats.length > 0,
    orphanSeats,
    orphanDetails,
    suggestionMessage,
  };
}

/**
 * Kiểm tra toàn bộ các hàng ghế mà người dùng đang chọn
 */
export function checkAllSelectedSeatsForOrphans(
  allSeats: Seat[],
  selectedSeats: Seat[],
  currentlyBookedLabels: Set<string>,
  currentlyHeldLabels: Set<string>,
  currentlyBlockedLabels: Set<string>
): OrphanSeatCheckResult {
  if (selectedSeats.length === 0) {
    return {
      hasOrphanSeats: false,
      orphanSeats: [],
      orphanDetails: [],
    };
  }

  // Nhóm các ghế được chọn theo từng hàng
  const selectedByRow = new Map<string, Seat[]>();
  for (const seat of selectedSeats) {
    const list = selectedByRow.get(seat.row_label) || [];
    list.push(seat);
    selectedByRow.set(seat.row_label, list);
  }

  const allOrphans: OrphanSeatCheckResult['orphanDetails'] = [];

  for (const [rowLabel, selSeats] of selectedByRow.entries()) {
    // Quy tắc nghiệp vụ CINEMAX: Bỏ qua hoàn toàn hàng ghế đôi (H hoặc loại COUPLE)
    if (rowLabel === 'H' || selSeats.some((s) => s.seat_type?.code === 'COUPLE')) {
      continue;
    }

    const rowSeats = allSeats.filter((s) => s.row_label === rowLabel);
    const rowResult = checkOrphanSeatsInRow(
      rowLabel,
      rowSeats,
      selSeats,
      currentlyBookedLabels,
      currentlyHeldLabels,
      currentlyBlockedLabels
    );

    if (rowResult.hasOrphanSeats) {
      allOrphans.push(...rowResult.orphanDetails);
    }
  }

  // Tuyệt đối không áp dụng cảnh báo cho ghế đôi (hàng H hoặc nhãn ĐÔI)
  const filteredOrphans = allOrphans.filter(
    (o) => o.rowLabel !== 'H' && !o.seatLabel.includes('ĐÔI')
  );

  const orphanSeats = Array.from(new Set(filteredOrphans.map((o) => o.seatLabel)));
  let suggestionMessage = '';
  if (orphanSeats.length > 0) {
    suggestionMessage = `Lựa chọn của bạn đang để lại ghế trống đơn lẻ (${orphanSeats.join(', ')}). Bạn có thể chọn thêm ghế này hoặc chọn vị trí liền kề!`;
  }

  return {
    hasOrphanSeats: orphanSeats.length > 0,
    orphanSeats,
    orphanDetails: filteredOrphans,
    suggestionMessage,
  };
}
