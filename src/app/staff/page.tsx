'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { useData } from '@/lib/data-context';
import { createClient } from '@/lib/supabase/client';
import {
  syncOrderToSupabase,
  syncCheckInToSupabase,
  syncStockMovementToSupabase,
  syncShiftToSupabase,
  syncRefundToSupabase,
  syncSeatExchangeToSupabase,
  syncConcessionFulfillmentToSupabase,
  fetchSupabaseStaffRecords,
} from '@/lib/supabase/queries';

// ============================================================================
// TYPES
// ============================================================================
type StaffRoleCode = 'SUPERVISOR' | 'POS' | 'CHECKIN' | 'CONCESSION';
type StaffTab = 'checkin' | 'pos' | 'concession' | 'rooms' | 'shift' | 'history';
type AudienceType = 'ADULT' | 'STUDENT_U22' | 'CHILD' | 'SENIOR';

interface FoodOrderItem {
  name: string;
  qty: number;
  price: number;
  flavor?: string;
  drinkSize?: string;
  fulfilled?: boolean;
}

interface SharedTicketOrder {
  id: string;
  movie_title: string;
  age_rating: string;
  cinema_name: string;
  room_name: string;
  screen_type: string;
  start_time: string;
  seats: string[];
  checked_in_seats: string[];
  audience_type: AudienceType;
  foods: FoodOrderItem[];
  food_fulfilled: boolean;
  promo_code: string | null;
  discount_amount: number;
  surcharge_amount?: number;
  total_amount: number;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  status: 'PAID' | 'USED' | 'REJECTED_AGE' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED';
  age_check_passed?: boolean;
  created_at: string;
  checked_in_at?: string;
  checked_in_by?: string;
  channel: 'ONLINE' | 'POS';
  showtime_id: number;
}

interface RoomDefinition {
  id: string;
  cinemaId: number;
  cinemaName: string;
  cinemaAddress: string;
  roomName: string;
  screenType: string;
  totalSeats: number;
  rows: string[];
  cols: number;
}

const SEAT_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const SEAT_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const AUDIENCE_CONFIG: Record<AudienceType, { label: string; discountPercent: number }> = {
  ADULT: { label: 'Người lớn', discountPercent: 0 },
  STUDENT_U22: { label: 'HSSV (-20%)', discountPercent: 20 },
  CHILD: { label: 'Trẻ em (-30%)', discountPercent: 30 },
  SENIOR: { label: 'Cao tuổi (-25%)', discountPercent: 25 },
};

const POPCORN_FLAVORS = ['Vị Ngọt', 'Vị Phô Mai', 'Vị Caramel'];
const DRINK_OPTIONS = ['Coca (M)', 'Coca (L +10K)', 'Pepsi (L)'];

const ROLE_CONFIG: Record<StaffRoleCode, { label: string; allowedTabs: StaffTab[] }> = {
  SUPERVISOR: {
    label: 'Trưởng ca (Toàn quyền)',
    allowedTabs: ['checkin', 'pos', 'concession', 'rooms', 'shift', 'history'],
  },
  POS: {
    label: 'Nhân viên POS (Bán vé)',
    allowedTabs: ['pos', 'rooms', 'shift', 'history'],
  },
  CHECKIN: {
    label: 'Nhân viên Soát vé',
    allowedTabs: ['checkin', 'rooms'],
  },
  CONCESSION: {
    label: 'Nhân viên Bắp nước',
    allowedTabs: ['concession'],
  },
};

const DEFAULT_ROOMS: RoomDefinition[] = [
  {
    id: 'room-q1-1',
    cinemaId: 1,
    cinemaName: 'Cinemax Quận 1',
    cinemaAddress: 'Tầng 5, Vincom Đồng Khởi, Quận 1',
    roomName: 'Phòng 1',
    screenType: 'IMAX Laser',
    totalSeats: 80,
    rows: SEAT_ROWS,
    cols: 10,
  },
  {
    id: 'room-q1-2',
    cinemaId: 1,
    cinemaName: 'Cinemax Quận 1',
    cinemaAddress: 'Tầng 5, Vincom Đồng Khởi, Quận 1',
    roomName: 'Phòng 2',
    screenType: '2D Dolby',
    totalSeats: 80,
    rows: SEAT_ROWS,
    cols: 10,
  },
  {
    id: 'room-q1-3',
    cinemaId: 1,
    cinemaName: 'Cinemax Quận 1',
    cinemaAddress: 'Tầng 5, Vincom Đồng Khởi, Quận 1',
    roomName: 'Phòng 3',
    screenType: 'Gold Class',
    totalSeats: 80,
    rows: SEAT_ROWS,
    cols: 10,
  },
  {
    id: 'room-td-1',
    cinemaId: 2,
    cinemaName: 'Cinemax Thủ Đức',
    cinemaAddress: 'Tầng 6, Gigamall Phạm Văn Đồng',
    roomName: 'Phòng 1',
    screenType: '4DX',
    totalSeats: 80,
    rows: SEAT_ROWS,
    cols: 10,
  },
  {
    id: 'room-td-2',
    cinemaId: 2,
    cinemaName: 'Cinemax Thủ Đức',
    cinemaAddress: 'Tầng 6, Gigamall Phạm Văn Đồng',
    roomName: 'Phòng 2',
    screenType: '2D Chuẩn',
    totalSeats: 80,
    rows: SEAT_ROWS,
    cols: 10,
  },
];

const INITIAL_DEMO_ORDERS: SharedTicketOrder[] = [
  {
    id: '69b6447c80200b3d4a2df75f',
    movie_title: 'Thế Lực Đen Tối (Dune 2)',
    age_rating: 'T16',
    cinema_name: 'Cinemax Quận 1',
    room_name: 'Phòng 1',
    screen_type: 'IMAX Laser',
    start_time: '2026-10-14T19:30:00',
    seats: ['F6', 'F7'],
    checked_in_seats: [],
    audience_type: 'ADULT',
    foods: [
      {
        name: 'Combo Couple',
        qty: 1,
        price: 115000,
        flavor: 'Vị Phô Mai',
        drinkSize: 'Coca (L +10K)',
        fulfilled: false,
      },
    ],
    food_fulfilled: false,
    promo_code: null,
    discount_amount: 0,
    total_amount: 325000,
    payment_method: 'VNPAY',
    customer_name: 'Lê Minh Tuấn',
    customer_phone: '0901234567',
    customer_email: 'tuan.le@gmail.com',
    status: 'PAID',
    created_at: '14/10/2026 18:15',
    channel: 'ONLINE',
    showtime_id: 1,
  },
  {
    id: '69a83a91c1149b2e7f1bc820',
    movie_title: 'Deadpool & Wolverine',
    age_rating: 'T18',
    cinema_name: 'Cinemax Quận 1',
    room_name: 'Phòng 2',
    screen_type: '2D Dolby',
    start_time: '2026-10-14T20:15:00',
    seats: ['E5', 'E6'],
    checked_in_seats: [],
    audience_type: 'STUDENT_U22',
    foods: [
      {
        name: 'Combo Solo',
        qty: 1,
        price: 89000,
        flavor: 'Vị Caramel',
        drinkSize: 'Pepsi (L)',
        fulfilled: false,
      },
    ],
    food_fulfilled: false,
    promo_code: null,
    discount_amount: 0,
    total_amount: 239000,
    payment_method: 'MOMO',
    customer_name: 'Nguyễn Hải Yến',
    customer_phone: '0918765432',
    customer_email: 'yen.nguyen@gmail.com',
    status: 'PAID',
    created_at: '14/10/2026 18:40',
    channel: 'ONLINE',
    showtime_id: 2,
  },
  {
    id: '69c19f44d8230a1c9e4fa109',
    movie_title: 'Thế Lực Đen Tối (Dune 2)',
    age_rating: 'T13',
    cinema_name: 'Cinemax Quận 1',
    room_name: 'Phòng 1',
    screen_type: 'IMAX Laser',
    start_time: '2026-10-14T19:30:00',
    seats: ['D4', 'D5'],
    checked_in_seats: ['D4', 'D5'],
    audience_type: 'ADULT',
    foods: [
      {
        name: 'Bắp Ngọt',
        qty: 1,
        price: 49000,
        flavor: 'Vị Ngọt',
        drinkSize: 'Coca (M)',
        fulfilled: true,
      },
    ],
    food_fulfilled: true,
    promo_code: null,
    discount_amount: 0,
    total_amount: 194000,
    payment_method: 'CASH',
    customer_name: 'Khách vãng lai (POS)',
    customer_phone: 'Tại quầy POS',
    customer_email: 'pos@cinemax.vn',
    status: 'USED',
    age_check_passed: true,
    created_at: '14/10/2026 19:05',
    checked_in_at: '19:06 - 14/10/2026',
    checked_in_by: 'Nguyễn Văn An',
    channel: 'POS',
    showtime_id: 1,
  },
];

function getCouplePartnerSeat(seatCode: string): string | null {
  if (seatCode.charAt(0) !== 'H') return null;
  const col = parseInt(seatCode.slice(1), 10);
  if (isNaN(col)) return null;
  return `H${col % 2 === 1 ? col + 1 : col - 1}`;
}

function detectOrphanSeats(
  selectedSeats: string[],
  soldSeats: string[],
  maintenanceSeats: string[]
): string | null {
  const blocked = new Set([...soldSeats, ...maintenanceSeats]);
  const selectedSet = new Set(selectedSeats);

  for (const row of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
    if (!SEAT_COLS.some((c) => selectedSet.has(`${row}${c}`))) continue;
    const state = SEAT_COLS.map((c) =>
      blocked.has(`${row}${c}`) || selectedSet.has(`${row}${c}`) ? 'OCCUPIED' : 'EMPTY'
    );
    for (let i = 0; i < SEAT_COLS.length; i++) {
      if (state[i] === 'EMPTY') {
        const leftOccupied = i === 0 || state[i - 1] === 'OCCUPIED';
        const rightOccupied = i === SEAT_COLS.length - 1 || state[i + 1] === 'OCCUPIED';
        const touchesSelection =
          (i > 0 && selectedSet.has(`${row}${SEAT_COLS[i - 1]}`)) ||
          (i < SEAT_COLS.length - 1 && selectedSet.has(`${row}${SEAT_COLS[i + 1]}`));
        if (leftOccupied && rightOccupied && touchesSelection) {
          return `Không để trống 1 ghế lẻ (${row}${SEAT_COLS[i]}) cạnh ghế đang chọn.`;
        }
      }
    }
  }
  return null;
}

export default function StaffWorkspacePage() {
  const {
    movies,
    showtimes,
    foods,
    soldSeatsByShowtime,
    seatUuidLookup,
    updateFoodItem,
    refreshFromSupabase,
  } = useData();

  // ==========================================================================
  // CORE NAVIGATION & STAFF STATE
  // ==========================================================================
  const [staffRole, setStaffRole] = useState<StaffRoleCode>('SUPERVISOR');
  const [activeTab, setActiveTab] = useState<StaffTab>('checkin');
  const [staffName, setStaffName] = useState<string>('Nguyễn Văn An');
  const [posTerminal, setPosTerminal] = useState<string>('POS-01');
  const [shiftLabel, setShiftLabel] = useState<string>('Ca Tối (14:00 - 22:00)');
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const handleRoleChange = (newRole: StaffRoleCode) => {
    setStaffRole(newRole);
    const allowed = ROLE_CONFIG[newRole].allowedTabs;
    if (!allowed.includes(activeTab)) {
      setActiveTab(allowed[0]);
    }
  };

  // ==========================================================================
  // SYNCHRONIZED DATA
  // ==========================================================================
  const [orders, setOrders] = useState<SharedTicketOrder[]>(INITIAL_DEMO_ORDERS);
  const [bookedSeatsMap, setBookedSeatsMap] = useState<Record<number, string[]>>({});
  const [maintenanceSeatsByRoom, setMaintenanceSeatsByRoom] = useState<Record<string, string[]>>({});

  const loadSynchronizedData = useCallback(async () => {
    try {
      let currentOrders: SharedTicketOrder[] = [...INITIAL_DEMO_ORDERS];
      const rawTickets = localStorage.getItem('cinemax_my_tickets_v2');
      if (rawTickets) {
        const parsed: SharedTicketOrder[] = JSON.parse(rawTickets);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((o) => o.id));
          currentOrders = [
            ...parsed.map((p) => ({
              ...p,
              age_rating: p.age_rating || 'T16',
              checked_in_seats: p.checked_in_seats || (p.status === 'USED' ? p.seats : []),
              audience_type: p.audience_type || 'ADULT',
              food_fulfilled: Boolean(p.food_fulfilled),
            })),
            ...INITIAL_DEMO_ORDERS.filter((d) => !existingIds.has(d.id)),
          ];
        }
      }

      const rawUserTickets = localStorage.getItem('cinemax_user_tickets');
      if (rawUserTickets) {
        const parsedUserTickets = JSON.parse(rawUserTickets);
        if (Array.isArray(parsedUserTickets)) {
          const existingIds = new Set(currentOrders.map((o) => o.id));
          const extraFromBooking: SharedTicketOrder[] = [];
          const extraSeatsBySt: Record<number, string[]> = {};

          parsedUserTickets.forEach((ut: Record<string, unknown>) => {
            const bCode = String(ut.bookingCode || ut.id || '');
            if (!bCode) return;
            const seatArr = String(ut.seats || '')
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean);
            const stId = Number(ut.showtimeId || 1);
            const rawStatus = String(ut.status || 'ĐÃ THANH TOÁN');
            const mappedStatus: SharedTicketOrder['status'] =
              rawStatus === 'ĐÃ XEM'
                ? 'USED'
                : rawStatus === 'ĐÃ HỦY' || rawStatus === 'ĐÃ HOÀN TIỀN'
                ? 'CANCELLED'
                : 'PAID';

            if (mappedStatus !== 'CANCELLED' && seatArr.length > 0) {
              extraSeatsBySt[stId] = Array.from(
                new Set([...(extraSeatsBySt[stId] || []), ...seatArr])
              );
            }

            if (!existingIds.has(bCode)) {
              const foodSummary = String(ut.foodSummary || '');
              const parsedFoods: FoodOrderItem[] =
                foodSummary && foodSummary !== 'Không kèm bắp nước'
                  ? [
                      {
                        name: foodSummary,
                        qty: 1,
                        price: 0,
                        flavor: 'Vị Phô Mai',
                        drinkSize: 'Coca (L +10K)',
                        fulfilled: Boolean(ut.foodFulfilled),
                      },
                    ]
                  : [];
              extraFromBooking.push({
                id: bCode,
                movie_title: String(ut.movieTitle || 'Phim chiếu rạp CINEMAX'),
                age_rating: String(ut.ageRating || 'T16'),
                cinema_name: String(ut.cinemaName || 'Cinemax Quận 1'),
                room_name: String(ut.roomName || 'Phòng 1'),
                screen_type: '2D Dolby',
                start_time: new Date().toISOString(),
                seats: seatArr.length > 0 ? seatArr : ['E5'],
                checked_in_seats: mappedStatus === 'USED' ? seatArr : [],
                audience_type: 'ADULT',
                foods: parsedFoods,
                food_fulfilled: Boolean(ut.foodFulfilled),
                promo_code: null,
                discount_amount: 0,
                total_amount: Number(ut.totalAmount || 180000),
                payment_method: String(ut.paymentMethod || 'VNPAY'),
                customer_name: String(ut.customerName || 'Khách đặt Online'),
                customer_phone: String(ut.customerPhone || '0901234567'),
                customer_email: String(ut.customerEmail || 'khach@cinemax.vn'),
                status: mappedStatus,
                created_at: String(ut.createdAt || '14/10/2026'),
                channel: String(ut.channel || 'ONLINE') === 'POS' ? 'POS' : 'ONLINE',
                showtime_id: stId,
              });
            }
          });

          if (extraFromBooking.length > 0) {
            currentOrders = [...extraFromBooking, ...currentOrders];
          }
          if (Object.keys(extraSeatsBySt).length > 0) {
            setBookedSeatsMap((prev) => {
              const merged = { ...prev };
              for (const [k, v] of Object.entries(extraSeatsBySt)) {
                const numK = Number(k);
                merged[numK] = Array.from(new Set([...(merged[numK] || []), ...v]));
              }
              return merged;
            });
          }
        }
      }

      setOrders(currentOrders);
      localStorage.setItem('cinemax_my_tickets_v2', JSON.stringify(currentOrders));

      const rawSeats = localStorage.getItem('cinemax_booked_seats_v2');
      if (rawSeats) {
        const parsedSeats = JSON.parse(rawSeats);
        if (parsedSeats && typeof parsedSeats === 'object') {
          setBookedSeatsMap((prev) => ({ ...prev, ...parsedSeats }));
        }
      }

      const rawMaint = localStorage.getItem('cinemax_maintenance_seats_v2');
      if (rawMaint) {
        const parsedMaint = JSON.parse(rawMaint);
        if (parsedMaint && typeof parsedMaint === 'object') {
          setMaintenanceSeatsByRoom(parsedMaint);
        }
      }
    } catch {
      // Ignore
    }

    try {
      const supaRecords = await fetchSupabaseStaffRecords();

      // Build audit snapshot lookup by order_code as fallback metadata source
      const auditSnapshotByCode = new Map<string, Record<string, unknown>>();
      for (const aud of (supaRecords.audits || []) as Record<string, unknown>[]) {
        const entityId = String(aud.entity_id || '');
        const afterData = (aud.after_data as Record<string, unknown>) || null;
        if (entityId && afterData && !auditSnapshotByCode.has(entityId)) {
          auditSnapshotByCode.set(entityId, afterData);
        }
      }

      if (supaRecords.orders && supaRecords.orders.length > 0) {
        setOrders((prev) => {
          const prevByCode = new Map<string, SharedTicketOrder>();
          prev.forEach((o) => prevByCode.set(o.id, o));

          const dbMappedOrders: SharedTicketOrder[] = (
            supaRecords.orders as Record<string, unknown>[]
          ).map((dbO) => {
            const orderCode = String(dbO.order_code || dbO.id);
            const existingLocal = prevByCode.get(orderCode);
            const auditSnap = auditSnapshotByCode.get(orderCode) || {};
            const auditMovieSnap =
              (auditSnap.movieSnapshot as Record<string, unknown>) || {};

            const rawOrderItems = Array.isArray(dbO.order_items)
              ? (dbO.order_items as Record<string, unknown>[])
              : [];
            const ticketItems = rawOrderItems.filter(
              (oi) => String(oi.item_type || '').toLowerCase() === 'ticket'
            );
            const productItems = rawOrderItems.filter(
              (oi) => String(oi.item_type || '').toLowerCase() === 'product'
            );

            const firstTicketSnap =
              (ticketItems[0]?.item_snapshot as Record<string, unknown>) ||
              auditMovieSnap ||
              {};

            // Extract real seats & checked-in seats from order_items + tickets
            const extractedSeats: string[] = [];
            const extractedCheckedInSeats: string[] = [];
            let anyTicketUsed = false;

            ticketItems.forEach((ti) => {
              const snap = (ti.item_snapshot as Record<string, unknown>) || {};
              const sCode = String(snap.seatCode || '').trim().toUpperCase();
              if (sCode) extractedSeats.push(sCode);

              const nestedTickets = Array.isArray(ti.tickets)
                ? (ti.tickets as Record<string, unknown>[])
                : ti.tickets && typeof ti.tickets === 'object'
                ? [ti.tickets as Record<string, unknown>]
                : [];
              nestedTickets.forEach((tk) => {
                if (String(tk.status || '').toLowerCase() === 'used') {
                  anyTicketUsed = true;
                  if (sCode) extractedCheckedInSeats.push(sCode);
                }
              });
            });

            const auditSeats = Array.isArray(auditSnap.seats)
              ? (auditSnap.seats as unknown[]).map((s) => String(s))
              : [];

            const finalSeats =
              extractedSeats.length > 0
                ? extractedSeats
                : auditSeats.length > 0
                ? auditSeats
                : existingLocal?.seats || ['E7', 'E8'];

            // Extract real food items & fulfillment status
            const extractedFoods: FoodOrderItem[] = productItems.map((pi) => {
              const snap = (pi.item_snapshot as Record<string, unknown>) || {};
              const fulfillments = Array.isArray(pi.order_item_fulfillments)
                ? (pi.order_item_fulfillments as unknown[])
                : [];
              const isFulfilled =
                Boolean(snap.fulfilled) || fulfillments.length > 0;
              const modStr = String(snap.modifierName || '');
              const parts = modStr.split('•').map((s) => s.trim());
              return {
                name: String(snap.productName || 'Combo Bắp Nước'),
                qty: Number(pi.quantity || 1),
                price: Number(pi.unit_price || 69000),
                flavor: parts[0] || 'Vị Phô Mai',
                drinkSize: parts[1] || 'Coca (M)',
                fulfilled: isFulfilled,
              };
            });

            const finalFoods =
              extractedFoods.length > 0
                ? extractedFoods
                : existingLocal?.foods || [];
            const allFoodFulfilled =
              finalFoods.length > 0
                ? finalFoods.every((f) => Boolean(f.fulfilled))
                : Boolean(existingLocal?.food_fulfilled);

            // Payment method from payments array or audit or channel
            const paymentsArr = Array.isArray(dbO.payments)
              ? (dbO.payments as Record<string, unknown>[])
              : [];
            const dbPaymentProvider = String(
              paymentsArr[0]?.provider ||
                auditSnap.paymentProvider ||
                existingLocal?.payment_method ||
                (String(dbO.channel || 'pos').toLowerCase() === 'pos' ? 'CASH' : 'VNPAY')
            ).toUpperCase();

            // Order status
            const rawDbStatus = String(dbO.status || 'paid').toLowerCase();
            let finalStatus: SharedTicketOrder['status'] =
              existingLocal?.status || 'PAID';
            if (rawDbStatus === 'refunded') {
              finalStatus = 'REFUNDED';
            } else if (rawDbStatus === 'cancelled') {
              finalStatus = 'CANCELLED';
            } else if (
              anyTicketUsed ||
              (extractedSeats.length > 0 &&
                extractedCheckedInSeats.length === extractedSeats.length)
            ) {
              finalStatus = 'USED';
            }

            return {
              id: orderCode,
              movie_title: String(
                firstTicketSnap.movieTitle ||
                  existingLocal?.movie_title ||
                  'Dune: Hành Tinh Cát - Phần 2'
              ),
              age_rating: String(
                firstTicketSnap.ageRating || existingLocal?.age_rating || 'T16'
              ),
              cinema_name: String(
                firstTicketSnap.cinemaName ||
                  existingLocal?.cinema_name ||
                  'Cinemax Hà Nội Centre'
              ),
              room_name: String(
                firstTicketSnap.roomName || existingLocal?.room_name || 'Phòng 1'
              ),
              screen_type: String(
                firstTicketSnap.format || existingLocal?.screen_type || '2D Dolby'
              ),
              start_time: String(
                existingLocal?.start_time || dbO.created_at || new Date().toISOString()
              ),
              seats: finalSeats,
              checked_in_seats:
                extractedCheckedInSeats.length > 0
                  ? extractedCheckedInSeats
                  : existingLocal?.checked_in_seats || [],
              audience_type:
                (ticketItems[0]?.audience_type as AudienceType) ||
                existingLocal?.audience_type ||
                'ADULT',
              foods: finalFoods,
              food_fulfilled: allFoodFulfilled,
              promo_code: existingLocal?.promo_code || null,
              discount_amount: Number(
                dbO.discount_amount ??
                  dbO.discount_total ??
                  existingLocal?.discount_amount ??
                  0
              ),
              total_amount: Number(
                dbO.total_amount ?? existingLocal?.total_amount ?? 170000
              ),
              payment_method: dbPaymentProvider,
              customer_name: String(
                dbO.contact_name ||
                  auditSnap.contactName ||
                  existingLocal?.customer_name ||
                  (String(dbO.channel || 'pos').toLowerCase() === 'pos'
                    ? 'Khách vãng lai (POS)'
                    : 'Khách đặt trực tuyến')
              ),
              customer_phone: String(
                dbO.contact_phone ||
                  auditSnap.contactPhone ||
                  existingLocal?.customer_phone ||
                  '0909888777'
              ),
              customer_email: String(
                dbO.contact_email ||
                  auditSnap.contactEmail ||
                  existingLocal?.customer_email ||
                  'khachhang@cinemax.vn'
              ),
              status: finalStatus,
              created_at:
                existingLocal?.created_at ||
                new Date(String(dbO.created_at || Date.now())).toLocaleString('vi-VN'),
              checked_in_at: existingLocal?.checked_in_at,
              checked_in_by: existingLocal?.checked_in_by,
              channel:
                String(dbO.channel || '').toLowerCase() === 'pos' ? 'POS' : 'ONLINE',
              showtime_id: existingLocal?.showtime_id || 1,
            };
          });

          const dbCodes = new Set(dbMappedOrders.map((o) => o.id));
          const merged = [
            ...dbMappedOrders,
            ...prev.filter((o) => !dbCodes.has(o.id)),
          ];
          try {
            localStorage.setItem('cinemax_my_tickets_v2', JSON.stringify(merged));
          } catch {
            // Ignore
          }
          return merged;
        });
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    loadSynchronizedData();
    const handleStorage = () => loadSynchronizedData();
    window.addEventListener('storage', handleStorage);

    // Subscribe to Supabase Realtime for orders, order_items, tickets, and refunds
    const supabase = createClient();
    const channel = supabase
      .channel('cinemax-staff-history-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadSynchronizedData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        loadSynchronizedData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        loadSynchronizedData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' }, () => {
        loadSynchronizedData();
      })
      .subscribe();

    return () => {
      window.removeEventListener('storage', handleStorage);
      supabase.removeChannel(channel);
    };
  }, [loadSynchronizedData]);

  const saveOrders = (nextOrders: SharedTicketOrder[]) => {
    setOrders(nextOrders);
    try {
      localStorage.setItem('cinemax_my_tickets_v2', JSON.stringify(nextOrders));

      const rawUserTickets = localStorage.getItem('cinemax_user_tickets');
      const userList: Record<string, unknown>[] = rawUserTickets ? JSON.parse(rawUserTickets) : [];
      const byCode = new Map<string, SharedTicketOrder>();
      nextOrders.forEach((o) => byCode.set(o.id, o));

      const updatedUserList = userList.map((ut) => {
        const code = String(ut.bookingCode || '');
        const match = byCode.get(code);
        if (!match) return ut;
        return {
          ...ut,
          seats: match.seats.join(', '),
          roomName: match.room_name,
          totalAmount: match.total_amount,
          foodFulfilled: match.food_fulfilled,
          status:
            match.status === 'USED'
              ? 'ĐÃ XEM'
              : match.status === 'CANCELLED' ||
                match.status === 'REFUNDED' ||
                match.status === 'REJECTED_AGE'
              ? 'ĐÃ HỦY'
              : 'ĐÃ THANH TOÁN',
        };
      });

      const existingCodes = new Set(updatedUserList.map((u) => String(u.bookingCode || '')));
      nextOrders.forEach((o) => {
        if (!existingCodes.has(o.id)) {
          updatedUserList.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            userId: 'guest',
            customerName: o.customer_name,
            customerEmail: o.customer_email,
            customerPhone: o.customer_phone,
            bookingCode: o.id,
            showtimeId: o.showtime_id || 1,
            movieTitle: o.movie_title,
            ageRating: o.age_rating,
            posterUrl:
              'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
            cinemaName: o.cinema_name,
            roomName: o.room_name,
            showtime:
              new Date(o.start_time).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              }) +
              ' • ' +
              new Date(o.start_time).toLocaleDateString('vi-VN'),
            seats: o.seats.join(', '),
            foodSummary:
              o.foods && o.foods.length > 0
                ? o.foods.map((f) => `${f.qty}x ${f.name}`).join(', ')
                : 'Không kèm bắp nước',
            foodFulfilled: o.food_fulfilled,
            paymentMethod: o.payment_method,
            channel: o.channel || 'POS',
            totalAmount: o.total_amount,
            createdAt: o.created_at,
            status:
              o.status === 'USED'
                ? 'ĐÃ XEM'
                : o.status === 'CANCELLED'
                ? 'ĐÃ HỦY'
                : 'ĐÃ THANH TOÁN',
          });
        }
      });

      localStorage.setItem('cinemax_user_tickets', JSON.stringify(updatedUserList));
    } catch {
      // Ignore
    }
  };

  // ==========================================================================
  // TAB 1: SOÁT VÉ (CHECK-IN) — REAL WEBCAM & IMAGE QR SCANNER
  // ==========================================================================
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStatusText, setCameraStatusText] = useState<string>('Đang kết nối Camera...');
  const [scanInputCode, setScanInputCode] = useState<string>('');
  const [inspectedOrder, setInspectedOrder] = useState<SharedTicketOrder | null>(null);
  const [printedQrDataUrl, setPrintedQrDataUrl] = useState<string>('');
  const [ageVerifiedChecked, setAgeVerifiedChecked] = useState<boolean>(false);
  const [selectedSeatsForPartialCheckin, setSelectedSeatsForPartialCheckin] = useState<string[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<SharedTicketOrder | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastScannedCodeRef = useRef<string>('');

  const playScannerBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Ignore audio errors
    }
  }, []);

  const extractBookingCodeFromQrPayload = useCallback((rawPayload: string): string => {
    const trimmed = rawPayload.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.bookingCode) return String(parsed.bookingCode);
        if (parsed.id) return String(parsed.id);
        if (parsed.code) return String(parsed.code);
      } catch {
        // Fallback to raw string
      }
    }
    return trimmed.replace(/^#/, '');
  }, []);

  const handleInspectTicket = useCallback(
    (codeToSearch?: string) => {
      const rawQuery = (codeToSearch ?? scanInputCode).trim();
      const query = extractBookingCodeFromQrPayload(rawQuery);
      if (!query) {
        setScanError('Vui lòng nhập mã đơn hàng hoặc quét mã QR để kiểm tra.');
        return;
      }
      const found = orders.find(
        (o) =>
          o.id.toLowerCase() === query.toLowerCase() ||
          o.id.toLowerCase().includes(query.toLowerCase()) ||
          query.toLowerCase().includes(o.id.toLowerCase()) ||
          o.customer_phone.includes(query)
      );
      if (!found) {
        setInspectedOrder(null);
        setScanError(`Không tìm thấy vé khớp với mã QR "${query}".`);
        return;
      }
      setScanError(null);
      setInspectedOrder(found);
      setScanInputCode(found.id);
      const remainingSeats = found.seats.filter(
        (s) => !(found.checked_in_seats || []).includes(s)
      );
      setSelectedSeatsForPartialCheckin(
        remainingSeats.length > 0 ? remainingSeats : [...found.seats]
      );
      setAgeVerifiedChecked(found.age_rating === 'P' || Boolean(found.age_check_passed));
    },
    [scanInputCode, orders, extractBookingCodeFromQrPayload]
  );

  const handleInspectTicketRef = useRef(handleInspectTicket);
  useEffect(() => {
    handleInspectTicketRef.current = handleInspectTicket;
  }, [handleInspectTicket]);

  // Generate real QR code for thermal print modal
  useEffect(() => {
    if (!printingOrder) {
      setPrintedQrDataUrl('');
      return;
    }
    QRCode.toDataURL(printingOrder.id, {
      width: 220,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => setPrintedQrDataUrl(url))
      .catch(() => setPrintedQrDataUrl(''));
  }, [printingOrder]);

  // Real Live Webcam QR Scanner Loop using jsQR
  useEffect(() => {
    if (!cameraActive || activeTab !== 'checkin') {
      return;
    }

    let activeStream: MediaStream | null = null;
    let animationFrameId: number | null = null;
    let isCancelled = false;

    const startCamera = async () => {
      try {
        setCameraError(null);
        setCameraStatusText('Đang kết nối Camera...');
        if (
          typeof window === 'undefined' ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          const msg =
            'Trình duyệt chặn Camera (chỉ hỗ trợ trên http://localhost:3000 hoặc HTTPS).';
          setCameraError(msg);
          setCameraStatusText(msg);
          return;
        }

        // Try standard laptop/PC video constraint first, with fallback
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false,
          });
        } catch {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (isCancelled) {
          activeStream.getTracks().forEach((t) => t.stop());
          return;
        }

        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.srcObject = activeStream;
          videoEl.setAttribute('playsinline', 'true');
          try {
            await videoEl.play();
          } catch {
            // Ignore benign play() interruption when autoPlay is already active
          }
          setCameraError(null);
          setCameraStatusText('Đang quét trực tiếp — đưa mã QR vào khung ngắm');
        }

        const scanFrame = () => {
          if (isCancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState >= 2) {
            const width = video.videoWidth;
            const height = video.videoHeight;
            if (width > 0 && height > 0) {
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'attemptBoth',
                });

                if (qrResult && qrResult.data) {
                  const cleanCode = extractBookingCodeFromQrPayload(qrResult.data);
                  if (cleanCode && cleanCode !== lastScannedCodeRef.current) {
                    lastScannedCodeRef.current = cleanCode;
                    playScannerBeep();
                    handleInspectTicketRef.current(cleanCode);
                    showToast(`Đã quét mã QR thành công: ${cleanCode}`);
                    setTimeout(() => {
                      lastScannedCodeRef.current = '';
                    }, 2500);
                  }
                }
              }
            }
          }
          animationFrameId = requestAnimationFrame(scanFrame);
        };

        animationFrameId = requestAnimationFrame(scanFrame);
      } catch (err: unknown) {
        console.error('[STAFF_CAMERA_ERROR]', err);
        const errName = err instanceof Error ? err.name : '';
        let msg =
          'Không thể mở Webcam. Hãy kiểm tra quyền Camera trên trình duyệt hoặc dùng nút "Tải ảnh QR".';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          msg =
            'Trình duyệt đang chặn quyền Camera. Hãy bấm biểu tượng ổ khóa cạnh địa chỉ localhost:3000 -> Cho phép Camera.';
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          msg = 'Không tìm thấy thiết bị Webcam trên máy tính này.';
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          msg =
            'Webcam đang bận bởi ứng dụng khác. Vui lòng tắt ứng dụng đang dùng Camera rồi thử lại.';
        }
        setCameraError(msg);
        setCameraStatusText(msg);
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraActive, activeTab, extractBookingCodeFromQrPayload, playScannerBeep]);

  // Decode QR code from uploaded image file
  const handleQrFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (qrResult && qrResult.data) {
          const cleanCode = extractBookingCodeFromQrPayload(qrResult.data);
          playScannerBeep();
          handleInspectTicket(cleanCode);
          showToast(`Đã đọc mã QR từ ảnh: ${cleanCode}`);
        } else {
          setScanError('Không nhận diện được mã QR trong ảnh này. Vui lòng chọn ảnh rõ nét hơn.');
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Download QR image helper for easy testing
  const handleDownloadQrImage = (dataUrl: string, orderId: string) => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR-VE-${orderId.slice(0, 10)}.png`;
    link.click();
  };

  const handleConfirmCheckIn = async (orderToCheckIn: SharedTicketOrder) => {
    if (orderToCheckIn.status !== 'PAID') return;

    const requiresAgeCheck = ['T13', 'T16', 'T18', 'C18'].includes(
      orderToCheckIn.age_rating.toUpperCase()
    );
    if (requiresAgeCheck && !ageVerifiedChecked) {
      showToast(`Vui lòng tích xác nhận khách đủ tuổi (${orderToCheckIn.age_rating}) trước khi vào rạp.`);
      return;
    }

    if (selectedSeatsForPartialCheckin.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 ghế để soát vào rạp.');
      return;
    }

    const nowFormatted =
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
      ' - ' +
      new Date().toLocaleDateString('vi-VN');

    const nextCheckedSeats = Array.from(
      new Set([...(orderToCheckIn.checked_in_seats || []), ...selectedSeatsForPartialCheckin])
    );
    const allSeatsChecked = orderToCheckIn.seats.every((s) => nextCheckedSeats.includes(s));

    const updatedOrders = orders.map((o) =>
      o.id === orderToCheckIn.id
        ? {
            ...o,
            checked_in_seats: nextCheckedSeats,
            status: allSeatsChecked ? ('USED' as const) : ('PAID' as const),
            age_check_passed: true,
            checked_in_at: nowFormatted,
            checked_in_by: staffName,
          }
        : o
    );
    saveOrders(updatedOrders);
    setInspectedOrder(updatedOrders.find((o) => o.id === orderToCheckIn.id) || null);
    await syncCheckInToSupabase(orderToCheckIn.id, true);
    showToast(`Đã xác nhận vào rạp cho mã đơn #${orderToCheckIn.id.slice(0, 8)}!`);
  };

  const handleRejectUnderageCheckIn = async (orderToReject: SharedTicketOrder) => {
    const updatedOrders = orders.map((o) =>
      o.id === orderToReject.id
        ? { ...o, status: 'REJECTED_AGE' as const, age_check_passed: false }
        : o
    );
    saveOrders(updatedOrders);
    setInspectedOrder(updatedOrders.find((o) => o.id === orderToReject.id) || null);
    await syncCheckInToSupabase(orderToReject.id, false);
    showToast(`Đã từ chối vé #${orderToReject.id.slice(0, 8)} do khách chưa đủ tuổi ${orderToReject.age_rating}.`);
  };

  // ==========================================================================
  // TAB 2: BÁN VÉ TẠI QUẦY (POS)
  // ==========================================================================
  const [posDateFilter, setPosDateFilter] = useState<'today' | 'tomorrow' | 'all'>('today');
  const [posAudienceType, setPosAudienceType] = useState<AudienceType>('ADULT');
  const [posSelectedMovieId, setPosSelectedMovieId] = useState<number>(movies[0]?.id || 1);

  const movieShowtimes = useMemo(() => {
    const byMovie = showtimes.filter(
      (s) => s.movie_id === posSelectedMovieId && s.status === 'OPEN'
    );
    const selectedMovieObj = movies.find((m) => m.id === posSelectedMovieId) || movies[0];

    // If this movie does not have dedicated showtime rows yet, generate distinct showtime IDs per movie
    // so seats booked for Movie A never appear on Movie B
    const baseList =
      byMovie.length > 0
        ? byMovie
        : showtimes.slice(0, 4).map((st, idx) => ({
            ...st,
            id: posSelectedMovieId * 10000 + (idx + 1),
            movie_id: posSelectedMovieId,
            movie: selectedMovieObj,
          }));

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

    const hasRealTodayOrTomorrow = baseList.some((s) => {
      const d = s.start_time.slice(0, 10);
      return d === todayStr || d === tomorrowStr;
    });

    const resultList =
      posDateFilter === 'all'
        ? baseList
        : hasRealTodayOrTomorrow
        ? baseList.filter(
            (s) =>
              s.start_time.slice(0, 10) ===
              (posDateFilter === 'today' ? todayStr : tomorrowStr)
          )
        : baseList.filter((_, idx) =>
            posDateFilter === 'today' ? idx % 2 === 0 : idx % 2 === 1
          );

    // Sort chronologically from morning to night
    return [...resultList].sort((a, b) => {
      const da = new Date(a.start_time);
      const db = new Date(b.start_time);
      const timeA = da.getHours() * 60 + da.getMinutes();
      const timeB = db.getHours() * 60 + db.getMinutes();
      return timeA - timeB;
    });
  }, [showtimes, movies, posSelectedMovieId, posDateFilter]);

  const [posSelectedShowtimeId, setPosSelectedShowtimeId] = useState<number>(
    movieShowtimes[0]?.id || showtimes[0]?.id || 1
  );

  useEffect(() => {
    if (movieShowtimes.length > 0 && !movieShowtimes.some((s) => s.id === posSelectedShowtimeId)) {
      setPosSelectedShowtimeId(movieShowtimes[0].id);
    }
  }, [movieShowtimes, posSelectedShowtimeId]);

  const activeShowtime = useMemo(
    () =>
      movieShowtimes.find((s) => s.id === posSelectedShowtimeId) ||
      showtimes.find((s) => s.id === posSelectedShowtimeId) ||
      movieShowtimes[0] ||
      showtimes[0],
    [movieShowtimes, showtimes, posSelectedShowtimeId]
  );

  const activeMovie = useMemo(
    () => movies.find((m) => m.id === posSelectedMovieId) || movies[0],
    [movies, posSelectedMovieId]
  );

  const [posSelectedSeats, setPosSelectedSeats] = useState<string[]>([]);
  const [posFoodQuantities, setPosFoodQuantities] = useState<Record<number, number>>({});
  const [posFoodModifiers, setPosFoodModifiers] = useState<
    Record<number, { flavor: string; drinkSize: string }>
  >({});
  const [posPaymentMethod, setPosPaymentMethod] = useState<'CASH' | 'VNPAY'>('CASH');
  const [posSubmitting, setPosSubmitting] = useState<boolean>(false);

  const activePosRoomId = useMemo(() => {
    const roomName = activeShowtime?.room?.name || 'Phòng 1';
    if (roomName.includes('2')) return 'room-q1-2';
    if (roomName.includes('3')) return 'room-q1-3';
    return 'room-q1-1';
  }, [activeShowtime]);

  const currentShowtimeSoldSeats = useMemo(() => {
    const stId = activeShowtime?.id || 1;
    return Array.from(
      new Set([...(bookedSeatsMap[stId] || []), ...(soldSeatsByShowtime[stId] || [])])
    );
  }, [activeShowtime, bookedSeatsMap, soldSeatsByShowtime]);

  const currentRoomMaintenanceSeats = useMemo(
    () => maintenanceSeatsByRoom[activePosRoomId] || [],
    [maintenanceSeatsByRoom, activePosRoomId]
  );

  const orphanSeatWarning = useMemo(
    () =>
      detectOrphanSeats(
        posSelectedSeats,
        currentShowtimeSoldSeats,
        currentRoomMaintenanceSeats
      ),
    [posSelectedSeats, currentShowtimeSoldSeats, currentRoomMaintenanceSeats]
  );

  const getSeatPrice = useCallback(
    (seatCode: string) => {
      const row = seatCode.charAt(0);
      const stdPrice =
        activeShowtime?.prices?.find((p) => p.seat_type?.code === 'STANDARD')?.price || 75000;
      const vipPrice =
        activeShowtime?.prices?.find((p) => p.seat_type?.code === 'VIP')?.price || 95000;
      const couplePrice =
        activeShowtime?.prices?.find((p) => p.seat_type?.code === 'COUPLE')?.price || 110000;

      const base = row === 'H' ? couplePrice : row === 'F' || row === 'G' ? vipPrice : stdPrice;
      const discountPct = AUDIENCE_CONFIG[posAudienceType].discountPercent;
      return Math.round((base * (100 - discountPct)) / 100);
    },
    [activeShowtime, posAudienceType]
  );

  const posTicketSubtotal = useMemo(
    () => posSelectedSeats.reduce((sum, code) => sum + getSeatPrice(code), 0),
    [posSelectedSeats, getSeatPrice]
  );

  const posFoodSubtotal = useMemo(
    () =>
      foods.reduce((sum, item) => {
        const qty = posFoodQuantities[item.id] || 0;
        const mod = posFoodModifiers[item.id];
        const extra = mod?.drinkSize?.includes('+10K') ? 10000 : 0;
        return sum + qty * (item.price + extra);
      }, 0),
    [foods, posFoodQuantities, posFoodModifiers]
  );

  const posGrandTotal = posTicketSubtotal + posFoodSubtotal;

  const togglePosSeat = (seatCode: string) => {
    if (
      currentShowtimeSoldSeats.includes(seatCode) ||
      currentRoomMaintenanceSeats.includes(seatCode)
    ) {
      return;
    }

    const partner = getCouplePartnerSeat(seatCode);
    if (partner) {
      if (
        currentShowtimeSoldSeats.includes(partner) ||
        currentRoomMaintenanceSeats.includes(partner)
      ) {
        return;
      }
      setPosSelectedSeats((prev) =>
        prev.includes(seatCode)
          ? prev.filter((s) => s !== seatCode && s !== partner)
          : Array.from(new Set([...prev, seatCode, partner]))
      );
      return;
    }

    setPosSelectedSeats((prev) =>
      prev.includes(seatCode) ? prev.filter((s) => s !== seatCode) : [...prev, seatCode]
    );
  };

  const adjustPosFood = (foodId: number, delta: number) => {
    setPosFoodQuantities((prev) => ({
      ...prev,
      [foodId]: Math.max(0, (prev[foodId] || 0) + delta),
    }));
    setPosFoodModifiers((prev) =>
      prev[foodId]
        ? prev
        : { ...prev, [foodId]: { flavor: POPCORN_FLAVORS[0], drinkSize: DRINK_OPTIONS[0] } }
    );
  };

  const handleCreatePosOrderAndPrint = async () => {
    if (posSelectedSeats.length === 0 && posFoodSubtotal === 0) return;
    if (orphanSeatWarning) {
      showToast(orphanSeatWarning);
      return;
    }

    setPosSubmitting(true);
    try {
      const generatedHexId =
        '69' +
        Math.floor(Date.now() / 1000).toString(16) +
        Math.random().toString(16).slice(2, 12).padEnd(10, '0');

      const selectedFoodList = foods
        .filter((f) => (posFoodQuantities[f.id] || 0) > 0)
        .map((f) => {
          const mod = posFoodModifiers[f.id] || {
            flavor: POPCORN_FLAVORS[0],
            drinkSize: DRINK_OPTIONS[0],
          };
          const extra = mod.drinkSize.includes('+10K') ? 10000 : 0;
          return {
            name: f.name,
            qty: posFoodQuantities[f.id],
            price: f.price + extra,
            flavor: mod.flavor,
            drinkSize: mod.drinkSize,
            fulfilled: false,
            productUuid: f.supabase_id,
          };
        });

      const nowStr =
        new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' - ' +
        new Date().toLocaleDateString('vi-VN');

      const newOrder: SharedTicketOrder = {
        id: generatedHexId,
        movie_title: activeMovie?.title || 'Phim chiếu rạp CINEMAX',
        age_rating: activeMovie?.age_rating || 'T13',
        cinema_name: activeShowtime?.room?.cinema?.name || 'Cinemax Quận 1',
        room_name: activeShowtime?.room?.name || 'Phòng 1',
        screen_type: activeShowtime?.room?.screen_type || '2D Dolby',
        start_time: activeShowtime?.start_time || new Date().toISOString(),
        seats: posSelectedSeats.length > 0 ? posSelectedSeats : ['F&B'],
        checked_in_seats: [],
        audience_type: posAudienceType,
        foods: selectedFoodList,
        food_fulfilled: false,
        promo_code: null,
        discount_amount: 0,
        total_amount: posGrandTotal,
        payment_method: posPaymentMethod,
        customer_name: 'Khách vãng lai (POS)',
        customer_phone: `Quầy ${posTerminal}`,
        customer_email: 'pos@cinemax.vn',
        status: 'PAID',
        age_check_passed: false,
        created_at: nowStr,
        channel: 'POS',
        showtime_id: activeShowtime?.id || 1,
      };

      saveOrders([newOrder, ...orders]);

      if (posSelectedSeats.length > 0 && activeShowtime) {
        const nextBooked = {
          ...bookedSeatsMap,
          [activeShowtime.id]: [
            ...(bookedSeatsMap[activeShowtime.id] || []),
            ...posSelectedSeats,
          ],
        };
        setBookedSeatsMap(nextBooked);
        localStorage.setItem('cinemax_booked_seats_v2', JSON.stringify(nextBooked));
      }

      const syncResult = await syncOrderToSupabase({
        orderCode: generatedHexId,
        channel: 'pos',
        contactName: 'Khách vãng lai (POS)',
        contactEmail: 'pos@cinemax.vn',
        contactPhone: '0900000000',
        subtotal: posGrandTotal,
        discountAmount: 0,
        totalAmount: posGrandTotal,
        paymentProvider: posPaymentMethod,
        showtimeUuid: activeShowtime?.supabase_id,
        auditoriumUuid: activeShowtime?.auditorium_id,
        seatCodes: posSelectedSeats,
        seatUuidLookup,
        audienceType: posAudienceType,
        unitTicketPrice:
          posSelectedSeats.length > 0
            ? Math.round(posTicketSubtotal / posSelectedSeats.length)
            : 0,
        movieSnapshot: {
          movieTitle: activeMovie?.title || 'Phim chiếu rạp CINEMAX',
          cinemaName: activeShowtime?.room?.cinema?.name || 'Cinemax Quận 1',
          roomName: activeShowtime?.room?.name || 'Phòng 1',
          showTime: new Date(activeShowtime?.start_time || Date.now()).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          showDate: new Date(activeShowtime?.start_time || Date.now()).toLocaleDateString('vi-VN'),
          format: activeShowtime?.room?.screen_type || '2D Dolby',
          ageRating: activeMovie?.age_rating || 'T13',
        },
        foodItems: selectedFoodList.map((f) => ({
          productUuid: f.productUuid,
          name: `${f.name} (${f.flavor}, ${f.drinkSize})`,
          quantity: f.qty,
          unitPrice: f.price,
        })),
      });

      if (syncResult.synced && syncResult.orderCode && syncResult.orderCode !== generatedHexId) {
        newOrder.id = syncResult.orderCode;
        const currentStored = orders.filter((o) => o.id !== generatedHexId);
        saveOrders([newOrder, ...currentStored]);
      }

      await refreshFromSupabase();
      setPosSelectedSeats([]);
      setPosFoodQuantities({});
      setPrintingOrder(newOrder);
      showToast(`Đã tạo vé POS #${newOrder.id} thành công (Đã lưu Supabase)!`);
    } finally {
      setPosSubmitting(false);
    }
  };

  // ==========================================================================
  // TAB 3: BẮP NƯỚC & KHO (CLEAN SUB-TAB SWITCHER)
  // ==========================================================================
  const [concessionSubTab, setConcessionSubTab] = useState<'fulfill' | 'inventory'>('fulfill');
  const [concessionSearchCode, setConcessionSearchCode] = useState<string>('');
  const [inventoryProductId, setInventoryProductId] = useState<number>(foods[0]?.id || 1);
  const [inventoryMoveType, setInventoryMoveType] = useState<'IMPORT' | 'LOSS' | 'ADJUSTMENT'>(
    'IMPORT'
  );
  const [inventoryMoveQty, setInventoryMoveQty] = useState<number>(20);
  const [inventoryMoveReason, setInventoryMoveReason] = useState<string>('Nhập bổ sung đầu ca');

  const handleFulfillFoodOrder = async (orderId: string) => {
    const nextOrders = orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            food_fulfilled: true,
            foods: o.foods.map((f) => ({ ...f, fulfilled: true })),
          }
        : o
    );
    saveOrders(nextOrders);
    await syncConcessionFulfillmentToSupabase(orderId, staffName);
    showToast(`Đã xác nhận giao đủ combo cho đơn #${orderId.slice(0, 8)} (Đã đồng bộ Supabase)!`);
  };

  const handleRecordInventoryMovement = async () => {
    const product = foods.find((f) => f.id === inventoryProductId) || foods[0];
    if (!product) return;

    const currentStock = product.stock ?? 150;
    const signedQty =
      inventoryMoveType === 'LOSS'
        ? -Math.abs(inventoryMoveQty)
        : inventoryMoveType === 'IMPORT'
        ? Math.abs(inventoryMoveQty)
        : inventoryMoveQty;
    const newStock = Math.max(0, currentStock + signedQty);

    updateFoodItem(product.id, { stock: newStock });

    await syncStockMovementToSupabase({
      productUuid: product.supabase_id,
      productName: product.name,
      movementType: inventoryMoveType,
      quantity: signedQty,
      newStock,
      reason: inventoryMoveReason.trim() || 'Kiểm kê kho quầy',
    });

    showToast(`Đã cập nhật tồn kho "${product.name}" thành ${newStock}!`);
  };

  // ==========================================================================
  // TAB 4: QUẢN LÝ PHÒNG & GHẾ
  // ==========================================================================
  const [selectedRoomForModal, setSelectedRoomForModal] = useState<RoomDefinition | null>(null);

  const toggleMaintenanceSeat = (roomId: string, seatCode: string) => {
    setMaintenanceSeatsByRoom((prev) => {
      const currentList = prev[roomId] || [];
      const exists = currentList.includes(seatCode);
      const nextList = exists
        ? currentList.filter((s) => s !== seatCode)
        : [...currentList, seatCode];
      const nextMap = { ...prev, [roomId]: nextList };
      try {
        localStorage.setItem('cinemax_maintenance_seats_v2', JSON.stringify(nextMap));
      } catch {
        // Ignore
      }
      return nextMap;
    });
  };

  // ==========================================================================
  // TAB 5: BÁO CÁO CA LÀM VIỆC
  // ==========================================================================
  const shiftMetrics = useMemo(() => {
    const validOrders = orders.filter(
      (o) =>
        o.status !== 'CANCELLED' &&
        o.status !== 'REFUNDED' &&
        o.status !== 'REJECTED_AGE'
    );
    const posOrders = validOrders.filter((o) => o.channel === 'POS');
    const posCashRevenue = posOrders
      .filter((o) => o.payment_method === 'CASH')
      .reduce((sum, o) => sum + o.total_amount, 0);
    const posTotalRevenue = posOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const posTicketsSoldCount = posOrders.length;
    const checkedInCount = orders.filter((o) => o.status === 'USED').length;

    return {
      posCashRevenue,
      posTotalRevenue,
      posTicketsSoldCount,
      checkedInCount,
    };
  }, [orders]);

  const [openingCash, setOpeningCash] = useState<number>(2000000);
  const [countedCashInput, setCountedCashInput] = useState<string>('');
  const [varianceReasonInput, setVarianceReasonInput] = useState<string>('');
  const [shiftApprovedStatus, setShiftApprovedStatus] = useState<'OPEN' | 'SUBMITTED' | 'APPROVED'>(
    'OPEN'
  );

  const expectedDrawerCash = openingCash + shiftMetrics.posCashRevenue;
  const parsedCountedCash =
    countedCashInput.trim() !== '' ? Number(countedCashInput) : expectedDrawerCash;
  const cashVariance = parsedCountedCash - expectedDrawerCash;

  const handleCloseShift = async () => {
    if (cashVariance !== 0 && !varianceReasonInput.trim()) {
      showToast('Vui lòng nhập lý do giải trình chênh lệch tiền mặt trước khi kết ca.');
      return;
    }

    await syncShiftToSupabase({
      posTerminal,
      shiftType: shiftLabel,
      openingCash,
      expectedCash: expectedDrawerCash,
      countedCash: parsedCountedCash,
      varianceReason: varianceReasonInput.trim() || 'Khớp tiền mặt tại két',
      status: staffRole === 'SUPERVISOR' ? 'closed' : 'submitted',
    });

    setShiftApprovedStatus(staffRole === 'SUPERVISOR' ? 'APPROVED' : 'SUBMITTED');
    showToast(
      staffRole === 'SUPERVISOR'
        ? `Đã chốt và duyệt bàn giao ${shiftLabel} thành công!`
        : `Đã gửi biên bản chốt ca chờ Trưởng ca duyệt!`
    );
  };

  // ==========================================================================
  // TAB 6: LỊCH SỬ GIAO DỊCH & ĐỔI/HOÀN VÉ
  // ==========================================================================
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    'ALL' | 'USED' | 'PAID' | 'CANCELLED'
  >('ALL');
  const [exchangingOrder, setExchangingOrder] = useState<SharedTicketOrder | null>(null);
  const [exchangeShowtimeId, setExchangeShowtimeId] = useState<number>(1);
  const [exchangeNewSeats, setExchangeNewSeats] = useState<string[]>([]);
  const [refundingOrder, setRefundingOrder] = useState<SharedTicketOrder | null>(null);
  const [refundReasonInput, setRefundReasonInput] = useState<string>('Khách yêu cầu hủy/hoàn vé trước giờ chiếu');

  const filteredHistoryOrders = useMemo(() => {
    return orders.filter((o) => {
      if (historyStatusFilter !== 'ALL' && o.status !== historyStatusFilter) {
        return false;
      }
      if (!historySearch.trim()) return true;
      const q = historySearch.toLowerCase();
      return (
        o.id.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.movie_title.toLowerCase().includes(q) ||
        o.seats.join(', ').toLowerCase().includes(q)
      );
    });
  }, [orders, historySearch, historyStatusFilter]);

  const handleOpenExchangeModal = (order: SharedTicketOrder) => {
    setExchangingOrder(order);
    setExchangeShowtimeId(order.showtime_id || 1);
    setExchangeNewSeats([...order.seats]);
  };

  const handleConfirmExchangeTicket = async () => {
    if (!exchangingOrder || exchangeNewSeats.length === 0) return;

    const targetShowtime = showtimes.find((s) => s.id === exchangeShowtimeId) || showtimes[0];
    const newTicketCost = exchangeNewSeats.reduce((sum, code) => {
      const r = code.charAt(0);
      return sum + (r === 'H' ? 110000 : r === 'F' || r === 'G' ? 95000 : 75000);
    }, 0);
    const oldFoodCost = exchangingOrder.foods.reduce((sum, f) => sum + f.qty * f.price, 0);
    const oldTicketCost = Math.max(0, exchangingOrder.total_amount - oldFoodCost);
    const surcharge = Math.max(0, newTicketCost - oldTicketCost);

    const oldStId = exchangingOrder.showtime_id || 1;
    const nextBooked = { ...bookedSeatsMap };
    nextBooked[oldStId] = (nextBooked[oldStId] || []).filter(
      (s) => !exchangingOrder.seats.includes(s)
    );
    nextBooked[exchangeShowtimeId] = Array.from(
      new Set([...(nextBooked[exchangeShowtimeId] || []), ...exchangeNewSeats])
    );
    setBookedSeatsMap(nextBooked);
    localStorage.setItem('cinemax_booked_seats_v2', JSON.stringify(nextBooked));

    const newRoomName = targetShowtime?.room?.name || exchangingOrder.room_name;
    const newStartTime = targetShowtime?.start_time || exchangingOrder.start_time;
    const newTotalAmount = exchangingOrder.total_amount + surcharge;

    const nextOrders = orders.map((o) =>
      o.id === exchangingOrder.id
        ? {
            ...o,
            showtime_id: exchangeShowtimeId,
            room_name: newRoomName,
            start_time: newStartTime,
            seats: exchangeNewSeats,
            surcharge_amount: (o.surcharge_amount || 0) + surcharge,
            total_amount: newTotalAmount,
          }
        : o
    );
    saveOrders(nextOrders);
    await syncSeatExchangeToSupabase({
      orderCode: exchangingOrder.id,
      newRoomName,
      newStartTime,
      newSeats: exchangeNewSeats,
      surcharge,
      newTotalAmount,
    });
    setExchangingOrder(null);
    showToast(
      surcharge > 0
        ? `Đã đổi sang ghế ${exchangeNewSeats.join(', ')} (Phụ phí nâng hạng: +${surcharge.toLocaleString('vi-VN')} đ - Đã đồng bộ Supabase)`
        : `Đã đổi sang ghế ${exchangeNewSeats.join(', ')} thành công (Đã đồng bộ Supabase)!`
    );
  };

  const handleCreateRefundRequest = async () => {
    if (!refundingOrder) return;
    const nextOrders = orders.map((o) =>
      o.id === refundingOrder.id
        ? {
            ...o,
            status:
              staffRole === 'SUPERVISOR'
                ? ('REFUNDED' as const)
                : ('REFUND_PENDING' as const),
          }
        : o
    );
    saveOrders(nextOrders);

    await syncRefundToSupabase({
      orderCode: refundingOrder.id,
      refundType: 'CUSTOMER_REQUEST',
      reason: refundReasonInput,
      amount: refundingOrder.total_amount,
      status: staffRole === 'SUPERVISOR' ? 'approved' : 'pending',
    });

    setRefundingOrder(null);
    showToast(
      staffRole === 'SUPERVISOR'
        ? `Đã hoàn tiền đơn #${refundingOrder.id.slice(0, 8)} thành công!`
        : `Đã gửi yêu cầu hoàn tiền đơn #${refundingOrder.id.slice(0, 8)} chờ Trưởng ca duyệt!`
    );
  };

  // ==========================================================================
  // CLEAN SIDEBAR ITEMS (EXACTLY MATCHING VIDEO SIMPLICITY)
  // ==========================================================================
  const allSidebarItems: { id: StaffTab; label: string }[] = [
    { id: 'checkin', label: 'Soát vé (Check-in)' },
    { id: 'pos', label: 'Bán vé tại quầy (POS)' },
    { id: 'rooms', label: 'Quản lý Phòng & Ghế' },
    { id: 'shift', label: 'Báo cáo Ca làm việc' },
    { id: 'history', label: 'Lịch sử giao dịch' },
    { id: 'concession', label: 'Bắp nước & Kho' },
  ];

  const visibleSidebarItems = useMemo(() => {
    const allowed = ROLE_CONFIG[staffRole].allowedTabs;
    return allSidebarItems.filter((item) => allowed.includes(item.id));
  }, [staffRole]);

  const activeTabTitle =
    allSidebarItems.find((item) => item.id === activeTab)?.label || 'Soát vé (Check-in)';

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 flex font-sans select-none">
      {/* ==================================================================== */}
      {/* MINIMAL LEFT SIDEBAR (EXACT MATCH TO VIDEO, NO CLUTTER)              */}
      {/* ==================================================================== */}
      <aside className="w-[230px] bg-[#0D1017] border-r border-[#1A1F2C] flex flex-col justify-between shrink-0">
        <div>
          {/* Clean Brand Header */}
          <div className="h-14 px-6 flex items-center gap-2.5 border-b border-[#1A1F2C]">
            <span className="bg-[#E63845] text-white font-black text-xs px-2 py-0.5 rounded">
              CINEMAX
            </span>
            <span className="text-white font-extrabold text-base tracking-wider">STAFF</span>
          </div>

          {/* Clean Menu List */}
          <nav className="p-3 space-y-1 mt-1">
            {visibleSidebarItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                    isActive
                      ? 'bg-[#2A1217] text-[#E63845]'
                      : 'text-slate-400 hover:bg-[#141822] hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Minimal Footer */}
        <div className="p-4 border-t border-[#1A1F2C] space-y-2">
          <Link
            href="/"
            className="block w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-[#141822] transition"
          >
            Đăng xuất
          </Link>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* MAIN CONTENT AREA                                                    */}
      {/* ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean Top Header Bar */}
        <header className="h-14 bg-[#0D1017] border-b border-[#1A1F2C] px-8 flex items-center justify-between shrink-0">
          <span className="text-sm font-bold text-slate-200">{activeTabTitle}</span>

          <div className="flex items-center gap-4">
            {/* Compact Role Selector */}
            <select
              value={staffRole}
              onChange={(e) => handleRoleChange(e.target.value as StaffRoleCode)}
              className="bg-[#141822] border border-[#242B3D] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:border-[#E63845]"
            >
              <option value="SUPERVISOR">Trưởng ca (Toàn quyền)</option>
              <option value="POS">Nhân viên POS (Bán vé)</option>
              <option value="CHECKIN">Nhân viên Soát vé</option>
              <option value="CONCESSION">Nhân viên Bắp nước</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="text-right hover:opacity-80 transition"
            >
              <div className="text-xs font-bold text-white">{staffName}</div>
              <div className="text-[11px] text-slate-400">
                {posTerminal} • Nhận ca / Đổi MK
              </div>
            </button>
          </div>
        </header>

        {/* Subtle Floating Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-[#132A1C] border border-[#22C55E]/60 text-[#4ADE80] text-xs font-bold shadow-2xl">
            {toastMessage}
          </div>
        )}

        {/* Workspace Body */}
        <main className="flex-1 p-8 overflow-y-auto">
          {/* ================================================================ */}
          {/* TAB 1: SOÁT VÉ (CHECK-IN) — CLEAN 2-COLUMN VIDEO LAYOUT          */}
          {/* ================================================================ */}
          {activeTab === 'checkin' && (
            <div className="max-w-4xl mx-auto pt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Left Column */}
                <div className="space-y-5">
                  {/* Card 1: Real Camera & Image QR Scanner */}
                  <div className="bg-[#11141D] border border-[#1E2433] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-bold text-white">Quét Mã QR (Camera)</h2>
                      <div className="flex items-center gap-2">
                        <input
                          ref={qrFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleQrFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => qrFileInputRef.current?.click()}
                          className="px-2.5 py-1 rounded bg-[#181D2B] hover:bg-[#232A3D] border border-[#2A3246] text-[11px] font-semibold text-slate-200 transition"
                        >
                          Tải ảnh QR
                        </button>
                        <button
                          type="button"
                          onClick={() => setCameraActive(!cameraActive)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                            cameraActive
                              ? 'bg-[#E63845] text-white'
                              : 'bg-[#132E1F] border border-[#22C55E]/50 text-[#4ADE80]'
                          }`}
                        >
                          {cameraActive ? 'Tắt Camera' : 'Bật Camera'}
                        </button>
                      </div>
                    </div>

                    {/* Hidden canvas for jsQR frame decoding */}
                    <canvas ref={canvasRef} className="hidden" />

                    <div
                      onClick={() => {
                        if (!cameraActive) setCameraActive(true);
                      }}
                      className={`bg-black rounded-xl border border-[#222838] h-[230px] relative overflow-hidden flex flex-col items-center justify-center p-4 ${
                        !cameraActive ? 'cursor-pointer' : ''
                      }`}
                    >
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`absolute inset-0 w-full h-full object-cover ${
                          cameraActive && !cameraError ? 'block' : 'hidden'
                        }`}
                      />

                      {/* Green Scanner Reticle */}
                      <div className="w-[155px] h-[155px] relative z-10 flex flex-col items-center justify-center text-center px-3">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#84CC16]" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-[#84CC16]" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-[#84CC16]" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#84CC16]" />

                        {!cameraActive && (
                          <span className="text-xs text-slate-400">
                            Camera đang tắt (Bấm vào đây để bật)
                          </span>
                        )}

                        {cameraActive && cameraError && (
                          <div className="space-y-2">
                            <p className="text-[11px] text-[#F87171] leading-snug">
                              {cameraError}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCameraActive(false);
                                setTimeout(() => setCameraActive(true), 150);
                              }}
                              className="px-3 py-1 rounded bg-[#E63845] text-white text-[11px] font-bold"
                            >
                              Thử kết nối lại
                            </button>
                          </div>
                        )}
                      </div>

                      {cameraActive && !cameraError && (
                        <div className="absolute bottom-2 inset-x-3 z-10 text-center pointer-events-none">
                          <span className="inline-block bg-black/75 px-3 py-1 rounded text-[11px] text-slate-200">
                            {cameraStatusText}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Manual Input */}
                  <div className="bg-[#11141D] border border-[#1E2433] rounded-xl p-5">
                    <h3 className="text-sm font-bold text-white mb-3">
                      Nhập mã vé (Nếu quét bị lỗi/mờ)
                    </h3>
                    <div className="flex gap-2.5">
                      <input
                        type="text"
                        value={scanInputCode}
                        onChange={(e) => setScanInputCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInspectTicket()}
                        placeholder="Nhập mã vé..."
                        className="flex-1 bg-[#161A26] border border-[#262D40] rounded-lg px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#E63845]"
                      />
                      <button
                        type="button"
                        onClick={() => handleInspectTicket()}
                        className="bg-[#E63845] hover:bg-[#D02B38] text-white font-bold text-xs px-5 py-2 rounded-lg transition shrink-0"
                      >
                        Kiểm tra
                      </button>
                    </div>

                    {scanError && (
                      <div className="mt-2 text-xs text-[#F87171]">{scanError}</div>
                    )}
                  </div>
                </div>

                {/* Right Column: Ticket Info */}
                <div className="bg-[#11141D] border border-[#1E2433] rounded-xl p-6 min-h-[365px] flex flex-col justify-between">
                  <h2 className="text-sm font-bold text-white mb-4">Thông tin vé soát</h2>

                  {!inspectedOrder ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                      <div className="w-10 h-10 rounded-lg border border-dashed border-slate-700 mb-3" />
                      <p className="text-xs text-slate-500 max-w-xs">
                        Vui lòng đưa mã QR vào khung hình hoặc nhập mã đơn hàng để kiểm tra.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Status Badge */}
                      <div className="flex justify-center">
                        {inspectedOrder.status === 'PAID' && (
                          <span className="px-4 py-1.5 rounded-full bg-[#132E1F] border border-[#22C55E]/60 text-[#4ADE80] text-xs font-bold">
                            VÉ HỢP LỆ - CHƯA CHECK-IN
                          </span>
                        )}
                        {inspectedOrder.status === 'USED' && (
                          <span className="px-4 py-1.5 rounded-full bg-[#2E2313] border border-[#F59E0B]/60 text-[#FBBF24] text-xs font-bold">
                            VÉ ĐÃ CHECK-IN ({inspectedOrder.checked_in_at || 'Đã vào'})
                          </span>
                        )}
                        {(inspectedOrder.status === 'CANCELLED' ||
                          inspectedOrder.status === 'REFUNDED' ||
                          inspectedOrder.status === 'REJECTED_AGE') && (
                          <span className="px-4 py-1.5 rounded-full bg-[#2E1318] border border-[#EF4444]/60 text-[#F87171] text-xs font-bold">
                            VÉ ĐÃ HỦY / TỪ CHỐI
                          </span>
                        )}
                      </div>

                      {/* Clean Details List */}
                      <div className="space-y-2.5 text-xs border-y border-[#1E2433] py-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Mã đơn:</span>
                          <span className="font-mono font-bold text-white">
                            {inspectedOrder.id}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Khách hàng:</span>
                          <span className="font-semibold text-white">
                            {inspectedOrder.customer_name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Phim:</span>
                          <span className="font-bold text-[#E63845]">
                            {inspectedOrder.movie_title} ({inspectedOrder.age_rating})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Phòng / Ghế:</span>
                          <span className="font-bold text-white">
                            {inspectedOrder.room_name} - {inspectedOrder.seats.join(', ')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Suất chiếu:</span>
                          <span className="text-slate-200">
                            {new Date(inspectedOrder.start_time).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            - {new Date(inspectedOrder.start_time).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Đồ ăn kèm:</span>
                          <span className="font-semibold text-[#F87171]">
                            {inspectedOrder.foods && inspectedOrder.foods.length > 0
                              ? inspectedOrder.foods.map((f) => `${f.qty}x ${f.name}`).join(', ')
                              : 'Không có'}
                          </span>
                        </div>
                      </div>

                      {/* Compact Seat & Age Check Row (Only when PAID) */}
                      {inspectedOrder.status === 'PAID' && (
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Chọn ghế vào rạp:</span>
                            <div className="flex gap-1.5">
                              {inspectedOrder.seats.map((seat) => {
                                const isChecked =
                                  selectedSeatsForPartialCheckin.includes(seat);
                                return (
                                  <button
                                    key={seat}
                                    type="button"
                                    onClick={() =>
                                      setSelectedSeatsForPartialCheckin((prev) =>
                                        prev.includes(seat)
                                          ? prev.filter((s) => s !== seat)
                                          : [...prev, seat]
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded text-[11px] font-bold border ${
                                      isChecked
                                        ? 'bg-[#E63845] border-[#E63845] text-white'
                                        : 'bg-[#161A26] border-[#262D40] text-slate-400'
                                    }`}
                                  >
                                    {seat}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                              <input
                                type="checkbox"
                                checked={ageVerifiedChecked}
                                onChange={(e) => setAgeVerifiedChecked(e.target.checked)}
                                className="accent-[#E63845]"
                              />
                              <span>Khách đủ tuổi ({inspectedOrder.age_rating})</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleRejectUnderageCheckIn(inspectedOrder)}
                              className="text-[11px] text-slate-400 hover:text-[#F87171] underline"
                            >
                              Từ chối do chưa đủ tuổi
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2 Action Buttons Matching Video */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setPrintingOrder(inspectedOrder)}
                          className="py-2.5 rounded-lg bg-[#1E2433] hover:bg-[#283044] text-white font-bold text-xs transition"
                        >
                          In vé
                        </button>
                        <button
                          type="button"
                          disabled={inspectedOrder.status !== 'PAID'}
                          onClick={() => handleConfirmCheckIn(inspectedOrder)}
                          className={`py-2.5 rounded-lg font-bold text-xs transition ${
                            inspectedOrder.status === 'PAID'
                              ? 'bg-[#E63845] hover:bg-[#D02B38] text-white'
                              : 'bg-[#191E2B] text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {inspectedOrder.status === 'USED'
                            ? 'Đã xác nhận'
                            : 'Xác nhận vào rạp'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 2: BÁN VÉ TẠI QUẦY (POS) — CLEAN 3-COLUMN VIDEO LAYOUT       */}
          {/* ================================================================ */}
          {activeTab === 'pos' && (
            <div className="space-y-4">
              <h1 className="text-lg font-extrabold text-white">Bán Vé Tại Quầy (POS)</h1>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Col 1: Movie & Showtime */}
                <div className="lg:col-span-4 bg-[#11141D] border border-[#1E2433] rounded-xl p-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      1. Chọn Phim &amp; Suất
                    </h2>

                    <div className="grid grid-cols-3 gap-1.5 bg-[#0B0D13] p-1 rounded-lg border border-[#1E2433]">
                      {(
                        [
                          { id: 'today', label: 'Hôm nay' },
                          { id: 'tomorrow', label: 'Ngày mai' },
                          { id: 'all', label: 'Tất cả' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setPosDateFilter(tab.id)}
                          className={`py-1.5 rounded text-xs font-bold transition ${
                            posDateFilter === tab.id
                              ? 'bg-white text-black'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <select
                      value={posSelectedMovieId}
                      onChange={(e) => {
                        setPosSelectedMovieId(Number(e.target.value));
                        setPosSelectedSeats([]);
                      }}
                      className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2.5 text-xs text-white font-semibold focus:outline-none focus:border-[#E63845]"
                    >
                      {movies.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} ({m.age_rating})
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2.5">
                      {movieShowtimes.map((st) => {
                        const isSelected = st.id === activeShowtime?.id;
                        const timeStr = new Date(st.start_time).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setPosSelectedShowtimeId(st.id);
                              setPosSelectedSeats([]);
                            }}
                            className={`p-2.5 rounded-lg border text-center transition ${
                              isSelected
                                ? 'bg-[#E63845] border-[#E63845] text-white'
                                : 'bg-[#161A26] border-[#262D40] text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            <div className="text-sm font-extrabold">{timeStr}</div>
                            <div
                              className={`text-[11px] ${
                                isSelected ? 'text-white/90' : 'text-slate-400'
                              }`}
                            >
                              {st.room?.name || 'Phòng 1'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Compact Audience Pills at Bottom of Col 1 */}
                  <div className="pt-4 border-t border-[#1E2433] space-y-2">
                    <div className="text-[11px] text-slate-400">Đối tượng khách:</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(AUDIENCE_CONFIG) as AudienceType[]).map((audKey) => (
                        <button
                          key={audKey}
                          type="button"
                          onClick={() => setPosAudienceType(audKey)}
                          className={`py-1.5 px-2 rounded text-[11px] font-semibold border transition ${
                            posAudienceType === audKey
                              ? 'bg-[#2A1217] border-[#E63845] text-[#E63845]'
                              : 'bg-[#161A26] border-[#262D40] text-slate-400'
                          }`}
                        >
                          {AUDIENCE_CONFIG[audKey].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Col 2: Seat Grid */}
                <div className="lg:col-span-4 bg-[#11141D] border border-[#1E2433] rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        2. Chọn Ghế
                      </h2>
                      <span className="text-xs font-bold text-[#E63845]">
                        {activeShowtime?.room?.name || 'Phòng 1'}
                      </span>
                    </div>

                    <div className="mb-5 text-center">
                      <div className="h-1 w-3/4 mx-auto rounded-full bg-[#E63845]" />
                      <div className="text-[10px] tracking-[0.2em] text-slate-500 mt-1.5">
                        MÀN HÌNH
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {SEAT_ROWS.map((row) => {
                        const isVipRow = row === 'F' || row === 'G';
                        const isCoupleRow = row === 'H';
                        return (
                          <div key={row} className="flex items-center justify-center gap-1">
                            <span className="w-4 text-[10px] font-bold text-slate-500 text-center">
                              {row}
                            </span>
                            <div className="grid grid-cols-10 gap-1">
                              {SEAT_COLS.map((col) => {
                                const code = `${row}${col}`;
                                const isSold = currentShowtimeSoldSeats.includes(code);
                                const isMaint = currentRoomMaintenanceSeats.includes(code);
                                const isSelected = posSelectedSeats.includes(code);

                                let seatClass =
                                  'bg-[#283044] text-slate-200 border-[#36415C] hover:border-white';
                                if (isVipRow) {
                                  seatClass =
                                    'bg-[#3B2610] text-[#FBBF24] border-[#92400E] hover:border-[#FBBF24]';
                                }
                                if (isCoupleRow) {
                                  seatClass =
                                    'bg-[#3B1530] text-[#F472B6] border-[#9D174D] hover:border-[#F472B6]';
                                }
                                if (isSelected) {
                                  seatClass = 'bg-[#E63845] text-white border-[#E63845] font-bold';
                                }
                                if (isSold) {
                                  seatClass =
                                    'bg-[#181C26] text-slate-600 border-[#1E2433] cursor-not-allowed';
                                }
                                if (isMaint) {
                                  seatClass =
                                    'bg-[#3A1217] text-[#F87171] border-[#7F1D1D] cursor-not-allowed line-through';
                                }

                                return (
                                  <button
                                    key={code}
                                    type="button"
                                    disabled={isSold || isMaint}
                                    onClick={() => togglePosSeat(code)}
                                    className={`w-7 h-7 rounded text-[10px] border transition ${seatClass}`}
                                  >
                                    {code}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {orphanSeatWarning && (
                      <div className="mt-3 text-[11px] text-[#F87171] text-center font-semibold">
                        {orphanSeatWarning}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#1E2433] flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-400">
                    <span>Thường (A-E)</span>
                    <span className="text-[#FBBF24]">VIP (F-G)</span>
                    <span className="text-[#F472B6]">Đôi (H)</span>
                    <span className="text-[#E63845]">Đang chọn ({posSelectedSeats.length})</span>
                  </div>
                </div>

                {/* Col 3: Food & Checkout */}
                <div className="lg:col-span-4 bg-[#11141D] border border-[#1E2433] rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
                      3. Đồ ăn &amp; Nước
                    </h2>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {foods.map((item) => {
                        const qty = posFoodQuantities[item.id] || 0;
                        const mod = posFoodModifiers[item.id] || {
                          flavor: POPCORN_FLAVORS[0],
                          drinkSize: DRINK_OPTIONS[0],
                        };
                        return (
                          <div
                            key={item.id}
                            className="bg-[#161A26] border border-[#242B3D] rounded-lg px-3 py-2 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-semibold text-white truncate">
                                  {item.name}
                                </div>
                                <div className="text-[11px] font-bold text-[#E63845]">
                                  {item.price.toLocaleString('vi-VN')} đ
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => adjustPosFood(item.id, -1)}
                                  className="w-6 h-6 rounded bg-[#23293A] text-white font-bold text-xs"
                                >
                                  -
                                </button>
                                <span className="w-4 text-center text-xs font-bold text-white">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => adjustPosFood(item.id, 1)}
                                  className="w-6 h-6 rounded bg-[#E63845] text-white font-bold text-xs"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {qty > 0 && (
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <select
                                  value={mod.flavor}
                                  onChange={(e) =>
                                    setPosFoodModifiers((prev) => ({
                                      ...prev,
                                      [item.id]: { ...mod, flavor: e.target.value },
                                    }))
                                  }
                                  className="bg-[#0D1017] border border-[#262D40] rounded px-1.5 py-1 text-[10px] text-slate-300"
                                >
                                  {POPCORN_FLAVORS.map((flav) => (
                                    <option key={flav} value={flav}>
                                      {flav}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={mod.drinkSize}
                                  onChange={(e) =>
                                    setPosFoodModifiers((prev) => ({
                                      ...prev,
                                      [item.id]: { ...mod, drinkSize: e.target.value },
                                    }))
                                  }
                                  className="bg-[#0D1017] border border-[#262D40] rounded px-1.5 py-1 text-[10px] text-slate-300"
                                >
                                  {DRINK_OPTIONS.map((dr) => (
                                    <option key={dr} value={dr}>
                                      {dr}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#1E2433] space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Tiền vé ({posSelectedSeats.length} ghế):</span>
                      <span className="text-slate-200">
                        {posTicketSubtotal.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Tiền đồ ăn:</span>
                      <span className="text-slate-200">
                        {posFoodSubtotal.toLocaleString('vi-VN')} đ
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Thanh toán:</span>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPosPaymentMethod('CASH')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            posPaymentMethod === 'CASH'
                              ? 'bg-[#2A1217] border-[#E63845] text-[#E63845]'
                              : 'bg-[#161A26] border-[#262D40] text-slate-400'
                          }`}
                        >
                          Tiền mặt
                        </button>
                        <button
                          type="button"
                          onClick={() => setPosPaymentMethod('VNPAY')}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            posPaymentMethod === 'VNPAY'
                              ? 'bg-[#2A1217] border-[#E63845] text-[#E63845]'
                              : 'bg-[#161A26] border-[#262D40] text-slate-400'
                          }`}
                        >
                          Mã QR
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-baseline pt-2 border-t border-[#1E2433]">
                      <span className="text-xs font-extrabold text-white">TỔNG CỘNG:</span>
                      <span className="text-base font-black text-[#E63845]">
                        {posGrandTotal.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={
                        posSubmitting ||
                        Boolean(orphanSeatWarning) ||
                        (posSelectedSeats.length === 0 && posFoodSubtotal === 0)
                      }
                      onClick={handleCreatePosOrderAndPrint}
                      className={`w-full py-2.5 rounded-lg font-bold text-xs transition ${
                        !orphanSeatWarning &&
                        (posSelectedSeats.length > 0 || posFoodSubtotal > 0)
                          ? 'bg-[#E63845] hover:bg-[#D02B38] text-white'
                          : 'bg-[#1D2230] text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      Tạo Vé &amp; In Hoá Đơn
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 3: QUẢN LÝ PHÒNG & GHẾ — CLEAN 2-COLUMN VIDEO LAYOUT         */}
          {/* ================================================================ */}
          {activeTab === 'rooms' && (
            <div className="max-w-5xl space-y-5">
              <h1 className="text-lg font-extrabold text-white">Quản Lý Phòng &amp; Ghế</h1>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((cinemaId) => {
                  const cinemaRooms = DEFAULT_ROOMS.filter((r) => r.cinemaId === cinemaId);
                  const firstRoom = cinemaRooms[0];
                  return (
                    <div
                      key={cinemaId}
                      className="bg-[#11141D] border border-[#1E2433] rounded-xl p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-[#1E2433] pb-3">
                        <div>
                          <h2 className="text-sm font-bold text-white">{firstRoom.cinemaName}</h2>
                          <p className="text-[11px] text-slate-400">{firstRoom.cinemaAddress}</p>
                        </div>
                        <span className="text-xs text-[#E63845] font-bold">
                          {cinemaRooms.length} phòng
                        </span>
                      </div>

                      <div className="space-y-2">
                        {cinemaRooms.map((room) => {
                          const brokenCount = (maintenanceSeatsByRoom[room.id] || []).length;
                          return (
                            <div
                              key={room.id}
                              onClick={() => setSelectedRoomForModal(room)}
                              className="flex items-center justify-between bg-[#161A26] hover:bg-[#1C2233] border border-[#242B3D] rounded-lg px-4 py-2.5 cursor-pointer transition"
                            >
                              <div className="text-xs">
                                <span className="font-bold text-white">{room.roomName}</span>
                                <span className="text-slate-400 ml-2">({room.screenType})</span>
                                {brokenCount > 0 && (
                                  <span className="ml-2 text-[#F87171] font-semibold">
                                    • {brokenCount} ghế bảo trì
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-300 font-semibold">
                                Sơ đồ ghế
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 4: BÁO CÁO CA LÀM VIỆC — CLEAN 3 KPI CARDS + 1 COMPACT FORM   */}
          {/* ================================================================ */}
          {activeTab === 'shift' && (
            <div className="max-w-5xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-extrabold text-white">Báo Cáo Ca Làm Việc</h1>
                  <p className="text-xs text-slate-400">
                    Nhân viên: {staffName} • {posTerminal} ({shiftLabel})
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    shiftApprovedStatus === 'APPROVED'
                      ? 'bg-[#132E1F] text-[#4ADE80]'
                      : shiftApprovedStatus === 'SUBMITTED'
                      ? 'bg-[#2E2313] text-[#FBBF24]'
                      : 'bg-[#161A26] text-slate-300'
                  }`}
                >
                  {shiftApprovedStatus === 'APPROVED'
                    ? 'Đã duyệt chốt ca'
                    : shiftApprovedStatus === 'SUBMITTED'
                    ? 'Chờ Trưởng ca duyệt'
                    : 'Ca đang mở'}
                </span>
              </div>

              {/* 3 Large KPI Cards Matching Video */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-[#11141D] border border-[#1E2433] rounded-xl p-6 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    DOANH THU TRONG CA
                  </div>
                  <div className="text-2xl font-black text-[#22C55E]">
                    {shiftMetrics.posTotalRevenue.toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Tiền mặt tại két: {shiftMetrics.posCashRevenue.toLocaleString('vi-VN')} đ
                  </div>
                </div>

                <div className="bg-[#11141D] border border-[#1E2433] rounded-xl p-6 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    SỐ VÉ BÁN TẠI QUẦY (POS)
                  </div>
                  <div className="text-2xl font-black text-[#3B82F6]">
                    {shiftMetrics.posTicketsSoldCount} vé
                  </div>
                  <div className="text-[11px] text-slate-500">Tổng số đơn bán tại quầy</div>
                </div>

                <div className="bg-[#11141D] border border-[#1E2433] rounded-xl p-6 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    SỐ VÉ ĐÃ SOÁT (CHECK-IN)
                  </div>
                  <div className="text-2xl font-black text-[#A855F7]">
                    {shiftMetrics.checkedInCount} vé
                  </div>
                  <div className="text-[11px] text-slate-500">Tổng số vé đã vào rạp</div>
                </div>
              </div>

              {/* Clean Handover & Cash Count Box */}
              <div className="bg-[#11141D] border border-[#1E2433] rounded-xl p-6 space-y-5">
                <div>
                  <h2 className="text-sm font-bold text-white mb-2">Hướng dẫn bàn giao ca</h2>
                  <div className="bg-[#0D1017] border border-[#1A1F2C] rounded-lg p-4 space-y-1.5 text-xs text-slate-400">
                    <div>
                      1. Kiểm tra lại tổng tiền mặt trong két khớp với &quot;Doanh thu trong ca&quot;.
                    </div>
                    <div>
                      2. Đối chiếu cuộn giấy in bill từ máy POS với &quot;Số vé bán tại quầy&quot;.
                    </div>
                    <div>
                      3. Ký sổ bàn giao ca cho quản lý hoặc nhân viên ca tiếp theo.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end pt-2 border-t border-[#1E2433]">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Tiền đầu ca ({openingCash.toLocaleString('vi-VN')} đ) + Thu tiền mặt:
                    </label>
                    <div className="bg-[#0D1017] border border-[#242B3D] rounded-lg px-3 py-2 text-xs font-bold text-[#22C55E]">
                      Kỳ vọng: {expectedDrawerCash.toLocaleString('vi-VN')} đ
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Tiền mặt thực đếm cuối ca:
                    </label>
                    <input
                      type="number"
                      value={countedCashInput}
                      onChange={(e) => setCountedCashInput(e.target.value)}
                      placeholder={String(expectedDrawerCash)}
                      className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-[#E63845]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Ghi chú / Giải trình chênh lệch ({cashVariance.toLocaleString('vi-VN')} đ):
                    </label>
                    <input
                      type="text"
                      value={varianceReasonInput}
                      onChange={(e) => setVarianceReasonInput(e.target.value)}
                      placeholder="Khớp quỹ tiền mặt..."
                      className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseShift}
                    className="bg-[#E63845] hover:bg-[#D02B38] text-white font-bold text-xs py-2.5 px-4 rounded-lg transition"
                  >
                    {staffRole === 'SUPERVISOR' ? 'Chốt & Duyệt Ca' : 'Gửi Kết Ca'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 5: LỊCH SỬ GIAO DỊCH — CLEAN TABLE MATCHING VIDEO             */}
          {/* ================================================================ */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h1 className="text-lg font-extrabold text-white">
                  Lịch sử Giao dịch (Vé tại rạp)
                </h1>

                <div className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Tìm mã đơn, tên khách, phim..."
                    className="w-64 bg-[#11141D] border border-[#242B3D] rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E63845]"
                  />

                  <select
                    value={historyStatusFilter}
                    onChange={(e) =>
                      setHistoryStatusFilter(
                        e.target.value as 'ALL' | 'USED' | 'PAID' | 'CANCELLED'
                      )
                    }
                    className="bg-[#11141D] border border-[#242B3D] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="USED">Đã check-in</option>
                    <option value="PAID">Chưa check-in</option>
                    <option value="CANCELLED">Đã hủy</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#11141D] border border-[#1E2433] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#161A26] border-b border-[#1E2433] text-[11px] font-bold text-slate-400">
                        <th className="py-3 px-4">Mã đơn</th>
                        <th className="py-3 px-4">Khách hàng</th>
                        <th className="py-3 px-4">Phim / Suất chiếu</th>
                        <th className="py-3 px-4">Ghế</th>
                        <th className="py-3 px-4">Đồ ăn</th>
                        <th className="py-3 px-4">Tổng tiền</th>
                        <th className="py-3 px-4">Trạng thái</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A1F2D] text-xs">
                      {filteredHistoryOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-[#151925] transition">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#F87171]">
                            #{ord.id.slice(0, 8)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">{ord.customer_name}</div>
                            <div className="text-[11px] text-slate-500">{ord.customer_phone}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-[#E63845]">{ord.movie_title}</div>
                            <div className="text-[11px] text-slate-400">
                              {new Date(ord.start_time).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}{' '}
                              ({ord.room_name})
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1">
                              {ord.seats.map((s) => (
                                <span
                                  key={s}
                                  className="px-2 py-0.5 rounded bg-[#1E2433] text-slate-200 font-bold text-[11px]"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[#FBBF24]">
                            {ord.foods && ord.foods.length > 0
                              ? ord.foods.map((f) => `${f.qty}x ${f.name}`).join(', ')
                              : '-'}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#E63845]">
                            {ord.total_amount.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-3.5 px-4">
                            {ord.status === 'USED' && (
                              <span className="text-[#4ADE80] font-semibold">Đã check-in</span>
                            )}
                            {ord.status === 'PAID' && (
                              <span className="text-[#60A5FA] font-semibold">Đã thanh toán</span>
                            )}
                            {ord.status === 'REFUND_PENDING' && (
                              <span className="text-amber-400 font-semibold">Chờ hoàn tiền</span>
                            )}
                            {ord.status === 'REFUNDED' && (
                              <span className="text-purple-400 font-semibold">Đã hoàn tiền</span>
                            )}
                            {(ord.status === 'CANCELLED' || ord.status === 'REJECTED_AGE') && (
                              <span className="text-slate-500 line-through">Đã hủy</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPrintingOrder(ord)}
                                className="px-2.5 py-1 rounded bg-[#1E2433] hover:bg-[#2B3348] text-slate-200 text-[11px]"
                              >
                                In vé
                              </button>
                              {ord.status === 'PAID' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenExchangeModal(ord)}
                                  className="px-2.5 py-1 rounded bg-[#1E2433] hover:bg-[#2B3348] text-amber-300 text-[11px]"
                                >
                                  Đổi ghế
                                </button>
                              )}
                              {(ord.status === 'PAID' || ord.status === 'USED') && (
                                <button
                                  type="button"
                                  onClick={() => setRefundingOrder(ord)}
                                  className="px-2.5 py-1 rounded bg-[#2A1217] hover:bg-[#E63845] text-[#F87171] hover:text-white text-[11px]"
                                >
                                  Hoàn vé
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TAB 6: BẮP NƯỚC & KHO — CLEAN TOGGLE (ONLY 1 VIEW AT A TIME)      */}
          {/* ================================================================ */}
          {activeTab === 'concession' && (
            <div className="max-w-4xl space-y-5">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-extrabold text-white">Quầy Bắp Nước &amp; Kho</h1>

                <div className="flex bg-[#11141D] p-1 rounded-lg border border-[#1E2433]">
                  <button
                    type="button"
                    onClick={() => setConcessionSubTab('fulfill')}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition ${
                      concessionSubTab === 'fulfill'
                        ? 'bg-[#E63845] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Trả hàng Combo
                  </button>
                  <button
                    type="button"
                    onClick={() => setConcessionSubTab('inventory')}
                    className={`px-4 py-1.5 rounded text-xs font-bold transition ${
                      concessionSubTab === 'inventory'
                        ? 'bg-[#E63845] text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Kiểm kê Kho
                  </button>
                </div>
              </div>

              {concessionSubTab === 'fulfill' ? (
                <div className="bg-[#11141D] border border-[#1E2433] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      Danh sách đơn có bắp nước
                    </span>
                    <input
                      type="text"
                      value={concessionSearchCode}
                      onChange={(e) => setConcessionSearchCode(e.target.value)}
                      placeholder="Nhập mã đơn..."
                      className="bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2.5">
                    {orders
                      .filter(
                        (o) =>
                          o.foods &&
                          o.foods.length > 0 &&
                          (!concessionSearchCode.trim() ||
                            o.id.toLowerCase().includes(concessionSearchCode.toLowerCase()))
                      )
                      .map((ord) => (
                        <div
                          key={ord.id}
                          className="bg-[#161A26] border border-[#242B3D] rounded-lg p-3.5 flex items-center justify-between gap-4"
                        >
                          <div className="text-xs space-y-1">
                            <div className="font-bold text-white">
                              <span className="font-mono text-[#F87171] mr-2">
                                #{ord.id.slice(0, 8)}
                              </span>
                              {ord.customer_name} ({ord.room_name} - {ord.seats.join(', ')})
                            </div>
                            <div className="text-slate-300">
                              {ord.foods
                                .map(
                                  (f) =>
                                    `${f.qty}x ${f.name} (${f.flavor || 'Vị Phô Mai'}, ${
                                      f.drinkSize || 'Coca L'
                                    })`
                                )
                                .join(' • ')}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={ord.food_fulfilled}
                            onClick={() => handleFulfillFoodOrder(ord.id)}
                            className={`px-3.5 py-2 rounded-lg text-xs font-bold shrink-0 ${
                              ord.food_fulfilled
                                ? 'bg-[#1C212E] text-slate-500'
                                : 'bg-[#E63845] text-white'
                            }`}
                          >
                            {ord.food_fulfilled ? 'Đã giao' : 'Giao Combo'}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#11141D] border border-[#1E2433] rounded-xl p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">Sản phẩm:</label>
                      <select
                        value={inventoryProductId}
                        onChange={(e) => setInventoryProductId(Number(e.target.value))}
                        className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-white"
                      >
                        {foods.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} (Tồn: {f.stock ?? 150})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Loại:</label>
                      <select
                        value={inventoryMoveType}
                        onChange={(e) =>
                          setInventoryMoveType(
                            e.target.value as 'IMPORT' | 'LOSS' | 'ADJUSTMENT'
                          )
                        }
                        className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-white"
                      >
                        <option value="IMPORT">Nhập kho (+)</option>
                        <option value="LOSS">Hủy / Hao hụt (-)</option>
                        <option value="ADJUSTMENT">Kiểm kê lại</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Số lượng &amp; Lý do:</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={inventoryMoveQty}
                          onChange={(e) => setInventoryMoveQty(Number(e.target.value))}
                          className="w-20 bg-[#161A26] border border-[#262D40] rounded-lg px-2.5 py-2 text-white font-bold"
                        />
                        <input
                          type="text"
                          value={inventoryMoveReason}
                          onChange={(e) => setInventoryMoveReason(e.target.value)}
                          className="flex-1 bg-[#161A26] border border-[#262D40] rounded-lg px-2.5 py-2 text-white"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRecordInventoryMovement}
                      className="py-2 px-4 rounded-lg bg-[#E63845] text-white font-bold"
                    >
                      Cập nhật kho
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: SƠ ĐỒ GHẾ - QUẢN LÝ PHÒNG & BẢO TRÌ GHẾ                      */}
      {/* ==================================================================== */}
      {selectedRoomForModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#141822] border border-[#262E42] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-[#22283A] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white">
                  Sơ đồ Ghế - {selectedRoomForModal.roomName} ({selectedRoomForModal.cinemaName})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click vào ghế để Khoá (Bảo trì) hoặc Mở khoá ghế
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoomForModal(null)}
                className="px-2.5 py-1 rounded bg-[#1F2536] text-slate-300 hover:text-white text-xs font-bold"
              >
                Đóng
              </button>
            </div>

            <div className="bg-[#252C3D] py-1.5 rounded text-center text-[11px] font-bold tracking-[0.2em] text-slate-300">
              MÀN HÌNH
            </div>

            <div className="space-y-1.5 py-1">
              {selectedRoomForModal.rows.map((row) => (
                <div key={row} className="flex items-center justify-center gap-1.5">
                  <span className="w-4 text-[11px] font-bold text-slate-400 text-center">
                    {row}
                  </span>
                  <div className="grid grid-cols-10 gap-1">
                    {SEAT_COLS.map((col) => {
                      const seatCode = `${row}${col}`;
                      const isBroken = (
                        maintenanceSeatsByRoom[selectedRoomForModal.id] || []
                      ).includes(seatCode);
                      return (
                        <button
                          key={seatCode}
                          type="button"
                          onClick={() =>
                            toggleMaintenanceSeat(selectedRoomForModal.id, seatCode)
                          }
                          className={`w-7 h-7 rounded text-[10px] font-bold border transition ${
                            isBroken
                              ? 'bg-[#E63845] border-[#E63845] text-white'
                              : 'bg-[#283044] border-[#38435E] text-slate-200 hover:border-white'
                          }`}
                        >
                          {seatCode}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#22283A] flex items-center justify-center gap-6 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#283044] inline-block" />
                <span>Hoạt động tốt</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#E63845] inline-block" />
                <span>Đang bảo trì</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: ĐỔI GHẾ / ĐỔI SUẤT CHIẾU                                    */}
      {/* ==================================================================== */}
      {exchangingOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#141822] border border-[#262E42] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-extrabold text-white">
              Đổi Ghế / Suất Chiếu (#{exchangingOrder.id.slice(0, 8)})
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Suất chiếu:</label>
                <select
                  value={exchangeShowtimeId}
                  onChange={(e) => setExchangeShowtimeId(Number(e.target.value))}
                  className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-white"
                >
                  {showtimes.slice(0, 6).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.movie?.title || exchangingOrder.movie_title} —{' '}
                      {new Date(st.start_time).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      ({st.room?.name || 'Phòng 1'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Ghế mới (VD: G5, G6):</label>
                <input
                  type="text"
                  value={exchangeNewSeats.join(', ')}
                  onChange={(e) =>
                    setExchangeNewSeats(
                      e.target.value
                        .split(',')
                        .map((s) => s.trim().toUpperCase())
                        .filter(Boolean)
                    )
                  }
                  className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setExchangingOrder(null)}
                className="py-2 rounded-lg bg-[#1E2433] text-slate-300 font-bold text-xs"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleConfirmExchangeTicket}
                className="py-2 rounded-lg bg-[#E63845] text-white font-bold text-xs"
              >
                Xác nhận đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: HOÀN TIỀN VÉ                                                */}
      {/* ==================================================================== */}
      {refundingOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#141822] border border-[#262E42] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-extrabold text-white">
              Hoàn Tiền Đơn #{refundingOrder.id.slice(0, 8)} (
              {refundingOrder.total_amount.toLocaleString('vi-VN')} đ)
            </h3>
            <textarea
              rows={3}
              value={refundReasonInput}
              onChange={(e) => setRefundReasonInput(e.target.value)}
              className="w-full bg-[#161A26] border border-[#262D40] rounded-lg p-3 text-xs text-white focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRefundingOrder(null)}
                className="py-2 rounded-lg bg-[#1E2433] text-slate-300 font-bold text-xs"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleCreateRefundRequest}
                className="py-2 rounded-lg bg-[#E63845] text-white font-bold text-xs"
              >
                Xác nhận hoàn tiền
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: TÀI KHOẢN, NHẬN CA QUẦY & ĐỔI MẬT KHẨU (2.1)                */}
      {/* ==================================================================== */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#141822] border border-[#262E42] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#22283A] pb-3">
              <h3 className="text-sm font-extrabold text-white">
                Tài Khoản &amp; Nhận Ca Quầy
              </h3>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nhân viên trực:</label>
                <input
                  type="text"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">Máy quầy POS:</label>
                  <select
                    value={posTerminal}
                    onChange={(e) => setPosTerminal(e.target.value)}
                    className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="POS-01">POS-01</option>
                    <option value="POS-02">POS-02</option>
                    <option value="GATE-A">GATE-A</option>
                    <option value="F&B-01">F&amp;B-01</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Ca làm việc:</label>
                  <select
                    value={shiftLabel}
                    onChange={(e) => setShiftLabel(e.target.value)}
                    className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Ca Sáng (08:00 - 14:00)">Ca Sáng</option>
                    <option value="Ca Tối (14:00 - 22:00)">Ca Tối</option>
                    <option value="Ca Đêm (22:00 - 02:00)">Ca Đêm</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Đổi mật khẩu mới (nếu cần):</label>
                <input
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className="w-full bg-[#161A26] border border-[#262D40] rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAccountModal(false);
                setNewPasswordInput('');
                showToast(`Đã lưu thông tin ca trực (${posTerminal} - ${shiftLabel})!`);
              }}
              className="w-full py-2.5 rounded-lg bg-[#E63845] text-white font-bold text-xs"
            >
              Lưu cài đặt
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: IN VÉ NHIỆT                                                 */}
      {/* ==================================================================== */}
      {printingOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white text-black rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4 font-mono">
            <div className="text-center border-b border-dashed border-slate-400 pb-3">
              <div className="text-base font-black">CINEMAX THEATER</div>
              <div className="text-[11px] text-slate-600">{printingOrder.cinema_name}</div>
            </div>

            {printedQrDataUrl && (
              <div className="flex flex-col items-center py-1">
                <img
                  src={printedQrDataUrl}
                  alt="QR Vé"
                  className="w-36 h-36 border border-slate-300 rounded p-1"
                />
                <span className="text-[10px] text-slate-500 mt-1">
                  Mã QR chuẩn quét tại cổng soát vé
                </span>
              </div>
            )}

            <div className="space-y-1.5 text-xs border-b border-dashed border-slate-400 pb-3">
              <div className="flex justify-between">
                <span>Mã đơn:</span>
                <span className="font-bold">#{printingOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Phim:</span>
                <span className="font-bold text-right">{printingOrder.movie_title}</span>
              </div>
              <div className="flex justify-between">
                <span>Phòng / Ghế:</span>
                <span className="font-bold">
                  {printingOrder.room_name} - {printingOrder.seats.join(', ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Đồ ăn:</span>
                <span className="font-bold text-right">
                  {printingOrder.foods && printingOrder.foods.length > 0
                    ? printingOrder.foods.map((f) => `${f.qty}x ${f.name}`).join(', ')
                    : 'Không'}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm font-black">
              <span>TỔNG CỘNG:</span>
              <span>{printingOrder.total_amount.toLocaleString('vi-VN')} đ</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 font-sans">
              <button
                type="button"
                onClick={() => setPrintingOrder(null)}
                className="py-2 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => handleDownloadQrImage(printedQrDataUrl, printingOrder.id)}
                className="py-2 rounded-lg bg-slate-800 text-white font-bold text-xs"
              >
                Tải ảnh QR
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2 rounded-lg bg-[#E63845] text-white font-bold text-xs"
              >
                In ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
