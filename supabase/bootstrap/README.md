# Khởi tạo tài khoản Admin đầu tiên

Chỉ áp dụng trên Supabase project **BAOTRI-Mini-New** (ref: `dskeaiyvldiwlsfqkboq`). Không chạy trên 2 project cũ.

## 1. Auth URL settings
Trong Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://baotri.vieclamhp247.com`
- Redirect URLs thêm:
  - `https://baotri.vieclamhp247.com/**`
  - `http://localhost:5173/**`
  - `http://127.0.0.1:5173/**`

## 2. Tạo Auth user đầu tiên
Authentication → Users → Add user:
- Nhập email của tài khoản Admin đầu tiên.
- Đặt mật khẩu ban đầu (người dùng tự chọn, không gửi mật khẩu vào chat).
- Bật email confirmed / xác nhận email nếu Dashboard cho chọn.
- Tạo user. Auth trigger tự tạo profile.

## 3. Tạo tổ chức + Admin membership
Mở SQL Editor đúng project mới. Mở file `supabase/bootstrap/first_admin_org.sql`, thay:
- `REPLACE_WITH_ADMIN_EMAIL` bằng email ở bước 2.
- `REPLACE_WITH_ORGANIZATION_NAME` bằng tên tổ chức.
Sau đó paste toàn bộ SQL và Run **một lần**. Script kiểm tra role/permission grants và từ chối chạy nếu placeholder còn, email chưa confirmed, hoặc bootstrap đã chạy trước.

Migration 007 tự tạo 3 built-in roles cùng bộ quyền khi organization được tạo. Bootstrap gán user vào Admin.

## 4. Auth policy
Authentication → Sign In / Providers hoặc User Signups:
- Tắt Allow new users to sign up (đăng ký tự do).
- Email confirmation bật.
- Cấu hình SMTP nếu cần mời thành viên/đặt lại mật khẩu thường xuyên. Email service mặc định có giới hạn.

## 5. Đăng nhập & kiểm tra
Mở `https://baotri.vieclamhp247.com/`, đăng nhập email + mật khẩu Admin. Sau khi có organization, nút **Tài khoản** sẽ hiện cho Admin để gửi invitation; người được mời sẽ xác nhận email và đặt mật khẩu đầu tiên.

Không có password, service-role hoặc secret key nào cần nhập vào frontend.
