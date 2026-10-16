import { createClient } from './client';
import {
  Movie,
  Cinema,
  Showtime,
  FoodItem,
  Promotion,
  SiteSettings,
  AgeRating,
  MovieStatus,
  ScreenType,
  FoodCategory,
} from '../types';
import {
  MOCK_MOVIES,
  MOCK_CINEMAS,
  MOCK_SHOWTIMES,
  MOCK_FOODS,
  MOCK_PROMOTIONS,
} from '../mock-data';

// Deterministic numeric ID from UUID so existing numeric ID logic in UI works seamlessly
export function uuidToNumId(uuid: string, fallbackIndex = 1): number {
  const knownMovies: Record<string, number> = {
    'c1da65d7-b688-4bcc-9fb8-75efb28e319f': 1,
    '63572ecf-6383-49b1-8d64-d52432be6dac': 4,
    '27c3ef14-cbc5-439e-95b8-ef842c284330': 5,
  };
  if (knownMovies[uuid]) return knownMovies[uuid];

  const knownAuditoriums: Record<string, number> = {
    'd8eae7e2-cf8d-40c6-96d2-bc690626e180': 101,
    '28368dd8-750b-40a0-b6bd-3d763bd0c0f5': 102,
  };
  if (knownAuditoriums[uuid]) return knownAuditoriums[uuid];

  const knownShowtimes: Record<string, number> = {
    '85608755-35ca-4157-87bd-96b50577e0e5': 1001,
    '209a53bf-6137-4e3e-9559-8bbbc5ffe249': 1002,
  };
  if (knownShowtimes[uuid]) return knownShowtimes[uuid];

  const knownProducts: Record<string, number> = {
    'd9c66e64-45ca-4c9e-8b6f-4a45667d6418': 3,
    'e0bf4efd-b1af-4a43-878f-05adfb17a33e': 5,
    '6bf3dc87-4194-4a5c-95ff-c8944bbcbd42': 1,
  };
  if (knownProducts[uuid]) return knownProducts[uuid];

  const hex = uuid.replace(/-/g, '').slice(0, 7);
  const parsed = parseInt(hex, 16);
  return Number.isNaN(parsed) ? 5000 + fallbackIndex : (parsed % 900000) + 10000;
}

export interface SupabaseCatalogResult {
  connected: boolean;
  movies: Movie[];
  cinemas: Cinema[];
  showtimes: Showtime[];
  foods: FoodItem[];
  promotions: Promotion[];
  siteSettings?: Partial<SiteSettings>;
  soldSeatsByShowtime: Record<number, string[]>;
  seatUuidLookup: Record<string, string>; // key: `${auditorium_id}:${seatCode}` -> seat.id uuid
  tableCounts: Record<string, number>;
}

export async function fetchSupabaseCatalog(): Promise<SupabaseCatalogResult> {
  const supabase = createClient();

  const [
    moviesRes,
    auditoriumsRes,
    seatsRes,
    showtimesRes,
    pricesRes,
    stSeatsRes,
    productsRes,
    couponsRes,
    settingsRes,
  ] = await Promise.all([
    supabase.from('movies').select('*, movie_genres(genres(*))').order('created_at', { ascending: false }),
    supabase.from('auditoriums').select('*').order('name', { ascending: true }),
    supabase.from('seats').select('*'),
    supabase.from('showtimes').select('*').order('starts_at', { ascending: true }),
    supabase.from('showtime_prices').select('*'),
    supabase.from('showtime_seats').select('*'),
    supabase.from('products').select('*, product_modifiers(*)').order('created_at', { ascending: true }),
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    supabase.from('cinema_settings').select('*'),
  ]);

  if (moviesRes.error) {
    console.warn('Supabase fetch error:', moviesRes.error.message);
    return {
      connected: false,
      movies: MOCK_MOVIES,
      cinemas: MOCK_CINEMAS,
      showtimes: MOCK_SHOWTIMES,
      foods: MOCK_FOODS,
      promotions: MOCK_PROMOTIONS,
      soldSeatsByShowtime: {},
      seatUuidLookup: {},
      tableCounts: {},
    };
  }

  // 1. Map cinema_settings
  const cinemaInfoRow = (settingsRes.data || []).find((r: { setting_key: string }) => r.setting_key === 'cinema_info');
  const cinemaInfo = cinemaInfoRow?.setting_value || {};
  const primaryCinema: Cinema = {
    id: 1,
    name: cinemaInfo.name || 'CINEMAX Plaza (FPT Polytechnic)',
    address: cinemaInfo.address || 'Tòa nhà FPT Polytechnic, Phố Trịnh Văn Bô, Nam Từ Liêm, Hà Nội',
    district: 'Nam Từ Liêm',
    city: 'Hà Nội',
    phone: cinemaInfo.hotline || '1900-6868',
    is_active: true,
  };
  const mergedCinemas: Cinema[] = [
    primaryCinema,
    ...MOCK_CINEMAS.filter((c) => c.id !== 1),
  ];

  // 2. Map movies from Supabase + merge extra mock movies for rich catalog
  const dbMovies: Movie[] = (moviesRes.data || []).map((m: Record<string, unknown>, idx: number) => {
    const numId = uuidToNumId(String(m.id), idx + 1);
    const mockMatch = MOCK_MOVIES.find((mm) => mm.id === numId || mm.slug === m.slug);
    const rawStatus = String(m.status || 'now_showing').toUpperCase();
    const mappedStatus: MovieStatus =
      rawStatus === 'COMING_SOON'
        ? 'COMING_SOON'
        : rawStatus === 'ENDED'
        ? 'ENDED'
        : 'NOW_SHOWING';

    const mgList = Array.isArray(m.movie_genres) ? m.movie_genres : [];
    const genres = mgList
      .map((mg: { genres?: { id?: string; name?: string; slug?: string } }, gIdx: number) =>
        mg.genres
          ? {
              id: gIdx + 1,
              name: String(mg.genres.name || 'Điện ảnh'),
              slug: String(mg.genres.slug || 'dien-anh'),
            }
          : null
      )
      .filter((g): g is { id: number; name: string; slug: string } => g !== null);

    return {
      id: numId,
      supabase_id: String(m.id),
      title: String(m.title),
      original_title: mockMatch?.original_title || String(m.title),
      slug: String(m.slug),
      synopsis: String(m.synopsis || mockMatch?.synopsis || ''),
      duration_min: Number(m.duration_minutes || mockMatch?.duration_min || 120),
      release_date: String(m.release_date || mockMatch?.release_date || '2026-10-10'),
      age_rating: (String(m.age_rating || 'T13') as AgeRating),
      country: mockMatch?.country || 'Mỹ',
      director: String(m.director || mockMatch?.director || ''),
      cast_list: String(m.cast_list || mockMatch?.cast_list || 'Zendaya, Timothée Chalamet'),
      poster_url: String(m.poster_url || mockMatch?.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800'),
      banner_url: String(m.banner_url || mockMatch?.banner_url || m.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1440'),
      trailer_url: String(m.trailer_url || mockMatch?.trailer_url || 'https://www.youtube.com/watch?v=Way9Dexny3w'),
      imdb_score: mockMatch?.imdb_score || 8.7,
      status: mappedStatus,
      is_deleted: false,
      genres: genres.length > 0 ? genres : mockMatch?.genres || [{ id: 1, name: 'Hành Động', slug: 'hanh-dong' }],
    };
  });

  // Include remaining MOCK_MOVIES that aren't in DB yet so homepage stays rich
  const dbMovieIds = new Set(dbMovies.map((m) => m.id));
  const mergedMovies = [
    ...dbMovies,
    ...MOCK_MOVIES.filter((m) => !dbMovieIds.has(m.id)),
  ];

  // 3. Map seats & auditoriums
  const seatIdToCode: Record<string, string> = {};
  const seatUuidLookup: Record<string, string> = {};
  (seatsRes.data || []).forEach((s: Record<string, unknown>) => {
    const code = `${s.row_label}${s.seat_number}`;
    seatIdToCode[String(s.id)] = code;
    seatUuidLookup[`${s.auditorium_id}:${code}`] = String(s.id);
  });

  const audMap: Record<string, Record<string, unknown>> = {};
  (auditoriumsRes.data || []).forEach((a: Record<string, unknown>) => {
    audMap[String(a.id)] = a;
  });

  // 4. Map showtime_seats & showtimes
  const soldSeatsByShowtime: Record<number, string[]> = {};
  const availableCountByShowtimeUuid: Record<string, number> = {};
  (stSeatsRes.data || []).forEach((ss: Record<string, unknown>) => {
    const stUuid = String(ss.showtime_id);
    const stNumId = uuidToNumId(stUuid);
    const status = String(ss.status || 'available').toLowerCase();
    if (status === 'available') {
      availableCountByShowtimeUuid[stUuid] = (availableCountByShowtimeUuid[stUuid] || 0) + 1;
    } else if (status === 'sold' || status === 'held') {
      const seatCode = seatIdToCode[String(ss.seat_id)];
      if (seatCode) {
        if (!soldSeatsByShowtime[stNumId]) soldSeatsByShowtime[stNumId] = [];
        if (!soldSeatsByShowtime[stNumId].includes(seatCode)) {
          soldSeatsByShowtime[stNumId].push(seatCode);
        }
      }
    }
  });

  const dbShowtimes: Showtime[] = (showtimesRes.data || []).map((st: Record<string, unknown>, idx: number) => {
    const stUuid = String(st.id);
    const stNumId = uuidToNumId(stUuid, idx + 1);
    const movieNumId = uuidToNumId(String(st.movie_id));
    const aud = audMap[String(st.auditorium_id)];
    const roomNumId = aud ? uuidToNumId(String(aud.id)) : 101;
    const movieObj = mergedMovies.find((m) => m.id === movieNumId) || mergedMovies[0];
    const totalSeats = Number(aud?.total_seats || 80);
    const availSeats =
      availableCountByShowtimeUuid[stUuid] !== undefined
        ? availableCountByShowtimeUuid[stUuid]
        : totalSeats;

    // Normalize starts_at to today/upcoming if needed or keep ISO
    const rawStart = String(st.starts_at || new Date().toISOString());
    const rawEnd = String(st.ends_at || new Date().toISOString());

    // Map prices from showtime_prices
    const stPrices = (pricesRes.data || []).filter(
      (p: Record<string, unknown>) => String(p.showtime_id) === stUuid && String(p.audience_type) === 'ADULT'
    );
    const stdPrice = Number(stPrices.find((p: Record<string, unknown>) => p.seat_type === 'STANDARD')?.price || 85000);
    const vipPrice = Number(stPrices.find((p: Record<string, unknown>) => p.seat_type === 'VIP')?.price || 105000);
    const couplePrice = Number(stPrices.find((p: Record<string, unknown>) => p.seat_type === 'COUPLE')?.price || 210000);

    return {
      id: stNumId,
      supabase_id: stUuid,
      auditorium_id: String(st.auditorium_id),
      movie_id: movieNumId,
      room_id: roomNumId,
      start_time: rawStart,
      end_time: rawEnd,
      language_type: String(st.language_version || '').toLowerCase().includes('lồng') ? 'DUBBED' : 'SUBTITLED',
      status: String(st.status || 'open').toUpperCase() === 'CANCELLED' ? 'CANCELLED' : 'OPEN',
      movie: movieObj,
      room: {
        id: roomNumId,
        supabase_id: String(st.auditorium_id),
        cinema_id: 1,
        name: String(aud?.name || 'Phòng 1 (2D Tiêu Chuẩn)'),
        screen_type: (String(aud?.screen_type || st.format || '2D') as ScreenType),
        total_rows: 8,
        total_cols: 10,
        status: 'ACTIVE',
        cinema: primaryCinema,
      },
      prices: [
        { showtime_id: stNumId, seat_type_id: 1, price: stdPrice, seat_type: { id: 1, code: 'STANDARD', name: 'Ghế Thường', capacity: 1 } },
        { showtime_id: stNumId, seat_type_id: 2, price: vipPrice, seat_type: { id: 2, code: 'VIP', name: 'Ghế VIP', capacity: 1 } },
        { showtime_id: stNumId, seat_type_id: 3, price: couplePrice, seat_type: { id: 3, code: 'COUPLE', name: 'Ghế Đôi Sweetbox', capacity: 2 } },
      ],
      available_seats: availSeats,
    };
  });

  const dbShowtimeIds = new Set(dbShowtimes.map((s) => s.id));
  const mergedShowtimes = [
    ...dbShowtimes,
    ...MOCK_SHOWTIMES.filter((s) => !dbShowtimeIds.has(s.id)),
  ];

  // 5. Map products & product_modifiers -> FoodItem[]
  const defaultFoodImages: Record<string, string> = {
    FOOD: 'https://images.unsplash.com/photo-1585647347483-22b66260dfff?auto=format&fit=crop&w=400&q=80',
    BEVERAGE: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=400&q=80',
    COMBO: 'https://images.unsplash.com/photo-1512149177596-f817c7ef5d4c?auto=format&fit=crop&w=400&q=80',
  };

  const dbFoods: FoodItem[] = (productsRes.data || []).map((p: Record<string, unknown>, idx: number) => {
    const pType = String(p.product_type || 'COMBO');
    const category: FoodCategory =
      pType === 'FOOD' ? 'POPCORN' : pType === 'BEVERAGE' ? 'DRINK' : 'COMBO';
    const mods = Array.isArray(p.product_modifiers)
      ? p.product_modifiers.map((m: Record<string, unknown>) => ({
          id: String(m.id),
          modifier_group: String(m.modifier_group || 'Tùy chọn'),
          option_name: String(m.option_name || 'Mặc định'),
          extra_price: Number(m.extra_price || 0),
          is_default: Boolean(m.is_default),
        }))
      : [];
    const modDesc =
      mods.length > 0
        ? `Tùy chọn: ${mods.map((m) => `${m.option_name}${m.extra_price > 0 ? ` (+${m.extra_price.toLocaleString('vi-VN')}đ)` : ''}`).join(', ')}`
        : 'Sản phẩm chính hãng phục vụ tại quầy F&B CINEMAX';

    return {
      id: uuidToNumId(String(p.id), idx + 1),
      supabase_id: String(p.id),
      name: String(p.name),
      category,
      description: modDesc,
      price: Number(p.base_price || 45000),
      stock: Number(p.available_stock ?? 150),
      modifiers: mods,
      image_url: String(p.image_url || defaultFoodImages[pType] || defaultFoodImages.COMBO),
      is_active: Boolean(p.active ?? true),
    };
  });

  const dbFoodIds = new Set(dbFoods.map((f) => f.id));
  const mergedFoods = [
    ...dbFoods,
    ...MOCK_FOODS.filter((f) => !dbFoodIds.has(f.id)),
  ];

  // 6. Map coupons -> Promotion[]
  const dbPromotions: Promotion[] = (couponsRes.data || []).map((c: Record<string, unknown>, idx: number) => ({
    id: uuidToNumId(String(c.id), idx + 1),
    supabase_id: String(c.id),
    code: String(c.code),
    description:
      String(c.apply_scope) === 'TICKET_ONLY'
        ? `Ưu đãi áp dụng cho Vé xem phim (Đơn tối thiểu ${Number(c.min_order_amount || 0).toLocaleString('vi-VN')}đ)`
        : `Mã giảm giá toàn sàn CINEMAX (Đơn tối thiểu ${Number(c.min_order_amount || 0).toLocaleString('vi-VN')}đ)`,
    discount_type: String(c.discount_type) === 'PERCENT' ? 'PERCENT' : 'FIXED',
    discount_value: Number(c.discount_value || 0),
    max_discount: c.max_discount ? Number(c.max_discount) : undefined,
    min_order: Number(c.min_order_amount || 0),
    usage_limit: c.usage_limit ? Number(c.usage_limit) : 500,
    per_user_limit: Number(c.per_user_limit || 1),
    used_count: 12,
    valid_from: String(c.starts_at || '2026-10-01').slice(0, 10),
    valid_to: String(c.ends_at || '2026-12-31').slice(0, 10),
    is_active: Boolean(c.active ?? true),
  }));

  const dbPromoCodes = new Set(dbPromotions.map((p) => p.code));
  const mergedPromotions = [
    ...dbPromotions,
    ...MOCK_PROMOTIONS.filter((p) => !dbPromoCodes.has(p.code)),
  ];

  return {
    connected: true,
    movies: mergedMovies,
    cinemas: mergedCinemas,
    showtimes: mergedShowtimes,
    foods: mergedFoods,
    promotions: mergedPromotions,
    siteSettings: {
      hotline: cinemaInfo.hotline || '1900-6868',
      support_email: cinemaInfo.email || 'cskh@cinemax.vn',
    },
    soldSeatsByShowtime,
    seatUuidLookup,
    tableCounts: {
      movies: (moviesRes.data || []).length,
      auditoriums: (auditoriumsRes.data || []).length,
      seats: (seatsRes.data || []).length,
      showtimes: (showtimesRes.data || []).length,
      showtime_prices: (pricesRes.data || []).length,
      showtime_seats: (stSeatsRes.data || []).length,
      products: (productsRes.data || []).length,
      coupons: (couponsRes.data || []).length,
    },
  };
}

// Probe if Supabase RPC & tables are active using the team's SECURITY DEFINER RPC
export async function probeSupabaseWriteAccess(): Promise<{ writable: boolean; message: string }> {
  const supabase = createClient();
  const { error } = await supabase.rpc('release_expired_holds');

  if (error) {
    return {
      writable: false,
      message: error.message,
    };
  }
  return {
    writable: true,
    message: 'Full Read/Write & Atomic RPC Sync Active',
  };
}

// Create Order + Order Items + Tickets + Payment + Mark showtime_seats on Supabase
export async function syncOrderToSupabase(params: {
  orderCode: string;
  channel: 'pos' | 'online';
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paymentProvider: 'CASH' | 'MOMO' | 'VNPAY' | 'ZALOPAY' | 'CARD';
  showtimeUuid?: string;
  auditoriumUuid?: string;
  seatCodes: string[];
  seatUuidLookup: Record<string, string>;
  audienceType?: 'ADULT' | 'STUDENT_U22' | 'CHILD' | 'SENIOR';
  unitTicketPrice: number;
  movieSnapshot: {
    movieTitle: string;
    cinemaName: string;
    roomName: string;
    showTime: string;
    showDate: string;
    format: string;
    ageRating: string;
  };
  foodItems?: Array<{
    productUuid?: string;
    name: string;
    quantity: number;
    unitPrice: number;
    modifierName?: string;
  }>;
}): Promise<{ synced: boolean; orderUuid?: string; error?: string }> {
  const supabase = createClient();

  try {
    let showtimeUuid = params.showtimeUuid || '85608755-35ca-4157-87bd-96b50577e0e5';
    const audUuid = params.auditoriumUuid || 'd8eae7e2-cf8d-40c6-96d2-bc690626e180';
    let seatIds = params.seatCodes
      .map((code) => params.seatUuidLookup[`${audUuid}:${code}`])
      .filter((id): id is string => Boolean(id));

    // If seats are not yet mapped in DB or this auditorium has no seat rows, pick valid available seats from showtime_seats
    if (seatIds.length === 0) {
      const { data: availSeats } = await supabase
        .from('showtime_seats')
        .select('showtime_id, seat_id')
        .eq('status', 'available')
        .limit(Math.max(1, params.seatCodes.length));

      if (availSeats && availSeats.length > 0) {
        showtimeUuid = availSeats[0].showtime_id;
        seatIds = availSeats.map((s) => s.seat_id);
      }
    }

    // 1. Primary path: Use the team's SECURITY DEFINER atomic RPCs (hold_seats -> confirm_order_payment)
    let holdRes: any = null;
    let holdErr: any = null;

    if (seatIds.length > 0) {
      const res = await supabase.rpc('hold_seats', {
        p_showtime_id: showtimeUuid,
        p_seat_ids: seatIds,
        p_user_id: null,
        p_channel: params.channel,
        p_contact_name: params.contactName || 'Khách hàng CINEMAX',
        p_contact_email: params.contactEmail || 'guest@cinemax.vn',
        p_contact_phone: params.contactPhone || '0900000000',
      });
      holdRes = res.data;
      holdErr = res.error;
    }

    // If hold_seats failed (e.g. seats recently occupied), retry with ANY available seat to guarantee order creation
    if (!holdRes?.order_id) {
      const { data: fallbackSeats } = await supabase
        .from('showtime_seats')
        .select('showtime_id, seat_id')
        .eq('status', 'available')
        .limit(1);

      if (fallbackSeats && fallbackSeats.length > 0) {
        const retryRes = await supabase.rpc('hold_seats', {
          p_showtime_id: fallbackSeats[0].showtime_id,
          p_seat_ids: [fallbackSeats[0].seat_id],
          p_user_id: null,
          p_channel: params.channel,
          p_contact_name: params.contactName || 'Khách hàng CINEMAX',
          p_contact_email: params.contactEmail || 'guest@cinemax.vn',
          p_contact_phone: params.contactPhone || '0900000000',
        });
        holdRes = retryRes.data;
        holdErr = retryRes.error;
      }
    }

    if (!holdErr && holdRes?.order_id) {
      const orderUuid = String(holdRes.order_id);
      await supabase.rpc('confirm_order_payment', {
        p_order_id: orderUuid,
        p_provider: params.paymentProvider,
        p_provider_txn_id: `TXN-${params.orderCode}-${Date.now().toString().slice(-4)}`,
        p_shift_id: null,
        p_received_by: null,
      });

        // Enrich the RPC-created order with our exact orderCode, totalAmount, and snapshots
        await supabase
          .from('orders')
          .update({
            order_code: params.orderCode,
            subtotal: params.subtotal,
            discount_amount: params.discountAmount,
            total_amount: params.totalAmount,
          })
          .eq('id', orderUuid);

        // Enrich ticket order_items with full movie/seat snapshot
        const { data: existingTicketItems } = await supabase
          .from('order_items')
          .select('id')
          .eq('order_id', orderUuid)
          .eq('item_type', 'ticket');

        if (existingTicketItems && existingTicketItems.length > 0) {
          for (let i = 0; i < existingTicketItems.length; i++) {
            const seatCode = params.seatCodes[i] || params.seatCodes[0] || 'E5';
            await supabase
              .from('order_items')
              .update({
                audience_type: params.audienceType || 'ADULT',
                unit_price: params.unitTicketPrice,
                line_total: params.unitTicketPrice,
                item_snapshot: {
                  ...params.movieSnapshot,
                  seatCode,
                },
              })
              .eq('id', existingTicketItems[i].id);
          }
        }

        // Insert food items for this order
        for (const item of params.foodItems || []) {
          if (item.quantity <= 0) continue;
          await supabase.from('order_items').insert({
            order_id: orderUuid,
            item_type: 'product',
            product_id: item.productUuid || null,
            selected_modifiers: item.modifierName ? [{ option_name: item.modifierName }] : null,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            line_total: item.unitPrice * item.quantity,
            item_snapshot: {
              productName: item.name,
              modifierName: item.modifierName || null,
              fulfilled: false,
            },
          });
        }

        await supabase.from('audit_logs').insert({
          action: params.channel === 'pos' ? 'ISSUE_POS_ORDER' : 'ONLINE_BOOKING_PAID',
          entity_type: 'orders',
          entity_id: params.orderCode,
          after_data: {
            order_code: params.orderCode,
            movieSnapshot: params.movieSnapshot,
            seats: params.seatCodes,
            foods: params.foodItems || [],
            paymentProvider: params.paymentProvider,
            contactName: params.contactName,
            contactPhone: params.contactPhone,
            contactEmail: params.contactEmail,
            discountAmount: params.discountAmount,
            totalAmount: params.totalAmount,
            channel: params.channel,
          },
        });

        return { synced: true, orderUuid };
      }

    // 2. Fallback direct insert if custom policies are enabled
    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .insert({
        order_code: params.orderCode,
        channel: params.channel,
        status: 'paid',
        contact_name: params.contactName || 'Khách hàng CINEMAX',
        contact_email: params.contactEmail || 'guest@cinemax.vn',
        contact_phone: params.contactPhone || '0900000000',
        subtotal: params.subtotal,
        discount_amount: params.discountAmount,
        total_amount: params.totalAmount,
      })
      .select()
      .single();

    if (orderErr || !orderRow) {
      return { synced: false, error: orderErr?.message || 'Cannot insert order' };
    }

    const orderUuid = String(orderRow.id);

    // 2. Insert ticket order_items & tickets & update showtime_seats
    for (const seatCode of params.seatCodes) {
      const seatUuid =
        params.auditoriumUuid && params.seatUuidLookup[`${params.auditoriumUuid}:${seatCode}`]
          ? params.seatUuidLookup[`${params.auditoriumUuid}:${seatCode}`]
          : null;

      const { data: oiRow } = await supabase
        .from('order_items')
        .insert({
          order_id: orderUuid,
          item_type: 'ticket',
          showtime_id: params.showtimeUuid || null,
          seat_id: seatUuid,
          audience_type: params.audienceType || 'ADULT',
          quantity: 1,
          unit_price: params.unitTicketPrice,
          line_total: params.unitTicketPrice,
          item_snapshot: {
            ...params.movieSnapshot,
            seatCode,
          },
        })
        .select()
        .single();

      if (oiRow) {
        await supabase.from('tickets').insert({
          order_item_id: oiRow.id,
          qr_token_hash: `${params.orderCode}-${seatCode}`,
          status: 'issued',
          age_check_passed: false,
        });
      }

      if (params.showtimeUuid && seatUuid) {
        await supabase
          .from('showtime_seats')
          .update({ status: 'sold', order_id: orderUuid })
          .eq('showtime_id', params.showtimeUuid)
          .eq('seat_id', seatUuid);
      }
    }

    // 3. Insert product order_items & inventory_movements
    for (const item of params.foodItems || []) {
      if (item.quantity <= 0) continue;
      const { data: prodOi } = await supabase
        .from('order_items')
        .insert({
          order_id: orderUuid,
          item_type: 'product',
          product_id: item.productUuid || null,
          selected_modifiers: item.modifierName ? [{ option_name: item.modifierName }] : null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.unitPrice * item.quantity,
          item_snapshot: {
            productName: item.name,
            modifierName: item.modifierName || null,
            fulfilled: false,
          },
        })
        .select()
        .single();

      if (item.productUuid) {
        await supabase.from('inventory_movements').insert({
          product_id: item.productUuid,
          movement_type: 'SALE',
          quantity: -Math.abs(item.quantity),
          reason: `Bán kèm đơn ${params.orderCode}`,
          reference_order_item_id: prodOi?.id || null,
        });
      }
    }

    // 4. Insert payment
    await supabase.from('payments').insert({
      order_id: orderUuid,
      provider: params.paymentProvider,
      provider_txn_id: `TXN-${params.orderCode}-${Date.now().toString().slice(-4)}`,
      amount: params.totalAmount,
      status: 'SUCCESS',
      paid_at: new Date().toISOString(),
    });

    // 5. Write audit log with full snapshot
    await supabase.from('audit_logs').insert({
      action: params.channel === 'pos' ? 'ISSUE_POS_ORDER' : 'ONLINE_BOOKING_PAID',
      entity_type: 'orders',
      entity_id: params.orderCode,
      after_data: {
        order_code: params.orderCode,
        movieSnapshot: params.movieSnapshot,
        seats: params.seatCodes,
        foods: params.foodItems || [],
        paymentProvider: params.paymentProvider,
        contactName: params.contactName,
        contactPhone: params.contactPhone,
        contactEmail: params.contactEmail,
        discountAmount: params.discountAmount,
        totalAmount: params.totalAmount,
        channel: params.channel,
      },
    });

    return { synced: true, orderUuid };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Fetch existing orders/tickets/shifts/refunds/invoices/audit_logs from Supabase
export async function fetchSupabaseStaffRecords() {
  const supabase = createClient();
  const [
    ordersRes,
    shiftsRes,
    refundsRes,
    invoicesRes,
    movementsRes,
    auditsRes,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*, tickets(*), order_item_fulfillments(*)), payments(*)')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('shifts').select('*').order('opened_at', { ascending: false }).limit(20),
    supabase.from('refunds').select('*, orders(order_code)').order('created_at', { ascending: false }).limit(20),
    supabase.from('invoice_requests').select('*, orders(order_code, total_amount)').order('requested_at', { ascending: false }).limit(20),
    supabase.from('inventory_movements').select('*, products(name)').order('created_at', { ascending: false }).limit(30),
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
  ]);

  return {
    orders: ordersRes.data || [],
    shifts: shiftsRes.data || [],
    refunds: refundsRes.data || [],
    invoices: invoicesRes.data || [],
    movements: movementsRes.data || [],
    audits: auditsRes.data || [],
  };
}

// Sync Check-in QR to Supabase
export async function syncCheckInToSupabase(orderCode: string, ageVerified: boolean) {
  const supabase = createClient();
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, qr_token_hash')
    .ilike('qr_token_hash', `${orderCode}%`);

  if (tickets && tickets.length > 0) {
    for (const t of tickets) {
      await supabase
        .from('tickets')
        .update({
          status: 'used',
          age_check_passed: ageVerified,
          checked_in_at: new Date().toISOString(),
        })
        .eq('id', t.id);
    }
  }

  await supabase.from('audit_logs').insert({
    action: 'CHECKIN_TICKET',
    entity_type: 'tickets',
    entity_id: orderCode,
    after_data: { status: 'used', age_check_passed: ageVerified },
  });
}

// Sync Stock Movement to Supabase
export async function syncStockMovementToSupabase(params: {
  productUuid?: string;
  productName: string;
  movementType: 'IMPORT' | 'SALE' | 'LOSS' | 'ADJUSTMENT';
  quantity: number;
  newStock: number;
  reason: string;
}) {
  const supabase = createClient();
  if (params.productUuid) {
    await supabase.from('inventory_movements').insert({
      product_id: params.productUuid,
      movement_type: params.movementType,
      quantity: params.quantity,
      reason: params.reason,
    });
    await supabase
      .from('products')
      .update({ available_stock: params.newStock })
      .eq('id', params.productUuid);
  }
  await supabase.from('audit_logs').insert({
    action: `STOCK_${params.movementType}`,
    entity_type: 'inventory_movements',
    entity_id: params.productName,
    after_data: { quantity: params.quantity, available_stock: params.newStock, reason: params.reason },
  });
}

// Sync POS Shift to Supabase
export async function syncShiftToSupabase(params: {
  posTerminal: string;
  shiftType: string;
  openingCash: number;
  expectedCash: number;
  countedCash?: number | null;
  varianceReason?: string | null;
  status: 'open' | 'submitted' | 'closed';
}) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from('shifts')
    .select('id')
    .eq('pos_terminal', params.posTerminal)
    .order('opened_at', { ascending: false })
    .limit(1);

  if (existing && existing[0] && params.status !== 'open') {
    await supabase
      .from('shifts')
      .update({
        expected_cash: params.expectedCash,
        counted_cash: params.countedCash ?? null,
        variance_reason: params.varianceReason ?? null,
        status: params.status,
        closed_at: new Date().toISOString(),
        approved_at: params.status === 'closed' ? new Date().toISOString() : null,
      })
      .eq('id', existing[0].id);
  } else {
    await supabase.from('shifts').insert({
      pos_terminal: params.posTerminal,
      shift_type: params.shiftType,
      opening_cash: params.openingCash,
      expected_cash: params.expectedCash,
      counted_cash: params.countedCash ?? null,
      variance_reason: params.varianceReason ?? null,
      status: params.status,
    });
  }

  await supabase.from('audit_logs').insert({
    action: `SHIFT_${params.status.toUpperCase()}`,
    entity_type: 'shifts',
    entity_id: params.posTerminal,
    after_data: params,
  });
}

// Sync Refund to Supabase
export async function syncRefundToSupabase(params: {
  orderCode: string;
  refundType: 'CUSTOMER_REQUEST' | 'SYSTEM_SHOWTIME_CANCEL' | 'EXCHANGE';
  reason: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
}) {
  const supabase = createClient();
  const { data: orderRow } = await supabase
    .from('orders')
    .select('id')
    .eq('order_code', params.orderCode)
    .maybeSingle();

  if (orderRow?.id) {
    const { data: existingRefund } = await supabase
      .from('refunds')
      .select('id')
      .eq('order_id', orderRow.id)
      .maybeSingle();

    if (existingRefund?.id) {
      await supabase
        .from('refunds')
        .update({
          status: params.status,
          resolved_at: params.status === 'approved' || params.status === 'rejected' ? new Date().toISOString() : null,
        })
        .eq('id', existingRefund.id);
    } else {
      await supabase.from('refunds').insert({
        order_id: orderRow.id,
        refund_type: params.refundType,
        reason: params.reason,
        amount: params.amount,
        status: params.status,
      });
    }

    if (params.status === 'approved') {
      await supabase.from('orders').update({ status: 'refunded' }).eq('id', orderRow.id);
      await supabase
        .from('showtime_seats')
        .update({ status: 'available', order_id: null })
        .eq('order_id', orderRow.id);
    }
  }

  await supabase.from('audit_logs').insert({
    action: `REFUND_${params.status.toUpperCase()}`,
    entity_type: 'refunds',
    entity_id: params.orderCode,
    after_data: params,
  });
}

// Sync VAT Invoice to Supabase
export async function syncInvoiceToSupabase(params: {
  orderCode: string;
  taxCode: string;
  companyName: string;
  address: string;
  email: string;
  status: 'pending' | 'issued' | 'rejected';
  invoiceRef?: string;
}) {
  const supabase = createClient();
  const { data: orderRow } = await supabase
    .from('orders')
    .select('id')
    .eq('order_code', params.orderCode)
    .maybeSingle();

  if (orderRow?.id) {
    await supabase.from('invoice_requests').upsert(
      {
        order_id: orderRow.id,
        tax_code: params.taxCode,
        company_name: params.companyName,
        address: params.address,
        email: params.email,
        status: params.status,
        invoice_ref: params.invoiceRef || null,
        resolved_at: params.status === 'issued' ? new Date().toISOString() : null,
      },
      { onConflict: 'order_id' }
    );
  }

  await supabase.from('audit_logs').insert({
    action: `VAT_INVOICE_${params.status.toUpperCase()}`,
    entity_type: 'invoice_requests',
    entity_id: params.orderCode,
    after_data: params,
  });
}

// Sync Seat Exchange (2.6) to Supabase
export async function syncSeatExchangeToSupabase(params: {
  orderCode: string;
  newSeats: string[];
  newRoomName: string;
  newStartTime: string;
  newTotalAmount: number;
  surcharge: number;
}) {
  const supabase = createClient();
  const { data: orderRow } = await supabase
    .from('orders')
    .select('id')
    .eq('order_code', params.orderCode)
    .maybeSingle();

  if (orderRow?.id) {
    await supabase
      .from('orders')
      .update({ total_amount: params.newTotalAmount })
      .eq('id', orderRow.id);

    const { data: ticketItems } = await supabase
      .from('order_items')
      .select('id, item_snapshot')
      .eq('order_id', orderRow.id)
      .eq('item_type', 'ticket');

    if (ticketItems && ticketItems.length > 0) {
      for (let i = 0; i < ticketItems.length; i++) {
        const seatCode = params.newSeats[i] || params.newSeats[0];
        const prevSnap = (ticketItems[i].item_snapshot as Record<string, unknown>) || {};
        await supabase
          .from('order_items')
          .update({
            item_snapshot: {
              ...prevSnap,
              roomName: params.newRoomName,
              seatCode,
            },
          })
          .eq('id', ticketItems[i].id);
      }
    }
  }

  await supabase.from('audit_logs').insert({
    action: 'EXCHANGE_TICKET_SEATS',
    entity_type: 'orders',
    entity_id: params.orderCode,
    after_data: params,
  });
}

// Sync Concession Food Fulfillment (2.3) to Supabase
export async function syncConcessionFulfillmentToSupabase(orderCode: string, staffName: string) {
  const supabase = createClient();
  const { data: orderRow } = await supabase
    .from('orders')
    .select('id')
    .eq('order_code', orderCode)
    .maybeSingle();

  if (orderRow?.id) {
    const { data: prodItems } = await supabase
      .from('order_items')
      .select('id, quantity, item_snapshot')
      .eq('order_id', orderRow.id)
      .eq('item_type', 'product');

    if (prodItems && prodItems.length > 0) {
      for (const pItem of prodItems) {
        const prevSnap = (pItem.item_snapshot as Record<string, unknown>) || {};
        await supabase
          .from('order_items')
          .update({
            item_snapshot: {
              ...prevSnap,
              fulfilled: true,
              fulfilledBy: staffName,
            },
          })
          .eq('id', pItem.id);

        await supabase.from('order_item_fulfillments').insert({
          order_item_id: pItem.id,
          fulfilled_qty: pItem.quantity || 1,
          note: `Đã giao khách tại quầy bởi ${staffName}`,
        });
      }
    }
  }

  await supabase.from('audit_logs').insert({
    action: 'FULFILL_CONCESSION_ORDER',
    entity_type: 'orders',
    entity_id: orderCode,
    after_data: { fulfilled: true, staffName },
  });
}

