# Booking Tâm Lý — Đồng bộ nhiều thiết bị

Ứng dụng quản lý booking với nhiều tài khoản, đồng bộ realtime qua Supabase (miễn phí).

## Tính năng

- Đăng nhập nhiều tài khoản, đổi mật khẩu
- Booking theo ngày: **Khung giờ → Tên → TLG → Người nhập** (tự động theo tài khoản)
- Tab **Thống kê TLG**: số ca, thứ tự theo giờ, trạng thái hoàn thành
- Tab **Lịch sử**: log thêm / sửa / xóa / hoàn thành ca
- Đồng bộ realtime giữa nhiều thiết bị
- Admin: thêm TLG, tạo tài khoản mới

## Cài đặt Supabase (1 lần, ~10 phút)

### 1. Tạo project

1. Vào [supabase.com](https://supabase.com) → **New project** (miễn phí)
2. Chờ project khởi tạo

### 2. Chạy SQL

1. **SQL Editor** → New query
2. Copy toàn bộ nội dung file `supabase/schema.sql` → **Run**

### 3. Tắt xác nhận email (quan trọng)

1. **Authentication** → **Providers** → **Email**
2. Tắt **Confirm email**

### 4. Tạo tài khoản admin

1. **Authentication** → **Users** → **Add user**
2. Email: `admin@booking.app.internal`
3. Password: `123456`
4. **User Metadata** (JSON):

```json
{"username":"admin","display_name":"Admin","is_admin":true}
```

### 5. Cấu hình app

1. **Project Settings** → **API**
2. Copy **Project URL** và **anon public** key
3. Mở `js/config.js` và điền:

```javascript
const APP_CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbG...',
  AUTH_EMAIL_DOMAIN: 'booking.app.internal',
};
```

### 6. Chạy thử

```bash
python -m http.server 8080
```

Mở http://localhost:8080 — đăng nhập `admin` / `123456`

## Deploy miễn phí

### GitHub Pages / Netlify / Vercel

Upload folder hoặc push lên GitHub, deploy static. **Không cần build.**

- GitHub Pages: Settings → Pages → branch `main`
- Netlify: kéo thả folder
- Vercel: import repo, framework preset **Other**

## Quản lý (Admin)

- Nút **Quản lý** trên header (chỉ admin)
- **Thêm TLG**: tên người được đặt lịch
- **Tạo tài khoản**: username + mật khẩu cho nhân viên

## Cấu trúc booking

| Cột | Mô tả |
|-----|--------|
| Khung giờ | HH:MM |
| Tên | Người đặt lịch |
| TLG | Người được đặt lịch |
| Người nhập | Tự động = tài khoản đăng nhập |
