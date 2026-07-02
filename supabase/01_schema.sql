-- ============================================================================
-- BƯỚC 1 — Tạo bảng (chạy trong Supabase → SQL Editor)
-- Giữ nguyên ID dạng text (PRD…, ORD…) để import thẳng dữ liệu cũ từ Sheets.
-- ============================================================================

create table if not exists products (
  product_id   text primary key,
  name         text not null,
  type         text,
  "group"      text,
  brand        text,
  condition    text,
  cost_price   bigint  default 0,
  sell_price   bigint  default 0,
  sale_price   bigint,
  stock_qty    integer default 0,
  image_url    text,
  description  text,
  detailed_description text,
  status       text    default 'active',
  featured     boolean default false,
  created_at   timestamptz default now()
);

create table if not exists customers (
  customer_id text primary key,
  name        text not null,
  phone       text,
  email       text,
  address     text,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists orders (
  order_id       text primary key,
  customer_id    text,
  customer_name  text,
  order_date     timestamptz default now(),
  total_amount   bigint default 0,
  discount       bigint default 0,
  final_amount   bigint default 0,
  payment_method text,
  payment_status text,
  notes          text,
  created_by     text
);

create table if not exists order_items (
  item_id      text primary key,
  order_id     text references orders(order_id) on delete cascade,
  product_id   text,
  product_name text,
  quantity     integer,
  unit_price   bigint,
  subtotal     bigint
);

create table if not exists stock_imports (
  import_id   text primary key,
  supplier    text,
  import_date timestamptz default now(),
  total_cost  bigint default 0,
  notes       text
);

create table if not exists import_items (
  item_id      text primary key,
  import_id    text references stock_imports(import_id) on delete cascade,
  product_id   text,
  product_name text,
  quantity     integer,
  unit_cost    bigint,
  subtotal     bigint
);

create table if not exists stock_takes (
  stocktake_id     text primary key,
  take_date        timestamptz default now(),
  notes            text,
  total_diff_qty   integer default 0,
  total_diff_value bigint  default 0,
  created_at       timestamptz default now()
);

create table if not exists stock_take_items (
  item_id      text primary key,
  stocktake_id text references stock_takes(stocktake_id) on delete cascade,
  product_id   text,
  product_name text,
  system_qty   integer,
  actual_qty   integer,
  diff_qty     integer,
  cost_price   bigint,
  diff_value   bigint
);

-- Cấu hình cửa hàng (key/value) — thay sheet Config
create table if not exists config (
  key   text primary key,
  value text
);

-- Index tăng tốc tìm kiếm / lọc
create index if not exists idx_products_status on products(status);
create index if not exists idx_products_type   on products(type, "group");
create index if not exists idx_orderitems_order on order_items(order_id);
create index if not exists idx_importitems_imp  on import_items(import_id);
create index if not exists idx_takeitems_take   on stock_take_items(stocktake_id);
create index if not exists idx_orders_date      on orders(order_date);
