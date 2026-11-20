# BAOTRI Mini

Dự án mới được tách độc lập từ BAOTRI Mini gốc. Giai đoạn đầu chỉ triển khai:
- Đăng nhập bằng tài khoản Supabase được cấp sẵn.
- Quản lý thiết bị trên dữ liệu Local của trình duyệt.

Chưa triển khai vật tư, checklist, công việc, kế hoạch, báo cáo hoặc đồng bộ Cloud thiết bị.

## Công nghệ
- React + TypeScript + Vite
- Dexie / IndexedDB cho dữ liệu thiết bị Local
- Supabase Auth cho đăng nhập

## Cấu hình
Sao chép `.env.example` thành `.env.local` và điền thông tin Supabase riêng của dự án mới:
```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Không dùng lại cấu hình Supabase Production hoặc Test của dự án cũ khi chưa có quyết định riêng.

## Chạy local
```bash
npm install
npm run dev
```

## Nguyên tắc
- Repository này độc lập với dự án gốc.
- Nghiệp vụ thiết bị giai đoạn đầu lưu tại Local; chưa đồng bộ Cloud.
- Tài khoản đăng nhập hiện xác thực qua Supabase; phân vùng dữ liệu theo tổ chức và quyền truy cập Cloud sẽ được thiết kế trước khi bật lưu trữ/chia sẻ dữ liệu thiết bị.
