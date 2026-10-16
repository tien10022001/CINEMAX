import { createClient } from '@/lib/supabase/client';
import {
  Movie,
  Auditorium,
  Seat,
  Showtime,
  ShowtimePrice,
  ShowtimeSeat,
  Product,
  ProductComponent,
  ProductModifier,
  InventoryMovement,
  Shift,
  Order,
  OrderItem,
  Ticket,
  Refund,
  InvoiceRequest,
  SupportRequest,
  Coupon,
  CinemaSetting,
  AuditLog,
  Genre,
  StaffPermission,
  Profile
} from '@/lib/types-redesign';

export class AdminDataService {
  private static supabase: any = createClient();

  // 1. Fetch initial bundle with instant local sync & 1.5s timeout fallback
  static async fetchAllAdminData() {
    const supabase = this.supabase;

    // 1. First fetch local store from /api/sync (extremely fast, ~5ms)
    let syncData: any = {};
    if (typeof window !== 'undefined') {
      try {
        const syncRes = await fetch('/api/sync');
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          if (syncJson.success && syncJson.data) {
            syncData = syncJson.data;
          }
        }
      } catch (err) {
        console.warn('Could not read from /api/sync:', err);
      }
    }

    // 2. Query Supabase with a strict 1.5-second race timeout so UI never hangs indefinitely
    const supabasePromise = Promise.allSettled([
      supabase.from('movies').select('*, movie_genres(genre:genres(*))').order('created_at', { ascending: false }),
      supabase.from('genres').select('*').order('name'),
      supabase.from('auditoriums').select('*').order('name'),
      supabase.from('seats').select('*').order('grid_row').order('grid_col'),
      supabase.from('showtimes').select('*, movie:movies(*), auditorium:auditoriums(*)').order('starts_at', { ascending: false }),
      supabase.from('showtime_prices').select('*'),
      supabase.from('products').select('*').order('name'),
      supabase.from('product_modifiers').select('*'),
      supabase.from('product_components').select('*, component:products(*)'),
      supabase.from('coupons').select('*').order('starts_at', { ascending: false }),
      supabase.from('cinema_settings').select('*'),
      supabase.from('shifts').select('*').order('opened_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('tickets').select('*').order('checked_in_at', { ascending: false }).limit(50),
      supabase.from('refunds').select('*').order('created_at', { ascending: false }),
      supabase.from('invoice_requests').select('*').order('requested_at', { ascending: false }),
      supabase.from('support_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)
    ]);

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const settledResults: any = await Promise.race([supabasePromise, timeoutPromise]);

    // Combine deleted IDs from sync store and local storage tombstone
    let localDeletedIds: string[] = [];
    if (typeof window !== 'undefined') {
      try {
        localDeletedIds = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
      } catch {}
    }
    const deletedIds = new Set([...(syncData.deleted_ids || []), ...localDeletedIds]);

    let loadedMovies = (syncData.movies || []).filter((m: any) => !deletedIds.has(m.id));
    let loadedCoupons = (syncData.coupons || []).filter((c: any) => !deletedIds.has(c.id) && !deletedIds.has(c.code));
    let loadedProducts = (syncData.products || []).filter((p: any) => !deletedIds.has(p.id));
    let loadedShowtimes = (syncData.showtimes || []).filter((s: any) => !deletedIds.has(s.id));
    let loadedAuditoriums = syncData.auditoriums || [];
    let loadedSettings = syncData.settings || [];
    let loadedSeats = syncData.seats || [];

    if (settledResults && Array.isArray(settledResults)) {
      const [
        moviesRes,
        genresRes,
        auditoriumsRes,
        seatsRes,
        showtimesRes,
        pricesRes,
        productsRes,
        modifiersRes,
        componentsRes,
        couponsRes,
        settingsRes,
        shiftsRes,
        ordersRes,
        ticketsRes,
        refundsRes,
        invoicesRes,
        supportRes,
        logsRes
      ] = settledResults;

      if (moviesRes?.status === 'fulfilled' && moviesRes.value?.data?.length) {
        const parsedMovies = moviesRes.value.data.map((m: any) => ({
          ...m,
          genres: m.movie_genres?.map((mg: any) => mg.genre).filter(Boolean) || m.genres || []
        }));
        if (!syncData.movies || syncData.movies.length === 0) {
          loadedMovies = parsedMovies.filter((m: any) => !deletedIds.has(m.id));
        } else {
          // Keep syncData as master, only include items not deleted
          loadedMovies = syncData.movies.filter((m: any) => !deletedIds.has(m.id));
        }
      }
      if (couponsRes?.status === 'fulfilled' && couponsRes.value?.data?.length) {
        if (!syncData.coupons || syncData.coupons.length === 0) {
          loadedCoupons = couponsRes.value.data.filter((c: any) => !deletedIds.has(c.id) && !deletedIds.has(c.code));
        } else {
          loadedCoupons = syncData.coupons.filter((c: any) => !deletedIds.has(c.id) && !deletedIds.has(c.code));
        }
      }
      if (productsRes?.status === 'fulfilled' && productsRes.value?.data?.length) {
        if (!syncData.products || syncData.products.length === 0) {
          loadedProducts = productsRes.value.data.filter((p: any) => !deletedIds.has(p.id));
        } else {
          loadedProducts = syncData.products.filter((p: any) => !deletedIds.has(p.id));
        }
      }
      if (showtimesRes?.status === 'fulfilled' && showtimesRes.value?.data?.length) {
        if (!syncData.showtimes || syncData.showtimes.length === 0) {
          loadedShowtimes = showtimesRes.value.data.filter((s: any) => !deletedIds.has(s.id));
        } else {
          loadedShowtimes = syncData.showtimes.filter((s: any) => !deletedIds.has(s.id));
        }
      }
      if (auditoriumsRes?.status === 'fulfilled' && auditoriumsRes.value?.data?.length) {
        if (!syncData.auditoriums || syncData.auditoriums.length === 0) {
          loadedAuditoriums = auditoriumsRes.value.data;
        }
      }
      if (settingsRes?.status === 'fulfilled' && settingsRes.value?.data?.length) {
        if (!syncData.settings || syncData.settings.length === 0) {
          loadedSettings = settingsRes.value.data;
        }
      }
      if (seatsRes?.status === 'fulfilled' && seatsRes.value?.data?.length) {
        if (!syncData.seats || syncData.seats.length === 0) {
          loadedSeats = seatsRes.value.data;
        }
      }

      return {
        movies: loadedMovies,
        genres: genresRes?.status === 'fulfilled' && genresRes.value?.data ? genresRes.value.data : [],
        auditoriums: loadedAuditoriums,
        seats: loadedSeats,
        showtimes: loadedShowtimes,
        prices: pricesRes?.status === 'fulfilled' && pricesRes.value?.data ? pricesRes.value.data : [],
        products: loadedProducts,
        modifiers: modifiersRes?.status === 'fulfilled' && modifiersRes.value?.data ? modifiersRes.value.data : [],
        components: componentsRes?.status === 'fulfilled' && componentsRes.value?.data ? componentsRes.value.data : [],
        coupons: loadedCoupons,
        settings: loadedSettings,
        shifts: shiftsRes?.status === 'fulfilled' && shiftsRes.value?.data ? shiftsRes.value.data : [],
        orders: ordersRes?.status === 'fulfilled' && ordersRes.value?.data ? ordersRes.value.data : [],
        tickets: ticketsRes?.status === 'fulfilled' && ticketsRes.value?.data ? ticketsRes.value.data : [],
        refunds: refundsRes?.status === 'fulfilled' && refundsRes.value?.data ? refundsRes.value.data : [],
        invoices: invoicesRes?.status === 'fulfilled' && invoicesRes.value?.data ? invoicesRes.value.data : [],
        support: supportRes?.status === 'fulfilled' && supportRes.value?.data ? supportRes.value.data : [],
        logs: logsRes?.status === 'fulfilled' && logsRes.value?.data ? logsRes.value.data : []
      };
    }

    return {
      movies: loadedMovies,
      genres: [],
      auditoriums: loadedAuditoriums,
      seats: loadedSeats,
      showtimes: loadedShowtimes,
      prices: [],
      products: loadedProducts,
      modifiers: [],
      components: [],
      coupons: loadedCoupons,
      settings: loadedSettings,
      shifts: [],
      orders: [],
      tickets: [],
      refunds: [],
      invoices: [],
      support: [],
      logs: []
    };
  }

  // Generic Entity Save to /api/sync
  static async saveEntity(entity: string, data: any) {
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity, data })
        });
      } catch (err) {
        console.warn(`Sync save ${entity} error:`, err);
      }
    }
  }

  // Generic Entity Delete
  static async deleteEntity(entity: string, id: string) {
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
        if (!local.includes(id)) {
          local.push(id);
          localStorage.setItem('cinemax_deleted_ids', JSON.stringify(local));
        }
      } catch {}
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: `delete_${entity}`, data: { id } })
        });
      } catch (err) {
        console.warn(`Sync delete ${entity} error:`, err);
      }
    }
    try {
      await this.supabase.from(entity).delete().eq('id', id);
    } catch {
      // Fallback
    }
  }

  // 2. Movie CRUD
  static async upsertMovie(movie: Partial<Movie>) {
    const supabase = this.supabase;
    let saved: Movie | null = null;
    const movieId = movie.id || crypto.randomUUID();

    // Prepare core database payload
    const corePayload: any = {
      id: movieId,
      title: movie.title,
      slug: movie.slug,
      synopsis: movie.synopsis || null,
      director: movie.director || null,
      cast_list: movie.cast_list || null,
      language: movie.language || 'Tiếng Việt - Phụ đề',
      duration_minutes: movie.duration_minutes || 120,
      age_rating: movie.age_rating || 'P',
      poster_url: movie.poster_url || null,
      banner_url: movie.banner_url || movie.poster_url || null,
      trailer_url: movie.trailer_url || null,
      release_date: movie.release_date || null,
      end_date: movie.end_date || null,
      status: movie.status || 'now_showing'
    };

    // Extended fields if schema allows
    const extendedPayload = {
      ...corePayload,
      ...(movie.country !== undefined ? { country: movie.country } : {}),
      ...(movie.studio !== undefined ? { studio: movie.studio } : {}),
      ...(movie.meta_title !== undefined ? { meta_title: movie.meta_title } : {}),
      ...(movie.meta_description !== undefined ? { meta_description: movie.meta_description } : {}),
      ...(movie.imdb_score !== undefined ? { imdb_score: movie.imdb_score } : {}),
      ...(movie.formats !== undefined ? { formats: movie.formats } : {})
    };

    try {
      // Try full upsert first
      const { data, error } = await supabase.from('movies').upsert(extendedPayload).select().single();
      if (!error && data) {
        saved = data as Movie;
      } else if (error) {
        // Fallback to core payload if extended columns are not yet in Supabase
        const { data: coreData, error: coreErr } = await supabase.from('movies').upsert(corePayload).select().single();
        if (!coreErr && coreData) {
          saved = coreData as Movie;
        }
      }
    } catch {
      // RLS or network fallback
    }

    // Sync movie_genres junction table if genres provided
    if (movie.genres && Array.isArray(movie.genres)) {
      try {
        await supabase.from('movie_genres').delete().eq('movie_id', movieId);
        const genreRows = movie.genres.map((g) => ({
          movie_id: movieId,
          genre_id: g.id
        }));
        if (genreRows.length > 0) {
          await supabase.from('movie_genres').insert(genreRows);
        }
      } catch (err) {
        console.warn('Error updating movie_genres:', err);
      }
    }

    const finalMovie: Movie = {
      ...(movie as Movie),
      ...(saved || {}),
      id: movieId,
      genres: movie.genres || saved?.genres || [],
      country: movie.country || (saved as any)?.country || 'Việt Nam',
      studio: movie.studio || (saved as any)?.studio || '',
      meta_title: movie.meta_title || (saved as any)?.meta_title || '',
      meta_description: movie.meta_description || (saved as any)?.meta_description || '',
      imdb_score: movie.imdb_score || (saved as any)?.imdb_score || 8.0,
      formats: movie.formats || (saved as any)?.formats || ['2D'],
      poster_url: saved?.poster_url || movie.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
      banner_url: saved?.banner_url || movie.banner_url || movie.poster_url || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800'
    };

    // Save to persistent server sync
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_movie', data: finalMovie })
        });
      } catch (err) {
        console.warn('Sync post error:', err);
      }
    }

    return finalMovie;
  }

  static async saveAllMovies(movies: Movie[]) {
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_movies', data: movies })
        });
      } catch (err) {
        console.warn('Sync saveAllMovies error:', err);
      }
    }
  }

  static async deleteMovie(id: string) {
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
        if (!local.includes(id)) {
          local.push(id);
          localStorage.setItem('cinemax_deleted_ids', JSON.stringify(local));
        }
      } catch {}
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_movie', data: { id } })
        });
      } catch (err) {
        console.warn('Sync delete error:', err);
      }
    }

    const supabase = this.supabase;
    try {
      await supabase.from('showtimes').delete().eq('movie_id', id);
      await supabase.from('movies').delete().eq('id', id);
    } catch {
      // RLS fallback
    }
  }

  // 3. Auditorium & Seat Map
  static async upsertAuditorium(auditorium: Partial<Auditorium>) {
    const supabase = this.supabase;
    const { data, error } = await supabase.from('auditoriums').upsert(auditorium).select().single();
    if (error) throw error;
    return data as Auditorium;
  }

  static async updateSeatStatus(seatId: string, status: 'ACTIVE' | 'BLOCKED', blockReason?: string) {
    try {
      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('seats')
        .update({ status, block_reason: blockReason || null })
        .eq('id', seatId)
        .select()
        .single();
      if (!error && data) return data as Seat;
    } catch {
      // Supabase RLS fallback
    }
    return { id: seatId, status, block_reason: blockReason || null } as any;
  }

  static async saveAllSeats(seats: Seat[]) {
    await this.saveEntity('seats', seats);
  }

  // 4. Showtime & Prices
  static async upsertShowtime(showtime: Partial<Showtime>, prices?: Partial<ShowtimePrice>[]) {
    const supabase = this.supabase;
    const { data, error } = await supabase.from('showtimes').upsert(showtime).select().single();
    if (error) throw error;

    if (prices && prices.length > 0 && data?.id) {
      const priceRows = prices.map((p) => ({
        ...p,
        showtime_id: data.id
      }));
      await supabase.from('showtime_prices').upsert(priceRows);
    }

    return data as Showtime;
  }

  // Bulk Upsert Showtimes in batches of 50 to avoid network payload limits & ultra-fast execution
  static async bulkUpsertShowtimes(
    items: { showtime: Partial<Showtime>; prices?: Partial<ShowtimePrice>[] }[]
  ): Promise<Showtime[]> {
    if (!items || items.length === 0) return [];

    const supabase = this.supabase;
    const results: Showtime[] = [];
    const allPriceRows: any[] = [];

    // Chunks of 50 for optimal HTTP payload size
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const showtimeRows = chunk.map((c) => ({
        ...c.showtime,
        id: c.showtime.id || crypto.randomUUID()
      }));

      try {
        const { data, error } = await supabase.from('showtimes').upsert(showtimeRows).select();
        if (!error && data && data.length > 0) {
          results.push(...(data as Showtime[]));
          chunk.forEach((item, idx) => {
            const savedSt = data[idx] || showtimeRows[idx];
            if (item.prices && item.prices.length > 0 && savedSt?.id) {
              item.prices.forEach((p) => {
                allPriceRows.push({
                  ...p,
                  showtime_id: savedSt.id
                });
              });
            }
          });
        } else {
          // If Supabase RLS / offline, fallback to in-memory generated rows
          results.push(...(showtimeRows as Showtime[]));
        }
      } catch {
        // Fallback to generated rows
        results.push(...(showtimeRows as Showtime[]));
      }
    }

    // Insert prices in chunks if any
    if (allPriceRows.length > 0) {
      try {
        for (let i = 0; i < allPriceRows.length; i += 100) {
          const pChunk = allPriceRows.slice(i, i + 100);
          await supabase.from('showtime_prices').upsert(pChunk);
        }
      } catch (err) {
        console.warn('Bulk upsert prices error (fallback continued):', err);
      }
    }

    return results;
  }

  static async deleteShowtime(id: string) {
    if (typeof window !== 'undefined') {
      try {
        const local = JSON.parse(localStorage.getItem('cinemax_deleted_ids') || '[]');
        if (!local.includes(id)) {
          local.push(id);
          localStorage.setItem('cinemax_deleted_ids', JSON.stringify(local));
        }
      } catch {}
      try {
        await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_showtime', data: { id } })
        });
      } catch (err) {
        console.warn('Sync delete showtime error:', err);
      }
    }

    const supabase = this.supabase;
    try {
      await supabase.from('showtime_prices').delete().eq('showtime_id', id);
      await supabase.from('showtimes').delete().eq('id', id);
    } catch {
      // Fallback
    }
  }

  // 5. Products & Inventory
  static async upsertProduct(product: Partial<Product>) {
    const supabase = this.supabase;
    const dbPayload = {
      id: product.id,
      name: product.name,
      product_type: product.product_type,
      base_price: product.base_price,
      inventory_tracking: product.inventory_tracking ?? true,
      available_stock: product.available_stock ?? 100,
      active: product.active ?? true,
      image_url: product.image_url || null
    };
    try {
      const { data, error } = await supabase.from('products').upsert(dbPayload).select().single();
      if (!error && data) {
        return { ...product, ...data } as Product;
      }
    } catch {
      // Offline or local storage mode fallback
    }
    return product as Product;
  }

  static async logInventoryMovement(movement: Partial<InventoryMovement>) {
    const supabase = this.supabase;
    const { data, error } = await supabase.from('inventory_movements').insert(movement).select().single();
    if (error) throw error;
    return data as InventoryMovement;
  }

  // 6. Shifts & POS
  static async openShift(staffId: string, posTerminal: string, openingCash: number) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        staff_id: staffId,
        pos_terminal: posTerminal,
        opening_cash: openingCash,
        expected_cash: openingCash,
        status: 'open'
      })
      .select()
      .single();
    if (error) throw error;
    return data as Shift;
  }

  static async closeShift(shiftId: string, countedCash: number, varianceReason?: string) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('shifts')
      .update({
        counted_cash: countedCash,
        variance_reason: varianceReason || null,
        closed_at: new Date().toISOString(),
        status: 'submitted'
      })
      .eq('id', shiftId)
      .select()
      .single();
    if (error) throw error;
    return data as Shift;
  }

  static async approveShift(shiftId: string, supervisorId: string) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('shifts')
      .update({
        supervisor_id: supervisorId,
        approved_at: new Date().toISOString(),
        status: 'closed'
      })
      .eq('id', shiftId)
      .select()
      .single();
    if (error) throw error;
    return data as Shift;
  }

  // 7. Check-in Ticket
  static async checkInTicket(qrTokenHash: string, checkedInBy: string, ageCheckPassed: boolean) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('tickets')
      .update({
        status: 'used',
        age_check_passed: ageCheckPassed,
        checked_in_at: new Date().toISOString(),
        checked_in_by: checkedInBy
      })
      .eq('qr_token_hash', qrTokenHash)
      .select()
      .single();
    if (error) throw error;
    return data as Ticket;
  }

  // 8. Refunds & Invoices
  static async approveRefund(refundId: string, approvedBy: string) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('refunds')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        resolved_at: new Date().toISOString()
      })
      .eq('id', refundId)
      .select()
      .single();
    if (error) throw error;
    return data as Refund;
  }

  static async issueInvoice(requestId: string, invoiceRef: string) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('invoice_requests')
      .update({
        status: 'issued',
        invoice_ref: invoiceRef,
        resolved_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();
    if (error) throw error;
    return data as InvoiceRequest;
  }

  // 9. Coupons
  static async upsertCoupon(coupon: Partial<Coupon>) {
    const supabase = this.supabase;
    const { data, error } = await supabase.from('coupons').upsert(coupon).select().single();
    if (error) throw error;
    return data as Coupon;
  }

  // 10. Settings & Audit
  static async updateSetting(key: string, value: Record<string, any>) {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('cinema_settings')
      .upsert({ setting_key: key, setting_value: value, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return data as CinemaSetting;
  }
}
