# Chuyển sang Supabase — hướng dẫn chạy

Hệ thống đã được code lại để dùng Supabase thay GAS. Bạn chỉ cần làm các bước sau **một lần**.

## A. Tạo cấu trúc database (Supabase → SQL Editor)
Chạy lần lượt từng file (mở file, copy nội dung, Run):
1. `01_schema.sql` — tạo bảng + index
2. `02_functions.sql` — hàm giao dịch (tạo đơn/nhập/kiểm kho…)
3. `03_policies.sql` — bảo mật RLS
4. `04_storage.sql` — bucket ảnh `products` (hoặc tạo tay ở mục Storage)

## B. Đưa dữ liệu cũ sang
Với mỗi sheet, vào Google Sheets → **File → Download → CSV**, rồi Supabase →
**Table Editor → mở bảng → Insert → Import data from CSV**.

Import theo đúng thứ tự (bảng cha trước):
```
Products       → products
Customers      → customers
Orders         → orders
OrderItems     → order_items
StockImports   → stock_imports
ImportItems    → import_items
StockTakes     → stock_takes
StockTakeItems → stock_take_items
Config*        → config   (xem chú thích bên dưới)
```
Tên cột đã đặt trùng tên cũ nên import gần như tự khớp. Cột thừa/thiếu (vd `featured`,
`sale_price`, `detailed_description`) có thể bỏ trống.

> **Config**: sheet cũ là 1 hàng nhiều cột. Bảng `config` mới là dạng key/value.
> Nhập tay vài dòng: `store_name`, `phone`, `address`, `email`, `facebook`, `youtube`,
> `logo_url`, `estore` — mỗi dòng là `key`,`value`.

## C. Tạo tài khoản đăng nhập admin
Supabase → **Authentication → Users → Add user** → nhập email + mật khẩu của bạn,
tick **Auto Confirm User**. Vào **Authentication → Providers → Email** → tắt
**Allow new users to sign up** (chỉ tài khoản bạn tạo mới đăng nhập được).

## D. Ảnh sản phẩm (Cloudinary)
Ảnh **mới** upload lên **Cloudinary** (không dùng Supabase Storage). Cần tạo **1 lần**
một *unsigned upload preset*:
1. Vào https://console.cloudinary.com → **Settings → Upload → Upload presets → Add upload preset**.
2. **Signing Mode = Unsigned**; **Preset name = `sax_products`** (đúng tên này để khớp `.env`).
3. (Tuỳ chọn) đặt **Folder = `products`**. Lưu.

- Cloud name: `jubredgn` (đã có trong `frontend/.env`).
- **KHÔNG** dùng API Key/Secret trong app frontend — chỉ cần Cloud name + preset.
- Ảnh **cũ** trên Google Drive vẫn hiển thị được (URL Drive còn trong `image_url`).

## E. Biến môi trường khi deploy (Netlify)
**sax-stock-manager (admin):**
```
VITE_SUPABASE_URL=https://tvdvdwxxgaqhwkqpyzrl.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_h1uSSHJ-0ewnsjD353ZInQ_5giAIUEq
VITE_CLOUDINARY_CLOUD_NAME=jubredgn
VITE_CLOUDINARY_UPLOAD_PRESET=sax_products
```
**brosax-web:**
```
NEXT_PUBLIC_SUPABASE_URL=https://tvdvdwxxgaqhwkqpyzrl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_h1uSSHJ-0ewnsjD353ZInQ_5giAIUEq
```
(Đã có sẵn trong `.env` / `.env.local` để chạy local.)

## F. Lưu ý free tier
Project free **tạm dừng sau 7 ngày không có request**. Dùng hằng ngày thì không sao;
nếu nghỉ dài, vào dashboard bấm **Restore**.

---
Sau khi xong bước A–B, báo mình để chạy kiểm thử (đăng nhập, tạo đơn, nhập kho, kiểm kho).
GAS có thể giữ lại làm backup vài tuần rồi gỡ.
