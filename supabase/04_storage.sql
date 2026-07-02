-- ============================================================================
-- BƯỚC 4 — Storage cho ảnh sản phẩm (thay Google Drive).
-- Cách 1 (khuyên dùng): UI → Storage → New bucket → tên "products" → tick Public.
-- Cách 2: chạy SQL dưới đây.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- Ai cũng xem được ảnh (bucket public)
create policy "product images public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'products');

-- Chỉ admin đăng nhập mới upload/sửa/xóa ảnh
create policy "product images auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'products');
create policy "product images auth update" on storage.objects
  for update to authenticated using (bucket_id = 'products');
create policy "product images auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'products');
