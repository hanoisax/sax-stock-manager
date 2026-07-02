-- ============================================================================
-- BƯỚC 2 — Hàm giao dịch (RPC). Port nguyên logic từ GAS, đảm bảo nguyên tử.
-- Chạy sau 01_schema.sql.
-- ============================================================================

-- Sinh ID giống generateId() của GAS: prefix + base36(time) + 3 ký tự ngẫu nhiên
create or replace function generate_id(prefix text)
returns text language sql volatile as $$
  select prefix
      || upper(to_hex((extract(epoch from clock_timestamp())*1000)::bigint))
      || upper(substr(md5(random()::text), 1, 3));
$$;

-- ─── Đơn hàng ────────────────────────────────────────────────────────────────
create or replace function create_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_order_id text := generate_id('ORD');
  v_item jsonb; v_prod products%rowtype;
  v_qty int; v_unit bigint; v_subtotal bigint;
  v_total bigint := 0; v_discount bigint; v_final bigint;
begin
  -- validate tồn + cộng tổng
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where product_id = v_item->>'product_id';
    if not found then raise exception 'Product not found: %', v_item->>'product_id'; end if;
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 then raise exception 'Invalid quantity for %', v_item->>'product_id'; end if;
    if v_prod.stock_qty < v_qty then
      raise exception 'Không đủ hàng "%". Tồn: %, cần: %', v_prod.name, v_prod.stock_qty, v_qty;
    end if;
    v_total := v_total + v_qty * coalesce(nullif(v_item->>'unit_price','')::bigint, v_prod.sell_price);
  end loop;

  v_discount := coalesce((p_order->>'discount')::bigint, 0);
  v_final := v_total - v_discount;

  insert into orders(order_id, customer_id, customer_name, order_date, total_amount,
                     discount, final_amount, payment_method, payment_status, notes, created_by)
  values (v_order_id, p_order->>'customer_id', p_order->>'customer_name',
          coalesce(nullif(p_order->>'order_date','')::timestamptz, now()),
          v_total, v_discount, v_final,
          coalesce(nullif(p_order->>'payment_method',''), 'Tiền mặt'),
          coalesce(nullif(p_order->>'payment_status',''), 'paid'),
          p_order->>'notes', p_order->>'created_by');

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where product_id = v_item->>'product_id';
    v_qty  := (v_item->>'quantity')::int;
    v_unit := coalesce(nullif(v_item->>'unit_price','')::bigint, v_prod.sell_price);
    v_subtotal := v_qty * v_unit;
    insert into order_items(item_id, order_id, product_id, product_name, quantity, unit_price, subtotal)
    values (generate_id('ITM'), v_order_id, v_prod.product_id, v_prod.name, v_qty, v_unit, v_subtotal);
    update products set stock_qty = stock_qty - v_qty where product_id = v_prod.product_id;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'total_amount', v_total, 'final_amount', v_final);
end $$;

create or replace function delete_order(p_id text)
returns void language plpgsql as $$
declare v_it record;
begin
  for v_it in select product_id, quantity from order_items where order_id = p_id loop
    update products set stock_qty = stock_qty + coalesce(v_it.quantity,0) where product_id = v_it.product_id;
  end loop;
  delete from orders where order_id = p_id;   -- cascade xóa order_items
end $$;

-- ─── Nhập kho (giá vốn bình quân gia quyền) ──────────────────────────────────
create or replace function create_import(p_import jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_import_id text := generate_id('IMP');
  v_item jsonb; v_np jsonb;
  v_pid text; v_pname text;
  v_qty int; v_unit bigint; v_subtotal bigint;
  v_total bigint := 0; v_prod products%rowtype; v_newavg bigint;
begin
  -- chèn header trước (FK), tổng cập nhật sau
  insert into stock_imports(import_id, supplier, import_date, total_cost, notes)
  values (v_import_id, coalesce(p_import->>'supplier',''),
          coalesce(nullif(p_import->>'import_date','')::timestamptz, now()), 0, coalesce(p_import->>'notes',''));

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := coalesce((v_item->>'quantity')::int, 0);
    v_unit := coalesce((v_item->>'unit_cost')::bigint, 0);
    if v_qty <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;

    if v_item ? 'new_product' and jsonb_typeof(v_item->'new_product') = 'object' then
      v_np := v_item->'new_product';
      if coalesce(v_np->>'name','') = '' then raise exception 'Tên sản phẩm không được để trống'; end if;
      v_pid := generate_id('PRD'); v_pname := v_np->>'name';
      insert into products(product_id, name, type, "group", brand, condition, cost_price,
                           sell_price, stock_qty, image_url, description, status, created_at)
      values (v_pid, v_pname, 'Kèn', coalesce(v_np->>'group',''), coalesce(v_np->>'brand',''),
              coalesce(nullif(v_np->>'condition',''),'Mới'), v_unit,
              coalesce((v_np->>'sell_price')::bigint, 0), 0,
              coalesce(v_np->>'image_url',''), coalesce(v_np->>'description',''), 'active', now());
    else
      v_pid := v_item->>'product_id';
      select * into v_prod from products where product_id = v_pid;
      if not found then raise exception 'Không tìm thấy sản phẩm: %', v_pid; end if;
      v_pname := v_prod.name;
      if (v_prod.stock_qty + v_qty) > 0 then
        v_newavg := round((v_prod.stock_qty::numeric * v_prod.cost_price + v_qty::numeric * v_unit)
                          / (v_prod.stock_qty + v_qty));
      else v_newavg := v_unit; end if;
      update products set cost_price = v_newavg where product_id = v_pid;
    end if;

    v_subtotal := v_qty * v_unit;
    v_total := v_total + v_subtotal;
    insert into import_items(item_id, import_id, product_id, product_name, quantity, unit_cost, subtotal)
    values (generate_id('IMI'), v_import_id, v_pid, v_pname, v_qty, v_unit, v_subtotal);
    update products set stock_qty = stock_qty + v_qty where product_id = v_pid;
  end loop;

  update stock_imports set total_cost = v_total where import_id = v_import_id;
  return jsonb_build_object('import_id', v_import_id, 'total_cost', v_total, 'items_count', jsonb_array_length(p_items));
end $$;

create or replace function update_import(p_import jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_import_id text := p_import->>'import_id';
  v_rev record; v_prod products%rowtype;
  v_item jsonb; v_np jsonb; v_pid text; v_pname text;
  v_qty int; v_unit bigint; v_subtotal bigint; v_total bigint := 0; v_newavg bigint; v_remain int;
begin
  if v_import_id is null then raise exception 'Missing import_id'; end if;

  -- 1. Hoàn tồn + đảo ngược bình quân giá vốn theo nhóm sản phẩm
  for v_rev in
    select product_id, sum(quantity) qty, sum(quantity*unit_cost) totalcost
    from import_items where import_id = v_import_id group by product_id
  loop
    select * into v_prod from products where product_id = v_rev.product_id;
    if found then
      v_remain := v_prod.stock_qty - v_rev.qty;
      if v_remain > 0 then
        update products set cost_price = greatest(0,
          round((v_prod.stock_qty::numeric * v_prod.cost_price - v_rev.totalcost) / v_remain))
        where product_id = v_rev.product_id;
      end if;
      update products set stock_qty = stock_qty - v_rev.qty where product_id = v_rev.product_id;
    end if;
  end loop;

  delete from import_items where import_id = v_import_id;

  -- 2. Thêm items mới (giống create_import)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty  := coalesce((v_item->>'quantity')::int, 0);
    v_unit := coalesce((v_item->>'unit_cost')::bigint, 0);
    if v_qty <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;

    if v_item ? 'new_product' and jsonb_typeof(v_item->'new_product') = 'object' then
      v_np := v_item->'new_product';
      if coalesce(v_np->>'name','') = '' then raise exception 'Tên sản phẩm không được để trống'; end if;
      v_pid := generate_id('PRD'); v_pname := v_np->>'name';
      insert into products(product_id, name, type, "group", brand, condition, cost_price,
                           sell_price, stock_qty, image_url, description, status, created_at)
      values (v_pid, v_pname, 'Kèn', coalesce(v_np->>'group',''), coalesce(v_np->>'brand',''),
              coalesce(nullif(v_np->>'condition',''),'Mới'), v_unit,
              coalesce((v_np->>'sell_price')::bigint, 0), 0,
              coalesce(v_np->>'image_url',''), coalesce(v_np->>'description',''), 'active', now());
    else
      v_pid := v_item->>'product_id';
      select * into v_prod from products where product_id = v_pid;
      if not found then raise exception 'Không tìm thấy sản phẩm: %', v_pid; end if;
      v_pname := v_prod.name;
      if (v_prod.stock_qty + v_qty) > 0 then
        v_newavg := round((v_prod.stock_qty::numeric * v_prod.cost_price + v_qty::numeric * v_unit)
                          / (v_prod.stock_qty + v_qty));
      else v_newavg := v_unit; end if;
      update products set cost_price = v_newavg where product_id = v_pid;
    end if;

    v_subtotal := v_qty * v_unit; v_total := v_total + v_subtotal;
    insert into import_items(item_id, import_id, product_id, product_name, quantity, unit_cost, subtotal)
    values (generate_id('IMI'), v_import_id, v_pid, v_pname, v_qty, v_unit, v_subtotal);
    update products set stock_qty = stock_qty + v_qty where product_id = v_pid;
  end loop;

  update stock_imports set
    supplier    = coalesce(p_import->>'supplier',''),
    import_date = coalesce(nullif(p_import->>'import_date','')::timestamptz, now()),
    total_cost  = v_total,
    notes       = coalesce(p_import->>'notes','')
  where import_id = v_import_id;

  return jsonb_build_object('import_id', v_import_id, 'total_cost', v_total);
end $$;

create or replace function delete_import(p_id text)
returns void language plpgsql as $$
declare v_it record;
begin
  for v_it in select product_id, quantity from import_items where import_id = p_id loop
    update products set stock_qty = stock_qty - coalesce(v_it.quantity,0) where product_id = v_it.product_id;
  end loop;
  delete from stock_imports where import_id = p_id;  -- cascade xóa import_items
end $$;

-- ─── Kiểm kho (set tồn = thực tế) ────────────────────────────────────────────
create or replace function create_stock_take(p_take jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_id text := generate_id('STK');
  v_item jsonb; v_prod products%rowtype;
  v_sys int; v_act int; v_diff int; v_cost bigint; v_dval bigint;
  v_tqty int := 0; v_tval bigint := 0;
begin
  insert into stock_takes(stocktake_id, take_date, notes, total_diff_qty, total_diff_value, created_at)
  values (v_id, coalesce(nullif(p_take->>'take_date','')::timestamptz, now()),
          coalesce(p_take->>'notes',''), 0, 0, now());

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from products where product_id = v_item->>'product_id';
    if not found then raise exception 'Không tìm thấy sản phẩm: %', v_item->>'product_id'; end if;
    v_sys := coalesce(v_prod.stock_qty, 0);
    v_act := (v_item->>'actual_qty')::int;
    if v_act is null or v_act < 0 then raise exception 'Số lượng thực tế không hợp lệ cho "%"', v_prod.name; end if;
    v_diff := v_act - v_sys;
    v_cost := coalesce(v_prod.cost_price, 0);
    v_dval := v_diff * v_cost;
    update products set stock_qty = v_act where product_id = v_prod.product_id;
    v_tqty := v_tqty + v_diff; v_tval := v_tval + v_dval;
    insert into stock_take_items(item_id, stocktake_id, product_id, product_name,
                                 system_qty, actual_qty, diff_qty, cost_price, diff_value)
    values (generate_id('STI'), v_id, v_prod.product_id, v_prod.name,
            v_sys, v_act, v_diff, v_cost, v_dval);
  end loop;

  update stock_takes set total_diff_qty = v_tqty, total_diff_value = v_tval where stocktake_id = v_id;
  return jsonb_build_object('stocktake_id', v_id, 'total_diff_qty', v_tqty,
                            'total_diff_value', v_tval, 'items_count', jsonb_array_length(p_items));
end $$;

-- Xóa phiếu kiểm kho KHÔNG hoàn tồn (tồn đã là số thực tế đúng) — giống GAS
create or replace function delete_stock_take(p_id text)
returns void language plpgsql as $$
begin
  delete from stock_takes where stocktake_id = p_id;  -- cascade xóa items
end $$;

-- Chỉ cho user đã đăng nhập gọi RPC (anon của web không được chạy).
-- Lưu ý: Postgres mặc định cấp EXECUTE cho PUBLIC, nên phải revoke từ PUBLIC
-- (revoke từ anon không đủ). Dữ liệu vẫn an toàn nhờ RLS, đây là lớp bảo vệ thêm.
revoke execute on function
  create_order(jsonb,jsonb), delete_order(text),
  create_import(jsonb,jsonb), update_import(jsonb,jsonb), delete_import(text),
  create_stock_take(jsonb,jsonb), delete_stock_take(text), generate_id(text)
from public;

grant execute on function
  create_order(jsonb,jsonb), delete_order(text),
  create_import(jsonb,jsonb), update_import(jsonb,jsonb), delete_import(text),
  create_stock_take(jsonb,jsonb), delete_stock_take(text), generate_id(text)
to authenticated;
