# TIENDO — BAOTRI Mini (dự án mới)

Cập nhật: 21/11/2026

## Phạm vi và nguyên tắc
- Repo: `Vodanhhp/BaoTri_Mini`, branch `main`, local clone dự kiến `E:\\BaoTri_Mini`.
- Supabase duy nhất được phép thao tác cho repo mới: **BAOTRI-Mini-New**.
- Supabase Project Ref: `dskeaiyvldiwlsfqkboq`; region Singapore `ap-southeast-1`.
- Hai project cũ chỉ tham khảo, không sửa/xóa: `BAOTRI-Mini-Test` (đang giữ để tham khảo) và `BAOTRI-Mini` (đã Pause).
- Không lấy hoặc dùng credentials từ project cũ. Không đưa service_role/secret key vào frontend hoặc Git.
- Các công việc/thao tác quan trọng phải cập nhật file này.

## Cấu hình kết nối
- Project URL: `https://dskeaiyvldiwlsfqkboq.supabase.co`.
- Frontend dùng `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Publishable key đã được xác minh qua Supabase Project Keys; giá trị được đặt trong build environment của workflow GitHub Pages `.github/workflows/deploy-pages.yml`. Đây là public client key, không phải secret/service_role.
- `.env.example` có đúng 2 biến; người dùng cần tạo `.env.local` trên máy nếu chạy local với Cloud Auth.
- GitHub Pages workflow bật `VITE_ENABLE_LOCAL_PREVIEW=true`; chế độ thử Local không cần Cloud.

## Trạng thái Supabase
- Project đã tạo và đang `ACTIVE_HEALTHY`.
- Đã có migrations:
  - `001_identity_and_organizations` (version `20261121022414`)
  - `005_roles_and_permissions` (version `20261121022440`)
  - `006_private_rbac_helpers` (version `20261121022513`)
  - `007_assets_import_permission_and_builtin_roles` (version `20261121022858`)
- Bảng public hiện có: `profiles`, `organizations`, `organization_members`, `roles`, `permissions`, `role_permissions`, `member_roles`; tất cả bật RLS.
- Catalog hiện có **27 permission codes** (đã bổ sung `assets.import` để khớp dự án cũ); profile trigger `on_auth_user_created` gọi `handle_new_auth_user()`.
- Kiểm tra số bản ghi (21/11): organizations=0, roles=0, permissions=27, role_permissions=0, profiles=0. Chưa tạo Auth user hoặc tổ chức đầu tiên.
- Các helper RBAC nằm schema `private`: `is_org_member`, `has_org_role`, `has_org_permission`.
- Migration 007 tạo trigger seed tự động 3 role và permission grants khi organization mới được tạo; role grants: Admin 27, Technician 17, Viewer 10. Helper seed nằm private, đã revoke EXECUTE khỏi PUBLIC/anon/authenticated.
- Bootstrap script an toàn (template, chưa chạy): `supabase/bootstrap/first_admin_org.sql`. Cần tạo Auth user đầu tiên qua Dashboard, thay email/tên tổ chức trong script, chạy một lần trên project mới.

## Ba cấp tài khoản (giữ nguyên mô hình cũ)
Role codes: `admin`, `technician`, `viewer`.

- **Admin** — 27 permissions: toàn bộ catalog; gồm quản lý Users/Roles, cấu hình, xóa/import thiết bị, và toàn quyền các module.
- **Technician (Kỹ thuật viên)** — 17 permissions: dashboard; assets.view/create/update; inventory.view/create/update/adjust; maintenance.view/create/update; checklist.view/result.create; logs.view/create; reports.view; settings.view. Không có quyền quản trị Users/Roles, cấu hình, xóa.
- **Viewer (Người xem)** — 10 permissions read-only: assets.view, checklist.view, dashboard.view, inventory.view, logs.view, maintenance.view, reports.view, roles.view, settings.view, users.view.

Permission catalog hiện có 26 code:
`dashboard.view`, `assets.view`, `assets.create`, `assets.update`, `assets.delete`, `assets.import`, `inventory.view`, `inventory.create`, `inventory.update`, `inventory.adjust`, `inventory.delete`, `maintenance.view`, `maintenance.create`, `maintenance.update`, `maintenance.delete`, `checklist.view`, `checklist.template.manage`, `checklist.result.create`, `logs.view`, `logs.create`, `reports.view`, `settings.view`, `settings.manage`, `users.view`, `users.manage`, `roles.view`, `roles.manage`.

## Repo / ứng dụng hiện tại
- React 18 + TypeScript + Vite; Supabase Auth đăng nhập; Dexie/IndexedDB lưu thiết bị Local.
- Chưa có đăng ký tự do trong giao diện. Chưa có UI quản lý user/role.
- GitHub Pages: `https://baotri.vieclamhp247.com/`.
- Local preview được bật trong workflow build Pages.
- Thiết bị vẫn Local-only; chưa sync Cloud, chưa có data isolation trên Local.
- Tính năng thiết bị đã có: CRUD (lưu kho/khôi phục), tìm kiếm/lọc/sắp xếp/dashboard, ảnh tối đa 8 ảnh JPEG nén, QR, in tem 50x30mm và in chi tiết.

## Việc tiếp theo
1. Hoàn tất bootstrap tổ chức đầu tiên và tài khoản Admin; việc tạo Auth user đầu tiên cần thực hiện qua Supabase Dashboard (Auth > Users) do chưa có công cụ Auth Admin an toàn được kết nối. Trigger sẽ tự tạo profile.
2. Tạo organization đầu tiên, membership Admin và gán role/permissions theo schema RBAC; xác minh bằng SQL read-only.
3. Không mở signup tự do; kiểm tra cấu hình Auth signups bị tắt trong Dashboard trước khi phát hành.
4. Kiểm tra đăng nhập trên GitHub Pages và local; sau đó triển khai luồng tạo user/đổi role Admin có kiểm soát.
5. Kiểm thử browser PC/mobile, thiết bị Local, máy in tem trước các tính năng tiếp theo.

## Nhật ký công việc
### 21/11/2026
- Đã xác nhận Project BAOTRI-Mini-New active healthy và credentials public client khớp cấu hình build.
- Đã kiểm tra database: 3 migration nền đã chạy; 7 bảng identity/RBAC; 26 permission catalog; chưa có organization/user/role assignments.
- Đã xác nhận mô hình 3 role và permission grants từ database Test cũ theo dạng read-only để giữ đúng thiết kế (không chỉnh sửa project cũ).
- Đã tạo file TIENDO để ghi lại các công việc và quyết định quan trọng từ nay về sau.
- Đã áp dụng Migration 007 trên BAOTRI-Mini-New: thêm `assets.import`, tạo private seed helper + trigger auto-seed roles/permissions mỗi organization. Migration source được commit vào repo.
- Đã kiểm thử trong transaction rollback-only: Auth user trigger tạo profile; tạo organization trigger sinh đúng 3 role; counts Admin=27, Technician=17, Viewer=10; Admin helper xác nhận `admin`, `users.manage`, `assets.import`. Toàn bộ test fixture đã ROLLBACK; database không lưu user/org thử nghiệm.
- Đã chạy Supabase Security Advisor sau migration: không có lints.
- Đã thêm template bootstrap first Admin + organization; chưa chạy và chưa tạo tài khoản thật.
