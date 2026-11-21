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


## Hoàn tất module tạo khách hàng từ Super Admin (21/11/2026)
- PR #2 đã merge vào `main`, merge commit `7f1bbbb268691594418433702e79738933d39ca1`.
- Thành phần giao diện: `src/PlatformAdminPanel.tsx`; App hiển thị nút **Quản trị nền tảng** chỉ cho email owner `tuanluongpham1980@gmail.com`.
- Backend: Edge Function `platform-create-customer`, ACTIVE version 2, verify_jwt=true. Server kiểm tra token thật qua Auth Admin API và so email đã xác thực với owner allowlist.
- Quy trình: nhập tên tổ chức + email Admin + tên hiển thị; tìm Auth user hiện có hoặc gửi invite; trigger tạo roles/permissions; gán Admin đầu tiên. Tổ chức mới tách tenant bằng organization_id; không tự động thêm user owner vào tổ chức khách hàng.
- Nếu email Admin đã tồn tại và xác nhận, gắn tài khoản đó vào tổ chức mới; nếu là user mới thì gửi invite để tự đặt mật khẩu; nếu Auth user chưa xác nhận thì membership chờ invited→active theo trigger migration 009.
- Test SQL transaction rollback trên database thật: tạo organization test rồi xác minh 3 system roles và grants Admin=27, Technician=17, Viewer=10; ROLLBACK toàn bộ fixture, không để lại dữ liệu thử.
- CI Build and test trên PR #2 đã success (run `44859135520`); Pages build artifact trên main đã success ở run `44859195690`, deployment đang hoàn tất tại thời điểm ghi log.
- Chưa thực hiện end-to-end qua giao diện bằng session owner thật, chưa gửi invite email thử và chưa xác minh khách hàng mới đăng nhập. Chỉ test thành công code build + role-seed database rollback.
- Chủ sở hữu hiện cố định theo email `tuanluongpham1980@gmail.com` ở cả UI và Edge Function. Nếu đổi tài khoản chủ nền tảng, phải thay allowlist ở cả hai nơi; về lâu dài nên chuyển sang bảng platform_owners/role claim do backend quản lý.
- Security Advisor vẫn còn cảnh báo Auth Leaked Password Protection disabled. Tính năng này chỉ có trên Supabase Pro trở lên; nếu giữ Free plan, áp dụng password length/complexity controls sẵn có và không dùng mật khẩu đã chia sẻ qua chat.


## Quản trị nền tảng: thống kê doanh nghiệp và tài khoản (21/11/2026)
- Mở rộng `src/PlatformAdminPanel.tsx`: cùng màn hình Quản trị nền tảng hiện có dashboard tổng quan và bảng theo từng doanh nghiệp; vẫn giữ form tạo khách hàng.
- Dashboard hiển thị tổng doanh nghiệp (active/suspended), tổng Auth accounts duy nhất (confirmed/unconfirmed), tổng memberships và memberships theo trạng thái.
- Bảng doanh nghiệp hiển thị số user duy nhất trong từng tổ chức, active/invited memberships và ngày tạo. Một Auth user tham gia nhiều tổ chức chỉ tính một lần ở tổng Auth, nhưng tính một user ở mỗi tổ chức.
- Tạo Edge Function `platform-get-overview` trên BAOTRI-Mini-New, ACTIVE version 1, `verify_jwt=true`. Function kiểm tra JWT thật qua Auth Admin API và chỉ owner email `tuanluongpham1980@gmail.com` được xem thống kê; service-role chỉ dùng server-side.
- Endpoint đọc organizations + memberships và phân trang Auth users để đếm chính xác tổng tài khoản, không đưa email người dùng ra dashboard.
- Kiểm tra dữ liệu hiện tại trước khi triển khai: 2 tổ chức active, 2 Auth accounts, 3 memberships (3 active); BAOTRI Mini có 2 thành viên, BAOTRI Mini Test 02 có 1 thành viên.
- Đang chờ CI build/PR và kiểm thử giao diện với owner session. Chưa đánh dấu hoàn tất E2E cho đến khi dashboard tải số liệu thật trên website.


## Hoàn thiện mục Quản lý tài khoản trong tổ chức (21/11/2026)
- Mở rộng `src/OrganizationMembersPanel.tsx`: dashboard thống kê tổng thành viên / đang hoạt động / chờ xác nhận / tạm khóa; danh sách email, tên, vai trò, trạng thái membership, tình trạng xác nhận email và ngày tham gia; tìm kiếm + làm mới.
- Bổ sung thao tác gửi email reset mật khẩu, tạm khóa, mở khóa và xóa khỏi tổ chức. Reset chỉ gửi recovery email để người dùng tự đặt mật khẩu; không cho reset tài khoản chưa xác nhận email.
- Tạm khóa chỉ đổi `organization_members.status` trong tổ chức hiện tại; không ban Auth user toàn cục. Mở khóa đưa membership về `active` nếu email đã xác nhận, nếu chưa thì về `invited`.
- Xóa thành viên chỉ xóa membership (các role assignment cascade theo FK); giữ Auth user, profile và dữ liệu lịch sử. Không cho tự thao tác tài khoản đang đăng nhập, Admin hoặc role không xác định.
- Giao diện mời mới chỉ cho chọn Technician / Viewer; không cho Admin tổ chức tạo thêm Admin. Edge Function `invite-org-member` được cập nhật version 5, phân trang Auth user và từ chối role `admin`.
- Tạo Edge Function `manage-organization-members` ACTIVE version 1, `verify_jwt=true`; backend xác minh JWT, membership active, quyền `users.manage`/Admin, kiểm tra target thuộc đúng organization và bảo vệ Admin/self. Service-role chỉ chạy phía server.
- Không cần migration DB mới: sử dụng trạng thái membership `active`, `invited`, `suspended` hiện có và FK cascade đã kiểm tra. Đã kiểm tra schema FK `member_roles.member_id` cascade khi xóa membership.
- Đã cập nhật CSS responsive cho desktop/mobile. Chưa hoàn tất kiểm thử end-to-end trên web với session thật; cần CI build, merge và kiểm tra danh sách/reset email/khóa/mở/xóa trên tổ chức thử nghiệm trước khi đánh dấu hoàn tất.


### Chuan hoa co chu giao dien (21/11/2026)
- Tích hợp chuẩn hóa cỡ chữ tiêu đề, thống kê, panel, nút và các màn hình Cloud/bảo dưỡng/QR trên desktop và mobile.
- Giữ vùng in ấn không bị tác động; input mobile vẫn tối thiểu 16px để tránh iOS tự phóng to khi nhập.
- Phần CSS này được gộp cùng PR hoàn thiện quản lý tài khoản để tránh hai thay đổi cùng sửa cuối stylesheet.


### Rà soát bảo mật bổ sung cho quản lý tài khoản (21/11/2026)
- Edge Function `manage-organization-members` nâng lên ACTIVE version 2, `verify_jwt=true`.
- Backend chỉ cho phép thao tác reset/khóa/mở/xóa với thành viên có role Technician hoặc Viewer; role Admin hoặc role không xác định đều bị từ chối ngay cả khi gọi API trực tiếp.
- GitHub Actions sau khi sửa lỗi JSX duplicate attribute: Build and test run `44861853971` success; Validate BAOTRI Mini run `44861853987` success.
- PR #5 đã merge squash vào main, commit `aad91ca326209d70dd419766a624c2741d75d8f5`. Sau đó commit bảo mật bổ sung trên main: `8970c055262d02cb144331c6f3fd69cfca738ca0`.
- Còn bước nghiệm thu trên trình duyệt bằng Admin thật: kiểm tra danh sách/thống kê, gửi email reset, khóa/mở và xóa một thành viên thử nghiệm; xác nhận user Technician/Viewer bị chặn quản trị.


## Cập nhật quản trị và phân quyền (21/11/2026)
### Xác nhận thực tế
- Edge Function `manage-organization-members` đã sửa lỗi tách Bearer token: thay regex sai bằng parse header `/^Bearer\\s+(.+)$/i`; deploy thành công ACTIVE version 5, `verify_jwt=true`.
- Người dùng đã tải lại trang và xác nhận mục **Tài khoản** hiển thị danh sách/thống kê bình thường.
- Người dùng đã thử xóa `tuanluongpham@gmail.com` khỏi tổ chức rồi thêm lại; tài khoản Auth đã xác nhận email được thêm trực tiếp ở trạng thái active, không cần xác nhận email lần nữa. Đây là hành vi đúng theo thiết kế hiện tại. Tài khoản Auth mới hoặc chưa xác nhận vẫn đi theo luồng invitation/confirmation.
- Chưa ghi nhận kết quả E2E của reset mật khẩu và suspend/reactivate; cần kiểm thử riêng trước khi nghiệm thu các thao tác này.

### Công việc tiếp theo: phân quyền thành viên
- Bổ sung chức năng đổi vai trò trực tiếp trong bảng **Tài khoản** của tổ chức: Technician ↔ Viewer.
- Chỉ Admin có quyền thực hiện; không cho đổi vai trò bản thân, Admin hoặc role không xác định. Phạm vi thay đổi chỉ trong organization hiện tại.
- Backend phải kiểm tra JWT, membership active, quyền `users.manage`, target membership thuộc đúng organization; cập nhật `member_roles` an toàn, bảo đảm mỗi thành viên chỉ có role hợp lệ theo thiết kế.
- Đổi role không thay đổi trạng thái membership: nếu đang suspended thì vẫn suspended; không tự kích hoạt lại. Không sửa legacy `organization_members.role` (chỉ giữ `admin/user`); role thực tế được xác định qua `member_roles` + `roles.code`.
- UI hiển thị vai trò hiện tại và thao tác đổi có xác nhận; cập nhật danh sách/thống kê sau khi thành công.

### Công việc tiếp theo: vòng đời doanh nghiệp trên Quản trị nền tảng
- Bổ sung thao tác **Ngừng hoạt động / Kích hoạt lại** doanh nghiệp cho Super Admin. Ngừng hoạt động phải chặn thành viên sử dụng tenant đó, nhưng giữ nguyên Auth users, memberships, dữ liệu và lịch sử để có thể khôi phục.
- Nghiên cứu và thiết kế riêng quy trình **xóa doanh nghiệp**; không hard-delete ngay. Cần xác nhận nhiều bước, sao lưu/đối soát, chính sách lưu trữ và xử lý quan hệ FK/dữ liệu phụ thuộc trước khi thực hiện xóa vĩnh viễn. Không ảnh hưởng các tổ chức khác hoặc Auth user dùng chung nhiều tổ chức.
- Backend phải xác thực owner Super Admin ở server-side; không chỉ dựa vào ẩn/hiện nút trên frontend.

### Quy tắc giao diện quản trị theo thiết bị
- Các chức năng **Quản trị nền tảng** và **Quản lý tài khoản tổ chức** chỉ hiển thị/được thao tác trên PC; trên mobile ẩn hoàn toàn, kể cả khi đăng nhập Super Admin hoặc Admin tổ chức.
- Nghiệp vụ thường ngày (thiết bị, bảo trì và các chức năng nghiệp vụ được cấp quyền) vẫn hỗ trợ PC và mobile.
- Giới hạn PC/mobile là quy tắc UX, không phải biện pháp bảo mật. Backend vẫn phải kiểm tra quyền độc lập với loại thiết bị; không cho phép truy cập quản trị chỉ vì gọi API từ PC.

### Thứ tự triển khai đề xuất
1. Hoàn thiện đổi role Technician/Viewer trong tổ chức, gồm backend + UI + kiểm thử.
2. Ẩn các mục quản trị trên mobile, kiểm tra responsive và bảo đảm backend authorization không phụ thuộc thiết bị.
3. Bổ sung suspend/reactivate organization cho Super Admin, kiểm tra tenant isolation.
4. Thiết kế và rà soát an toàn quy trình xóa vĩnh viễn doanh nghiệp trước khi triển khai.
5. Nghiệm thu E2E: đổi role; quyền thực tế Technician/Viewer; tài khoản suspended; organization suspended; Super Admin/Admin trên PC và mobile.


## Hoàn thiện đổi vai trò thành viên Technician / Viewer (21/11/2026)
- PR #6 đã merge squash vào `main`, commit `ddce5fbf71926a86c788a7e074c2cd13fca1acca`.
- UI `src/OrganizationMembersPanel.tsx`: thêm nút **Đổi vai trò** tại từng dòng thành viên; thao tác có hộp xác nhận và tải lại danh sách sau khi thành công.
- Chỉ cho đổi qua lại giữa **Kỹ thuật viên (Technician)** và **Người xem (Viewer)** trong đúng tổ chức đang quản lý.
- Backend `manage-organization-members`: action `change_role`; xác minh JWT, membership active của người thao tác, bắt buộc actor có role Admin; target phải thuộc organization; từ chối tự đổi, Admin, role không xác định hoặc thành viên có nhiều role assignment; chỉ chấp nhận built-in role đang active của chính organization.
- Thay role không sửa `organization_members.role` legacy, không đổi membership status; tài khoản đang suspended vẫn suspended, invited vẫn invited. Khi gán role mới thất bại, backend thử khôi phục role assignment cũ và báo lỗi rõ nếu khôi phục cũng thất bại.
- CI trên PR #6: Validate BAOTRI Mini run `44863272962` success; Build and test run `44863273022` success (npm ci + npm run build).
- Edge Function `manage-organization-members` đã deploy lên BAOTRI-Mini-New, ACTIVE version 6, `verify_jwt=true`.
- **Chưa nghiệm thu E2E trên trình duyệt**: cần Admin thật đổi Technician → Viewer → Technician; xác minh quyền thực tế bị thu hẹp/mở lại; kiểm tra đổi role không tự mở khóa tài khoản suspended; kiểm tra API từ chối non-Admin, self, Admin target và role không hợp lệ.
- Người dùng cần đồng bộ local branch sau khi merge: `git checkout main` rồi `git pull`; branch triển khai `feature/member-role-management` đã được merge.


## Sắp xếp chức năng quản trị vào menu Cài đặt (21/11/2026)
- Đưa **Quản lý tài khoản tổ chức** và **Quản trị nền tảng** khỏi thanh công cụ chính vào menu **Cài đặt** trên giao diện PC.
- Menu chỉ xuất hiện với Admin tổ chức và Super Admin; từng mục tiếp tục kiểm tra điều kiện quyền hiện có trước khi mở panel.
- Ẩn hoàn toàn menu quản trị trên màn hình có chiều rộng 760px trở xuống (gồm điện thoại); không thay đổi API/Edge Function/RBAC, backend vẫn là nơi xác thực quyền.
- Không bổ sung luồng chọn/chuyển tổ chức tự động; giữ nguyên hành vi hiện tại.
- Cần CI build và kiểm thử giao diện thực tế trên PC/mobile sau khi merge.

## Quy tắc chọn tổ chức sau đăng nhập (21/11/2026)
- **Yêu cầu kiến trúc đã được người dùng xác nhận:** sau khi đăng nhập, ứng dụng tải danh sách tổ chức mà tài khoản có membership đang hoạt động và tổ chức cũng đang hoạt động.
- Nếu tài khoản chỉ có **một tổ chức** hợp lệ, tự động vào tổ chức đó.
- Nếu tài khoản có **từ hai tổ chức trở lên**, bắt buộc hiển thị màn hình **Chọn tổ chức làm việc** trước khi mở màn hình nghiệp vụ; người dùng chọn đúng doanh nghiệp cần làm việc/hỗ trợ.
- Membership `suspended`, `invited` hoặc tổ chức không active không được đưa vào danh sách lựa chọn.
- Không làm dropdown chuyển đổi tổ chức trong lúc đang làm việc. Muốn đổi tổ chức, người dùng đăng xuất rồi đăng nhập lại và chọn tổ chức khác.
- Tổ chức đã chọn là phạm vi áp dụng cho Local data, Cloud data, quyền RBAC và các thao tác nghiệp vụ; không cấp quyền chéo giữa các tenant.
- Đã bắt đầu triển khai trên branch `feature/organization-login-chooser`: sửa `src/App.tsx` để không tự chọn phần tử đầu tiên khi có nhiều organization contexts; thêm màn hình chọn tổ chức sau đăng nhập; bỏ select chuyển tổ chức khỏi topbar; thêm CSS cho danh sách lựa chọn.
- Chỉ dùng membership/RLS và role grants hiện có; **không thay đổi schema, migration, Auth flow hoặc Edge Functions** trong phạm vi giao diện này.
- Bổ sung an toàn khi đổi tài khoản: xóa ngay organization contexts và organizationId của phiên trước khi tải context cho user mới, tránh hiển thị tạm dữ liệu/tenant cũ nếu tài khoản mới đang tải hoặc truy vấn lỗi.
- CI build/validate, kiểm thử chọn một tổ chức/nhiều tổ chức, kiểm tra membership suspended và kiểm tra tenant isolation còn chờ.

## Chuyển Cài đặt vào thanh menu bên trái (21/11/2026)
- Theo yêu cầu đã thống nhất, chuyển điểm truy cập **Cài đặt** khỏi topbar sang thanh điều hướng bên trái, đặt cùng nhóm với các mục Thiết bị để tạo cấu trúc mở rộng cho các chức năng cài đặt về sau.
- Cài đặt hiện mở nhóm mục con: **Quản lý tài khoản** (chỉ Admin của tổ chức hiện tại) và **Quản trị nền tảng** (chỉ Super Admin theo allowlist hiện có).
- Không thay đổi component quản trị, backend authorization, RBAC hoặc Supabase schema; chỉ thay đổi vị trí và cách mở các mục quản trị.
- Thanh sidebar và mục quản trị tiếp tục không hiển thị trên giao diện mobile theo quy tắc responsive hiện có; backend vẫn là lớp bảo vệ quyền thực tế.
- Đã triển khai trên branch `feature/settings-sidebar-menu`: cập nhật `src/App.tsx`, `src/style.css`.
- CI, kiểm tra giao diện PC/mobile và xác nhận Pages deploy còn chờ.


## Hồ sơ cá nhân và thông tin đăng nhập (21/11/2026)
- Bổ sung màn hình **Hồ sơ cá nhân** để mọi tài khoản đã đăng nhập tự cập nhật họ tên, số điện thoại và ngày sinh.
- Họ tên + số điện thoại lưu trong bảng profiles theo đúng auth.uid(); ngày sinh lưu trong Auth user metadata, không thêm vào bảng hồ sơ đang có chính sách đọc hồ sơ các thành viên cùng tổ chức, tránh lộ ngày sinh cho người khác.
- Cho phép người dùng tự yêu cầu đổi email đăng nhập qua supabase.auth.updateUser({email}); email chỉ đổi sau quy trình xác nhận của Supabase. Cho phép tự đổi mật khẩu qua Supabase Auth; không lưu mật khẩu dạng văn bản trong database.
- Mục **Hồ sơ cá nhân** xuất hiện với mọi tài khoản trong Cài đặt; thêm lối mở nhanh từ thẻ tài khoản trên topbar để dùng được cả khi sidebar ẩn ở màn hình nhỏ. Các mục quản trị vẫn giữ điều kiện Admin/Super Admin và giới hạn PC.
- Không thay đổi RBAC, membership, quyền tenant, Edge Functions hoặc dữ liệu thiết bị. Cần CI build/validate và kiểm tra thao tác cập nhật hồ sơ, email, mật khẩu bằng tài khoản thử nghiệm trước khi nghiệm thu.


## Sửa lỗi hiển thị khi lưu hồ sơ cá nhân (21/11/2026)
- Khắc phục lỗi giao diện hiển thị `[object Object]`: chuẩn hóa thông báo lỗi Supabase, hiển thị message/details/hint/code thay vì ép object thành chuỗi.
- Luồng lưu hồ sơ kiểm tra kết quả UPDATE có thực sự trả về bản ghi; nếu không có bản ghi sẽ báo rõ và hướng dẫn đăng nhập lại.
- Phân biệt trường hợp họ tên/số điện thoại đã lưu nhưng ngày sinh chưa lưu được, tránh báo chung gây hiểu nhầm.
- Commit: `b57e8966e1b2b0f88396f12f75c8373d0c3d6e35`. Chờ CI build/validate; cần người dùng thử lưu trên giao diện sau deploy để xác định lỗi gốc nếu vẫn còn.


## 21/11/2026 – Ưu tiên họ tên hồ sơ trên thanh tài khoản
- Thanh tài khoản trên topbar ưu tiên `profiles.display_name` sau khi đăng nhập; nếu chưa có họ tên thì dùng `user_metadata.full_name`, cuối cùng mới fallback về email.
- Khi đóng cửa sổ Hồ sơ cá nhân, ứng dụng tải lại tên hiển thị để cập nhật ngay sau khi lưu.
- Không thay đổi email đăng nhập, Auth, RBAC, RLS hoặc cấu trúc dữ liệu.


## Quản trị vòng đời tổ chức – Super Admin (21/11/2026)
- Chỉ owner email đã xác thực `tuanluongpham1980@gmail.com` được mở và thao tác Quản trị nền tảng; UI và Edge Function đều kiểm tra allowlist server-side, không dựa vào user metadata.
- Bổ sung thao tác Tạm ngưng / Kích hoạt lại / Xóa vĩnh viễn theo từng tổ chức trong bảng quản trị nền tảng.
- Mỗi thao tác bắt buộc xác thực lại mật khẩu bằng Supabase Auth `signInWithPassword`, đối chiếu đúng Auth user ID của access token; backend bắt buộc xác nhận `Có`. Không lưu mật khẩu, không trả session/token xác thực phụ về trình duyệt.
- Xóa vĩnh viễn yêu cầu nhập đúng tên tổ chức. Edge Function `platform-manage-organization` ACTIVE v1, verify_jwt=true; service-role chỉ dùng phía server.
- Migration `20261121045631_platform_organization_lifecycle.sql`: hàm xóa tổ chức nguyên tử, implementation ở schema private SECURITY DEFINER, wrapper public SECURITY INVOKER chỉ cấp EXECUTE cho service_role. Xóa receipt/lock/assets/memberships/roles theo thứ tự FK RESTRICT; giữ nguyên Auth users và profiles.
- Đã rà soát các bảng có organization_id: assets, asset_import_receipts, asset_mutation_receipts, asset_edit_locks, organization_members, member_roles, role_permissions, roles. Hiện không có Storage bucket nào.
- Tạm ngưng chỉ đổi organizations.status sang suspended; dữ liệu giữ nguyên. Kích hoạt lại chuyển status về active. Organization context chỉ nạp tổ chức active.
- Xóa tổ chức không thể xóa dữ liệu Local IndexedDB đã tải về trên thiết bị người dùng; giao diện cảnh báo rõ giới hạn này. Chưa thực hiện xóa tổ chức khách hàng thật.
- Cần kiểm tra CI Build/Pages, test password sai/đúng, từ chối non-owner, suspend/reactivate trên tổ chức thử; chỉ kiểm thử xóa bằng fixture rollback hoặc tổ chức thử riêng, tuyệt đối không xóa BAOTRI Mini đang dùng.

- Edge Function `platform-manage-organization` đã redeploy ACTIVE **version 2**, verify_jwt=true; token Bearer được parse đúng bằng regex whitespace. CI Build and test + GitHub Pages deploy đã success ở commit `ca4e8dea4e1c35d6cf92fe48225615a7a790cad2`; các chỉnh sửa giao diện cuối đang chờ workflow mới.
- Kiểm tra trực tiếp `private.is_org_member(uuid)`: policy/RLS xác nhận cả membership active và `organizations.status='active'`; khi tạm ngưng, quyền truy cập Cloud qua RLS bị chặn ngay cả khi người dùng còn giữ phiên đăng nhập.
- Rollback test hàm xóa đã tạo fixture tổ chức + Admin membership + role assignment, gọi hàm xóa, xác minh tổ chức biến mất trong transaction rồi ROLLBACK; kiểm tra fixture không tồn tại sau test. Wrapper RPC chỉ service_role EXECUTE; authenticated và anon bị từ chối. Security Advisor không phát sinh lint mới; cảnh báo Auth leaked-password protection là cảnh báo cũ.


## Tinh chỉnh giao diện Quản trị nền tảng (21/11/2026)
- Thu gọn typography và mật độ bảng doanh nghiệp: thống nhất cỡ chữ, giảm padding, giới hạn độ rộng tên tổ chức, giữ các nút thao tác gọn trên một hàng; bảng có thể cuộn ngang khi màn hình hẹp.
- Chuyển xác nhận Tạm ngưng / Kích hoạt / Xóa khỏi cuối nội dung trang sang modal riêng ở giữa màn hình, có lớp nền tối, tiêu đề theo hành động, cảnh báo phù hợp và nút thao tác rõ ràng.
- Dùng lựa chọn Có/Không dạng radio; Không hoặc Hủy đóng modal mà không gọi API. Giữ nguyên xác thực lại mật khẩu, kiểm tra đúng tên tổ chức khi xóa và xác thực Super Admin ở backend.
- Commit giao diện: `a020f9411f516c407d573482757fc2a89e452c0e`. Chờ CI build và GitHub Pages deploy.


## 21/11/2026 – Quy định PC-only cho khu vực quản trị
- Thống nhất: **Quản trị tài khoản** và **Quản trị tổ chức / Quản trị nền tảng** chỉ hoạt động trên PC (máy tính để bàn hoặc laptop); không hỗ trợ điện thoại và máy tính bảng.
- Thêm kiểm tra nền tảng ở giao diện hai panel quản trị; thiết bị di động/máy tính bảng chỉ hiển thị thông báo giới hạn, không hiển thị nội dung thao tác quản trị.
- Gỡ quy tắc responsive cho màn hình nhỏ khỏi giao diện Quản trị nền tảng; giữ bố cục desktop.


## 21/11/2026 – Làm lại menu mobile và giao diện quản trị

- Khắc phục menu mobile: thêm nút mở menu trên thanh tiêu đề, sidebar dạng ngăn kéo có lớp nền đóng/mở; khôi phục nhãn điều hướng, submenu Cài đặt và các mục Hồ sơ cá nhân / Quản lý tài khoản / Quản trị nền tảng trên màn hình nhỏ.
- Khi chọn một mục trong menu, ngăn kéo tự đóng.
- Làm mới giao diện PC cho Quản trị tài khoản: mở rộng hộp thoại, cân đối dải thống kê, bố trí danh sách thành viên và vùng mời tài khoản rõ ràng hơn.
- Làm mới giao diện PC cho Quản trị nền tảng: mở rộng hộp thoại, thống kê 4 cột, bảng doanh nghiệp có vùng cuộn riêng và biểu mẫu tạo khách hàng theo hàng ngang.
- Giữ nguyên chính sách nghiệp vụ: các màn hình quản trị tài khoản/tổ chức chỉ hoạt động trên PC; mobile chỉ khôi phục menu điều hướng và hồ sơ cá nhân, không mở chức năng quản trị.
- Commit giao diện: `50404f0` (App/mobile menu), `0d6f894` (CSS giao diện).


## 21/11/2026 – Thu gọn bố cục quản trị PC theo chiều ngang

- Thu nhỏ chiều rộng hộp thoại Quản lý tài khoản và Quản trị nền tảng, giảm padding, cỡ chữ và khoảng cách giữa các khối.
- Quản lý tài khoản: giữ 6 thẻ thống kê trên một hàng; rút chiều cao danh sách; bố trí thông tin thành viên, trạng thái và thao tác theo hàng ngang; biểu mẫu mời giữ 3 cột.
- Quản trị nền tảng: giữ 4 thẻ thống kê trên một hàng; giới hạn chiều cao bảng doanh nghiệp; bố trí biểu mẫu tạo khách hàng thành 3 cột ngang thay vì xếp dọc.
- Không thay đổi nghiệp vụ, quyền hạn hoặc chính sách quản trị chỉ hỗ trợ trên PC.
- Commit giao diện: `cab303d` (CSS), `bd4c15b` (biểu mẫu Quản trị nền tảng).


## 21/11/2026 – Chuẩn hóa bảng Hồ sơ cá nhân

- Đồng bộ kích thước hộp thoại Hồ sơ cá nhân với hai bảng Quản lý tài khoản và Quản trị nền tảng: chiều rộng PC khoảng 960px, tiêu đề và khoảng đệm gọn.
- Chia nội dung thành các khung thông tin riêng: Thông tin cá nhân, Email đăng nhập và Đổi mật khẩu.
- Thông tin cá nhân bố trí 3 trường theo chiều ngang; Email và Đổi mật khẩu bố trí 2 cột, nút thao tác nằm cuối từng khung.
- Trên màn hình nhỏ, các khung tự chuyển về một cột để dễ thao tác.
- Không thay đổi logic lưu hồ sơ, đổi email hoặc đổi mật khẩu.


## Sửa ký tự `\\n` hiển thị thừa trong Quản trị nền tảng (21/11/2026)
- Xóa chuỗi backslash+n bị chèn trực tiếp sau thẻ `</style>` trong JSX của `src/PlatformAdminPanel.tsx`; nguyên nhân khiến giao diện hiển thị nguyên văn `\\n` trước mục **Tổng quan hệ thống**.
- Chỉ sửa ký tự phân cách markup, không thay đổi CSS, bố cục, dữ liệu hoặc logic quản trị.
- Commit sửa lỗi: `388b854cf9e0ef7b4f9e8c2199dff44f956b546a`. Chờ CI Build và GitHub Pages deploy; sau deploy cần tải lại cứng bằng Ctrl+F5 để xác nhận.


## Khôi phục menu điều hướng trên mobile (21/11/2026)
- Nguyên nhân menu không xuất hiện: một media query cũ đặt `.sidebar{display:none}` ở màn hình nhỏ; CSS drawer bổ sung sau đó chỉ thiết lập kích thước và transform, chưa ghi đè thuộc tính `display`.
- Bổ sung `display:flex` trực tiếp cho `.sidebar` trong media query mobile của drawer để sidebar có thể hiện ra khi nhấn nút ba gạch; trạng thái mặc định vẫn trượt ra ngoài màn hình, khi mở dùng `.mobile-open`.
- Giữ nguyên mẫu đã thống nhất: nút menu ở góc trái thanh tiêu đề, sidebar dạng ngăn kéo có nhãn và submenu Cài đặt, backdrop/đóng menu; không thay đổi quyền quản trị PC-only hoặc logic nghiệp vụ.
- Commit: `188e2d848becb079b74b451c7131c1ae30e4833e`. Chờ CI Build và GitHub Pages deploy; cần kiểm tra thực tế trên mobile sau deploy.


## Chốt phạm vi Tài khoản và Quản trị (21/11/2026)

- Người dùng xác nhận phần **Tài khoản và Quản trị đã hoàn tất**, đồng ý chốt phạm vi này; không tiếp tục chỉnh sửa nếu không có yêu cầu mới.
- Các nội dung đã hoàn thành:
  - **Hồ sơ cá nhân:** cập nhật họ tên, số điện thoại, ngày sinh; yêu cầu đổi email qua xác nhận Supabase; tự đổi mật khẩu. Tên hiển thị trên topbar ưu tiên họ tên hồ sơ.
  - **Quản lý tài khoản tổ chức:** mời thành viên; quản lý trạng thái; đổi vai trò Kỹ thuật viên (Technician) / Người xem (Viewer); backend xác minh quyền Admin và giới hạn đúng tổ chức.
  - **Quản trị nền tảng:** tạo khách hàng/tổ chức; tạm ngưng, kích hoạt lại và xóa vĩnh viễn có xác thực lại mật khẩu; chỉ Super Admin được phép thao tác, backend xác minh owner.
  - **Chọn tổ chức sau đăng nhập:** một tổ chức hợp lệ thì tự vào; nhiều tổ chức thì bắt buộc chọn; không chuyển tổ chức giữa phiên làm việc.
  - **Giao diện:** đưa các chức năng quản trị vào Cài đặt/sidebar; tối ưu bố cục PC theo chiều ngang; các màn hình Quản lý tài khoản và Quản trị nền tảng chỉ hỗ trợ PC. Mobile vẫn có menu ngăn kéo để điều hướng và truy cập Hồ sơ cá nhân, không mở chức năng quản trị.
  - **Sửa lỗi giao diện:** loại bỏ chuỗi literal `\\n` thừa trong Quản trị nền tảng; khôi phục menu mobile bằng cách ghi đè `display:flex` cho sidebar trong media query drawer.
- Người dùng xác nhận menu mobile đã hoạt động và chốt phần Tài khoản/Quản trị.
- CI Build and test run **44872238366**: success. GitHub Pages deploy run **44872238426**: success, cùng commit `6c3146839bdf51db8c7d92747c7cda38b221f20d`.
- Production: `https://baotri.vieclamhp247.com/`.
- Trạng thái: **ĐÃ CHỐT**. Các thay đổi tiếp theo thuộc phạm vi Tài khoản/Quản trị chỉ thực hiện khi người dùng yêu cầu cụ thể; ưu tiên chuyển sang module/chức năng kế tiếp của BAOTRI Mini.


## 21/11/2026 – Smart Equipment ID Engine: triển khai nền tảng trên BAOTRI-Mini-New

- Phạm vi thực hiện đúng dự án mới: repo `Vodanhhp/BaoTri_Mini`, branch `feature/smart-equipment-id-engine`; Supabase duy nhất được cập nhật là `BAOTRI-Mini-New` / ref `dskeaiyvldiwlsfqkboq`. Không sửa hai Supabase project cũ.
- Đã rà soát `TIENDO.md`, `SMART_EQUIPMENT_ID_ENGINE.md`, `THIET_BI.md`, `public/data/baotri-config.json` và mã nguồn nhánh triển khai. Danh mục chuẩn dataVersion `1.1.0`: 44 ngành nghề, 30 nhóm thiết bị, 74 mục từ điển thiết bị.
- Giữ nguyên Plan đã duyệt: A tối đa 200; B tối đa 500; C tối đa 1.000; D không giới hạn số lượng. A/B/C/D áp dụng cấu trúc mã và phạm vi bộ đếm theo tài liệu Smart ID.
- Phát hiện và sửa lỗi tương thích RBAC trước khi triển khai: dự án mới dùng helper `private.has_org_permission`, không có `public.has_org_permission`; loại bỏ lệnh revoke quyền schema `private` có thể làm hỏng RLS hiện hữu; cập nhật các migration gọi đúng private helper.
- Sửa so khớp mã nhóm để chuẩn hóa cả mã trong snapshot lẫn mã người dùng chọn (ví dụ `CNC-T` → `CNCT`), tránh từ chối nhóm hợp lệ.
- Áp dụng 8 migration Smart ID và 1 migration hardening RPC vào đúng BAOTRI-Mini-New. Các public RPC được giữ dạng SECURITY INVOKER; phần SECURITY DEFINER đặt trong schema private theo kiến trúc RBAC của dự án. Migration history trên Supabase:
  - `20261121094439` smart_equipment_id_engine_v1
  - `20261121094441` smart_equipment_id_local_first_reservations
  - `20261121094443` smart_equipment_id_audit_hardening
  - `20261121094444` smart_equipment_id_cloud_mirror_metadata
  - `20261121094447` smart_equipment_id_admin_confirmation
  - `20261121094449` smart_equipment_id_admin_group_mutation
  - `20261121094451` smart_equipment_id_local_group_audit_mirror
  - `20261121094453` smart_equipment_id_catalog_snapshot_validation
  - `20261121094809` smart_equipment_id_private_rpc_wrappers
- Đã đổi prefix tên file migration trong repo để khớp chính xác version đã ghi trên Supabase; tránh CLI nhận nhầm là migration chưa chạy.
- Kiểm thử rollback-only trên tổ chức BAOTRI Mini: Plan C, group code `CNC-T` chuẩn hóa thành `CNCT`, cấp sequence 1, site 01, tháng/năm 1126; confirm reservation và Cloud insert trigger sao chép đúng metadata Local. Transaction đã ROLLBACK.
- Kiểm tra sau rollback: catalog snapshots=0, counters=0, reservations=0, assets=0; không tạo dữ liệu thử nghiệm tồn tại trong project mới.
- Security Advisor sau hardening: không còn cảnh báo SECURITY DEFINER RPC trong public schema. Còn 3 INFO về private tables bật RLS nhưng không có policy (cố ý không cấp truy cập trực tiếp) và cảnh báo Auth Leaked Password Protection Disabled đã tồn tại từ trước.
- CI tại commit mới nhất `e9447db628cd8351b9b2dbc41ad3fbee5afb4a8e`: Build and test run `44891882855` success; Validate BAOTRI Mini run `44891882853` success.
- **Chưa provision Plan hoặc Catalog Snapshot cho bất kỳ Organization nào trong BAOTRI-Mini-New.** Không tự đoán Plan cho `BAOTRI Mini` hoặc `BAOTRI Mini Test 02`; chưa cấp mã thiết bị chính thức.
- Việc còn lại trước khi nghiệm thu Smart ID: bổ sung luồng Super Admin tin cậy để gán Plan và khởi tạo snapshot theo `baotri-config.json`; hoàn thiện quản lý danh mục riêng của Organization; xử lý yêu cầu không trả UUID cho KTV/Viewer qua API thông thường (hiện Cloud asset reads vẫn trả `assets.id`); kiểm thử browser PC/mobile và luồng Local↔Cloud thực tế.
- PR #11 vẫn chưa merge. Không deploy Pages/production từ nhánh này.



## 21/11/2026 – Đồng bộ khởi tạo doanh nghiệp với Plan và Catalog Snapshot

- Đã xác định Plan phải được chọn ngay trong quy trình Super Admin tạo doanh nghiệp/cấp tài khoản Admin đầu tiên; không tạo Organization trước rồi mới để Plan ở một bước rời rạc.
- UI `src/PlatformAdminPanel.tsx`: tải danh sách Plan từ `public/data/baotri-config.json`; bắt buộc người vận hành chọn rõ A/B/C/D (không tự mặc định A); hiển thị hạn mức thiết bị, nhóm thiết bị, số cơ sở và quy tắc mã; kết quả tạo mới hiển thị Plan + phiên bản Snapshot.
- Bảng tổng quan Quản trị nền tảng hiển thị Plan/Snapshot của từng doanh nghiệp. Hai Organization hiện có (`BAOTRI Mini`, `BAOTRI Mini Test 02`) hiển thị trạng thái chưa khởi tạo; không tự gán Plan cho hai tổ chức này.
- Migration `20261121100426_platform_customer_plan_provisioning.sql` đã áp dụng lên đúng Supabase `BAOTRI-Mini-New`:
  - Tạo registry catalog chuẩn trong schema private, lưu dataVersion `1.1.0` từ `public/data/baotri-config.json`.
  - Tạo hàm private SECURITY DEFINER và public SECURITY INVOKER wrapper; chỉ `service_role` được EXECUTE. Backend kiểm tra JWT role service_role, email chủ nền tảng, Auth user/email Admin và profile.
  - Hàm provision thực hiện trong một transaction: tạo Organization → trigger seed 3 role + grants → sao chép Plan-specific Catalog Snapshot → tạo membership Admin → gán role Admin. Lỗi ở bất kỳ bước DB nào rollback toàn bộ.
  - Snapshot lọc theo Plan: A có 0 nhóm/74 từ điển/11 ngành; B có 9 nhóm/74 từ điển/21 ngành; C có 17 nhóm/74 từ điển/32 ngành; D có 30 nhóm/74 từ điển/44 ngành. Các gợi ý nhóm không có trong Plan đã chọn được bỏ khỏi từ điển để Engine không đề xuất nhóm không hợp lệ.
- Đã kiểm thử transaction rollback-only cả 4 Plan A/B/C/D bằng Auth users có thật trong BAOTRI-Mini-New. Kết quả đúng tên Plan, dataVersion `1.1.0`, số nhóm/từ điển/ngành như trên; membership Admin active do email đã xác nhận.
- Sau rollback: organizations=2, tenant Catalog Snapshots=0, assets=0, roles=6, memberships=3. Không tạo doanh nghiệp hoặc dữ liệu thử nghiệm tồn tại.
- Quyền RPC: authenticated=false, anon=false, service_role=true; public wrapper SECURITY INVOKER, private implementation SECURITY DEFINER. Authenticated vẫn chỉ đọc Catalog Snapshot theo RLS và không được sửa Plan.
- Source Edge Function `platform-create-customer` đã đổi sang bắt buộc `planCode` và gọi RPC nguyên tử; `platform-get-overview` đã bổ sung Plan/Snapshot vào tổng quan.
- CI trên commit `ef771bc879fb95cfb016db6ffc17749d15694717`: Build and test run `44892786102` success; Validate BAOTRI Mini run `44892786091` success.
- **Chưa deploy hai Edge Function đã sửa và chưa merge PR #11** để tránh lệch phiên bản với giao diện Pages đang chạy trên `main`. Sau khi merge/đưa UI mới lên Pages mới deploy đồng bộ hai function. Database migration nền tảng đã có trên BAOTRI-Mini-New nhưng chưa có khách hàng mới nào được tạo.
- Chưa gán Plan cho hai Organization hiện tại; cần người vận hành quyết định riêng sau này. Không thay đổi bất kỳ dữ liệu hay Supabase project cũ nào.


## Hoàn thiện quy trình và giao diện Plan (21/11/2026)
- Thay ô chọn Plan dạng dropdown trong Quản trị nền tảng bằng bốn thẻ Plan A/B/C/D; mỗi thẻ hiển thị tên gói, hạn mức thiết bị, hỗ trợ nhóm thiết bị, số cơ sở và quy tắc mã quản lý.
- Khi chọn Plan, giao diện xem trước Catalog Snapshot sẽ được cấp: số nhóm thiết bị, số loại thiết bị trong từ điển, số ngành nghề và phiên bản danh mục chuẩn. Các con số lấy trực tiếp từ `public/data/baotri-config.json`, không hard-code.
- Sau khi tạo doanh nghiệp thành công, hiển thị rõ Plan, hạn mức và số lượng dữ liệu Snapshot; xóa lựa chọn Plan khỏi biểu mẫu để buộc chọn lại khi tạo doanh nghiệp tiếp theo.
- Trên màn hình làm việc của doanh nghiệp, hiển thị Plan hiện tại, hạn mức, số nhóm / loại thiết bị chuẩn và phiên bản Catalog Snapshot; không tự suy ra số thiết bị đang sử dụng từ dữ liệu Local chưa chắc đã đồng bộ đầy đủ.
- Sửa lỗi xác nhận nhóm thiết bị: trước đây dropdown hiển thị nhóm gợi ý nhưng state chưa có lựa chọn, khiến người dùng tưởng đã chọn mà khi lưu vẫn bị báo thiếu nhóm. Hiện nhóm gợi ý chỉ là gợi ý; người dùng phải chọn rõ trong danh sách để xác nhận.
- Ngày đưa vào sử dụng được đánh dấu bắt buộc ngay trên giao diện khi thêm thiết bị mới thuộc Plan C/D; backend vẫn kiểm tra lại trước khi cấp số.
- Kiểm tra hạn mức thiết bị vẫn do RPC Cloud thực hiện trong giao dịch giữ số thứ tự; UI chỉ trình bày hạn mức, không thay thế kiểm tra bảo mật phía database. Plan D không giới hạn.
- Các thay đổi giao diện/code đã commit trên `feature/smart-equipment-id-engine`; chưa merge PR #11, chưa deploy Pages hoặc hai Edge Function provisioning/overview. Chờ CI và rà soát tiếp.
