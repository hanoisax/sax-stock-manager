-- ============================================================================
-- BƯỚC 5 (chạy thêm) — Ẩn RPC khỏi anon cho đúng.
-- Bạn đã chạy 02_functions.sql phiên bản cũ (revoke từ anon — chưa đủ).
-- Chạy đoạn này để ẩn hẳn các hàm giao dịch khỏi vai trò anon của web.
-- (Dữ liệu vốn đã an toàn nhờ RLS; đây là lớp bảo vệ thêm.)
-- ============================================================================

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
