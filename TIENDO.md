# TIENDO — BAOTRI Mini (dự án mới)

Cập nhật: 21/11/2026

## Phạm vi và nguyên tắc
- Repo: `Vodanhhp/BaoTri_Mini`, branch `main`, local clone `E:\\BaoTri_Mini`.
- Supabase duy nhất được phép thao tác cho repo mới: **BAOTRI-Mini-New**.
- Supabase Project Ref: `dskeaiyvldiwlsfqkboq`; region Singapore `ap-southeast-1`.
- Hai project cũ chỉ tham khảo, không sửa/xóa: `BAOTRI-Mini-Test` (đang giữ để tham khảo) và `BAOTRI-Mini` (đã Pause).
- Không lấy hoặc dùng credentials từ project cũ. Không đưa service_role/secret key vào frontend hoặc Git.
- Các công việc/thao tác quan trọng phải cập nhật file này.

## Cấu hình kết nối
- Project URL: `https://dskeaiyvldiwlsfqkboq.supabase.co`.
- Frontend dùng `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Publishable key đã được xác minh qua Supabase Project Keys; giá trị được đặt trong build environment của workflow GitHub Pages `.github/workflows/deploy-pages.yml`. Đây là public client key, không phải secret/service_role.
- `.env.example` đã điền URL + publishable key của project mới; copy sang `.env.local` trên máy để chạy local với Cloud Auth.
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
- Đã kiểm tra database: 4 migrations đã chạy; 7 bảng identity/RBAC; catalog 27 permissions; chưa có organization/user/role assignments.
- Đã xác nhận mô hình 3 role và permission grants từ database Test cũ theo dạng read-only để giữ đúng thiết kế (không chỉnh sửa project cũ).
- Đã tạo file TIENDO để ghi lại các công việc và quyết định quan trọng từ nay về sau.
- Đã áp dụng Migration 007 trên BAOTRI-Mini-New: thêm `assets.import`, tạo private seed helper + trigger auto-seed roles/permissions mỗi organization. Migration source được commit vào repo.
- Đã kiểm thử trong transaction rollback-only: Auth user trigger tạo profile; tạo organization trigger sinh đúng 3 role; counts Admin=27, Technician=17, Viewer=10; Admin helper xác nhận `admin`, `users.manage`, `assets.import`. Toàn bộ test fixture đã ROLLBACK; database không lưu user/org thử nghiệm.
- Đã chạy Supabase Security Advisor sau migration: không có lints.
- Đã thêm template bootstrap first Admin + organization; chưa chạy và chưa tạo tài khoản thật.

## Commit tham chiếu
- Migration 007 source: `83b87a691a1008d1ebd6050f65db72c70a63eef3`.
- Bootstrap script: `c1a581d4535645012903428479f9f76cc9457deb`.
- TIENDO được tạo và cập nhật trong các commit: `136f3601d5f4fe9a0d40deb0f5af61371b3ebe9`, `0a4eb71f1e7906676097311d1856d8e7646c725b`, `0da54a671c870f181f2d8e53c7787f1b2fe85fda`.

### Cấu hình key sửa lỗi (21/11/2026)
- So sánh trực tiếp workflow với Supabase Project Keys phát hiện publishable key trong workflow thiếu ký tự `k` trước `0EY`; đã sửa về đúng key hiện tại.
- Đã cập nhật `.env.example` để dùng URL và key của BAOTRI-Mini-New, thuận tiện tạo `.env.local` local.
- Commit sửa workflow: `c9cfb386206990d64e09ba99562330146174ef9f`; commit `.env.example`: `5b5a5de5ea530f4b7f3ce85f7832bc41b41f2499`.
- Các commit trên kích hoạt GitHub Pages workflow build/deploy; trạng thái run chưa kiểm tra được qua kết nối GitHub hiện có.

## Tiến độ tiếp tục: Auth + Local/Cloud thiết bị (21/11/2026)
### Supabase migrations 008–010 (chỉ project BAOTRI-Mini-New)
- **008 Cloud asset sync and locking**: tạo bảng `assets`, `asset_import_receipts`, `asset_edit_locks`, `asset_mutation_receipts`. Cloud thiết bị chỉ SELECT trực tiếp; mọi import/update qua RPC kiểm tra permission.
- Import Local→Cloud giữ UUID + mã quản lý; kiểm tra trùng UUID/code; không tự ghi đè; idempotent theo mutation UUID.
- Lock chỉnh sửa thiết bị có lease 75 giây, renew heartbeat; khóa gắn user+device, PC và Mobile khác device ID sẽ bị chặn khi cùng hồ sơ. Mutation dùng lock token + expected Cloud updated_at + receipt để retry an toàn.
- 009: Auth user được mời có membership status `invited`; sau xác nhận email, trigger Auth tự chuyển membership sang `active`.
- 010: chuyển các SECURITY DEFINER implementation sang schema `private`; public RPC wrapper là SECURITY INVOKER. Receipt/lock table có policy deny direct. Security Advisor hiện **0 lints**.
- Test rollback-only đã chạy thành công: Auth profile trigger, tổ chức auto-seed roles, Admin import, import retry, PC lock và Mobile conflict, Cloud mutation/replay receipt, release lock, invite activation; test Technician 17 quyền và Viewer read-only; test public invoker wrappers. Mọi fixture đều rollback.
### Frontend
- Thêm `organizationContext`: đọc membership, role, permission và tổ chức đang hoạt động.
- Local IndexedDB nâng version 3: tách scope theo organization UUID; Local Preview dùng scope riêng `local-preview`; tạo bảng Cloud links và mutation queue. Tránh dữ liệu Preview lẫn dữ liệu tài khoản.
- Đăng nhập không signup tự do; thêm Forgot password và screen đặt password mới.
- Tài khoản Admin có nút Tài khoản để mời email với role Admin/Kỹ thuật viên/Người xem.
- Edge Function `invite-org-member` đã deploy **ACTIVE, version 4**, verify JWT; server-side kiểm tra `users.manage`; mời Auth user, tạo membership + member_roles; user được mời phải xác nhận email và đặt mật khẩu lần đầu. User chưa xác nhận nhưng đã tồn tại cần resend invite thủ công từ Dashboard.
- Cloud panel: import Local có chọn/batch; tải Cloud về Local; kiểm tra UUID/code; nhận biết pending mutation và retry đúng snapshot; conflict khi Local+Cloud cùng sửa; ảnh vẫn chỉ Local.
- Sửa thiết bị Cloud: acquire/heartbeat/release lock; Local snapshot và mutation queue lưu trước, sau đó Cloud RPC; nếu Cloud chưa xác nhận thì giữ Local snapshot + pending để retry; lưu kho/khôi phục Cloud cũng qua lock + mutation. Viewer chỉ xem/tải Local, không sửa.
- Chưa có tạo Cloud trực tiếp vì mã thiết bị vẫn nhập thủ công; chưa cấu hình quy tắc sinh mã.
### Trạng thái khởi tạo (chưa có user)
- 0 profiles, 0 organizations, 0 assets, 0 roles, 0 role_permissions; permissions catalog 27.
- Template bootstrap first Admin/org đã có: `supabase/bootstrap/first_admin_org.sql`. Cần tạo Auth user đầu tiên trong Dashboard (email + password do người dùng tự đặt, xác nhận email), rồi chạy script bootstrap trên project mới; chưa chạy script.
### Thiết lập Dashboard cần hoàn tất thủ công (tool chưa có quyền Auth settings)
- Auth > URL Configuration: Site URL `https://baotri.vieclamhp247.com`; allow redirects `https://baotri.vieclamhp247.com/**`, `http://localhost:5173/**`, `http://127.0.0.1:5173/**`.
- Tắt `Allow new users to sign up` / signup tự do.
- Bật xác nhận email; SMTP cần cấu hình nếu muốn gửi invitation/password recovery ổn định (email mặc định Supabase giới hạn).
- Lưu ý redirectTo của Edge Function invitation là custom domain; nếu chưa allowlist thì email invite có thể lỗi.
### CI / browser verification
- GitHub Actions build đang được sửa theo lỗi TypeScript/JSX phát hiện bởi CI; chưa coi build/deploy đạt cho đến khi run mới nhất xanh.
- Chưa thử đăng nhập bằng user thật, invitation email, browser PC/Mobile, Local↔Cloud, printer. Chưa có organization/user thật.

## Kiểm thử & triển khai checkpoint 21/11/2026 (đã hoàn tất code)
- Build CI `npm run build` (TypeScript + Vite) thành công ở commit `1c90ccbabf959ccbacc740550f1879c425956a73`; Pages deployment run `44858007589` completed/success.
- Đã hợp nhất workflow GitHub Pages vào `.github/workflows/pages.yml`, build có URL + publishable key + Local Preview, giữ CNAME custom domain. Xóa workflow Pages trùng để tránh concurrency cancel.
- Cloud conflict handling: nếu Local và Cloud cùng đổi, tạo mutation conflict và yêu cầu Admin/Technician chọn rõ **Cloud** hoặc **Local**; Cloud-wins giữ ảnh Local; Local-wins ghi Cloud qua lock và receipt. Không auto-overwrite.
- Frontend có scope Local theo organization; Local Preview tách riêng. PC/Mobile từng browser có device ID riêng, khóa Cloud chặn sửa song song.
- GitHub Pages custom domain: `https://baotri.vieclamhp247.com/`; deployment đã success ở commit trên. Publishable key trong workflow và `.env.example` đối chiếu exact-match Supabase Project Keys.
- Edge Function `invite-org-member` version 4 active; CORS production + localhost. Auth invite email metadata `must_set_password=true`; người nhận được yêu cầu đặt mật khẩu lần đầu.
- **Chưa có tài khoản Auth/org/thiết bị thật**; tất cả DB integration tests rollback. Bước bootstrap Admin vẫn phải thực hiện trên Dashboard (email + password do user tự chọn), sau đó chạy `supabase/bootstrap/first_admin_org.sql`. Chưa thực hiện test browser/email invitation/PC-Mobile thật.
- Auth Settings cần user thao tác: site URL/redirect allowlist, disable free signup, email confirmation, SMTP. Chi tiết ở `supabase/bootstrap/README.md`.

## Khôi phục migration source và đồng bộ version (21/11/2026)
- Đã bổ sung source migrations 001, 005, 006 (trước đó chỉ có trong migration history Supabase, chưa có file repo), phục hồi từ schema lịch sử cũ và tương thích với private helper migration.
- Đã sửa tên file source 008, 009, 010 để version prefix khớp chính xác Supabase migration history:
  - `20261121023532_008_cloud_asset_sync_and_locking.sql`
  - `20261121024116_009_activate_invited_memberships_on_email_confirm.sql`
  - `20261121024405_010_private_cloud_sync_rpc_wrappers.sql`
- Repo migrations hiện đầy đủ và khớp 7 version đã ghi trong Supabase: 001, 005, 006, 007, 008, 009, 010. Không tạo migration trùng.
- Kiểm tra cuối: database vẫn trống profiles/org/members/assets/roles/grants/locks/receipts; permissions=27. Các security-definer implementation nằm private; public RPC wrappers SECURITY INVOKER. Security Advisor 0 lints.

### Xác nhận CI/Pages lần cuối
- Commit `8d02b31b2df820318a5756e35e4008c29d44cafb`: Build `44858242873` success và Pages deploy `44858242963` success. Custom domain được giữ trong artifact.


## Khởi tạo tài khoản thật đầu tiên (21/11/2026)
- Người dùng đã tạo và xác nhận email thành công trong Auth của **BAOTRI-Mini-New**:
  - `tuanluongpham1980@gmail.com`
  - `tuanluongpham@gmail.com`
- Đã tạo tổ chức `BAOTRI Mini` và gán thành viên:
  - `tuanluongpham1980@gmail.com`: membership `admin`, RBAC role `admin`, trạng thái active, 27 permissions.
  - `tuanluongpham@gmail.com`: membership legacy `user`, RBAC role `viewer`, trạng thái active, 10 read-only permissions.
- Xác minh SQL JOIN trực tiếp Auth users → organization_members → member_roles → roles → role_permissions; kết quả đúng như phân quyền dự kiến.
- Lưu ý schema: `organization_members.role` hiện chỉ chấp nhận `admin` hoặc `user`; phân biệt Technician/Viewer phải dựa vào `member_roles` + `roles.code`. Không ghi `viewer` vào cột legacy role.
- Template `first_admin_org.sql` hiện chỉ bootstrap Admin; khi mở rộng cần bổ sung hỗ trợ gán user thứ hai (hoặc nhiều thành viên) qua backend an toàn.
- Security Advisor sau bootstrap có 1 cảnh báo WARN: Auth Leaked Password Protection đang tắt. Cần bật trong Auth password/security settings trước khi phát hành.
- Chưa xác nhận đăng nhập UI, invitation, và hành vi thực tế trên trình duyệt PC/mobile; SQL phân quyền đã xác minh.


## Super Admin tạo khách hàng (21/11/2026)
- Đã tạo nhánh `feature/super-admin-customer-provisioning` để triển khai module chủ nền tảng, chưa nhập vào main.
- Thêm `PlatformAdminPanel` và nút Quản trị nền tảng chỉ hiển thị cho email chủ sở hữu đã xác thực `tuanluongpham1980@gmail.com`.
- Edge Function `platform-create-customer` đã deploy lên BAOTRI-Mini-New, ACTIVE version 1, verify_jwt=true. Backend xác minh JWT bằng Auth Admin API và kiểm tra email chủ sở hữu ở server; không dùng metadata do người dùng tự sửa để cấp quyền.
- Luồng tạo khách hàng: nhập tên tổ chức + email Admin đầu tiên; hệ thống tìm Auth user (nếu đã có) hoặc gửi invitation; tổ chức mới được trigger tạo 3 built-in roles/permission grants; gán Admin vào tổ chức; rollback dữ liệu tổ chức/role/member nếu gán membership thất bại.
- User mới nhận email mời và tự đặt mật khẩu; user Auth hiện hữu đã xác nhận được thêm vào tổ chức trực tiếp; user hiện hữu chưa xác nhận có membership trạng thái invited chờ xác nhận.
- Frontend thay đổi nằm trên branch; cần CI build trước khi merge. Edge Function đang ACTIVE nhưng UI chưa được đưa lên Pages do branch chưa merge.
- Giới hạn hiện tại: owner allowlist đang cố định server-side theo email chủ sở hữu; khi thay email chủ nền tảng phải cập nhật function. Cần kiểm thử chức năng tạo tổ chức bằng tài khoản owner thật sau khi UI được build/merge.
- Cần bật/tối ưu Auth email SMTP và kiểm tra URL redirect allowlist để invitation email gửi/hoạt động ổn định.
