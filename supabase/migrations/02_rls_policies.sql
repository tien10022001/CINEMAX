-- ====================================================================
-- CINEMAX SUPABASE REDESIGN v3.0 - BƯỚC 2/4: ROW LEVEL SECURITY (RLS)
-- Thiết lập kiểm soát truy cập cấp hàng nghiêm ngặt theo Ma trận RBAC
-- ====================================================================

-- 1. Kích hoạt RLS trên toàn bộ 28 bảng
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cinema_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movie_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoriums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showtimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showtime_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.showtime_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_access_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Helper Functions kiểm tra quyền người dùng hiện tại
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role_t AS $$
DECLARE
    v_role public.user_role_t;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_role, 'user'::public.user_role_t);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_staff_permission(p_perm public.staff_perm_t)
RETURNS boolean AS $$
BEGIN
    IF public.current_user_role() = 'admin' THEN
        RETURN true;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.staff_permissions
        WHERE staff_id = auth.uid() AND permission = p_perm AND active = true
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Policies cho từng bảng

-- 3.1. profiles
CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.current_user_role() = 'admin');

CREATE POLICY "profiles_update_self_or_admin" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.current_user_role() = 'admin');

-- 3.2. staff_permissions
CREATE POLICY "staff_permissions_admin_all" ON public.staff_permissions
    FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "staff_permissions_self_read" ON public.staff_permissions
    FOR SELECT USING (staff_id = auth.uid());

-- 3.3. cinema_settings
CREATE POLICY "cinema_settings_public_read" ON public.cinema_settings
    FOR SELECT USING (true);

CREATE POLICY "cinema_settings_admin_all" ON public.cinema_settings
    FOR ALL USING (public.current_user_role() = 'admin');

-- 3.4. content_items, genres, movies, movie_genres
CREATE POLICY "content_items_read" ON public.content_items
    FOR SELECT USING (status = 'published' OR public.current_user_role() = 'admin');
CREATE POLICY "content_items_admin" ON public.content_items
    FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "genres_read" ON public.genres FOR SELECT USING (true);
CREATE POLICY "genres_admin" ON public.genres FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "movies_read" ON public.movies
    FOR SELECT USING (status IN ('coming_soon', 'now_showing') OR public.current_user_role() = 'admin');
CREATE POLICY "movies_admin" ON public.movies FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "movie_genres_read" ON public.movie_genres FOR SELECT USING (true);
CREATE POLICY "movie_genres_admin" ON public.movie_genres FOR ALL USING (public.current_user_role() = 'admin');

-- 3.5. auditoriums, seats, showtimes, showtime_prices, showtime_seats
CREATE POLICY "auditoriums_read" ON public.auditoriums FOR SELECT USING (true);
CREATE POLICY "auditoriums_admin" ON public.auditoriums FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "seats_read" ON public.seats FOR SELECT USING (true);
CREATE POLICY "seats_admin" ON public.seats FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "showtimes_read" ON public.showtimes FOR SELECT USING (true);
CREATE POLICY "showtimes_admin" ON public.showtimes FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "showtime_prices_read" ON public.showtime_prices FOR SELECT USING (true);
CREATE POLICY "showtime_prices_admin" ON public.showtime_prices FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "showtime_seats_read" ON public.showtime_seats FOR SELECT USING (true);
-- Ghi showtime_seats chỉ cho phép qua Security Definer Stored Procedures

-- 3.6. products, product_components, product_modifiers
CREATE POLICY "products_read" ON public.products FOR SELECT USING (active = true OR public.current_user_role() = 'admin');
CREATE POLICY "products_admin" ON public.products FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "product_components_read" ON public.product_components FOR SELECT USING (true);
CREATE POLICY "product_components_admin" ON public.product_components FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "product_modifiers_read" ON public.product_modifiers FOR SELECT USING (active = true OR public.current_user_role() = 'admin');
CREATE POLICY "product_modifiers_admin" ON public.product_modifiers FOR ALL USING (public.current_user_role() = 'admin');

-- 3.7. inventory_movements
CREATE POLICY "inventory_movements_read" ON public.inventory_movements
    FOR SELECT USING (public.current_user_role() = 'admin' OR public.has_staff_permission('CONCESSION'));

-- 3.8. coupons, coupon_redemptions
CREATE POLICY "coupons_read" ON public.coupons FOR SELECT USING (active = true OR public.current_user_role() = 'admin');
CREATE POLICY "coupons_admin" ON public.coupons FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "coupon_redemptions_admin" ON public.coupon_redemptions
    FOR ALL USING (public.current_user_role() = 'admin');

-- 3.9. orders, order_items, order_item_fulfillments
CREATE POLICY "orders_select" ON public.orders
    FOR SELECT USING (
        user_id = auth.uid() OR
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('POS')
    );

CREATE POLICY "order_items_select" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id AND (
                o.user_id = auth.uid() OR
                public.current_user_role() = 'admin' OR
                public.has_staff_permission('POS') OR
                public.has_staff_permission('CHECKIN') OR
                public.has_staff_permission('CONCESSION')
            )
        )
    );

CREATE POLICY "fulfillments_select" ON public.order_item_fulfillments
    FOR SELECT USING (public.current_user_role() = 'admin' OR public.has_staff_permission('CONCESSION'));

-- 3.10. payments
CREATE POLICY "payments_select" ON public.payments
    FOR SELECT USING (
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('POS') OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND o.user_id = auth.uid())
    );

-- 3.11. tickets
CREATE POLICY "tickets_select" ON public.tickets
    FOR SELECT USING (
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('CHECKIN') OR
        public.has_staff_permission('POS') OR
        EXISTS (
            SELECT 1 FROM public.order_items oi
            JOIN public.orders o ON o.id = oi.order_id
            WHERE oi.id = tickets.order_item_id AND o.user_id = auth.uid()
        )
    );

-- 3.12. shifts
CREATE POLICY "shifts_select" ON public.shifts
    FOR SELECT USING (
        staff_id = auth.uid() OR
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('SUPERVISOR')
    );

-- 3.13. refunds, invoice_requests, support_requests
CREATE POLICY "refunds_select" ON public.refunds
    FOR SELECT USING (
        requested_by = auth.uid() OR
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('SUPERVISOR')
    );

CREATE POLICY "invoice_requests_select" ON public.invoice_requests
    FOR SELECT USING (
        public.current_user_role() = 'admin' OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = invoice_requests.order_id AND o.user_id = auth.uid())
    );

CREATE POLICY "support_requests_select" ON public.support_requests
    FOR SELECT USING (
        created_by = auth.uid() OR
        assigned_to = auth.uid() OR
        public.current_user_role() = 'admin' OR
        public.has_staff_permission('POS')
    );

-- 3.14. order_access_challenges, audit_logs
CREATE POLICY "challenges_system_only" ON public.order_access_challenges
    FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "audit_logs_admin_only" ON public.audit_logs
    FOR SELECT USING (public.current_user_role() = 'admin');
