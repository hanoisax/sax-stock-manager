-- ============================================================================
-- BƯỚC 3 — Bảo mật (RLS). Chạy sau 02_functions.sql.
--   • Web (anon): CHỈ đọc sản phẩm đang bán + config.
--   • Admin (đã đăng nhập): toàn quyền.
-- ============================================================================

alter table products         enable row level security;
alter table customers        enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table stock_imports    enable row level security;
alter table import_items     enable row level security;
alter table stock_takes      enable row level security;
alter table stock_take_items enable row level security;
alter table config           enable row level security;

-- ─── PRODUCTS ────────────────────────────────────────────────────────────────
-- Web đọc sản phẩm đang bán
create policy products_anon_read on products
  for select to anon using (status = 'active');
-- Admin đọc tất cả + ghi
create policy products_auth_all on products
  for all to authenticated using (true) with check (true);

-- ─── CONFIG ──────────────────────────────────────────────────────────────────
create policy config_anon_read on config
  for select to anon using (true);
create policy config_auth_all on config
  for all to authenticated using (true) with check (true);

-- ─── CÁC BẢNG QUẢN TRỊ KHÁC (chỉ admin) ─────────────────────────────────────
create policy customers_auth        on customers        for all to authenticated using (true) with check (true);
create policy orders_auth           on orders           for all to authenticated using (true) with check (true);
create policy order_items_auth      on order_items      for all to authenticated using (true) with check (true);
create policy stock_imports_auth    on stock_imports    for all to authenticated using (true) with check (true);
create policy import_items_auth     on import_items     for all to authenticated using (true) with check (true);
create policy stock_takes_auth      on stock_takes      for all to authenticated using (true) with check (true);
create policy stock_take_items_auth on stock_take_items for all to authenticated using (true) with check (true);

-- ============================================================================
-- TÀI KHOẢN ADMIN: KHÔNG tạo bằng SQL. Vào Supabase → Authentication → Users
--   → Add user → nhập email + mật khẩu của bạn (tick "Auto Confirm User").
-- Tắt đăng ký công khai: Authentication → Providers → Email → tắt "Allow signups"
--   (chỉ user bạn tạo tay mới đăng nhập được).
-- ============================================================================
