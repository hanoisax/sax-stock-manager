# Sax Stock Manager — hệ thống quản lý cửa hàng kèn saxophone

Hệ thống quản lý bán hàng / tồn kho cho cửa hàng saxophone (Hanoi Sax / BroSax),
gồm **app quản trị** nội bộ và **website bán hàng** công khai, dùng chung một database.

## Kiến trúc

```
Admin (Vite React)  ──supabase-js──►  Supabase (Postgres + Auth + Storage)
Web (Next.js)       ──supabase-js──►  ▲ (đọc read-only qua RLS)
```

- **Backend cũ = Google Apps Script + Google Sheets** (thư mục `gas/`) — CHẬM,
  đang được thay bằng **Supabase**. Giữ lại làm backup, sẽ gỡ sau.
- Supabase project: `https://tvdvdwxxgaqhwkqpyzrl.supabase.co` (free tier — tự
  pause sau 7 ngày không dùng).
- Thao tác ghi nhiều bảng (tạo đơn, nhập kho, kiểm kho) chạy qua **Postgres RPC**
  (`supabase.rpc(...)`) để đảm bảo nguyên tử; đọc/CRUD đơn giản gọi thẳng PostgREST.

## Thư mục

| Đường dẫn | Nội dung |
|---|---|
| `frontend/` | App quản trị — Vite + React + Tailwind, deploy Netlify (`hanoisax.netlify.app`) |
| `frontend/src/pages/` | Dashboard, Products, Orders, StockImports, StockTakes, Customers, Reports, Login |
| `frontend/src/lib/api.js` | Lớp dữ liệu dùng supabase-js (giữ chữ ký cũ để trang không phải sửa) |
| `frontend/src/lib/auth.jsx` | AuthProvider + `useAuth()` (Supabase Auth) |
| `supabase/` | SQL migration + hướng dẫn (chạy trong SQL Editor) |
| `gas/` | Backend cũ Google Apps Script (tham chiếu / backup) |
| `../brosax/brosax-web/` | Website bán hàng công khai — Next.js 10 + Bulma |

## Database (bảng chính)

`products, customers, orders, order_items, stock_imports, import_items,
stock_takes, stock_take_items, config`.
ID dạng text giữ nguyên tiền tố cũ: `PRD…`, `CUS…`, `ORD…`, `IMP…`, `STK…`.

- **products**: `type` = 'Kèn' | 'Phụ kiện'; `group` (Kèn) Alto/Soprano/Baritone,
  (Phụ kiện) Beck/Dăm/Bao kèn/Chân kèn/Khác. `cost_price` = giá vốn **bình quân
  gia quyền** (cập nhật khi nhập kho). Cột web: `featured`, `sale_price`,
  `detailed_description`.
- **Kiểm kho**: đặt `stock_qty` = số thực tế; chênh lệch tính theo giá vốn hiện tại.
  Xóa phiếu kiểm kho KHÔNG hoàn tồn.

### RPC (trong `supabase/02_functions.sql`)
`create_order` / `delete_order`, `create_import` / `update_import` / `delete_import`,
`create_stock_take` / `delete_stock_take`, `generate_id`. Chỉ role `authenticated`
được execute; anon (web) bị chặn.

## Bảo mật
- **RLS bật trên mọi bảng.** Web (anon) chỉ đọc `products` (status='active') + `config`.
  Admin phải **đăng nhập** (Supabase Auth email/mật khẩu) mới ghi được.
- Tài khoản admin tạo tay ở dashboard (Authentication → Users, Auto Confirm);
  tắt "Allow signups".

## Lệnh thường dùng

```bash
# Admin (trong frontend/)
npm run dev                       # dev server (Vite, cổng 5173)
npx vite build                    # build
netlify deploy --prod --dir dist  # deploy (CHỈ khi user yêu cầu)

# Web (trong ../brosax/brosax-web/) — Next 10 cần cờ OpenSSL cũ trên Node ≥17
NODE_OPTIONS=--openssl-legacy-provider npm run dev
```

## Biến môi trường
- Admin: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`,
  `VITE_CLOUDINARY_UPLOAD_PRESET` (file `frontend/.env`).
- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`.env.local`).

## Quy ước làm việc
- **CHỈ deploy khi user yêu cầu rõ ràng.**
- Ảnh sản phẩm mới → **Cloudinary** (cloud `jubredgn`, unsigned preset `sax_products`,
  folder `products`); hàm trả về `secure_url`. Ảnh cũ vẫn là URL Google Drive.
  KHÔNG nhúng API Secret vào frontend — chỉ dùng unsigned preset.
- Ngôn ngữ giao tiếp: tiếng Việt.

## Trạng thái hiện tại (migration Supabase)
- ✅ Đã viết: schema, RPC, RLS, `api.js` mới, đăng nhập admin, web đọc Supabase.
- ⏳ Cần user: chạy `supabase/05_fix_rpc_grants.sql`, import dữ liệu (tuỳ chọn),
  tạo tài khoản admin, rồi test luồng ghi + deploy.
