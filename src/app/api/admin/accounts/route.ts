import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cycuxhztpvezqcznifqh.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_g_o1rXOoH48TQ80fcAYD6g_vsk-tcs0';

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });
}

// GET: Lấy toàn bộ tài khoản thực tế từ Supabase Database (profiles + staff_permissions + guest orders)
export async function GET() {
  try {
    const supabase = getSupabase();

    // 1. Lấy toàn bộ profiles từ bảng profiles
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profErr) {
      console.error('Lỗi truy vấn profiles Supabase:', profErr);
      return NextResponse.json({ success: false, error: profErr.message }, { status: 500 });
    }

    // 2. Lấy toàn bộ ma trận quyền staff_permissions
    const { data: permsData, error: permErr } = await supabase
      .from('staff_permissions')
      .select('*');

    if (permErr) {
      console.warn('Cảnh báo lấy staff_permissions:', permErr);
    }

    const permsMap = new Map<string, string[]>();
    (permsData || []).forEach((p: any) => {
      if (p.active !== false && p.staff_id) {
        const cur = permsMap.get(p.staff_id) || [];
        if (!cur.includes(p.permission)) {
          cur.push(p.permission);
        }
        permsMap.set(p.staff_id, cur);
      }
    });

    // 3. Lấy danh sách khách vãng lai (Guest) từ đơn hàng thực tế
    const { data: guestOrders } = await supabase
      .from('orders')
      .select('id, contact_name, contact_email, contact_phone, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(50);

    const accounts: any[] = [];
    const seenEmails = new Set<string>();

    // Map profiles thực tế
    (profiles || []).forEach((prof: any) => {
      const email = prof.email || `${prof.id.substring(0, 8)}@cinemax.internal`;
      seenEmails.add(email.toLowerCase());

      const rawRole = (prof.role || 'user').toLowerCase();
      let role = 'USER';
      if (rawRole === 'admin') role = 'ADMIN';
      else if (rawRole === 'staff') role = 'STAFF';
      else if (rawRole === 'guest') role = 'GUEST';

      const staffPerms = permsMap.get(prof.id) || (role === 'ADMIN' ? ['POS', 'CHECKIN', 'CONCESSION', 'SUPERVISOR'] : (role === 'STAFF' ? ['POS'] : []));

      accounts.push({
        id: prof.id,
        name: prof.full_name || 'Người dùng',
        email: prof.email || email,
        phone: prof.phone || '',
        role: role,
        staff_position:
          role === 'ADMIN'
            ? 'Quản trị viên hệ thống'
            : role === 'STAFF'
            ? 'Nhân viên rạp'
            : 'Khách hàng thành viên',
        permissions: staffPerms,
        is_active: prof.status !== 'blocked',
        created_at: prof.created_at ? prof.created_at.split('T')[0] : '2026-01-01',
        source: 'SUPABASE'
      });
    });

    // Map khách vãng lai (Guest) thực tế từ bảng orders
    (guestOrders || []).forEach((ord: any) => {
      if (ord.contact_email && !seenEmails.has(ord.contact_email.toLowerCase())) {
        seenEmails.add(ord.contact_email.toLowerCase());
        accounts.push({
          id: `guest-${ord.id.substring(0, 8)}`,
          name: ord.contact_name || 'Khách vãng lai',
          email: ord.contact_email,
          phone: ord.contact_phone || '',
          role: 'GUEST',
          staff_position: 'Khách vãng lai (Đặt vé online)',
          permissions: [],
          is_active: true,
          created_at: ord.created_at ? ord.created_at.split('T')[0] : '2026-01-01',
          source: 'GUEST'
        });
      }
    });

    return NextResponse.json({
      success: true,
      accounts,
      count: accounts.length,
      source: 'SUPABASE_CLOUD'
    });
  } catch (err: any) {
    console.error('API /admin/accounts GET Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Thực hiện cập nhật trực tiếp vào Supabase Database
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { action } = body;

    // 1. CẬP NHẬT CHỨC DANH / VAI TRÒ (Update Role)
    if (action === 'UPDATE_ROLE') {
      const { accountId, newRole } = body;
      const dbRole = newRole.toLowerCase();

      // Kiểm tra xem ID có phải là UUID hợp lệ không
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);

      if (isUuid) {
        const { error } = await supabase
          .from('profiles')
          .update({
            role: dbRole === 'guest' ? 'user' : dbRole,
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId);

        if (error) {
          console.error('Lỗi update role profiles:', error);
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Nếu chuyển sang STAFF, tự động thêm quyền POS vào staff_permissions nếu chưa có
        if (newRole === 'STAFF') {
          const { data: existing } = await supabase
            .from('staff_permissions')
            .select('id')
            .eq('staff_id', accountId);

          if (!existing || existing.length === 0) {
            await supabase.from('staff_permissions').insert({
              staff_id: accountId,
              permission: 'POS',
              active: true
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Đã cập nhật chức danh [${newRole}] trực tiếp vào database Supabase!`
      });
    }

    // 2. BẬT/TẮT QUYỀN CHỨC NĂNG (Toggle Staff Permission)
    if (action === 'TOGGLE_PERMISSION') {
      const { accountId, permission, enable } = body;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);

      if (isUuid) {
        if (enable) {
          // Thêm / kích hoạt quyền trong bảng staff_permissions
          await supabase.from('staff_permissions').upsert(
            {
              staff_id: accountId,
              permission: permission,
              active: true,
              assigned_at: new Date().toISOString()
            },
            { onConflict: 'staff_id,permission' }
          );
        } else {
          // Xóa hoặc hủy kích hoạt quyền
          await supabase
            .from('staff_permissions')
            .delete()
            .eq('staff_id', accountId)
            .eq('permission', permission);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Đã lưu quyền [${permission}] vào Supabase database!`
      });
    }

    // 3. THÊM TÀI KHOẢN MỚI (Insert into profiles)
    if (action === 'CREATE_ACCOUNT') {
      const { name, email, phone, role, permissions, staff_position, is_active } = body;
      const newUuid = crypto.randomUUID();
      const dbRole = role.toLowerCase() === 'guest' ? 'user' : role.toLowerCase();

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: newUuid,
          full_name: name,
          email: email.toLowerCase().trim(),
          phone: phone?.trim() || null,
          role: dbRole,
          status: is_active ? 'active' : 'blocked',
          loyalty_points: role === 'USER' ? 100 : 0,
          membership_tier: 'MEMBER'
        })
        .select()
        .single();

      if (error) {
        console.error('Lỗi tạo profile:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      // Nếu là STAFF, ghi các quyền vào staff_permissions
      if (role === 'STAFF' && permissions && permissions.length > 0) {
        const permsToInsert = permissions.map((p: string) => ({
          staff_id: newUuid,
          permission: p,
          active: true
        }));
        await supabase.from('staff_permissions').insert(permsToInsert);
      }

      return NextResponse.json({
        success: true,
        message: `Đã tạo tài khoản "${name}" trực tiếp trên Supabase Database!`,
        account: {
          id: newUuid,
          name,
          email,
          phone,
          role,
          staff_position,
          permissions: permissions || [],
          is_active,
          created_at: new Date().toISOString().split('T')[0],
          source: 'SUPABASE'
        }
      });
    }

    // 4. CẬP NHẬT TRẠNG THÁI KHÓA / MỞ KHÓA (Status)
    if (action === 'TOGGLE_STATUS') {
      const { accountId, is_active } = body;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);

      if (isUuid) {
        await supabase
          .from('profiles')
          .update({
            status: is_active ? 'active' : 'blocked',
            updated_at: new Date().toISOString()
          })
          .eq('id', accountId);
      }

      return NextResponse.json({
        success: true,
        message: `Đã cập nhật trạng thái [${is_active ? 'Hoạt động' : 'Tạm khóa'}] vào Supabase!`
      });
    }

    // 5. XÓA TÀI KHOẢN (Delete profile)
    if (action === 'DELETE_ACCOUNT') {
      const { accountId } = body;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);

      if (isUuid) {
        // Xóa permissions trước
        await supabase.from('staff_permissions').delete().eq('staff_id', accountId);
        // Xóa profile
        const { error } = await supabase.from('profiles').delete().eq('id', accountId);
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Đã xóa tài khoản khỏi Supabase Database!'
      });
    }

    return NextResponse.json({ success: false, error: 'Hành động không hợp lệ' }, { status: 400 });
  } catch (err: any) {
    console.error('API /admin/accounts POST Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
