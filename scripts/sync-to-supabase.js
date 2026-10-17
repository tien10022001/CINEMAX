/**
 * CINEMAX - SCRIPT ĐỒNG BỘ DỮ LIỆU TỰ ĐỘNG LÊN SUPABASE DATABASE
 * Chạy: node scripts/sync-to-supabase.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Đọc file .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cycuxhztpvezqcznifqh.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('==================================================================');
console.log('🚀 CINEMAX: TIẾN HÀNH ĐỒNG BỘ DỮ LIỆU LÊN SUPABASE DATABASE');
console.log('🌐 Target URL:', SUPABASE_URL);
console.log('🔑 Sử dụng Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE_KEY (Bypass RLS)' : 'ANON_KEY');
console.log('==================================================================\n');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runSync() {
  const storePath = path.join(__dirname, '..', 'src', 'data', 'cinema-store.json');
  if (!fs.existsSync(storePath)) {
    console.error('✗ Không tìm thấy file cinema-store.json');
    return;
  }

  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

  // 1. Đồng bộ Phim (Movies)
  console.log('1. Đồng bộ danh sách phim...');
  if (store.movies && store.movies.length > 0) {
    const moviesPayload = store.movies.map((m, idx) => ({
      id: m.supabase_id || (m.id && m.id.length === 36 ? m.id : undefined),
      title: m.title,
      slug: m.slug || ('phim-' + idx),
      synopsis: m.synopsis || '',
      director: m.director || '',
      duration_minutes: m.duration_minutes || m.duration_min || 120,
      age_rating: m.age_rating || 'T13',
      poster_url: m.poster_url || '',
      banner_url: m.banner_url || m.poster_url || '',
      trailer_url: m.trailer_url || '',
      status: m.status?.toLowerCase() === 'coming_soon' ? 'coming_soon' : 'now_showing',
      release_date: m.release_date || new Date().toISOString().slice(0, 10),
      country: m.country || 'Việt Nam',
      imdb_score: m.imdb_score || 8.0
    }));

    for (const movie of moviesPayload) {
      const { error } = await supabase.from('movies').upsert(movie, { onConflict: 'slug' });
      if (error) {
        console.warn(`  ⚠️ Không thể ghi phim "${movie.title}":`, error.message);
      } else {
        console.log(`  ✓ Đã đồng bộ phim: ${movie.title}`);
      }
    }
  }

  // 2. Đồng bộ Phòng chiếu (Auditoriums)
  console.log('\n2. Đồng bộ phòng chiếu...');
  if (store.auditoriums && store.auditoriums.length > 0) {
    for (const aud of store.auditoriums) {
      const payload = {
        name: aud.name,
        screen_type: aud.screen_type || '2D',
        sound_system: aud.sound_system || 'Dolby 7.1',
        total_seats: aud.total_seats || 80,
        cleaning_buffer_minutes: aud.cleaning_buffer_minutes || 15
      };
      const { error } = await supabase.from('auditoriums').upsert(payload, { onConflict: 'name' });
      if (error) {
        console.warn(`  ⚠️ Không thể ghi phòng "${aud.name}":`, error.message);
      } else {
        console.log(`  ✓ Đã đồng bộ phòng chiếu: ${aud.name}`);
      }
    }
  }

  // 3. Đồng bộ Sản phẩm F&B (Products)
  console.log('\n3. Đồng bộ bắp nước F&B...');
  if (store.products && store.products.length > 0) {
    for (const prod of store.products) {
      const payload = {
        name: prod.name,
        product_type: prod.product_type || 'COMBO',
        base_price: prod.base_price || 69000,
        available_stock: prod.available_stock || 100,
        active: prod.active !== false,
        image_url: prod.image_url || ''
      };
      const { error } = await supabase.from('products').upsert(payload, { onConflict: 'name' });
      if (error) {
        console.warn(`  ⚠️ Không thể ghi món "${prod.name}":`, error.message);
      } else {
        console.log(`  ✓ Đã đồng bộ món: ${prod.name}`);
      }
    }
  }

  // 4. Đồng bộ Mã giảm giá (Coupons)
  console.log('\n4. Đồng bộ mã giảm giá...');
  if (store.coupons && store.coupons.length > 0) {
    for (const coup of store.coupons) {
      const payload = {
        code: coup.code,
        discount_type: coup.discount_type || 'PERCENT',
        discount_value: coup.discount_value || 10,
        max_discount: coup.max_discount || 50000,
        min_order_amount: coup.min_order_amount || 0,
        apply_scope: coup.apply_scope || 'ALL',
        starts_at: coup.starts_at || new Date().toISOString(),
        ends_at: coup.ends_at || '2026-12-31T23:59:59Z',
        active: coup.active !== false
      };
      const { error } = await supabase.from('coupons').upsert(payload, { onConflict: 'code' });
      if (error) {
        console.warn(`  ⚠️ Không thể ghi mã "${coup.code}":`, error.message);
      } else {
        console.log(`  ✓ Đã đồng bộ voucher: ${coup.code}`);
      }
    }
  }

  console.log('\n==================================================================');
  console.log('✨ HOÀN TẤT TIẾN TRÌNH KIỂM TRA ĐỒNG BỘ SUPABASE!');
  console.log('==================================================================');
}

runSync();
