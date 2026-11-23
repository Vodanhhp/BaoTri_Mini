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
- Bảng tổng quan Quản trị nền tảng cũng trả về và hiển thị hạn mức thiết bị cùng số nhóm / loại thiết bị / ngành nghề trong Snapshot của từng doanh nghiệp; dữ liệu lấy từ Catalog Snapshot trên Cloud.
- Sửa lỗi xác nhận nhóm thiết bị: trước đây dropdown hiển thị nhóm gợi ý nhưng state chưa có lựa chọn, khiến người dùng tưởng đã chọn mà khi lưu vẫn bị báo thiếu nhóm. Hiện nhóm gợi ý chỉ là gợi ý; người dùng phải chọn rõ trong danh sách để xác nhận.
- Ngày đưa vào sử dụng được đánh dấu bắt buộc ngay trên giao diện khi thêm thiết bị mới thuộc Plan C/D; backend vẫn kiểm tra lại trước khi cấp số.
- Kiểm tra hạn mức thiết bị vẫn do RPC Cloud thực hiện trong giao dịch giữ số thứ tự; UI chỉ trình bày hạn mức, không thay thế kiểm tra bảo mật phía database. Plan D không giới hạn.
- Các thay đổi giao diện/code đã commit trên `feature/smart-equipment-id-engine`. CI cho commit code cuối `af62511ac0440d68633d41051b90a843bad8d20d`: `Build and test` run `44894357408` và `Validate BAOTRI Mini` run `44894357391` đều success. Build thêm trên commit tài liệu mới nhất `4cc73a78a1c48f6a56a699491a54ed3776b0ab68`: run `44894405573` success.
- Tương thích chuyển phiên bản: bảng Plan xử lý trường metadata chưa có từ Edge Function cũ bằng trạng thái “Đang tải hạn mức” và dấu gạch cho số liệu chưa trả về; không hiển thị nhầm `NaN` hoặc hiểu thiếu dữ liệu là Plan không giới hạn.
- Chưa merge PR #11, chưa deploy Pages hoặc hai Edge Function provisioning/overview. Khi phát hành phải triển khai theo cửa sổ phối hợp: cập nhật `platform-get-overview` trước (bổ sung dữ liệu, tương thích ngược), sau đó cập nhật `platform-create-customer` (bắt buộc Plan; giao diện cũ sẽ bị từ chối tạo mới một cách an toàn), rồi đưa UI mới lên Pages ngay sau đó. Không đưa UI mới lên trước Edge Function tạo khách hàng vì function cũ có thể bỏ qua `planCode` và tạo Organization không có Plan. Tạm dừng thao tác tạo khách hàng trong thời gian chuyển phiên bản.


## 21/11/2026 – Ma trận nghiệm thu Smart ID theo Plan A/B/C/D

### Kiểm tra trạng thái trước nghiệm thu
- Supabase `BAOTRI-Mini-New` (`dskeaiyvldiwlsfqkboq`) đang `ACTIVE_HEALTHY`.
- Catalog chuẩn hiện hành trong registry private: dataVersion `1.1.0`, 44 ngành nghề, 30 nhóm chuẩn, 74 mục từ điển.
- Kiểm tra read-only sau các kiểm thử trước đó: 2 Organizations, 0 tenant Catalog Snapshot, 0 assets, 0 sequence counters, 0 reservations. Không có dữ liệu test tồn tại.
- RPC public `platform_provision_customer` là SECURITY INVOKER; EXECUTE chỉ có `service_role`, không có `anon` hoặc `authenticated`.
- PR #11 vẫn Draft; branch đang ahead main 110 commits, behind 0. Hai workflow gắn với head hiện tại `f82623ec166c246c29875f3cd1e9f5b9d6f3a139` đều success: Build and test run `44894499728`, Validate BAOTRI Mini run `44894499754`.
- Lưu ý: workflow tên “Build and test” hiện chỉ chạy `npm ci` và `npm run build`; chưa có bộ unit test tự động riêng cho Smart ID engine. Build success không thay thế nghiệm thu nghiệp vụ.

### Ma trận mã dự kiến
| Plan | Mã minh họa | Nhóm | Cơ sở | Ngày đưa vào sử dụng |
|---|---|---|---|---|
| A | `BOM-001` | Không yêu cầu | Không áp dụng | Không yêu cầu |
| B | `BOM-NUO-001` | Bắt buộc chọn/xác nhận | Không áp dụng | Không yêu cầu |
| C | `BOM-NUO-01-001-1126` | Bắt buộc chọn/xác nhận | Mã 2 chữ số | Bắt buộc |
| D | `BOM-NUO-01-001-1126` | Bắt buộc chọn/xác nhận | Mã 2 chữ số | Bắt buộc |

Các mã trên là ví dụ định dạng, không phải mã đã cấp cho thiết bị thật.

### Các ca bắt buộc trước khi cho dùng thực tế
1. **Plan A:** thêm thiết bị mới; không hiện thao tác chọn nhóm/cơ sở; mã theo `EQUIPMENT_CODE-SEQUENCE`; từ chối thiết bị không nhận diện được hoặc mã loại không hợp lệ.
2. **Plan B:** gợi ý nhóm không được xem là đã xác nhận; phải chọn nhóm rõ ràng trước khi lưu; mã có nhóm nhưng không có cơ sở/ngày tháng.
3. **Plan C/D:** thiếu hoặc sai ngày đưa vào sử dụng phải bị chặn; mã gồm loại-nhóm-cơ sở-số thứ tự-MMYY; xác minh đổi tháng không reset bộ đếm.
4. **Nhận diện:** thử tên có dấu/không dấu, chữ hoa/thường, alias, tên không tồn tại và hai kết quả gần tương đương; không tự bịa mã khi not-found/ambiguous.
5. **Nhóm:** thử mã có dấu câu như `CNC-T`; nhóm phải thuộc Snapshot và đúng Plan; không được tự nhận nhóm gợi ý nếu người dùng chưa chọn.
6. **Local-first:** Cloud giữ số; Local tự định dạng ID và ghi IndexedDB trước; Cloud chỉ xác nhận ID Local đã lưu. Nếu lỗi trước khi Local lưu thì không có asset Local; nếu confirm lỗi sau khi Local lưu thì giữ record và retry cùng reservation, không cấp số thứ hai.
7. **Bất biến:** sửa tên không đổi ID; UUID và ID đã cấp không được sửa; Admin đổi nhóm phải có audit; Technician không được đổi nhóm.
8. **Hạn mức:** kiểm tra tại biên 200/201 (A), 500/501 (B), 1.000/1.001 (C); D không giới hạn. Chỉ dùng transaction rollback/fixture riêng, không tạo asset thử tồn tại trên tổ chức thật.
9. **Tenant và đồng bộ:** xác minh người dùng chỉ đọc snapshot/sequence của tổ chức đang chọn; kiểm tra Local↔Cloud, retry, import idempotent và xung đột không nhân đôi thiết bị.
10. **Thiết bị:** kiểm tra thao tác thêm mới trên PC và mobile; kiểm tra trạng thái offline/online và thông báo khi chưa thể cấp mã chính thức.

### Trạng thái và giới hạn
- Đã kiểm chứng trước đó bằng transaction rollback: các định dạng A/B/C/D, sequence vượt 999, retry idempotent, confirm Local ID, Cloud mirror metadata, audit đổi nhóm và bộ lọc snapshot.
- Chưa chạy nghiệm thu browser E2E cho cả bốn Plan trên tenant được provision riêng; hiện không có tenant snapshot để tạo mã chính thức.
- Không được gán Plan cho hai Organization hiện có hoặc tạo khách hàng/asset thử nghiệm thật nếu chưa có quyết định rõ.
- Trước khi phát hành còn phải xử lý yêu cầu không trả UUID nội bộ `assets.id` cho Technician/Viewer qua API đọc thông thường; đây là hạng mục bảo mật còn mở.
- Không merge PR, deploy Pages hoặc redeploy Edge Functions trong bước nghiệm thu này.


## 21/11/2026 – Bổ sung unit test tự động cho Smart ID Engine

- Tạo `scripts/smartEquipmentId.test.mjs`, dùng `node:test` của Node 22 và TypeScript compiler đã có sẵn; không thêm dependency và không cần kết nối Supabase/IndexedDB.
- Bổ sung lệnh `npm test` trong `package.json`; cập nhật `.github/workflows/ci.yml` để chạy Unit tests trước Build.
- Bộ kiểm thử có 22 ca: định dạng Plan A/B/C/D; sequence lớn hơn 999; kiểm tra sequence/code/group/site/date không hợp lệ; chuẩn hóa tiếng Việt; Plan A không dùng nhóm; gợi ý nhóm không được coi là xác nhận; chọn nhóm rõ ràng; giới hạn nhóm theo Plan; ngày đưa vào sử dụng C/D; not-found; ambiguous; mã nhóm trùng sau chuẩn hóa; nhóm không có trong Snapshot; dữ liệu nhóm/từ điển riêng; preview ID.
- Unit test và build đều chạy thành công trên GitHub Actions commit `cdcad0c999e11bd60e5c7ad1c20d86e53e9f649d`: Build and test run `44895188334` (Unit tests + Build success); Validate BAOTRI Mini run `44895188313` (npm ci + npm run build success).
- Không cài thêm thư viện, không sửa database, không tạo tenant/asset/reservation test. Chỉ thêm script test, cấu hình CI và tài liệu.
- Phạm vi hiện tại là unit test cho hàm thuần của Smart ID Engine; chưa bao gồm test tích hợp RPC, IndexedDB, đồng bộ Local↔Cloud hoặc browser E2E.


## 21/11/2026 – Tích hợp công cụ mô phỏng sinh mã Smart Equipment ID

- Bổ sung component src/SmartEquipmentIdTool.tsx, mở từ nút **Sinh mã thử** trong chế độ thử nghiệm Local của appweb.
- Công cụ đọc danh mục chuẩn public/data/baotri-config.json (dataVersion hiện tại), cho phép chọn Plan A/B/C/D, nhập tên thiết bị, chọn loại khi kết quả mơ hồ, xác nhận nhóm, nhập mã cơ sở/ngày đưa vào sử dụng đối với Plan C/D và thử số thứ tự.
- Kết quả hiển thị đúng cấu trúc mã theo Plan; không tự đoán loại/nhóm khi không đủ dữ liệu.
- Đây là chế độ mô phỏng độc lập: không gọi Supabase, không cấp/giữ số chính thức, không ghi thiết bị vào IndexedDB và luôn ghi rõ mã chỉ là minh họa. Luồng thêm thiết bị của Organization vẫn dùng Catalog Snapshot riêng và RPC Cloud reservation/confirmation đã tích hợp trước đó.
- Bổ sung unit tests dùng chính danh mục chuẩn thực tế cho Plan A/B/C/D, bao gồm số thứ tự 1000.
- Không gán Plan cho Organization hiện có, không tạo dữ liệu test trong Supabase. Công cụ mô phỏng đã được port riêng trên nền main qua PR #12 (không kéo theo PR #11), merge vào main tại commit `fbccd395a5d25ca8140305592db720fe0cc8c802` và GitHub Pages Production deploy thành công. Bản sửa thêm lối vào công cụ ngay trên màn hình đăng nhập đã deploy tại commit `41328767da804b382901fa9da3e3e02ebd7dfd01`.
- CI PR #12: 25/25 unit tests passed; Build and test + Validate BAOTRI Mini đều success. Pages build/deploy sau merge và sau sửa lối vào đều success. Công cụ chỉ mô phỏng, không cấp mã chính thức hoặc ghi dữ liệu. PR #11 chứa luồng Smart ID đầy đủ vẫn Draft, chưa merge.


## 21/11/2026 – Rà soát bảo mật và ranh giới triển khai PR #11 (tiếp tục)

- Xác nhận Supabase đích vẫn là `BAOTRI-Mini-New` (`dskeaiyvldiwlsfqkboq`), trạng thái `ACTIVE_HEALTHY`; migration history khớp đủ 18 migration, bao gồm Smart ID và Plan provisioning. Không thao tác trên hai project cũ.
- Đọc lại Edge Function source trên nhánh PR #11 và đối chiếu function đang chạy trong Supabase:
  - Source nhánh đã yêu cầu `planCode` và gọi RPC `platform_provision_customer` để tạo Organization + Plan Catalog Snapshot nguyên tử.
  - Function đang chạy `platform-create-customer` vẫn là version 2 cũ, chưa yêu cầu Plan và chưa gọi RPC snapshot.
  - Function đang chạy `platform-get-overview` vẫn là version 1 cũ, chưa trả Plan/Snapshot.
  - Vì vậy tuyệt đối chưa merge UI Plan-aware hoặc triển khai tạo khách hàng chính thức cho tới khi cập nhật Edge Functions đồng bộ; nếu không, giao diện và backend sẽ lệch phiên bản.
- Củng cố authorization trong source PR #11: cả `platform-create-customer` và `platform-get-overview` đều yêu cầu owner có email đã xác nhận (`email_confirmed_at`) ngoài kiểm tra đúng email allowlist. Hai thay đổi đã commit trên nhánh: `80b517d68ef0f9fb6c5f13cb3ad4e7f9fe029f3b`, `bdfd7d5bbb098eee8510313ecb961232c172e0fd`.
- Xác minh các hàm Smart ID RPC: implementation `SECURITY DEFINER` ở schema `private`; public entrypoints là `SECURITY INVOKER`; authenticated được gọi qua wrapper, anon không được EXECUTE. Reserve/confirm/release đều kiểm tra quyền `assets.create`; confirm kiểm tra actor hoặc Admin, đối chiếu mã và snapshot với reservation.
- Đối chiếu luồng frontend: `App.tsx` đã gắn `reservation_id` vào `idComponentsSnapshot` trước khi lưu Local và gửi confirm; nghi vấn thiếu trường này không phải lỗi thực tế.
- Các blocker còn mở:
  1. Cloud asset read path vẫn trả `assets.id` cho mọi authenticated member; cần thiết kế API/view theo mã quản lý hoặc public asset handle để Technician/Viewer không nhận UUID nội bộ, đồng thời giữ được lock/mutation/import.
  2. Auth Leaked Password Protection vẫn tắt (Supabase Security Advisor WARN); cần bật trong Auth settings trước khi phát hành.
  3. PR #11 hiện sau main 3 commit và đang diverged; cần đồng bộ main, giải quyết mergeability rồi chạy lại CI đầy đủ.
  4. Cần kiểm tra Auth URL redirect allowlist trong Dashboard; công cụ hiện tại không đọc được Auth URL configuration.
- Supabase Security Advisor hiện có 4 INFO cho private tables bật RLS nhưng không có policy (các bảng private bị revoke quyền trực tiếp, dự kiến chỉ truy cập qua hàm private); 1 WARN về leaked-password protection. Không có migration hoặc dữ liệu nào được ghi thêm trong lần rà soát này.
- Không deploy Edge Functions, không đổi Auth settings, không gán Plan cho hai Organization hiện có, không tạo khách hàng/asset/reservation thật.


## 21/11/2026 – Refactor Cloud Asset API để không lộ UUID nội bộ

- Đã xác minh bằng quyền database thực tế: `public.assets` đang cấp `SELECT` cho `authenticated` và `anon`; RLS chỉ giới hạn thành viên tổ chức, không giới hạn theo role. Đây là nguồn UUID bị lộ cho KTV/Viewer. Anon hiện không có policy SELECT nên bị RLS chặn, nhưng vẫn thu hồi grant trực tiếp để đóng bề mặt không cần thiết.
- Đã thêm migration nguồn `20261121130000_cloud_asset_public_key_api.sql` trên nhánh PR #11:
  - Thu hồi quyền đọc trực tiếp `public.assets` từ `anon` và `authenticated`.
  - RPC `list_cloud_assets` chỉ trả `asset_key=code`, bỏ cột UUID `id`.
  - Các RPC khóa, gia hạn khóa, nhả khóa, mutation và mirror lịch sử đổi nhóm nhận mã quản lý thay vì UUID.
  - RPC đọc danh sách khóa đổi `asset_id` thành `asset_code`.
  - RPC import/apply trả biên nhận không chứa UUID Cloud.
  - Thu hồi EXECUTE khỏi các RPC cũ có thể trả UUID (acquire/list locks/apply/mirror); các RPC mới kiểm tra membership hoặc permission trước khi phân giải mã thiết bị.
- Đã chuyển `src/lib/cloudAssets.ts`, `src/CloudAssetsPanel.tsx`, `src/App.tsx` sang RPC code-based; loại bỏ các truy vấn trực tiếp `.from('assets').select(...)`. Local UUID vẫn được giữ tại IndexedDB và khi import; phía client không còn nhận UUID Cloud khi đọc danh sách.
- Đã bổ sung `scripts/cloudAssetPublicApi.test.mjs` và mở rộng lệnh `npm test` chạy toàn bộ `scripts/*.test.mjs`.
- Các commit refactor gần nhất: migration + client/API + UI + test trên nhánh PR #11, head hiện tại cần kiểm tra lại sau commit cuối.
- Giới hạn an toàn: migration mới CHƯA được áp dụng lên Supabase; chưa deploy bất kỳ Edge Function nào; chưa có browser/CI build mới xác nhận. Không được thu hồi quyền SELECT ở database đang dùng trước khi migration + frontend cùng được kiểm thử và phát hành đồng bộ, nếu không giao diện cũ sẽ mất khả năng đọc Cloud.
- PR #11 vẫn Draft, chưa merge. Main có thêm 3 commit kể từ merge-base; cần đồng bộ main và chạy CI/build sau khi giải quyết divergence.


## 21/11/2026 – Hoàn thiện wizard giao diện đăng ký khách hàng lần đầu

- Nâng cấp khu vực **Tạo khách hàng mới** trong Quản trị nền tảng từ biểu mẫu dài thành quy trình 3 bước: (1) thông tin doanh nghiệp, (2) chọn Plan A/B/C/D, (3) khai báo Admin đầu tiên và rà soát trước khi khởi tạo.
- Bổ sung tiến trình từng bước, nút quay lại/tiếp tục, trạng thái tải danh mục Plan, thẻ Plan có trạng thái đã chọn, phần tóm tắt Catalog Snapshot và bảng rà soát dữ liệu cuối cùng.
- Sau khi provisioning thành công, hiển thị kết quả gồm tổ chức, Plan, Admin, Snapshot, số nhóm/từ điển/ngành và hạn mức; biểu mẫu được đưa về bước 1 để sẵn sàng tạo khách hàng tiếp theo.
- Giữ nguyên Edge Function `platform-create-customer` và luồng provisioning giao dịch hiện có; không phát sinh thao tác ghi dữ liệu mới từ giao diện ngoài lời gọi API đã được bảo vệ.
- Thay đổi giao diện nằm trên nhánh `feature/smart-equipment-id-engine`, PR #11. Chưa merge, chưa deploy Pages và chưa deploy Edge Functions. Chưa có CI/build mới xác nhận cho các commit giao diện này; migration Cloud Asset Public Key vẫn chưa apply.

## Hoàn thiện Smart Equipment ID và đăng ký khách hàng lần đầu (21/11/2026)
### Smart Equipment ID
- Luồng cấp mã chính thức tiếp tục theo Local-first: bộ phân tích đọc Catalog Snapshot riêng của Organization; Cloud chỉ giữ số thứ tự nguyên tử; Local ghép mã hoàn chỉnh và ghi hồ sơ IndexedDB; Cloud xác nhận reservation + snapshot thành phần mã.
- Sửa luồng retry reservation: reservation_id được giữ trên bản nháp khi RPC có thể đã thành công nhưng phản hồi bị mất. Bấm lưu lại dùng đúng reservation key, không cấp số thứ tự mới.
- Khi người dùng đổi tên/nhóm/cơ sở/ngày vận hành trước khi lưu, reservation cũ được giải phóng best-effort và khóa reservation của bản nháp được làm mới. Khi đóng form chưa lưu, hệ thống thử giải phóng reservation; nếu Local đã ghi hồ sơ thì giữ reservation để retry xác nhận.
- Client kiểm tra chặt dữ liệu Cloud trả về: request ID, Plan, mã loại, nhóm, cơ sở, MMYY, sequence, trạng thái và source catalog version phải khớp với đầu vào trước khi ghép ID.
- Không tự đoán mã nếu tên không khớp; trường hợp mơ hồ buộc người dùng chọn loại. Plan B/C/D bắt buộc xác nhận nhóm; Plan C/D yêu cầu mã cơ sở 2 chữ số và ngày đưa vào sử dụng.
### Đăng ký khách hàng lần đầu
- Wizard 3 bước giữ nguyên: thông tin doanh nghiệp → Plan A/B/C/D → Admin đầu tiên + review. Plan/Snapshot hiển thị hạn mức, nhóm, ngành, từ điển và quy tắc ID.
- Thêm request UUID idempotency cho provisioning. Nếu HTTP response bị mất sau khi transaction đã commit, thao tác retry trả về cùng Organization thay vì tạo tổ chức thứ hai.
- Bản nháp provisioning lưu trong sessionStorage của tab, gồm request ID và dữ liệu form; sau reload/đóng-mở panel trong cùng tab có thể tiếp tục đúng yêu cầu. Xóa bản nháp sau khi nhận kết quả thành công.
- Edge Function source platform-create-customer yêu cầu request UUID hợp lệ và gọi RPC idempotent; vẫn xác minh token, email chủ nền tảng đã xác nhận, Auth user + profile Admin, Plan hợp lệ. Không đưa mật khẩu Admin qua form.
- Overview source đọc Plan và Catalog Snapshot để hiển thị đúng thông tin khách hàng.
### Supabase BAOTRI-Mini-New
- Đã áp dụng migration 20261121120907_platform_customer_provisioning_idempotency: bảng request private, RLS bật, không cấp quyền đọc trực tiếp; function khóa advisory theo request UUID, ràng buộc request vào payload và lưu kết quả provision trong cùng transaction.
- Đã áp dụng migration 20261121120954_grant_service_role_customer_provisioning_idempotency: cấp EXECUTE cho service_role trên private implementation; public wrapper SECURITY INVOKER chỉ cho service_role gọi.
- Kiểm tra rollback-only qua public RPC với role service_role: hai lần gọi cùng request UUID trả cùng organizationId; kết quả có Plan A, Snapshot v1.1.0, 74 dictionary entries và 11 industries. Transaction đã ROLLBACK; không tạo khách hàng thật.
- Security Advisor: INFO cho private tables bật RLS nhưng không có policy (đúng chủ đích vì không cho client truy cập trực tiếp); WARN hiện hữu về Leaked Password Protection đang tắt. Performance Advisor có cảnh báo FK/index và permissive profiles policy từ schema trước; chưa thuộc phạm vi thay đổi lần này.
- Không áp dụng migration 20261121130000_cloud_asset_public_key_api.sql trong công việc này.
### Ranh giới phát hành
- Các thay đổi code và migration source chỉ được commit trên feature/smart-equipment-id-engine / PR #11. Chưa merge main, chưa deploy Pages, chưa redeploy Edge Functions; do đó website production vẫn giữ phiên bản cũ và Edge Functions trên BAOTRI-Mini-New vẫn là bản cũ cho đến khi phát hành đồng bộ frontend + functions.
- Không tạo Organization, Auth user, membership, asset hoặc sequence thật trong quá trình này.

## Chốt tiến trình và lịch theo dõi PR #11 (21/11/2026)

### Trạng thái công việc tại thời điểm chốt
- Repository: `Vodanhhp/BaoTri_Mini`; PR #11 – Smart Equipment ID Engine; branch `feature/smart-equipment-id-engine`; base `main`.
- Supabase đích duy nhất: `BAOTRI-Mini-New`, project ref `dskeaiyvldiwlsfqkboq`.
- Các phần code đã ghi ở các mục phía trên: Smart Equipment ID Local-first, wizard tạo khách hàng theo Plan, provisioning idempotency và hai migration liên quan đã apply trên BAOTRI-Mini-New.
- Kiểm thử provisioning gần nhất là rollback-only; cùng request UUID trả cùng Organization, tái sử dụng UUID với payload khác bị từ chối. Transaction đã ROLLBACK, không tạo khách hàng thật.
- Migration `20261121130000_cloud_asset_public_key_api.sql` chưa apply.
- PR #11 chưa merge; chưa deploy Pages frontend hoặc Edge Functions `platform-create-customer` và `platform-get-overview`. Không chạy migration phát hành, không tạo Organization/Auth user/membership/asset/reservation/sequence thật.
- Không coi các trạng thái ahead/behind, conflict hoặc CI lịch sử là trạng thái hiện tại; phải kiểm tra lại GitHub trước khi ra quyết định phát hành.

### Điều kiện phát hành bắt buộc
1. Branch `feature/smart-equipment-id-engine` đồng bộ hoàn toàn với `main` (ahead=0, behind=0).
2. PR #11 không conflict và GitHub xác nhận mergeable.
3. Các workflow/CI checks bắt buộc trên đúng head commit đều thành công; phân biệt Build với unit/integration/browser tests, không suy diễn build thành nghiệm thu nghiệp vụ.
4. Đọc và đối chiếu source frontend với hai Edge Functions `platform-create-customer`, `platform-get-overview`; xác minh tương thích contract, Plan/Catalog Snapshot và request idempotency.
5. Lập kế hoạch phát hành đồng bộ Pages frontend + hai Edge Functions trên đúng Supabase project `BAOTRI-Mini-New`. Migration nào còn cần apply phải được liệt kê, kiểm tra thứ tự và phê duyệt riêng.
6. Chỉ phát hành sau khi người dùng phê duyệt rõ ràng. Không tự merge PR, deploy Pages/Edge Functions, chạy migration hoặc tạo dữ liệu khách hàng.

### Lịch theo dõi tự động
- Đã tạo và cập nhật automation theo dõi PR #11 hằng ngày, automation ID: `6b018b61709481918244f3737ac65288`.
- Nội dung lịch: kiểm tra trạng thái PR, ahead/behind, mergeability/conflict, workflow/CI mới nhất trên head commit và tương thích frontend/backend.
- Nếu chưa đạt đủ điều kiện: giữ im lặng, tiếp tục kiểm tra ở lịch sau; không gửi báo cáo trạng thái không đổi hoặc lỗi kiểm tra tạm thời.
- Khi lần đầu xác minh đủ điều kiện: gửi báo cáo ngắn nêu bằng chứng, commit và các bước phát hành cần người dùng phê duyệt; sau đó dừng theo dõi.
- Lịch không được phép tự merge, deploy, chạy migration hoặc tạo dữ liệu khách hàng.
- Lịch theo dõi DEEP C đã được tắt theo yêu cầu người dùng.

### Điểm bắt đầu phiên làm việc tiếp theo
- Đọc lại file TIENDO này và kiểm tra trạng thái GitHub mới nhất của PR #11/branch/main.
- Xác minh lại các CI checks trên head commit thực tế.
- Rà soát source hiện hành của frontend và hai Edge Functions trước khi đề xuất bước phát hành.
- Không yêu cầu người dùng lặp lại các quyết định đã ghi; không sửa hai Supabase project cũ.

## Tiếp tục rà soát PR #11 — 22/11/2026

- Kiểm tra GitHub trực tiếp: PR #11 vẫn OPEN, Draft, chưa merge; head branch `feature/smart-equipment-id-engine` hiện là `6a12ad98fcfe1e290b2ecb226094bb31bce2698f` (commit cập nhật TIENDO), main hiện là `41328767da804b382901fa9da3e3e02ebd7dfd01`.
- PR ghi base SHA `c88d59fc0c928e9ef87d145989c2cebf12b05e5f`; main đã tiến thêm 3 commit sau base (merge Smart ID simulator PR #12 và hai commit thêm lối vào công cụ ở màn hình đăng nhập). Branch PR #11 cần cập nhật main trước khi đánh giá release.
- GitHub hiện trả `mergeable=false`; coi là blocker, chưa kết luận conflict cụ thể nếu chưa có kết quả cập nhật/đối chiếu đầy đủ.
- Head commit `6a12ad98...` hiện không có check-runs/status: check-runs total_count=0, commit status state=pending và total_count=0; wrapper workflow-runs cũng trả danh sách rỗng. Các CI success ghi ở commit cũ không phải bằng chứng cho head hiện tại.
- PR hiện báo 154 commits, 31 files changed. Changed files bao gồm `src/App.tsx`, `src/AuthScreen.tsx`, `src/SmartEquipmentIdTool.tsx`, CI/tests, migration Cloud Asset Public API và hai Edge Functions.
- Đã đọc source hiện hành trên branch: package có `npm test` chạy `scripts/*.test.mjs`, CI workflow thực hiện `npm ci` → `npm test` → `npm run build`; hai Edge Function source có Plan-aware provisioning và idempotent request UUID; Cloud Asset client dùng RPC code-based thay vì SELECT trực tiếp bảng assets.
- Chưa thể xác minh CI trên head mới; chưa hoàn thành kiểm tra source-to-deployed contract hoặc browser E2E. Migration `20261121130000_cloud_asset_public_key_api.sql` vẫn chưa apply.
- Công cụ GitHub hiện có không cung cấp thao tác tạo merge commit/update branch an toàn; không tự force-move ref hoặc merge PR. Việc cập nhật main vào feature branch cần xử lý qua Git merge/rebase và review conflict.
- Việc tiếp theo: cập nhật branch với main, xử lý xung đột (đặc biệt App/AuthScreen và SmartEquipmentIdTool), chạy unit tests/build CI trên head mới, sau đó tiếp tục rà soát release checklist. Không merge/deploy/migration/ghi dữ liệu nếu chưa được phê duyệt.


## Tiếp tục xử lý đồng bộ Main–Feature theo chỉ đạo mới — 22/11/2026

- Người dùng xác nhận appweb hiện đang trong giai đoạn xây dựng, chưa có khách hàng; yêu cầu làm trực tiếp trên website/nhánh đang phát triển, không dựng môi trường thử nghiệm riêng và không chạy test theo quy trình cũ. Không được hiểu yêu cầu này thành cho phép ghi dữ liệu khách hàng thật, tự merge PR hoặc deploy production.
- Kiểm tra lại PR #11: OPEN, Draft, chưa merge; head hiện tại tại thời điểm kiểm tra là `3beab678b1741ee47fcc7722202b09af00601c8e`. Main là `41328767da804b382901fa9da3e3e02ebd7dfd01`. Compare xác nhận feature ahead 155, behind 3, status diverged; merge-base vẫn là `c88d59fc0c928e9ef87d145989c2cebf12b05e5f`.
- Đọc compare main từ merge-base: 3 commit mới trên main gồm commit đưa Smart ID simulator vào Local mode và các cập nhật lối vào giao diện. Main thay đổi `.github/workflows/ci.yml`, `package.json`, `scripts/smartEquipmentId.test.mjs`, `src/App.tsx`, `src/AuthScreen.tsx`, `src/SmartEquipmentIdTool.tsx`, `src/lib/smartEquipmentId.ts`, `src/style.css`.
- Đối chiếu blob: CI workflow, AuthScreen, SmartEquipmentIdTool và smartEquipmentId.ts hiện giống hệt giữa main và feature. package.json khác ở script test: main chỉ chạy smartEquipmentId.test.mjs, feature chạy toàn bộ scripts/*.test.mjs; giữ cách của feature để không bỏ test Cloud Asset API. src/style.css của feature đã chứa CSS Smart ID simulator của main cùng phần plan-context; không cần ghi đè CSS.
- src/App.tsx là vùng cần hợp nhất cẩn thận: feature có luồng Smart ID chính thức tích hợp Add Equipment, Cloud reservation, Local-first persistence và Cloud confirmation; main có thay đổi liên quan simulator/đường dẫn mở công cụ. Không thay toàn bộ App.tsx bằng bản main vì sẽ làm mất luồng Smart ID chính thức và các thay đổi Cloud Asset của feature.
- Chưa thực hiện cập nhật ref, tạo commit merge hoặc sửa file nguồn trong lượt này. Chưa deploy, chưa apply migration Cloud Asset Public Key, chưa tạo dữ liệu khách hàng.
- Quy trình làm việc từ nay theo yêu cầu người dùng: không dựng staging/preview hoặc chạy test theo checklist cũ; làm trực tiếp trên appweb/nhánh phát triển. Vẫn phải giữ nguyên bảo vệ dữ liệu và không thực hiện hành động không thể đảo ngược (merge PR, deploy production, migration ghi dữ liệu, tạo Organization/Auth user/asset/sequence thật) nếu chưa được cho phép rõ ràng.
- Việc tiếp theo: xử lý riêng các thay đổi main trong App.tsx theo hướng giữ luồng Smart ID chính thức của feature và đưa lối mở simulator nếu vẫn cần; sau đó đồng bộ nhánh theo cách tạo merge commit có hai parent, không force-push và không thay thế toàn bộ file feature bằng file main.


## Đồng bộ Main vào Feature — 22/11/2026

- Đã đối chiếu toàn bộ 3 commit mới trên Main với nội dung Feature. Các phần Smart ID simulator, entry trên màn hình đăng nhập, nút mở công cụ trong appweb, SmartEquipmentIdTool, AuthScreen, smartEquipmentId.ts, CSS và CI workflow đều đã hiện diện trên Feature. package.json của Feature giữ script `node --test scripts/*.test.mjs`, bao gồm bộ test Cloud Asset API ngoài bộ Smart ID, nên không thay bằng script hẹp hơn của Main.
- Giữ nguyên toàn bộ tree của Feature (bao gồm Smart ID Local-first chính thức, Cloud reservation/mutation, provisioning và các cập nhật TIENDO), tạo merge commit hai parent để ghi nhận Main đã được hợp nhất mà không ghi đè code Feature.
- Merge commit: `854f8e39efc1b1a63eb1bf2a24eb9ea8891af90e`; parent Feature trước merge `b82253fba752704ff780948cc773b7b40f9df601`; parent Main `41328767da804b382901fa9da3e3e02ebd7dfd01`. Cập nhật branch bằng fast-forward, không force-push.
- Kiểm tra lại GitHub sau cập nhật: compare Main → Feature trả `ahead=157, behind=0`, merge-base đúng bằng Main SHA `41328767da804b382901fa9da3e3e02ebd7dfd01`. PR #11 vẫn OPEN và Draft; GitHub trả `mergeable=true`, `mergeable_state=unstable`. Đây mới là trạng thái mergeability, không phải xác nhận CI/build hoặc nghiệm thu nghiệp vụ.
- Theo chỉ đạo hiện tại, không chạy test/build, không dựng preview/staging. Không merge PR, không deploy Pages/Edge Functions, không apply migration và không tạo dữ liệu khách hàng thật.
- Bước tiếp theo: tiếp tục hoàn thiện trực tiếp phần appweb trên Feature, ưu tiên rà soát chức năng đang thiếu theo yêu cầu sản phẩm; chỉ xem xét release khi người dùng yêu cầu và phê duyệt rõ ràng.


## Sửa lỗi migration Cloud Asset Public Key — 22/11/2026

- Khi rà soát source migration `20261121130000_cloud_asset_public_key_api.sql` với migration gốc `20261121023532_008_cloud_asset_sync_and_locking.sql` và migration wrapper `20261121094809_smart_equipment_id_private_rpc_wrappers.sql`, phát hiện migration Public Key gọi các implementation `private.import_asset_preserving_identity`, `private.acquire_asset_edit_lock`, `private.heartbeat_asset_edit_lock`, `private.release_asset_edit_lock`, `private.list_asset_edit_locks` nhưng các hàm gốc này chưa được chuyển từ schema public sang private. Migration 010 mới chuyển các hàm apply mutation và mirror history, không chuyển 5 hàm nêu trên.
- Đã sửa migration Public Key trên Feature: chuyển 5 implementation hiện hữu vào schema `private` trước khi tạo các RPC wrapper code-based; thu hồi EXECUTE trực tiếp của public/anon/authenticated trên implementation private. Các public wrapper giữ nguyên hợp đồng gọi bằng mã thiết bị, tiếp tục thực thi qua implementation cũ có kiểm tra `auth.uid()` và permission của tổ chức.
- Commit sửa migration: `c3fa7a6acab86d90012c73b4cf44f3c98b352744`.
- Chỉ sửa source migration trong GitHub. Chưa apply migration lên Supabase BAOTRI-Mini-New; chưa thay đổi schema/database runtime, chưa deploy, chưa tạo dữ liệu.
- Không chạy test/build theo yêu cầu người dùng. Trước khi apply sau này cần rà soát thứ tự migration và trạng thái thực tế của schema trên đúng project `dskeaiyvldiwlsfqkboq`; không áp dụng lên hai project Supabase cũ.
- Tiếp tục rà soát migration Public Key và contract frontend↔RPC trước khi xin phê duyệt apply. Các điều kiện phát hành khác vẫn giữ nguyên: chưa merge PR #11, chưa deploy Pages hoặc Edge Functions.


## Chốt phiên rà soát migration Public Key — 22/11/2026

- Head trước khi ghi checkpoint: `5df38d09ef44c6250cf3f64e546353527466c102`. Compare Main → Feature: ahead 160, behind 0; merge-base là Main `41328767da804b382901fa9da3e3e02ebd7dfd01`.
- PR #11 vẫn OPEN, Draft; GitHub báo mergeable=true, mergeable_state=unstable. Không coi đây là CI/build success.
- Migration Public Key đã được sửa để chuyển 5 implementation UUID-based sang schema private trước khi tạo code-based public wrappers; xác nhận source có đủ 5 lệnh ALTER FUNCTION và wrapper import gọi private implementation.
- Không chạy test/build, không apply migration, không deploy hoặc merge PR theo yêu cầu hiện tại.
- Việc tiếp theo: rà soát tiếp toàn bộ hợp đồng RPC/grants và tương thích dữ liệu của migration Public Key với frontend; nếu còn lỗi source thì sửa trên Feature. Việc apply migration và deploy vẫn cần phê duyệt riêng.


## Ưu tiên hoàn thiện Đăng nhập + Smart Equipment ID để người dùng chạy thử — 22/11/2026

- Người dùng yêu cầu ưu tiên hoàn thiện hai phần Đăng nhập và Tạo mã thiết bị càng sớm càng tốt để tự chạy thử. Tiếp tục làm trực tiếp trên nhánh Feature; không chạy test/build tự động.
- Supabase target `BAOTRI-Mini-New` (`dskeaiyvldiwlsfqkboq`) đang `ACTIVE_HEALTHY`. Các migration nền tảng, RBAC và Smart ID đến `20261121120954` đã có trong lịch sử DB. Edge Functions nền tảng hiện có và ACTIVE: platform-manage-organization, platform-create-customer, platform-get-overview, invite-org-member, manage-organization-members.
- DB có 2 tổ chức: `BAOTRI Mini` (2 active memberships) và `BAOTRI Mini Test 02` (1 active membership). Cả hai đều chưa có `organization_equipment_catalog`, chưa có Plan, chưa có sequence/reservation. Tổ chức chạy thử đã được người dùng xác nhận trước đây là `BAOTRI Mini Test 02`, tài khoản của người dùng có role Admin ở tổ chức này; `BAOTRI Mini` là Viewer. Người dùng chưa chọn Plan A/B/C/D, vì vậy không tự gán Plan.
- Đây là blocker nghiệp vụ hiện tại của việc cấp mã chính thức: `reserve_asset_id_sequence` từ chối nếu tổ chức chưa có Plan + Catalog Snapshot. Public catalog file hiện có version `1.1.0`, 30 nhóm, 74 loại chuẩn, 44 ngành; snapshot cần được khởi tạo theo Plan được chọn (A/B/C/D sẽ lọc số nhóm/ngành tương ứng).
- Migration `20261121130000_cloud_asset_public_key_api.sql` chưa được áp dụng lên DB. Migration này dành cho Cloud asset read/edit/lock API ẩn UUID; không phải blocker trực tiếp của login hoặc cấp số Smart ID (các migration Smart ID reservation hiện đã áp dụng). Chưa apply để tránh thay đổi schema không cần thiết cho lần chạy thử đầu tiên.
- Source fixes trên Feature:
  - `cfd5a436`: xử lý lỗi khôi phục session Supabase để giao diện không mắc vô hạn ở trạng thái “Đang kiểm tra phiên đăng nhập”.
  - `80358dc` và `21c5ca4`: hiển thị lỗi khôi phục session ngay trên màn hình đăng nhập.
  - `cd27467`: cập nhật README theo đúng kiến trúc Auth + Local-first + Smart ID, ghi rõ điều kiện Plan/Catalog.
  - `d9d6e21`: Smart ID simulator dùng `import.meta.env.BASE_URL` khi tải catalog, tương thích base path của Vite.
- AuthScreen hiện hỗ trợ signInWithPassword, email chưa xác nhận, quên mật khẩu và không cho đăng ký tự do. Supabase URL/publishable key được cấu hình trong `.env.example` cho đúng project mới; không đưa service-role key vào frontend. Email/password login không cần redirect; password recovery cần Supabase Auth Site URL/Redirect URLs khớp domain/local origin.
- Bước tiếp theo để unblock: người dùng cần chọn Plan cho `BAOTRI Mini Test 02`. Sau đó khởi tạo Catalog Snapshot cho tổ chức này qua quy trình quản trị an toàn, apply chỉ những migration thực sự cần cho luồng đang thử, triển khai website/Edge Functions phù hợp rồi hướng dẫn người dùng đăng nhập và tạo mã đầu tiên.
- Lưu ý triển khai: hiện chỉ có quyền sửa source qua GitHub connector; không có Cloudflare Pages deploy tool trong phiên. Branch Feature chưa được đưa lên production domain, PR #11 vẫn Draft/open. Không tuyên bố website live đã cập nhật cho đến khi có deployment thật.


## Xác minh trực tiếp BAOTRI Mini New trước khi cấp Plan chạy thử — 22/11/2026

- Đối chiếu lại Project ID trong mọi truy vấn Supabase: chỉ thao tác đọc trên `dskeaiyvldiwlsfqkboq` (BAOTRI Mini New). Không truy cập hoặc thay đổi project `BaoTRiMini` cũ.
- Xác minh DB: `BAOTRI Mini Test 02` đang active; membership tài khoản người dùng active, role `admin`, có role assignment `admin` và 27 quyền. Tổ chức `BAOTRI Mini` vẫn là tổ chức khác; không thay đổi.
- Xác minh catalog chuẩn trong `private.standard_equipment_catalog_versions`: bản current `data_version=1.1.0`, `schema_version=1.0.0`, 30 nhóm và 74 loại thiết bị.
- Xác minh `organization_equipment_catalog` hiện chưa có bản ghi cho bất kỳ tổ chức nào; Test 02 chưa có Plan/Snapshot. Chưa có dữ liệu sequence. Không tự chọn Plan hoặc ghi dữ liệu khi chưa được người dùng xác nhận.
- Xác minh migration Smart ID đến `20261121120954` đã áp dụng; RPC reservation/confirmation/release là luồng frontend đang gọi. Migration Cloud Asset Public Key vẫn chưa áp dụng và không phải điều kiện trực tiếp để login hoặc cấp Smart ID.
- Source đã rà soát: AuthScreen dùng signInWithPassword, thông báo lỗi khôi phục session, quên mật khẩu; App.tsx tải membership/role/permissions rồi tải Catalog Snapshot theo tổ chức. Luồng tạo thiết bị yêu cầu Plan + Snapshot, giữ sequence ở Cloud, ghi asset Local trước, sau đó confirm reservation.
- Chưa chạy test/build tự động, chưa deploy Pages, chưa merge PR. Nhánh Feature chưa phải bản đang chạy trên domain production.
- Blocker duy nhất để thử cấp mã chính thức: cần người dùng chọn Plan cho riêng `BAOTRI Mini Test 02`; sau đó mới được khởi tạo snapshot đúng Plan. Khuyến nghị Plan B nếu muốn thử luồng nhóm thiết bị mà vẫn giữ giới hạn test 500 thiết bị; Plan D chỉ nên chọn nếu cần thử các nhóm D và không giới hạn số lượng. Không tự gán thay người dùng.


## Khởi tạo Plan B cho BAOTRI Mini Test 02 — 22/11/2026

- Người dùng đã xác nhận đồng ý Plan B cho tổ chức thử nghiệm `BAOTRI Mini Test 02` trong Supabase `BAOTRI Mini New` (`dskeaiyvldiwlsfqkboq`).
- Trước khi ghi dữ liệu đã kiểm tra đúng organization UUID `f11bb85f-0dbe-45f0-bffa-472e5f84f7bf`, trạng thái active, Admin membership active; tổ chức chưa có Catalog Snapshot, chưa có Cloud assets, chưa có sequence/reservation.
- Đã khởi tạo `public.organization_equipment_catalog` cho đúng tổ chức này từ catalog chuẩn hiện hành trong DB; không tạo tổ chức mới, không thay đổi `BAOTRI Mini`, không tác động project Supabase cũ.
- Xác minh sau khởi tạo: Plan B / Tiêu chuẩn, tối đa 500 thiết bị; data version 1.1.0; snapshot có 9 nhóm thiết bị, 74 loại thiết bị, 21 ngành nghề. Bản ghi đã được trigger `validate_equipment_catalog_snapshot` kiểm tra khi insert thành công.
- Xác minh lại: Test 02 hiện có 0 assets Cloud, 0 sequence, 0 reservation; chỉ cấu hình Plan + Snapshot, chưa tạo mã hay thiết bị.
- Luồng frontend đã rà soát: sau khi chọn tổ chức, App tải Catalog Snapshot; khi tạo thiết bị mới sẽ phân tích tên theo catalog, yêu cầu chọn nhóm đối với Plan B, reserve sequence trên Cloud, ghi hồ sơ Local trước, sau đó confirm reservation lên Cloud. Nếu confirm lỗi thì hồ sơ Local giữ trạng thái reserved để retry.
- Không chạy test/build tự động theo yêu cầu người dùng. Chưa deploy website Pages, chưa merge PR #11. Supabase Edge Function hiện có vẫn ACTIVE; chưa cần deploy function mới cho bước gán Plan này.
- Việc còn lại trước khi người dùng chạy thử trên domain: đưa nhánh Feature lên môi trường website thực tế theo cách triển khai đã chọn; hiện chưa có công cụ Cloudflare Pages được kết nối trong phiên nên không tuyên bố website live đã cập nhật. Có thể chạy local theo README với `.env.local` trỏ đúng BAOTRI Mini New trong lúc chờ deploy.

## BỘ QUY TẮC PLAN — NGUYÊN TẮC NGHIỆP VỤ CHÍNH THỨC — 22/11/2026

Phần này là quy tắc chuẩn để thiết kế, triển khai và kiểm tra mọi chức năng liên quan Plan A/B/C/D. Khi code cũ hoặc cách triển khai kỹ thuật mâu thuẫn với các nguyên tắc dưới đây, phải ưu tiên quy tắc nghiệp vụ này và sửa code cho phù hợp; không tự ý thay đổi quy tắc nếu chưa có xác nhận của người dùng.

### 1. Vai trò của Plan

- Plan là gói quy định **hạn mức và quyền sử dụng đối với thiết bị được tạo mới kể từ thời điểm Plan có hiệu lực**.
- Plan không phải công cụ để tái phân loại, cấp lại mã, sửa hoặc can thiệp ngược vào thiết bị đã tồn tại.
- Việc nâng/hạ Plan không được làm thay đổi organization_id, quyền sở hữu dữ liệu, danh mục riêng, lịch sử hoặc hồ sơ thiết bị của doanh nghiệp.
- Mỗi tổ chức có Plan và Catalog Snapshot riêng. Không dùng việc đổi Plan để thay Snapshot riêng của tổ chức bằng toàn bộ catalog chuẩn, không ghi đè các tùy chỉnh do tổ chức đã tạo.

### 2. Các gói Plan

Hạn mức thiết bị theo catalog chuẩn hiện hành:

| Plan | Tên gói | Hạn mức thiết bị | Phân nhóm thiết bị | Nhiều cơ sở |
|---|---|---:|---|---|
| A | Cơ bản | 200 | Không | Không |
| B | Tiêu chuẩn | 500 | Có | Không |
| C | Chuyên nghiệp | 1.000 | Có | Có |
| D | Doanh nghiệp chuyên sâu | Không giới hạn | Có | Có |

- Các nhóm, loại thiết bị, ngành nghề và quy tắc mã được hiển thị/áp dụng theo catalog snapshot của Plan được cấp.
- Việc chọn Plan khi tạo tổ chức và việc nâng/hạ Plan sau này đều phải dùng đúng catalog chuẩn đang được công bố tại thời điểm xử lý, nhưng phải giữ dữ liệu tùy chỉnh riêng của tổ chức.
- Không tự suy diễn tính năng ngoài catalog/đặc tả đã được xác nhận. Khi catalog chuẩn thay đổi, phải đối chiếu version và ghi nhận rõ thay đổi.

### 3. Quy tắc bảo toàn thiết bị và mã đã cấp

- Tất cả thiết bị đã được tạo và cấp mã trước thời điểm Plan mới có hiệu lực phải giữ nguyên mã quản lý/Smart Equipment ID, UUID, thông tin, nhóm, vị trí, lịch sử, ảnh và trạng thái hiện tại.
- Không sinh lại mã; không đánh số lại; không chuyển mã; không xóa; không tự động lưu kho; không khóa quyền xem, sửa chữa hoặc bảo trì thiết bị cũ chỉ vì đổi Plan.
- Không tự động ép thiết bị cũ vào nhóm, ngành nghề, quy tắc mã hoặc cấu trúc danh mục của Plan mới.
- Không thay đổi hồ sơ cũ chỉ để làm cho số lượng thiết bị phù hợp với hạn mức Plan mới.
- Quy tắc trên áp dụng cho cả nâng cấp lẫn hạ cấp, cả dữ liệu Local lẫn Cloud. Đồng bộ Cloud không được ghi đè hoặc làm mất định danh đã tồn tại tại Local.

### 4. Quy tắc áp dụng Plan mới cho thiết bị tạo sau thời điểm hiệu lực

- Chỉ thiết bị được tạo mới sau thời điểm Plan mới có hiệu lực mới phải tuân thủ hạn mức, nhóm thiết bị, ngành nghề, tính năng và quy tắc cấp mã của Plan mới.
- Mã thiết bị mới phải được cấp theo đúng cơ chế Smart Equipment ID/sequence hiện hành, gắn đúng tổ chức và quy tắc Plan có hiệu lực tại thời điểm cấp.
- Mọi điểm tạo mới/cấp mã phải kiểm tra Plan và hạn mức ở phía server/Cloud có thẩm quyền; không chỉ dựa vào kiểm tra giao diện hoặc số liệu Local.
- Không được để thao tác Local, retry, đồng bộ trễ hoặc nhiều thiết bị cùng thao tác vượt qua hạn mức. Phải tính cả các lượt giữ số thứ tự/reservation chưa hoàn tất theo quy tắc cấp mã hiện hành để tránh cấp vượt hạn mức.
- Thiết bị đã được tạo trước thời điểm hiệu lực không bị xem là thiết bị mới khi đồng bộ, import, retry hoặc khôi phục dữ liệu.

### 5. Quy tắc hạ cấp khi số lượng thiết bị hiện có vượt hạn mức mới

Ví dụ: tổ chức đang có 420 thiết bị ở Plan B (500), chuyển xuống Plan A (200).

- Giữ nguyên toàn bộ 420 thiết bị và mã đã cấp. Doanh nghiệp vẫn được xem, quản lý, sửa chữa, bảo trì, tra cứu và khai thác hồ sơ cũ theo quyền hiện có.
- Hiển thị cảnh báo rõ ràng: số lượng thiết bị hiện có đang vượt hạn mức Plan mới; nêu số hiện có và hạn mức.
- Chặn việc tạo mới/cấp mã thiết bị mới cho đến khi số lượng được đưa về trong hạn mức. Việc chặn phải thực hiện ở backend/Cloud, frontend chỉ có nhiệm vụ thông báo và hỗ trợ người dùng.
- Không tự xóa thiết bị, không tự lưu kho, không tự khóa thiết bị, không buộc doanh nghiệp xóa dữ liệu để được tiếp tục dùng hệ thống.
- Khi số lượng thiết bị hợp lệ giảm xuống bằng hoặc thấp hơn hạn mức, cho phép tạo mới trở lại theo Plan hiện hành.
- Không được hiểu thao tác lưu kho hoặc xóa mềm là cách tự động giải quyết vượt hạn mức; chỉ áp dụng cách tính số lượng theo quy tắc đếm thiết bị đã được định nghĩa riêng và thống nhất.

### 6. Quy tắc nâng cấp

- Thiết bị cũ vẫn giữ nguyên toàn bộ mã và hồ sơ.
- Từ thời điểm Plan mới có hiệu lực, thiết bị mới được tạo theo hạn mức/tính năng/nhóm/quy tắc của Plan mới.
- Các nhóm, loại, ngành nghề hoặc lựa chọn mới được mở theo Plan có thể được bổ sung vào catalog riêng của tổ chức nhưng không được ghi đè mục cũ hoặc tùy chỉnh riêng.
- Nâng cấp không tự động chuyển đổi, phân nhóm lại hoặc sửa hồ sơ thiết bị cũ.

### 7. Quy trình yêu cầu và phê duyệt đổi Plan

- Admin đang hoạt động của đúng tổ chức được xem Plan hiện tại, hạn mức và số lượng thiết bị Cloud; được gửi yêu cầu chuyển sang Plan A/B/C/D và ghi chú lý do.
- Gửi yêu cầu không làm Plan thay đổi ngay. Plan chỉ đổi khi Super Admin duyệt và thao tác áp dụng thành công.
- Mỗi tổ chức chỉ có tối đa một yêu cầu đổi Plan ở trạng thái chờ xử lý tại một thời điểm. Không cho tạo yêu cầu chờ trùng.
- Super Admin phải kiểm tra tổ chức, Plan hiện tại, Plan đề xuất, người gửi, ghi chú và điều kiện thương mại/thanh toán trước khi quyết định.
- Khi duyệt phải xác thực lại danh tính/mật khẩu Super Admin; kiểm tra request vẫn pending và Plan hiện tại vẫn khớp Plan tại thời điểm gửi. Nếu trạng thái đã thay đổi hoặc request cũ thì từ chối áp dụng, yêu cầu đối chiếu lại.
- Duyệt/từ chối phải được xử lý nguyên tử; không để cập nhật Plan thành công nhưng trạng thái yêu cầu/lịch sử không được ghi nhận.
- Mỗi lần duyệt phải lưu lịch sử tối thiểu: tổ chức, Plan cũ, Plan mới, người yêu cầu, người duyệt, thời điểm, version catalog, ghi chú yêu cầu và ghi chú xử lý.
- Từ chối không thay đổi Plan/Catalog Snapshot; phải lưu trạng thái, người xử lý, thời điểm và lý do/ghi chú.
- Không tự động gia hạn, thu tiền, lập hóa đơn hoặc xác nhận thanh toán. Đây là bước kiểm tra thương mại do Super Admin thực hiện trước khi duyệt; việc tích hợp thanh toán chỉ làm khi có đặc tả riêng.

### 8. Bảo toàn Catalog Snapshot riêng của tổ chức

- Mỗi tổ chức tiếp tục sở hữu Catalog Snapshot riêng, có version nguồn và Plan hiện hành.
- Khi nâng cấp, có thể bổ sung các nhóm/loại/ngành chuẩn mà Plan mới mở quyền sử dụng, nhưng chỉ thêm mục còn thiếu theo khóa định danh ổn định.
- Không ghi đè tên, mã, cấu hình hoặc nội dung do tổ chức đã chỉnh sửa; không xóa mục riêng; không xóa mục cũ chỉ vì Plan mới không còn cung cấp cho việc tạo mới.
- Khi hạ cấp, các mục catalog đã tồn tại và đang được hồ sơ cũ sử dụng phải được giữ nguyên để tra cứu/quản lý hồ sơ cũ. Giao diện tạo mới chỉ cho chọn nội dung được phép theo Plan mới.
- Phải phân biệt rõ dữ liệu catalog được giữ để đọc/duy trì hồ sơ cũ với lựa chọn được phép dùng để tạo hồ sơ mới.
- Ghi nhận catalog data version và Plan hiệu lực trong Snapshot/lịch sử để có thể truy vết.

### 9. Phân quyền, tenant isolation và an toàn dữ liệu

- Admin chỉ được xem/gửi yêu cầu cho tổ chức mà tài khoản đang là Admin active.
- Super Admin mới có quyền xem danh sách yêu cầu toàn nền tảng và duyệt/từ chối.
- Không tin organization_id, role, email hoặc user ID do frontend tự khai báo nếu backend chưa xác minh bằng access token và dữ liệu membership/allowlist có thẩm quyền.
- Client không được tự cập nhật organization_equipment_catalog.plan_code, Snapshot, request status hoặc history trực tiếp.
- Các thao tác nhạy cảm phải qua Edge Function/RPC server-side; bảng request/history không mở quyền đọc/ghi trực tiếp cho anon/authenticated.
- Mọi truy vấn và mutation phải giới hạn đúng organization; tuyệt đối không để thao tác đổi Plan của một tổ chức ảnh hưởng tổ chức khác.
- Không thử nghiệm, apply migration hoặc ghi dữ liệu vào tổ chức thật nếu chưa có chỉ đạo rõ ràng. Môi trường Supabase dự án mới duy nhất là BAOTRI Mini New (dskeaiyvldiwlsfqkboq); tổ chức thử nghiệm được chỉ định là BAOTRI Mini Test 02. Không thao tác project Supabase cũ BaoTRiMini.

### 10. Các tình huống bắt buộc phải giữ đúng khi kiểm tra

1. Nâng A → B: thiết bị cũ giữ mã/hồ sơ; thiết bị mới được dùng phân nhóm theo B và hạn mức B.
2. Nâng B → C: thiết bị cũ không bị ép bổ sung ngày/nhóm/quy tắc mới; thiết bị mới tuân thủ tính năng C.
3. Nâng C → D: thiết bị cũ không đổi; thiết bị mới theo D, không giới hạn số lượng theo catalog.
4. Hạ B → A khi đang có 420 thiết bị: vẫn quản lý đủ 420 thiết bị; cảnh báo vượt 200; chặn tạo mới/cấp mã cho đến khi số lượng hợp lệ không quá 200.
5. Hạ D → B khi đang có trên 500 thiết bị: giữ toàn bộ dữ liệu và quyền bảo trì cũ; chỉ chặn tạo mới cho đến khi trong hạn mức.
6. Một tổ chức có catalog riêng đã chỉnh sửa: nâng/hạ Plan không được ghi đè hoặc xóa các mục tùy chỉnh.
7. Có request pending nhưng Plan đã thay đổi bởi một thao tác hợp lệ khác: không được duyệt request theo Plan cũ; phải yêu cầu gửi lại/đối chiếu.
8. Hai Admin hoặc hai phiên cùng gửi request: chỉ một request pending được tạo.
9. Hai thao tác tạo thiết bị đồng thời ở sát hạn mức: backend phải khóa/kiểm soát nguyên tử để không cấp vượt hạn mức.
10. Retry/sync/import một thiết bị cũ: không tính nhầm thành tạo mới, không sinh mã mới và không làm tăng số lượng thiết bị lần thứ hai.

### 11. Trạng thái triển khai code Plan trên main — 22/11/2026

Đã ghi source trực tiếp lên main theo yêu cầu làm việc hiện tại:

- Migration source: supabase/migrations/20261122120000_organization_plan_change_workflow.sql — tạo request, history, private RPC và public wrapper chỉ cho service_role.
- Edge Function source:
  - supabase/functions/organization-plan-requests/index.ts — Admin doanh nghiệp xem/gửi yêu cầu.
  - supabase/functions/platform-manage-plan-requests/index.ts — Super Admin xem/duyệt/từ chối.
- UI source: src/PlanChangePanels.tsx — giao diện Admin doanh nghiệp và Super Admin.
- src/App.tsx — thêm menu Cài đặt → Gói dịch vụ cho Admin doanh nghiệp.
- src/PlatformAdminPanel.tsx — thêm khu vực yêu cầu nâng/hạ Plan cho Super Admin.
- Các commit source liên quan trên main:
  - 8fc44604fd772eae2c03859a33b4fb4b81a26ea6 — migration workflow ban đầu.
  - 4111915d1dd6f95e1d166eb495fd34992c8a9fe8 — điều chỉnh cascade cho audit rows.
  - 911f2994c1eb5b943f3a3db5cec5d8b5c93c17a3 — Edge Function Admin gửi yêu cầu.
  - cbd7c9c2690bff0ced66650bd8ef5adc536316ee — Edge Function Super Admin xử lý.
  - 639906550b2b83ccb6a5c491db30914b723b304c — UI hai vai trò.
  - 7b235f4bbb4891df21361e74f24736e4c620ecad — gắn menu Gói dịch vụ.
  - 5a6a71b2210defb42c2b36b1ba3cad1a3734b1c6 — tích hợp panel vào Platform Admin.
  - 18937f3469a3f48c2d085f573e9c1a1df314182e — đồng bộ catalog về App khi tải lại panel.
  - 5fbdb710c9fb07ffba538280d6ee6749e0f5fb25 — cập nhật catalog state sau khi panel tải.
- **Trạng thái cần ghi nhớ:** các commit trên chỉ xác nhận source đã được ghi vào GitHub main; chưa có nghĩa là migration đã apply, Edge Functions đã deploy hoặc ứng dụng đã build/kiểm thử.
- Chưa chạy build/test, chưa apply migration 20261122120000_organization_plan_change_workflow.sql, chưa deploy hai Edge Functions mới, chưa deploy Pages.
- Chưa xác minh runtime contract của migration với schema thực tế, chưa kiểm thử luồng request/approve/reject, tenant isolation, giới hạn đồng thời và hành vi vượt hạn mức. Không được tuyên bố tính năng đã hoạt động production cho đến khi các bước này được kiểm tra.
- Không tự động thay đổi tổ chức BAOTRI Mini hoặc bất kỳ dữ liệu khách hàng thật nào. Khi được phép kiểm tra runtime, chỉ dùng BAOTRI Mini Test 02 trên đúng Supabase BAOTRI Mini New.
- Lưu ý kỹ thuật: quy tắc chặn tạo mới vượt hạn mức phải được kiểm tra lại trực tiếp trong đường cấp mã/reservation ở backend; cảnh báo UI không đủ để bảo vệ hạn mức. Cần bảo đảm đếm đúng thiết bị và xử lý reservation đồng thời, không để retry/import thiết bị cũ bị tính thành thiết bị mới.

### 12. Điểm tiếp tục

- Dùng bộ quy tắc PLAN ở trên làm chuẩn cho mọi thay đổi tiếp theo.
- Rà soát migration và các RPC/catalog schema thực tế trước khi coi source migration là hợp lệ; đặc biệt kiểm tra tên bảng/cột, cấu trúc JSON catalog, quyền execute, và việc giữ nguyên catalog riêng.
- Rà soát contract Edge Function ↔ frontend ↔ RPC, xác minh authentication/authorization và cấu hình deploy.
- Rà soát mọi code path tạo thiết bị/cấp Smart ID để bảo đảm giới hạn Plan được enforce server-side, có tính đến reservation đồng thời và phân biệt thiết bị mới với thiết bị cũ.
- Sau khi rà soát source, chỉ triển khai theo chỉ đạo riêng; không tự apply migration, deploy hoặc ghi dữ liệu.


### Rà soát PLAN — đồng bộ khóa cấp mã với đổi Plan — 22/11/2026

- Đã rà soát source migration Smart ID và migration workflow Plan trên `main`.
- Phát hiện khe hở đồng thời: `reserve_asset_id_sequence` đọc Plan/Catalog Snapshot mà chưa khóa hàng `organization_equipment_catalog`; trong khi RPC duyệt Plan đã khóa chính hàng này bằng `FOR UPDATE`. Hai thao tác có thể chạy đua, khiến lượt cấp mã đọc Plan cũ trước khi Plan mới được áp dụng nhưng hoàn tất sau thời điểm đổi Plan.
- Đối chiếu lại migration history trong TIENDO xác nhận migration `20261121094441_smart_equipment_id_local_first_reservations.sql` đã được áp dụng trên BAOTRI-Mini-New. Vì vậy không sửa nội dung migration lịch sử đã chạy; file gốc đã được khôi phục nguyên trạng.
- Đã tạo migration mới `supabase/migrations/20261122130000_serialize_smart_id_reservations_with_plan_changes.sql`, chứa `CREATE OR REPLACE FUNCTION public.reserve_asset_id_sequence(...)` với `FOR UPDATE` trên hàng `organization_equipment_catalog`.
- Sau khi migration mới được apply, thao tác cấp mã và thao tác duyệt đổi Plan sẽ cùng khóa hàng Catalog Snapshot của đúng tổ chức; thao tác đến sau phải chờ và đọc Plan đã có hiệu lực. Không thay đổi bảng thiết bị, mã đã cấp, sequence đã cấp hoặc dữ liệu tổ chức.
- Commit khôi phục migration lịch sử: `9e3cb6caa973cb95d3b99e0bd936f2678577d2fa`; commit thêm migration mới: `a91bcaa774883e972af43cb84d0114e5baf5cbae`.
- Migration mới chỉ được ghi source vào GitHub; không chạy SQL, không apply migration, không deploy Edge Function/Pages.
- Chưa chạy build/test theo nguyên tắc dự án. Cần kiểm tra runtime sau khi được chỉ đạo, gồm: cấp mã đồng thời với duyệt Plan; reservation đã tạo trước thời điểm đổi Plan; retry xác nhận một thiết bị Local đã lưu; và hạ cấp vượt hạn mức.

- Phát hiện phụ thuộc triển khai: `OrganizationPlanPanel` trước đó gọi `listCloudAssets()`, tức RPC `list_cloud_assets` chỉ được tạo bởi migration Cloud Asset Public Key `20261121130000` (đang chưa apply theo TIENDO). Nếu chỉ apply migration PLAN thì panel không tải được.
- Đã loại bỏ phụ thuộc này: bổ sung RPC `public.count_organization_cloud_assets(uuid)` ngay trong migration PLAN; RPC chỉ trả số lượng, tự kiểm tra `assets.view` đúng tổ chức, không trả danh sách/UUID thiết bị. Frontend `src/PlanChangePanels.tsx` chuyển sang gọi RPC đếm riêng và kiểm tra dữ liệu trả về.
- Commit thêm RPC: `ed88ac40bd5165af355e5a92943468f98eea1d7e`; commit chuyển frontend: `9eb450f81e7900c2ed3cc82591e35bd5217eeed4`.
- Cả migration PLAN và migration đồng bộ khóa Smart ID đều chưa apply; đây chỉ là source. Không deploy hoặc kiểm thử runtime trong lượt này.
- Điều chỉnh thêm RPC đếm: số lượng trả về nay khớp phép tính hạn mức của `reserve_asset_id_sequence`: tổng hồ sơ Cloud cộng các reservation `reserved/confirmed` chưa có asset row tương ứng; reservation đã có asset row không bị đếm hai lần. Nhờ đó cảnh báo UI phản ánh cả lượt giữ số chưa hoàn tất.
- Commit đồng bộ cách đếm: `9b7f9e4ae20bb4675ac1a63c09469baa54cfd1fb`.

### PLAN — bảo toàn reservation Smart ID qua thời điểm đổi Plan — 22/11/2026

- Rà soát Edge Functions và RPC: Edge Function doanh nghiệp xác minh access token/email-confirmed, membership Admin active đúng organization; Edge Function Super Admin xác minh token, email owner allowlist và yêu cầu nhập lại mật khẩu trước approve/reject. Các RPC private ghi/list request chỉ cấp EXECUTE cho `service_role`; bảng request/history không cho client truy cập trực tiếp. RPC đếm thiết bị là SECURITY DEFINER nhưng kiểm tra `auth.uid()` + `assets.view` theo đúng organization.
- Phát hiện lỗi nghiệp vụ: `reserve_asset_id_sequence` kiểm tra Plan/Catalog hiện tại trước khi tìm reservation cũ. Reservation đã được cấp theo Plan cũ có thể bị từ chối khi retry sau nâng/hạ Plan, trái nguyên tắc giữ nguyên mã đã cấp và retry thiết bị Local.
- Đã tạo migration mới `supabase/migrations/20261122140000_preserve_smart_id_reservation_retries_after_plan_change.sql`: tìm reservation cũ trước khi kiểm tra Plan mới; xác minh actor, equipment code, group/site/date components theo Plan gốc của reservation; trả lại chính reservation cũ, không cấp sequence mới. Sau khi khóa Catalog Snapshot cho lượt cấp mới, kiểm tra reservation lần hai để xử lý hai request đồng thời; nhánh này cũng xác thực theo Plan gốc. Migration bổ sung `source_data_version` vào reservation và lưu version tại thời điểm cấp mã; retry giữ lại version gốc (các reservation lịch sử chưa có cột này sẽ dùng version Catalog hiện hành làm fallback).
- Luồng confirm reservation hiện tại đã xác minh mã thiết bị từ các thành phần lưu trong reservation và không phụ thuộc Plan hiện tại; do đó thiết bị Local cũ vẫn có thể được confirm sau đổi Plan.
- Đã đổi nhãn UI số lượng thành “thiết bị/lượt giữ mã đang được tính vào hạn mức” vì RPC đếm cả Cloud assets và reservation chưa có asset row tương ứng; tránh mô tả sai là chỉ đếm hồ sơ Cloud.
- Commit migration retry-safe: `5983625b78933f0a2fcf43cf69cc9122bf8b8f5b`; commit xử lý nhánh retry đồng thời: `8d3707efcd04d643d1a94828b1c72d56bbd5a1c6`; commit nhãn UI: `9279d6478a2fdc3002612a89766abaaece9c2e5a`.
- Chưa apply migration, chưa chạy build/test, chưa deploy Edge Functions/Pages. Cần test riêng các trường hợp reservation Plan A→B, B→A, C→D; retry cùng reservation ID; cùng ID gửi đồng thời; confirm sau đổi Plan; bảo đảm không tăng sequence và không đếm hai lần.

### PLAN — đồng bộ frontend Local với reservation Plan gốc — 22/11/2026

- Rà soát đường tạo mới trong `src/App.tsx` → `reserveSmartEquipmentId` → RPC `reserve_asset_id_sequence` → ghi IndexedDB Local → `confirm_asset_id_sequence_reservation`.
- Phát hiện lỗi contract: backend có thể trả reservation theo Plan gốc, nhưng frontend trước đó bắt buộc `reservation.plan_code === input.plan` (Plan đang hiển thị trên UI). Vì vậy retry cùng reservation ID sau khi Plan thay đổi có thể bị Local từ chối dù Cloud vẫn giữ đúng số đã cấp.
- Migration `20261122140000_preserve_smart_id_reservation_retries_after_plan_change.sql` đã điều chỉnh cả nhánh retry sớm và nhánh kiểm tra lại sau khi khóa Catalog: chỉ so sánh group/site/date nếu caller còn gửi thành phần đó; nếu trường đã bị Plan mới ẩn thì lấy nguyên thành phần đã lưu trong reservation. Thành phần được gửi nhưng khác reservation gốc vẫn bị từ chối.
- Migration bổ sung cột `group_name_at_creation` và lưu cùng `source_data_version` khi cấp reservation mới; retry trả lại tên nhóm gốc. Reservation cũ chưa có tên nhóm được fallback tra từ Catalog Snapshot hiện tại của đúng tổ chức (Catalog Snapshot riêng vẫn được giữ theo quy tắc PLAN).
- `src/lib/smartEquipmentIdClient.ts`: bỏ yêu cầu Plan UI phải khớp Plan reservation; xác thực cấu trúc và thành phần reservation do Cloud trả về, tự ghép mã hoàn chỉnh từ Plan/mã nhóm/mã cơ sở/sequence/tháng-năm gốc. Không gửi Plan UI như một dữ liệu quyết định lên RPC. Snapshot Local nhận group name do reservation trả về, fallback input chỉ khi group code trùng.
- `src/App.tsx`: category, equipmentTypeCode, groupCodeAtCreation và siteCodeAtCreation được lấy từ issuance snapshot do Cloud xác nhận, không lấy Plan UI có thể đã cũ.
- Các commit sửa contract: migration retry validation `6fb9c1181b2184ec6dac7a64e6b4a1c5c5f05f84`; client nhận reservation Plan gốc `a1c3b98c0513fe4de031e7f3374b34b47679097f`; kiểm tra component + group metadata `d8d5d4d8f8ba42476a47474c4db3e4864253defe`; App lấy metadata từ reservation `de729abf1dd63a9191e18955a5fae377186eb069`; lưu group name gốc trong reservation `c22770d12f1e8afdf7d59037c39724b74ecc75fe`; client nhận group name gốc `85350e8b0be742a24f57a0c9cbb8a8f9e8fee5b6`; bỏ Plan UI khỏi RPC helper `927264a1508a4c6f100b74be9ef2410191d0a0bf`; App không gửi Plan UI `aa04cc13e916fe3bfc9c8254fe96dc18c348e264`.
- **Điểm còn tồn tại cần xử lý:** nếu Cloud tạo reservation thành công nhưng response thất lạc trước khi Local ghi thiết bị, reservation ID hiện chỉ nằm trong React state của form. Nếu người dùng đóng/reload trình duyệt trước khi retry, Local mất reservation ID và draft; reservation Cloud vẫn ở trạng thái `reserved`, tiếp tục chiếm một suất hạn mức. Không tự đặt TTL/release vì reservation đã ghi Local nhưng chưa confirm phải được giữ nguyên để retry offline. Cần thiết kế lưu draft/reservation key bền vững trên IndexedDB và luồng khôi phục draft an toàn trước khi coi khép kín hoàn toàn.
- Chưa chạy build/test, chưa apply migration, chưa deploy; các thay đổi chỉ là source trên `main`. Không có thao tác dữ liệu Supabase.

- Bổ sung bảo toàn tên nhóm tại thời điểm cấp mã: migration 1400 thêm `group_name_at_creation` vào reservation, ghi tên nhóm từ Catalog Snapshot khi cấp số; retry trả lại tên nhóm gốc. Với reservation cũ chưa có cột, tra fallback theo group code trong Catalog Snapshot hiện tại.
- Frontend không còn yêu cầu Plan UI bằng Plan reservation; Plan gốc từ Cloud quyết định cấu trúc mã. Client ghép ID từ reservation gốc, kiểm tra group/site/date được gửi nếu có, đồng thời chấp nhận trường không còn xuất hiện trong form do Plan mới. `App.tsx` lưu category và các trường mã nhóm/cơ sở theo issuance snapshot Cloud trả về.
- Không truyền Plan UI vào `reserveSmartEquipmentId` nữa, tránh coi state Plan trên trình duyệt là nguồn quyết định. Backend vẫn kiểm tra Plan hiện hành cho reservation mới.
- Commit bổ sung tên nhóm trong reservation: `c22770d12f1e8afdf7d59037c39724b74ecc75fe`; commit helper nhận tên nhóm: `85350e8b0be742a24f57a0c9cbb8a8f9e8fee5b6`; commit bỏ Plan khỏi input helper: `927264a1508a4c6f100b74be9ef2410191d0a0bf`; commit bỏ Plan UI khỏi lời gọi: `aa04cc13e916fe3bfc9c8254fe96dc18c348e264`.
- Lưu ý: luồng retry cùng form sau khi Cloud response thất lạc nay được xử lý theo reservation ID. Tuy nhiên, nếu đóng/reload trình duyệt trước khi Local ghi hồ sơ, draft và reservation ID chưa được lưu bền vững; reservation Cloud có thể còn giữ suất hạn mức. Cần thiết kế draft recovery IndexedDB riêng, không tự TTL/release reservation.

### PLAN — lưu bền vững draft cấp Smart ID và khôi phục sau reload — 22/11/2026

- Đã xử lý điểm tồn tại ghi ở checkpoint trước: trước khi gọi RPC Cloud, Local ghi draft thiết bị + reservation UUID + userId + organizationId vào IndexedDB. Draft chỉ được tạo tại thời điểm người dùng bấm lưu, không lưu mọi form đang nhập.
- Dexie nâng schema Local từ version 4 lên version 5, thêm store `assetDrafts`, index theo `[organizationId+userId]`. Không sửa/xóa các bảng Local hiện có.
- Khi đăng nhập/chọn tổ chức, App tìm draft đúng user + đúng organization; nếu UUID thiết bị đã tồn tại trong Local thì dọn draft thừa (thiết bị đã lưu sẽ đi theo luồng retry confirm hiện hữu). Nếu chưa có asset Local, hiển thị khu vực “Thao tác cấp mã chưa hoàn tất” để tiếp tục hoặc hủy giữ số.
- Khôi phục draft sử dụng lại reservation ID và các thành phần phân loại đã lưu; không bắt buộc Catalog/Plan hiện tại phải còn hiển thị các trường cũ. Khi người dùng thay đổi tên/loại/nhóm/cơ sở/ngày, hệ thống phải giải phóng reservation trước rồi mới bỏ draft và cho sửa.
- Khi đóng form, chỉ xóa draft sau khi xử lý release thành công; nếu mất mạng/release thất bại, draft được giữ để khôi phục. Nút đóng và click backdrop bị chặn trong lúc request đang chạy để tránh race giữa reserve/release.
- Sau khi Local ghi asset thành công, draft được dọn riêng; lỗi dọn draft không được giải phóng reservation của thiết bị đã lưu. Nếu hai tab cùng hoàn tất một draft, nhánh xử lý lỗi duplicate Local kiểm tra asset cùng reservation ID và xác nhận theo snapshot đã lưu ở tab thắng, không giải phóng số của thiết bị đó.
- Có thể khôi phục sau đóng/reload trình duyệt khi IndexedDB còn nguyên. **Giới hạn còn lại:** nếu người dùng xóa dữ liệu trang/IndexedDB, đổi trình duyệt hoặc mất thiết bị trước khi Local lưu asset, draft/reservation ID không còn để khôi phục; Cloud reservation chưa có asset row có thể tiếp tục tính vào hạn mức. Chưa đặt TTL tự giải phóng vì sẽ có nguy cơ làm mất reservation của thiết bị Local đã lưu nhưng chưa confirm.
- Các commit chính: Dexie store `892b9ed16318186f842b03c1fd484d7164fed5ad`; tải draft theo tenant/user `cf257e9be5d8151362e7c8264022fd2426e56858`; helper resume/discard `75ac79de3b57fd3aa8f3c5e83a892eca55c3c5d7`; persist trước RPC `48a2446aebcc44a7b84a5ee4ebacda8807452c32`; cleanup sau save/release `5409420abb8acd78ecc3e16414a866f1a0e9277f`; UI recovery `d8ea29c11422864985f69a0b1dbbad1af582bc92`; yêu cầu xác nhận Cloud khi hủy `e45b4bc36ec14d1eea05215ff3e1994cfc42d661`; chặn đóng khi đang reserve `b7bdfbbedf0cfd08a74d98d70c4bb878ca0f45e0`; xử lý mã thiết bị đã lưu từ tab khác `ad70e6fa34f419a09f30e9deb21d8adf487c0870`.
- Chưa chạy build/test, chưa apply migration, chưa deploy Edge Functions/Pages. Chỉ cập nhật source trên GitHub `main`; chưa có thao tác dữ liệu Supabase.

- Bổ sung xử lý khi reservation bị backend từ chối: App tải lại Plan/Catalog Snapshot mới nhất của đúng tổ chức để giao diện không tiếp tục dùng state Plan cũ sau khi Admin khác vừa đổi Plan. Commit `51ed3f27f281818b124d5d96984f359a4c7b9587`; type rõ kết quả issuance `f979af2af6d8bcd8f144e62f24460b38f28817e3`.
- Hoàn thiện xử lý duplicate Local khi hai tab cùng tiếp tục một draft: nếu tab khác đã lưu đúng asset UUID + reservation ID, tab còn lại dùng snapshot Local đã thắng để confirm idempotent; không release reservation của thiết bị đã lưu. Commit `ad70e6fa34f419a09f30e9deb21d8adf487c0870`.

### PLAN — rà soát import dữ liệu Local cũ và khôi phục thiết bị — 22/11/2026

- Đã rà soát source `src/lib/cloudAssets.ts`, `src/CloudAssetsPanel.tsx`, `src/App.tsx`, Dexie schema và các migration import/sync/metadata/Plan.
- **Import thiết bị Local đã có mã (không có Smart ID reservation):** `importLocalAsset` không gọi reserve/cấp sequence nếu hồ sơ không có `idReservationId`; RPC `import_asset_preserving_identity` giữ nguyên UUID + code, kiểm tra quyền `assets.import`, chống trùng UUID/code, dùng `asset_import_receipts` và advisory lock để retry idempotent. DB trigger chỉ chép Smart ID metadata từ reservation đã confirm; hồ sơ legacy không có metadata thì không tự sinh metadata/mã mới. Không có thao tác xóa hoặc đánh số lại hồ sơ cũ.
- **Import thiết bị Local có Smart ID reservation chưa confirm:** client xác nhận chính reservation đã gắn với UUID/code/snapshot trước khi gọi import; nếu import lỗi sau confirm, lần sau có thể retry import mà không cấp reservation/sequence mới. Khi insert Cloud, trigger lấy metadata từ reservation đã confirm. Đây là luồng bảo toàn định danh.
- **Retry import:** cùng UUID làm mutation ID; receipt trả lại kết quả trước đó khi cùng actor/asset/payload. Nếu code đã tồn tại với UUID khác hoặc UUID đã có nội dung khác, RPC từ chối; không tự ghép hai hồ sơ hoặc ghi đè.
- **Tải Cloud về Local:** giữ code và metadata từ Cloud, dùng UUID Local đã có nếu match code; nếu Local có cùng code nhưng chưa liên kết Cloud, UI chặn ghi đè và yêu cầu đối chiếu. Không gọi reserve Smart ID.
- **Lưu kho/khôi phục:** thiết bị đã liên kết Cloud được cập nhật qua mutation trên chính row Cloud, có lock + optimistic timestamp + receipt; chỉ đổi `archived_at`, không insert row, không reserve mã mới và không đổi UUID/code. Thiết bị chưa liên kết chỉ đổi `archivedAt` trên Local row hiện hữu. Vì vậy restore không bị tính là thiết bị mới.
- **Điểm cần quyết định trước khi sửa:** các row Local có `localScope='local-preview'` (Dexie v3 upgrade gán scope này cho dữ liệu cũ không có localScope) không xuất hiện trong danh sách `localAssets` của tổ chức và không phải candidates trong Cloud import panel, vốn chỉ nhận `localScope===organizationId`. Đây có thể là dữ liệu xem thử hoặc dữ liệu Local cũ cần chuyển; hiện chưa có luồng chuyển scope/import rõ ràng. Không tự động chuyển vì có nguy cơ đưa dữ liệu thử nghiệm vào tổ chức thật. Nếu cần nhập dữ liệu cũ, phải làm một thao tác riêng, hiển thị rõ nguồn Local Preview, cho chọn từng hồ sơ, giữ UUID/code, kiểm tra trùng, import Cloud thành công rồi mới chuyển `localScope` sang organizationId; không đổi scope trước khi Cloud xác nhận.
- Không phát hiện đường import/restore hiện tại nào tự sinh Smart ID hoặc tăng sequence cho thiết bị cũ. Import legacy không có reservation vẫn làm tăng số row Cloud được tính trong tổng thiết bị khi lần đầu nhập; đây là ghi nhận thiết bị hiện hữu vào Cloud, không phải cấp mới mã. Import không chạy qua reservation quota; cần giữ quyền `assets.import` giới hạn đúng vai trò và chỉ dùng cho dữ liệu đã có.
- Chỉ rà soát source tĩnh; chưa chạy build/test, chưa apply migration, chưa deploy, chưa thao tác Supabase hoặc dữ liệu tổ chức. Commit cập nhật TIENDO sẽ là checkpoint của rà soát này.


### NGUYÊN TẮC — tự động tải thiết bị Cloud xuống khi đăng nhập trên thiết bị mới — 22/11/2026

- Người dùng đã chốt nguyên tắc: khi đăng nhập trên một thiết bị mới, ứng dụng tự động kiểm tra dữ liệu của tổ chức đang truy cập và tải danh sách thiết bị hiện có từ Cloud xuống Local; không yêu cầu người dùng tự mở màn hình đồng bộ hoặc tự chọn từng thiết bị.
- **Không phụ thuộc Plan A/B/C/D:** thiết bị đã tồn tại trên Cloud thuộc tổ chức được phép tải xuống Local; hạn mức Plan chỉ chi phối các nghiệp vụ tạo mới/cấp mã và tính năng theo Plan, không được dùng để chặn việc tải dữ liệu thiết bị hiện hữu.
- **Không phụ thuộc vai trò Admin/Kỹ thuật viên/Người xem** nếu tài khoản có quyền `assets.view` trong tổ chức đang truy cập. Quyền xem và thao tác sau khi tải vẫn tuân theo RBAC hiện hành; Người xem chỉ đọc, không được mở rộng quyền sửa/xóa/import.
- **Super Admin:** tài khoản quản trị nền tảng không mặc nhiên thuộc một tenant. Chỉ thực hiện tải dữ liệu sau khi Super Admin đã chọn/đang ở ngữ cảnh một tổ chức cụ thể; tuyệt đối không tải chéo tenant.
- Thiết bị Local mới hoàn toàn (chưa có dữ liệu của tổ chức) thì tải bộ dữ liệu Cloud hiện có. Thiết bị đã có dữ liệu Local thì đối chiếu và tải phần thiếu/thay đổi theo quy tắc đồng bộ an toàn; không tải trùng, không ghi đè mù quáng dữ liệu Local mới hơn hoặc thay đổi Local chưa đồng bộ.
- Đây là luồng **Cloud → Local**. Không tự động đẩy Local lên Cloud, không tự động import dữ liệu `local-preview`, không tự cấp Smart ID/sequence, không tạo thiết bị Cloud mới và không thay đổi UUID, mã quản lý, Smart ID, lịch sử, ảnh hoặc trạng thái của hồ sơ đã tồn tại.
- Lưu kho/khôi phục và các thay đổi Cloud đã được phân quyền vẫn phải được phản ánh về Local mà không biến thành thiết bị mới hoặc cấp mã mới. Các pending mutation/conflict phải được giữ và xử lý theo luồng hiện hữu; không được tự ý ghi đè hoặc giải quyết conflict thay người dùng.
- Đây là **quyết định nghiệp vụ/kiến trúc đã chốt, chưa phải xác nhận tính năng đã triển khai**. Bước triển khai cần rà soát auth + organization context, quyền `assets.view`, Cloud query/pagination, Dexie Local scope, Cloud links, pending mutations/conflicts, tải lần đầu và đồng bộ gia tăng. Phải bảo đảm chỉ truy cập đúng organization ID và có thể retry an toàn khi mất mạng/đóng tab.
- Chưa sửa source cho tính năng này; chưa build/test, chưa apply migration, chưa deploy và chưa thao tác dữ liệu Supabase.


### PLAN — chuyển dữ liệu Local Preview cũ vào tổ chức có kiểm soát — 22/11/2026

- Triển khai source bước đầu cho điểm tồn tại đã nêu ở checkpoint import/restore: các hồ sơ localScope=local-preview trước đây không xuất hiện trong danh sách Local chưa liên kết của tổ chức.
- src/App.tsx: khi đã đăng nhập và chọn tổ chức, tải riêng danh sách Local Preview cũ vào state độc lập; không trộn vào danh sách thiết bị của tổ chức. Truyền danh sách này cho CloudAssetsPanel.
- src/CloudAssetsPanel.tsx: thêm khu vực “Dữ liệu Local Preview cũ”. Chỉ hiển thị khi tài khoản có quyền assets.import; người dùng phải chọn hồ sơ cụ thể và xác nhận rõ rằng nguồn có thể chứa dữ liệu thử nghiệm. Không tự động nhập khi đăng nhập, mở panel hoặc tải Cloud.
- Trước khi nhập từng hồ sơ: kiểm tra hồ sơ vẫn thuộc local-preview; bắt buộc có UUID hợp lệ, mã quản lý và tên; chặn mọi hồ sơ có idReservationId vì chưa xác định reservation thuộc organization/user nào; chặn UUID đã liên kết với tenant khác; chặn liên kết cùng tenant đang conflict hoặc sai mã; chặn mã đã có trong Local của tổ chức.
- Tận dụng RPC hiện hữu import_asset_preserving_identity qua importLocalAsset; không tạo reservation mới, không cấp Smart ID/sequence mới. Backend tiếp tục kiểm tra quyền assets.import, UUID/code và receipt idempotent.
- Chỉ sau khi RPC Cloud xác nhận và Local có Cloud link đúng organization + UUID + code + trạng thái linked, mới dùng transaction IndexedDB để chuyển localScope từ local-preview sang organizationId. Giữ nguyên UUID, mã, thông tin hồ sơ, createdAt/updatedAt, trạng thái, ảnh Local và lịch sử đang có; không thay đổi nội dung hồ sơ. Ảnh vẫn chỉ nằm trên trình duyệt, theo giới hạn hiện tại.
- Nếu Cloud import thành công nhưng bước chuyển scope Local thất bại, hồ sơ vẫn ở local-preview; lần retry dùng cùng UUID/mutation ID qua receipt idempotent và không tạo hồ sơ/sequence mới. Nếu lỗi từng hồ sơ trong batch, các hồ sơ lỗi vẫn được giữ trong danh sách chọn để xử lý lại; hồ sơ thành công đã chuyển khỏi Local Preview.
- Các hồ sơ có Smart ID reservation bị khóa khỏi thao tác chuyển tự động, kể cả reservation đã confirm; cần xử lý riêng sau khi xác minh đúng tenant/actor/reservation. Không tự giải phóng reservation.
- Commit source:
  - 3e9c3bb4cd3c1cc18de518d8407f7a4853ea73b3 — UI nhập Local Preview có chọn.
  - f74cbfe83038f046eb1484fc733830712a0c998e — tải Local Preview độc lập trong App.
  - 71cde3c96c1c04387767e900bf9b47ce13c98736 — truyền dữ liệu Local Preview vào panel.
  - c496c50aa2df69e649354aa22b8a59781bf52ef2 — guard UUID, mã và liên kết cũ.
  - 67a3b7be1ac36ee8f921e1e6495e2fff796d33b0 — giữ lại các lựa chọn lỗi trong batch và làm rõ quyền import.
  - a724cb7c974c0867025eb79175deb33e59ce2ebe — trả kết quả từng hồ sơ để batch nhận biết thành công/thất bại.
- Chỉ sửa source trên main; không tạo branch. Chưa chạy build/test, chưa apply migration, chưa deploy Edge Functions/Pages, chưa thao tác Supabase hoặc dữ liệu tổ chức.
- Giới hạn cần rà soát tiếp: các hồ sơ preview thiếu UUID/mã/tên hoặc có reservation đều bị chặn; hồ sơ trùng code/UUID cần đối chiếu thủ công. Cần rà soát tĩnh lần cuối toàn bộ luồng và kiểm tra CI/build khi người dùng cho phép.


- Bổ sung sau rà soát: hàm nhập từng hồ sơ trả về kết quả boolean để batch giữ lại chính xác các hồ sơ thất bại; sau thao tác refresh danh sách, lỗi của hồ sơ được đặt lại để không bị hàm reload xóa mất. Commit: e14d52d82f17f98ab06d564e7ce1ee424470596f.
- Xác minh source cuối trên main: App có state tải Local Preview riêng và truyền prop vào panel; panel có khu vực chọn thủ công, kiểm tra UUID/code/reservation/tenant link, gọi import RPC hiện hữu, rồi mới chuyển scope trong transaction IndexedDB. Đây chỉ là rà soát source tĩnh, không thay thế build/test.
- Main head tại checkpoint này: e14d52d82f17f98ab06d564e7ce1ee424470596f. Chưa build/test, chưa apply migration, chưa deploy, chưa thao tác Supabase.


### Rà soát kiến trúc tự động Cloud → Local khi đăng nhập — 22/11/2026

- Đọc lại nguyên tắc đã chốt ở phần PLAN: chỉ tải sau khi có đúng ngữ cảnh tổ chức và quyền assets.view; không phụ thuộc Plan/role nếu quyền xem hợp lệ; không import Local Preview; không đẩy Local lên Cloud; không ghi đè thay đổi Local hoặc tự xử lý conflict.
- Source hiện tại chưa có auto-sync khi đăng nhập. App chỉ load IndexedDB theo localScope; CloudAssetsPanel mới gọi listCloudAssets khi người dùng mở panel và việc tải từng hồ sơ phải bấm thủ công.
- listCloudAssets gọi RPC public.list_cloud_assets(p_organization_id) và nhận toàn bộ JSON array trong một lần. Migration 20261121130000_cloud_asset_public_key_api.sql đang aggregate toàn bộ public.assets theo organization bằng jsonb_agg, không có limit/cursor/page. Không phù hợp để dùng làm cơ chế đồng bộ tự động khi dữ liệu tăng lớn.
- Kiểm tra quyền backend: RPC list_cloud_assets hiện chỉ kiểm tra auth.uid() và private.is_org_member(p_organization_id), chưa kiểm tra riêng private.has_org_permission(...,'assets.view'). Mặc dù các built-in role hiện có assets.view, custom role có thể không có; cần sửa backend để đúng nguyên tắc RBAC đã chốt trước khi auto-sync.
- listCloudAssets đang ánh xạ Cloud asset_key (mã quản lý) thành id phía client; Cloud internal UUID không được trả ra theo thiết kế migration 013000. Local mới tải xuống được gán UUID Local riêng qua downloadCloudAsset; không được giả định Cloud key chính là UUID Local.
- Luồng downloadOne hiện có quy tắc so sánh phiên bản qua AssetCloudLink: nếu Local không đổi và Cloud đổi thì cập nhật Cloud → Local; nếu Local đổi và Cloud không đổi thì giữ Local; nếu cả hai cùng đổi thì đánh dấu conflict và yêu cầu người dùng chọn. Nếu Local có mã trùng nhưng chưa có Cloud link thì chặn ghi đè. Auto-sync phải tái sử dụng hoặc tách helper từ đúng quy tắc này, không viết đường tải mới bỏ qua conflict.
- RPC list hiện tại yêu cầu membership, nên Super Admin owner không phải thành viên tổ chức sẽ không thể dùng trực tiếp. PlatformAdminPanel hiện có quản trị tổ chức nhưng không có tenant context/selection dành cho Cloud asset browsing. Không được cho Super Admin truyền organization_id tùy ý để bypass membership; cần một cơ chế backend Super Admin riêng, xác minh owner allowlist ở server, hoặc yêu cầu Super Admin được gán membership rõ ràng. Chưa chọn giải pháp.
- Kiến trúc cần có trước khi triển khai:
  1. RPC phân trang ổn định (keyset cursor theo thứ tự cố định, ví dụ name + code hoặc updated_at + code), có giới hạn page size phía server; response chứa items + cursor/has_more.
  2. RPC kiểm tra đúng assets.view và đúng tenant; không dựa vào client-supplied role/permission.
  3. Auto-sync chỉ chạy sau khi Auth session ổn định, organization context đã tải xong, organizationId cụ thể và quyền assets.view đã xác nhận. Mỗi lần đổi user/org phải hủy lượt cũ để tránh ghi nhầm tenant.
  4. Trang đầu/thiết bị mới: tải lần lượt từng page; thiết bị đã có Local dùng AssetCloudLink + updatedAt để đối chiếu; không có link nhưng có Local cùng code thì tạo conflict/đòi đối chiếu, không overwrite.
  5. Pending mutations/processing/conflicts phải giữ nguyên và không bị auto-download ghi đè; không auto push Local.
  6. Ghi từng page hoặc từng asset an toàn vào IndexedDB; cursor/progress có thể retry sau mất mạng/reload, không đánh dấu sync hoàn tất khi một page lỗi.
  7. Chạy cùng một cơ chế sau login và khi người dùng đổi tổ chức; tránh chạy trùng bằng single-flight/cancel token.
- Kết luận: chưa sửa source cho auto-sync. Cần hoàn tất thiết kế và migration phân trang + RBAC trước khi bật luồng tự động; không dùng RPC list toàn bộ hiện tại cho dữ liệu lớn.
- Không apply migration, không deploy, không thao tác dữ liệu Supabase. Không chạy build/test.


### Quyết định Super Admin truy cập Cloud → Local theo tenant context — 22/11/2026

- Người dùng chốt phương án Super Admin riêng, không tự động thêm Super Admin thành thành viên của mọi tổ chức.
- Luồng dự kiến: Super Admin mở Quản trị nền tảng, chọn một tổ chức cụ thể; backend xác minh owner allowlist bằng thông tin phía máy chủ; chỉ sau khi xác minh mới cho phép đọc danh sách thiết bị Cloud của đúng organization_id đang chọn để tải Cloud → Local.
- Không cho client tự truyền organization_id để vượt membership/RBAC; không mở quyền sửa, xóa, import hoặc thay đổi dữ liệu tổ chức. Đây chỉ là quyền đọc phục vụ tải xuống Local, giới hạn tenant cụ thể và được audit.
- Người dùng thuộc tổ chức vẫn dùng RPC dành cho thành viên với quyền assets.view; không phụ thuộc Plan.
- Bước kỹ thuật tiếp theo: thiết kế RPC phân trang có kiểm soát riêng cho member và Super Admin, xác minh owner allowlist ở backend, sau đó tích hợp lựa chọn tổ chức vào PlatformAdminPanel. Chưa triển khai source ở checkpoint này.
- Commit ghi quyết định: sẽ cập nhật ở commit TIENDO hiện tại; chưa apply migration, deploy, build/test hoặc thao tác dữ liệu Supabase.


### PLAN — triển khai Cloud → Local tự động để chuẩn bị đăng nhập thử nghiệm — 22/11/2026

- Theo quyết định đã chốt: thành viên tổ chức có quyền assets.view tự động tải/đối chiếu Cloud → Local sau khi session và organization context sẵn sàng; không phụ thuộc Plan/role nếu quyền xem hợp lệ. Không chạy ở Local Preview, không tự import Local Preview, không đẩy Local lên Cloud.
- Tạo migration source supabase/migrations/20261122170000_cloud_asset_sync_pagination_and_platform_read.sql:
  - Thêm RPC public.list_cloud_assets_page dùng keyset cursor theo mã thiết bị code, page size server-side tối đa 100, trả items, has_more, next_cursor.
  - Thành viên thường phải có private.has_org_permission(organization_id,'assets.view').
  - Super Admin dùng cờ platform_admin riêng; backend xác minh auth.uid(), email allowlist tuanluongpham1980@gmail.com và email_confirmed_at trong auth.users. Chỉ đọc tổ chức đang active, không bypass theo client-provided role.
  - Siết cả RPC legacy public.list_cloud_assets để yêu cầu assets.view.
  - EXECUTE page RPC chỉ cấp authenticated; revoke public/anon.
- src/lib/cloudAssets.ts:
  - listCloudAssets chuyển sang đọc hết các trang bằng cursor.
  - Thêm syncCloudAssetsToLocal: tải thiết bị chưa có Local; dùng AssetCloudLink để đối chiếu thiết bị đã liên kết; cập nhật Cloud → Local khi Local không đổi; giữ Local nếu có thay đổi Local chưa đẩy; đánh dấu conflict nếu hai bên cùng thay đổi; bảo vệ hồ sơ có pending/processing/conflict mutation hoặc hồ sơ Local cùng mã chưa có link. Không xóa hồ sơ, không cấp Smart ID, không import Local Preview.
- src/App.tsx: sau khi đăng nhập, session ổn định, tổ chức cụ thể đã được chọn và quyền assets.view đã có, tự chạy đồng bộ; hủy lượt cũ khi đổi user/org hoặc rời ngữ cảnh. Hiển thị kết quả mới/cập nhật/đã khớp/được bảo vệ/conflict.
- src/PlatformAdminPanel.tsx + App: Super Admin có nút “Tải Cloud → Local” theo từng tổ chức active. Backend vẫn tự xác minh allowlist; không thêm membership, không có thao tác sửa/xóa Cloud.
- Commits source:
  - 8a90b179dfafb95c4f29a14b788fc4584927b0c2 — migration phân trang và xác thực Super Admin.
  - 2b19822a3486d427210f1d5533824779d9d8e72e — helper đồng bộ Cloud → Local an toàn.
  - 89f0c7a67c280c2dc2c511a8783756aad5fabb33 — auto-sync sau khi organization context sẵn sàng.
  - 347a48a862c04671ced6550ec8fe7ba9f3cd2cd1 — nút tải Cloud theo tổ chức cho Super Admin.
  - 93361f8b26f29a105a256f28c723a3adb4f32f28 — nối callback Super Admin vào sync helper.
  - a3db6d47a80857c0eaccbe3ad29e7757d3d09d7a — listCloudAssets chuyển sang phân trang.
  - 3e471c4c07d9f19a5529de6ae37b0881b500c82b — siết quyền assets.view cả RPC legacy.
- Cơ sở kỹ thuật: Supabase Database Functions docs cập nhật 18/11/2026; changelog đã rà soát, không có breaking change liên quan trực tiếp tới RPC PostgreSQL dùng ở đây. SECURITY DEFINER đặt search_path rỗng, revoke PUBLIC/anon, grant authenticated có kiểm tra auth/permission phía server.
- Kiểm tra source tĩnh: migration có giới hạn page size và keyset cursor; bảng assets có unique index (organization_id,code) hỗ trợ truy vấn; App chỉ chạy auto-sync khi org context và assets.view hợp lệ; Super Admin chọn tenant cụ thể. Chưa chạy SQL parser, chưa build/test.
- Chưa apply migration vào Supabase BAOTRI Mini New / BAOTRI Mini Test 02; chưa deploy Edge Functions/Pages; chưa thao tác dữ liệu tổ chức. Vì vậy đăng nhập vào bản đang chạy hiện tại chưa thể dùng auto-sync cho tới khi migration được apply và source được đưa lên môi trường thử nghiệm.
- Bước cần người dùng xác nhận tiếp theo: cho phép apply riêng migration trên vào Supabase project BAOTRI Mini New (project ID dskeaiyvldiwlsfqkboq) để thử với tổ chức BAOTRI Mini Test 02 (UUID f11bb85f-0dbe-45f0-bffa-472e5f84f7bf). Không thao tác tổ chức BAOTRI Mini thật.


### Cloud → Local — apply migration và chuẩn bị deploy preview — 22/11/2026

- Người dùng xác nhận “ok tiếp” cho phép apply migration và triển khai bản thử nghiệm, giới hạn BAOTRI Mini Test 02; không tác động tổ chức BAOTRI Mini thật.
- Đã xác minh Supabase project BAOTRI Mini New, ID dskeaiyvldiwlsfqkboq, trạng thái ACTIVE_HEALTHY, PostgreSQL 17.12.
- Đã xác minh organization UUID f11bb85f-0dbe-45f0-bffa-472e5f84f7bf chính là BAOTRI Mini Test 02, trạng thái active; hiện có 1 asset Cloud. Không truy vấn/sửa dữ liệu tổ chức thật.
- Đã apply thành công migration cloud_asset_sync_pagination_and_platform_read vào BAOTRI Mini New. Supabase ghi version 20261122055755.
- Đã đồng bộ tên file migration source theo version đã apply: supabase/migrations/20261122055755_cloud_asset_sync_pagination_and_platform_read.sql (đã xóa tên file cũ 20261122170000 để không tạo migration duplicate khi CLI đối chiếu).
- Kiểm tra SQL sau apply:
  - RPC member list_cloud_assets_page(..., p_platform_admin=false) chạy thành công với JWT claim mô phỏng của user đang là active member BAOTRI Mini Test 02, có assets.view; trả đúng 1 asset, has_more=false.
  - RPC Super Admin p_platform_admin=true chạy thành công với JWT claim mô phỏng của tài khoản owner allowlist, email confirmed; trả đúng 1 asset.
  - private.has_org_permission xác nhận user test có assets.view.
  - ACL sau apply: EXECUTE chỉ còn postgres, authenticated, service_role; không còn PUBLIC/anon cho hai RPC.
  - Đây là SQL smoke test mô phỏng claim trong transaction có ROLLBACK, không phải đăng nhập qua trình duyệt hoặc test thực tế JWT từ Auth.
- Supabase Security Advisor sau migration có cảnh báo authenticated_security_definer_function_executable gồm 9 function SECURITY DEFINER trong public; hai RPC mới nằm trong danh sách. Đây là function API chủ đích, đã revoke PUBLIC/anon, chỉ grant authenticated và kiểm tra auth/tenant/permission trong thân hàm. Các cảnh báo khác có từ các RPC Cloud Asset trước đó. Chưa xử lý các cảnh báo ngoài phạm vi này.
- Performance Advisor không có cảnh báo mới đặc thù RPC phân trang; index unique (organization_id, code) đã tồn tại, phục vụ keyset cursor. Các findings khác là FK indexes/policies tồn tại trước đó.
- Vercel: đã tìm thấy project baotri-mini-new-preview, ID prj_De80PT3JC04b3NqtXHRL6JD8QMoo, team team_VnC0cB9kMxYP31Thelm8Zz4C; có env Preview VITE_SUPABASE_URL trỏ đúng BAOTRI Mini New và VITE_SUPABASE_PUBLISHABLE_KEY. Project hiện chưa có deployment và không có linked Git project trong deployment context.
- Lần gọi tạo deployment Preview từ repo Vodanhhp/BaoTri_Mini, branch main, commit f699235f559cbe63e80108f6d50e6c5f9b334c24 bị Vercel trả HTTP 429 rate_limited do GitHub API rate limit; không có deployment được tạo.
- Commit GitHub sau khi rename migration: 63d4aecd98b175e45801385a667e2306f7b37130; cần xác minh HEAD mới nhất sau cập nhật TIENDO.
- Chưa build/test ứng dụng; chưa đăng nhập trình duyệt; chưa deploy Preview. Bước tiếp: retry tạo deployment Preview khi rate limit hết, giữ đúng project/team/branch/commit, sau đó theo dõi build logs và chỉ gửi URL khi trạng thái READY.


- Bổ sung smoke test từ SQL transaction: user UUID không có membership thử gọi RPC member thì bị chặn bởi 42501; transaction ROLLBACK, không ghi dữ liệu.
- Migration source được đổi tên ở commit 30a400a9ba01e7d61d84eddf7ce64cd77f0883b0 và xóa file cũ ở commit 63d4aecd98b175e45801385a667e2306f7b37130. TIENDO hiện ghi nhận lần apply thành công và kết quả smoke test.
- Lần retry deploy Preview tiếp tục bị Vercel 429 GitHub API rate limit; chưa có deployment URL.
- HEAD trước khi append mục này: 446510b1a5034dbc82c7ac501a3d06d755aa3fe3.


- Lần thử tạo deployment Preview thứ ba cho HEAD faaf8352b118335c6a812f2855a7d8bc0d28c31b tiếp tục nhận HTTP 429 rate_limited (GitHub API rate limit exceeded). Đã dừng retry theo hướng dẫn dịch vụ; không tạo deployment và không có URL để đăng nhập.
- Trạng thái hiện tại: migration đã apply + SQL smoke test member/Super Admin/denied đã có kết quả; phần frontend đã commit main nhưng chưa được build/deploy. Cần chờ Vercel/GitHub API hết rate limit hoặc dùng phương thức deploy khác có quyền truy cập repo. Không chuyển sang production.


- Retry kiểm tra/khởi tạo Preview tiếp theo ngày 22/11/2026: xác nhận HEAD main vẫn là `2962d3e2b49444ca422ae406c1cf9e38c6dd3ce2`; project Preview vẫn có 0 deployment. Gọi tạo deployment một lần nữa cho đúng project/team/branch/commit tiếp tục bị HTTP 429 `rate_limited` (GitHub API rate limit exceeded). Không có deployment ID/URL; đã dừng retry, không dùng Production và không thay đổi Supabase/dữ liệu.
- Hướng xử lý tiếp: chờ API hết rate limit hoặc dùng quy trình deploy từ source local/CI đã được liên kết đúng project nếu có quyền và cấu hình hợp lệ. Không dùng CLI fallback khi chưa có source local đã xác minh và chưa xác nhận liên kết project; không tự chuyển sang project khác.


### Thử lại Vercel Preview — 22/11/2026
- Đọc lại TIENDO trên main; HEAD trước cập nhật là ae223932e4fad937d2da925aaa6fce025ac12444. Kiểm tra đúng Vercel project baotri-mini-new-preview (prj_De80PT3JC04b3NqtXHRL6JD8QMoo), team team_VnC0cB9kMxYP31Thelm8Zz4C; project framework Vite, chưa có deployment trước lần thử.
- Sau khoảng thời gian chờ, thử tạo deployment từ repo Vodanhhp/BaoTri_Mini, main, commit ae223932e4fad937d2da925aaa6fce025ac12444. Lần này không còn lỗi 429; Vercel tạo deployment ID dpl_8noG3YiyPcDTAraFiuGcsfc8HgET, URL baotri-mini-new-preview-dypobrpdv-tuanluongpham-8256.vercel.app.
- Tuy nhiên phản hồi deployment ghi target=production dù yêu cầu target=preview. Deployment kết thúc ERROR (errorCode git_info_fail), không READY; danh sách deployments xác nhận chỉ có deployment này và state ERROR. Không thể cancel do đã chuyển sang trạng thái terminal ERROR. Không có production deployment thành công/live; tuyệt đối không truy cập/promote/tiếp tục deploy theo đường này.
- Nguyên nhân thực tế đang cần xác định: project không có linked Git project trong deployment context, Vercel Git metadata resolution thất bại (git_info_fail). Trước khi thử deploy lần tiếp, cần làm rõ/khắc phục liên kết Git hoặc chọn quy trình deploy file/source local đã xác minh, đồng thời bảo đảm target Preview được Vercel xác nhận rõ ràng. Repo không có checkout tại runtime hiện tại (đã kiểm tra các thư mục làm việc và /mnt/data); chưa build/test.
- Không thay đổi Supabase, không thao tác dữ liệu tenant, không chạy build/test. Dừng tại đây để tránh deploy nhầm Production.

- Chẩn đoán bổ sung sau khi deployment lỗi: Vercel Git deployment context của team trả `linkedProjects=[]`, không có Git-linked project; deployment event log rỗng. Container hiện tại không có checkout repo/source local (kiểm tra root và /mnt/data). Vì vậy không có nguồn files để dùng deployment inline/local an toàn.
- Không tạo project mới, không sửa Git connection/project settings, không thử thêm deployment. Chờ người dùng kết nối repo Git trong Vercel Dashboard hoặc cung cấp checkout local/cho phép một phương án cụ thể; sau đó kiểm tra target preview trước khi deploy.


### Vercel staging build retry — 22/11/2026
- Người dùng xác nhận đã kết nối Vercel với repo; kiểm tra deployment context vẫn báo linkedProjects=[] (không thấy project Git link trong context API), nhưng gọi deployment trực tiếp từ GitHub source đã clone được repo và chạy build.
- Deployment ID: dpl_C4qzUDBMBT84To7xhJhy4sustZ1R; project baotri-mini-new-preview (prj_De80PT3JC04b3NqtXHRL6JD8QMoo); team team_VnC0cB9kMxYP31Thelm8Zz4C.
- API không chấp nhận target "preview" (chỉ production/staging/custom env); không có custom environment. Để tránh Production, deployment được tạo target **staging**, không phải Preview/Production.
- Source: repo Vodanhhp/BaoTri_Mini, main, commit a00107a80ae78159a911f18eb5b904ba23c1dc57. Clone thành công, npm ci cài 82 packages, báo 0 vulnerabilities; chạy npm run build (tsc -b && vite build).
- Build ERROR: TypeScript TS2345 tại src/App.tsx dòng 872 cột 317: SupabaseClient | null truyền vào syncCloudAssetsToLocal, yêu cầu SupabaseClient không nullable. Đây là lỗi build được xác nhận qua Vercel logs; chưa chỉnh source.
- URL deployment staging (không READY, không dùng để đăng nhập): baotri-mini-new-preview-qr98jtnjg-tuanluongpham-8256.vercel.app.
- Không có Production deployment thành công/live, không apply migration mới, không thay đổi Supabase hoặc dữ liệu tenant. Bước tiếp theo: sửa lỗi narrowing/nullability ở callback onSyncOrganization trong App.tsx, sau đó build/deploy lại staging theo commit mới; chỉ tiếp tục khi được người dùng yêu cầu.


### Sửa lỗi build và deploy staging thành công — 22/11/2026
- Sửa `src/App.tsx` callback `onSyncOrganization` của PlatformAdminPanel: thêm guard `if(!supabase) throw new Error('Chưa kết nối Supabase.')` để TypeScript narrow nullable Supabase client trước khi truyền vào `syncCloudAssetsToLocal`. Thay đổi chỉ bảo vệ trường hợp client null; logic sync không đổi.
- Commit source: `fcb310b709ab4c23a4e064720733600b55885c79` (main).
- Vercel deployment ID `dpl_hW1GrFDMnH3y46AgDL6zH8YM49zz` trên đúng project `baotri-mini-new-preview`, target `staging`, state **READY**. URL: `baotri-mini-new-preview-eazlswbhd-tuanluongpham-8256.vercel.app`.
- Build logs xác nhận `npm ci` thành công (82 packages), `tsc -b` không còn lỗi, Vite v6.4.6 transform 1640 modules; deployment READY. Build chỉ chạy trên Vercel, không chạy local.
- Không deploy Production, không promote, không thay đổi project settings hoặc Supabase/database. Runtime đăng nhập và các chức năng ứng dụng chưa được browser-test; cần người dùng mở deployment và thử.


## Khắc phục lỗi đếm thiết bị Cloud / đồng bộ migration Plan (22/11/2026)
- Người dùng gặp lỗi trên Staging khi mở Gói dịch vụ: `Could not find the function public.count_organization_cloud_assets(p_organization_id) in the schema cache`.
- Đã đối chiếu source `main` với migration history của đúng Supabase project `dskeaiyvldiwlsfqkboq`. DB đang dừng ở migration `20261122055755_cloud_asset_sync_pagination_and_platform_read`; thiếu ba migration Plan workflow và bảo toàn Smart ID phía sau.
- Migration source `20261122110000_remove_unreliable_jwt_guard_inner_customer_provisioning.sql` đã được áp dụng trước đó trong DB dưới version `20261122034910_remove_unreliable_jwt_guard_inner_customer_provisioning`; đã xác minh function private không còn legacy JWT role guard, không chạy lại.
- Đã áp dụng thành công theo thứ tự trên **BAOTRI Mini New (Test)**:
  1. `20261122120000_organization_plan_change_workflow.sql` — tạo RPC đếm thiết bị Cloud có kiểm tra `assets.view`, luồng yêu cầu/duyệt đổi Plan và audit history.
  2. `20261122130000_serialize_smart_id_reservations_with_plan_changes.sql` — khóa đồng bộ việc giữ mã Smart ID với thao tác đổi Plan.
  3. `20261122140000_preserve_smart_id_reservation_retries_after_plan_change.sql` — giữ khả năng retry reservation cũ sau khi Plan thay đổi, bổ sung metadata version và group name tại thời điểm tạo.
- Supabase xác nhận cả ba migration thành công; migration history hiện có các version do Supabase cấp lần lượt `20261122105818`, `20261122105819`, `20261122105821`.
- Đã xác minh `public.count_organization_cloud_assets(p_organization_id uuid)` tồn tại; role `authenticated` có EXECUTE, `anon` không có. Hai RPC `reserve_asset_id_sequence` và count có quyền authenticated; các RPC quản trị Plan vẫn chỉ dành cho service_role. Hai cột reservation mới đã tồn tại.
- Đã gửi `NOTIFY pgrst, 'reload schema'` để yêu cầu PostgREST nạp lại schema cache.
- Không tạo/sửa/xóa organization, user, asset hay reservation; không thay đổi dữ liệu nghiệp vụ. Không đụng project/org Production.
- Còn cần người dùng tải lại Staging và kiểm tra giao diện Gói dịch vụ; xác minh RPC/ACL ở database chưa thay thế cho browser runtime test.


### Triển khai Edge Functions cho luồng Gói dịch vụ — 22/11/2026
- Người dùng xác nhận triển khai hai Edge Functions còn thiếu lên đúng Supabase project **BAOTRI Mini New (Test)**, project ID `dskeaiyvldiwlsfqkboq`.
- Đã triển khai `organization-plan-requests` version 1, trạng thái **ACTIVE**, `verify_jwt=true`. Function xác thực access token và email đã xác nhận; chỉ Admin active của đúng tổ chức được xem/gửi yêu cầu Plan; các thao tác dữ liệu đi qua RPC Plan đã triển khai trong migration.
- Đã triển khai `platform-manage-plan-requests` version 1, trạng thái **ACTIVE**, `verify_jwt=true`. Function xác thực access token, email Super Admin allowlist; khi duyệt/từ chối còn xác thực lại mật khẩu và yêu cầu xác nhận điều kiện thương mại/thanh toán.
- Đã gọi danh sách Edge Functions sau deploy và xác nhận cả hai function xuất hiện trạng thái ACTIVE, JWT verification bật.
- Chưa thực hiện browser runtime test, chưa gửi yêu cầu Plan, chưa duyệt/từ chối yêu cầu, chưa thay đổi Plan/Catalog Snapshot hoặc dữ liệu tổ chức. Tổ chức `BAOTRI Mini` trong project Test vẫn chưa có Plan/Snapshot; cần xử lý riêng theo quyết định có chủ đích, không tự gán Plan.
- Không deploy Production, không thay đổi cấu hình project hoặc dữ liệu nghiệp vụ.
- Việc tiếp theo: người dùng tải lại Staging và kiểm tra Gói dịch vụ; nếu vẫn lỗi, cung cấp nguyên văn thông báo mới.


### Sửa CORS cho Edge Functions Gói dịch vụ trên Staging — 22/11/2026
- Người dùng xác nhận cho phép sửa CORS và triển khai lại hai Edge Functions trên đúng Supabase project **BAOTRI Mini New (Test)**, project ID `dskeaiyvldiwlsfqkboq`.
- Đối chiếu source hai function version 1: CORS chỉ cho phép domain production `https://baotri.vieclamhp247.com` và localhost; chưa cho phép domain Vercel Staging đang kiểm thử `https://baotri-mini-new-preview-eazlswbhd-tuanluongpham-8256.vercel.app`. Đây là nguyên nhân có cơ sở giải thích lỗi trình duyệt `Failed to send a request to the Edge Function`.
- Đã cập nhật CORS cho cả hai function theo allowlist cụ thể gồm domain production, domain Staging nêu trên và hai địa chỉ localhost; không dùng wildcard. Bổ sung các header trace/retry vào allow-headers; giữ nguyên logic xác thực JWT, quyền Admin/Super Admin, RPC và quy trình duyệt.
- Triển khai thành công trên **Test**:
  - `organization-plan-requests`: version **2**, trạng thái **ACTIVE**, `verify_jwt=true`, SHA `2140f9a0e781e168c64f8d68e8f7186a4fee2a8fef88f8b60bd787bec0856935`.
  - `platform-manage-plan-requests`: version **2**, trạng thái **ACTIVE**, `verify_jwt=true`, SHA `c20c9fffe6ac234562eded7fe2f24fa16ab35acab5e198c14546fcb41af9bd8a`.
- Gọi `list_edge_functions` sau deploy xác nhận cả hai function đang ACTIVE ở version 2, JWT verification vẫn bật.
- Chưa thể kiểm tra preflight HTTP trực tiếp từ môi trường thực thi hiện tại do DNS/network không khả dụng; chưa có browser runtime test sau deploy. Không gửi yêu cầu Plan, không duyệt/từ chối, không gán Plan hoặc tạo Catalog Snapshot.
- Không deploy Production, không thay đổi dữ liệu nghiệp vụ hoặc cấu hình project khác.
- Việc tiếp theo: người dùng tải lại Staging (Ctrl+F5), mở Gói dịch vụ và gửi lại thông báo mới nếu còn lỗi. Nếu CORS đã hết lỗi nhưng vẫn báo thiếu Plan/Catalog Snapshot thì xử lý riêng theo quyết định khởi tạo dữ liệu có chủ đích.

### Chuẩn hóa giao diện bảng dữ liệu toàn hệ sinh thái — 22/11/2026
- Rà soát các bảng dữ liệu chính đang hiển thị trong BAOTRI Mini: danh sách thiết bị Local, tổng quan tổ chức Super Admin và hai màn hình lịch sử/yêu cầu đổi Plan. Các bảng in hồ sơ/Checklist được giữ riêng theo tiêu chuẩn giấy, không áp dụng CSS giao diện màn hình.
- Chuyển danh sách yêu cầu đổi Plan của doanh nghiệp và Super Admin từ các thẻ dòng rời rạc sang bảng dữ liệu có cột rõ ràng: nội dung thay đổi, ngày gửi, người gửi, ghi chú/phản hồi, trạng thái và thao tác. Giữ nguyên dữ liệu, trạng thái, luồng duyệt/từ chối và xác thực Super Admin.
- Bổ sung quy chuẩn `.table-standard` / `.table-standard-wrap` dùng chung: header nền trung tính, chữ tiêu đề nhỏ và rõ, hàng dữ liệu gọn, căn giữa theo chiều dọc, đường phân cách nhẹ, hover tinh tế, trạng thái dùng màu có ý nghĩa, vùng cuộn ngang trên màn hình hẹp và header cố định khi cuộn.
- Áp dụng cùng chuẩn cho bảng thiết bị Local và bảng tổng quan tổ chức Super Admin; CSS chỉ tác động bảng nằm trong `.table-wrap`, không làm thay đổi biểu mẫu/bảng in.
- Thêm tài liệu chuẩn dùng lại: `docs/UI_TABLE_STANDARD.md`, mô tả nguyên tắc, kích thước, responsive, trạng thái rỗng và cách áp dụng cho ứng dụng mới trong hệ sinh thái.
- Các commit source: `df9ebf883225d415d243a8efbbcb2ed7714dfdcd` (Plan tables), `524a3d8fc32285fd407e9e0ee489b88f04f5ee9b` (table CSS), `0ef1cf0076b36b4113ae5a923a19dc2d7ab563b8` (asset register), `49d43a708ce8079b3ddfc248f4d01329d76de4cd` (platform overview), `51c31541cc11de44648507fac2511cedf18587a5` (CSS selector compatibility).
- Chưa chạy build hoặc browser test; chưa tạo deployment Staging mới. Không thay đổi Supabase, dữ liệu tổ chức, Edge Functions hoặc Production.
- Bước tiếp theo: kiểm tra build và triển khai riêng lên Staging khi được yêu cầu; sau đó rà soát trực quan trên PC và mobile, đặc biệt bảng yêu cầu Plan và bảng tổng quan Super Admin.

### Ghi nhận workflow sau cập nhật bảng — 22/11/2026
- Lưu ý vận hành: các cập nhật được ghi trực tiếp lên `main`; workflow `.github/workflows/pages.yml` có trigger `push` trên `main`, vì vậy GitHub Actions đã tự chạy deploy GitHub Pages. Run `45016313747` hoàn tất **success**, source commit `b918fdcf37e02c7760aeb24fee3de815e4901808`; workflow có bước `actions/deploy-pages@v4`. Đây là lần cập nhật GitHub Pages trên domain production theo CNAME, không phải Vercel Staging. Việc này xảy ra ngoài dự kiến; không có thay đổi Supabase/Edge Functions hay dữ liệu nghiệp vụ.
- Workflow CI run `45016313708` thất bại ở Unit tests nên bước Build của workflow CI bị skip. Kết quả test: 28/29 pass; test `member-facing Cloud asset list uses the UUID-free RPC` đang kiểm tra RPC cũ `list_cloud_assets`, trong khi `src/lib/cloudAssets.ts` hiện dùng RPC phân trang `list_cloud_assets_page`. Đây là test assertion chưa đồng bộ với implementation hiện tại, không phải lỗi từ các file UI bảng vừa sửa. Riêng workflow Pages đã chạy `npm run build` và build thành công trước khi deploy.
- Không thực hiện rollback production vì cần quyết định rõ ràng của người dùng. Trước mọi lần cập nhật tiếp theo phải tránh push `main` nếu chưa xác định rõ tác động workflow; ưu tiên kiểm thử và xác nhận Staging trước. Chờ người dùng quyết định có cần rollback GitHub Pages về bản trước hay giữ giao diện mới.

 
### Điều chỉnh bố cục bảng Gói dịch vụ và chuẩn bảng nhiều cột — 22/11/2026
- Tiếp tục từ branch `feature/ui-table-layout-system`, tách khỏi `main`; không rollback hoặc di chuyển nhánh Production.
- Nguyên nhân nhìn thấy ở source: modal Gói dịch vụ doanh nghiệp bị cố định `min(720px,96vw)`, trong khi bảng lịch sử có 4 cột và bảng Super Admin có 6 cột, kèm min-width lớn. Ở màn hình desktop, modal quá hẹp khiến bảng bị cuộn ngang và nội dung trông như bị dồn/chật.
- Đã mở rộng modal Gói dịch vụ trên desktop lên tối đa 1120px/96vw; tablet thu về tối đa 760px; mobile dùng 96vw và giới hạn chiều cao phù hợp.
- Chuẩn hóa bố cục hai bảng Plan: khai báo tỷ lệ cột, dùng table-layout fixed, cho phép cột ghi chú wrap; cột trạng thái/ngày gọn; giữ nhóm thao tác trên một hàng. Vùng bảng có cuộn độc lập và chiều cao giới hạn.
- Bổ sung quy tắc modal/bảng nhiều cột vào `docs/UI_TABLE_STANDARD.md` để dùng cho các ứng dụng cùng hệ sinh thái.
- Files thay đổi: `src/PlanChangePanels.tsx`, `src/style.css`, `docs/UI_TABLE_STANDARD.md`.
- Chưa build/test trình duyệt; chưa deploy Staging hoặc Production. Không thay đổi nghiệp vụ, quyền, Supabase, Edge Functions hoặc dữ liệu.
- Bước tiếp theo: chạy CI/build trên branch, kiểm tra giao diện desktop/tablet/mobile; tiếp tục rà soát các bảng còn lại trước khi đề xuất merge/deploy.


### Chuẩn hóa typography toàn website — 22/11/2026
- Rà soát source cho thấy font Be Vietnam Pro đã được import và khai báo ở `:root`; vấn đề không phải thiếu font chung mà là cỡ chữ bị đặt rải rác, có nhiều quy tắc 7–10px và một khối CSS riêng trong Quản trị nền tảng.
- Giữ Be Vietnam Pro làm font giao diện duy nhất; bổ sung token `--font-family-ui` và thang chữ thống nhất: 11px chú thích, 12px nội dung phụ, 13px nội dung chính, 15px tiêu đề khu vực, 18px tiêu đề hộp thoại, 22px tiêu đề trang.
- Thêm lớp chuẩn hóa để các nhãn phụ, trạng thái, nội dung bảng, nút nhỏ và thành phần Quản trị nền tảng không còn bị thu nhỏ xuống 7–10px; giữ ngoại lệ font Tahoma cho bản in và Consolas cho mã kỹ thuật.
- Sửa JSX trùng thuộc tính `className` tại modal Gói dịch vụ; giữ class `plan-request-modal` để áp dụng đúng kích thước bảng nhiều cột.
- Cập nhật `docs/UI_TABLE_STANDARD.md` thêm chuẩn typography dùng lại cho các ứng dụng trong hệ sinh thái.
- Phạm vi chỉ CSS/JSX/tài liệu; không đổi logic nghiệp vụ, quyền, Supabase, Edge Functions hoặc dữ liệu. Chưa build và chưa kiểm tra trực quan trên browser; chưa deploy Staging/Production.

### Kiểm tra typography và build sau chuẩn hóa — 22/11/2026
- Kiểm tra lại source sau cập nhật: CSS cân bằng dấu ngoặc `{}`; font-family giao diện vẫn thống nhất Be Vietnam Pro, các khai báo font Tahoma/Consolas chỉ nằm trong vùng in và chuỗi mã kỹ thuật.
- Xác nhận JSX modal Gói dịch vụ không còn thuộc tính `className` trùng; class `plan-request-modal` vẫn được giữ.
- GitHub Actions `Validate BAOTRI Mini` run `45017871094` hoàn tất **success**, bước `npm run build` thành công ở commit `c2b4d81e6f8f4f185bf8f2669cff0e92af9b31db`.
- GitHub Actions `Build and test` run `45017871083` thất bại tại test cũ `scripts/cloudAssetPublicApi.test.mjs`: test vẫn đòi `rpc('list_cloud_assets')`, trong khi implementation hiện tại dùng RPC phân trang `list_cloud_assets_page`. Đây là assertion chưa đồng bộ, không phải lỗi build/typography; không sửa test nghiệp vụ trong phạm vi công việc này.
- PR #16 vẫn là Draft, chưa merge; không deploy Staging hoặc Production. Chưa có browser visual test trên PC/tablet/mobile.


### Đồng bộ bài kiểm thử API Cloud với RPC phân trang — 22/11/2026
- Đối chiếu CI run `45017934605` và log job: 28/29 unit tests pass; test duy nhất thất bại vì còn yêu cầu `list_cloud_assets` trong khi `src/lib/cloudAssets.ts` đã chuyển sang `list_cloud_assets_page`.
- Kiểm tra migration `20261122055755_cloud_asset_sync_pagination_and_platform_read.sql`: RPC phân trang trả dữ liệu theo `items/has_more/next_cursor`, loại UUID nội bộ khỏi response và chỉ cấp quyền execute cho authenticated.
- Cập nhật `scripts/cloudAssetPublicApi.test.mjs` để xác nhận đúng RPC phân trang, tham số keyset pagination, không SELECT trực tiếp bảng assets, và quyền/response trong migration tương ứng. Không thay đổi source nghiệp vụ, migration, Supabase hoặc dữ liệu.
- Commit sửa test: `cb3a2670c1299b10a88c195cba76020314533ecd`. Đang chờ workflow chạy lại trên commit mới; chưa kết luận CI pass.
- PR #16 vẫn Draft, chưa merge. Chưa tạo deployment Preview, chưa deploy Production; cần xác minh Vercel Preview tự động theo đúng commit mới trước khi kiểm tra trực quan.


### Chỉnh giao diện Danh mục thiết bị theo phản hồi kiểm tra Staging — 22/11/2026
- Tiếp nhận phản hồi trực tiếp trên màn hình Công ty C: một số cỡ chữ chưa đồng đều, khu vực tìm kiếm/bộ lọc chưa gọn và nút thử nghiệm “Sinh mã thử” không nên xuất hiện trong giao diện vận hành.
- Trên nhánh `feature/ui-table-layout-system`: bỏ nút “Sinh mã thử” khỏi thanh đầu trang và bỏ đường mở công cụ thử mã từ màn hình đăng nhập; không đụng tới luồng Smart Equipment ID thực tế khi tạo/lưu hồ sơ thiết bị.
- Tổ chức lại vùng tra cứu Danh mục thiết bị: ô tìm kiếm thành một hàng riêng, rộng toàn vùng; bộ lọc nhóm/vị trí/trạng thái và sắp xếp chuyển thành hàng có nhãn; nút Đặt lại nằm cùng hàng bộ lọc. Bổ sung responsive tablet/mobile và cỡ input mobile 16px để tránh tự zoom.
- Chỉ thay đổi giao diện React/CSS và đường dẫn vào tiện ích thử nghiệm; không sửa logic nghiệp vụ, dữ liệu Local/Cloud, RPC, phân quyền, migrations, Supabase hoặc Edge Functions.
- Cần CI/build và triển khai Staging đúng commit mới để người dùng kiểm tra trực quan; PR #16 vẫn Draft, không merge và không triển khai Production.


### Giữ thông tin Plan hiện tại khi API yêu cầu đổi gói gặp lỗi — 22/11/2026
- Khi mở “Thuê bao doanh nghiệp” trên Staging, trình duyệt báo `Failed to send a request to the Edge Function`; đồng thời UI còn hiển thị dòng “Tổ chức chưa có Plan hoặc Catalog Snapshot” dù trang Danh mục thiết bị của cùng phiên đang hiển thị Plan A và Catalog v1.1.0.
- Nguyên nhân UI: `OrganizationPlanPanel` chờ kiểm tra lỗi RPC/Edge Function trước khi cập nhật state Plan/Catalog. Nếu Edge Function lỗi mạng/CORS, state Plan vẫn null nên thông báo “chưa có Plan” gây hiểu nhầm.
- Sửa thứ tự: ghi nhận Plan/Catalog trả về thành công trước, sau đó mới kiểm tra lỗi đếm Cloud hoặc API yêu cầu. Nếu API yêu cầu lỗi, giữ Plan hiện tại trên màn hình và hiển thị lỗi riêng; không tự thay đổi Plan hoặc gửi yêu cầu.
- CORS: Edge Function `organization-plan-requests` bản Test trước đó chỉ được allowlist domain Staging cũ; deployment mới dùng hostname khác `baotri-mini-new-preview-mjyccbxn2-tuanluongpham-8256.vercel.app`. Cần người dùng cho phép bổ sung origin mới và deploy lại Edge Function trên đúng Supabase Test để kiểm thử luồng yêu cầu Plan. Chưa thay đổi Edge Function hoặc Supabase trong bước này.


### CORS cho giao diện Thuê bao doanh nghiệp trên Staging — 22/11/2026
- Người dùng đồng ý cập nhật CORS trên Supabase Test và đề nghị hoàn tất nhanh trên nhánh main khi đủ điều kiện.
- Project Test `dskeaiyvldiwlsfqkboq`: triển khai thành công phiên bản 3 cho hai Edge Functions `organization-plan-requests` và `platform-manage-plan-requests`; cả hai giữ `verify_jwt: true`.
- Chỉ bổ sung origin `https://baotri-mini-new-preview-mutqeu613-tuanluongpham-8256.vercel.app` vào allowlist hiện có; không dùng wildcard, không đổi xác thực, phân quyền, RPC, dữ liệu hoặc Plan.
- Đã đọc lại source sau deploy và xác nhận origin mới có trong allowlist. Chưa chạy được HTTP OPTIONS end-to-end từ môi trường thao tác hiện tại do không phân giải được hostname Supabase; cần kiểm thử trực tiếp từ trình duyệt người dùng trước khi kết luận luồng gọi API đã thông suốt.
- Đồng bộ nguyên trạng source hai Edge Functions Test phiên bản 3 vào nhánh `feature/ui-table-layout-system` để Git không còn giữ source cũ và tránh deploy sau này ghi đè mất allowlist. Không triển khai bất kỳ Edge Function nào lên Production.
- Tiếp tục giữ PR #16 Draft cho tới khi CI và staging được xác minh; chưa merge hoặc deploy Production trong bước cập nhật CORS này.


### Hoàn thiện tính nguyên tử khi tải thiết bị Cloud → Local — 22/11/2026

- Rà soát lại luồng tải Cloud → Local phát hiện một khe hở khi ghi IndexedDB: hàm `downloadCloudAsset` ghi hồ sơ Local trước rồi mới ghi `AssetCloudLink`. Nếu tab bị đóng hoặc IndexedDB lỗi giữa hai lần ghi, hồ sơ Local có thể tồn tại nhưng thiếu link; lần đồng bộ sau sẽ bảo vệ hồ sơ không link thay vì tự ghép, đúng về an toàn dữ liệu nhưng khiến thiết bị đó không tự cập nhật được.
- Sửa trên nhánh `fix/cloud-local-atomic-download`: ghi hồ sơ và Cloud link trong cùng một Dexie transaction. Nếu một bước lỗi, cả hai cùng rollback; lần retry không tạo hồ sơ Local mồ côi.
- Bổ sung unit test kiểm tra hai ghi được đặt trong cùng transaction.
- Không thay đổi RPC, migration, quyền, dữ liệu Cloud, Smart ID, UUID/mã quản lý, Local Preview hoặc luồng import. Chưa deploy và không chạm Production.
- Chờ CI/build trên branch. Sau khi đạt, tạo PR về main. Lưu ý push trực tiếp main kích hoạt GitHub Pages production workflow; vì vậy chưa push/merge main cho tới khi xử lý rõ tác động triển khai Production.


### Sửa lỗi kiểm tra khóa khi lưu thiết bị Cloud đã tải về Local — 22/11/2026
- Phản hồi thực tế: Công ty C có hai thiết bị Cloud; sau khi đồng bộ về Local, mở sửa một thiết bị và thêm ảnh thì ứng dụng báo “Không còn khóa Cloud hợp lệ; không lưu.” Người dùng xác nhận chỉ thao tác trên một máy.
- Đối chiếu `src/App.tsx` tìm thấy lỗi định danh: khi mở editor, `cloudLease.assetId` được gán bằng `asset.code` (mã quản lý dùng cho RPC khóa/heartbeat), nhưng khi lưu lại so sánh với `value.id` (UUID Local). Hai giá trị không đồng nhất với thiết bị tải từ Cloud, khiến guard từ chối lưu dù lease được cấp.
- Sửa guard so sánh `lease.assetId` với `value.code`, giữ nguyên UUID Local cho khóa IndexedDB/mutation và mã quản lý cho Cloud RPC.
- Thêm `scripts/cloudEditLeaseIdentity.test.mjs` để kiểm tra hợp đồng định danh giữa lúc cấp lease và lúc lưu.
- Thay đổi chỉ nằm trên nhánh `fix/cloud-edit-lock-code-check`; chưa merge main, chưa deploy, không thao tác Supabase hoặc dữ liệu Công ty C. Cần CI/build và kiểm tra Staging trước khi đề xuất merge.


### Chuẩn hóa xem ảnh phóng to dùng chung toàn ứng dụng — 22/11/2026
- Đã rà soát toàn bộ mã nguồn giao diện: các ảnh nghiệp vụ hiện có nằm ở màn hình chỉnh sửa thiết bị và Chi tiết thiết bị; chưa có thành phần ảnh Cloud riêng vì ảnh hiện vẫn lưu Local.
- Thêm thành phần dùng chung `ImageLightbox`: nhấn thumbnail để mở ảnh trong lớp phủ toàn màn hình; vùng xem tối đa 90vw × 85vh (giới hạn 1200 × 820px), giữ nguyên tỷ lệ ảnh bằng `object-fit: contain`.
- Hỗ trợ đóng bằng nút X, nhấn nền ngoài ảnh hoặc phím Esc; điều hướng ảnh trước/sau bằng nút và phím mũi tên; có nhãn thứ tự ảnh và hỗ trợ giảm kích thước trên màn hình nhỏ.
- Áp dụng cho thumbnail trong màn hình chỉnh sửa và ảnh trong Chi tiết thiết bị. Không thay đổi dữ liệu ảnh, nén ảnh, IndexedDB, luồng mutation hoặc đồng bộ Cloud; ảnh vẫn chỉ lưu Local như hiện tại.
- Thực hiện trên nhánh `feature/unified-image-lightbox`; chưa merge main, chưa triển khai Production.


## Xóa mềm thiết bị – Admin only (22/11/2026, đang chờ kiểm thử)
- Tách trường `deletedAt/deleted_at` khỏi `archivedAt/archived_at`; không dùng Lưu kho làm trạng thái xóa.
- Admin mới có nút xóa và chế độ tìm/xem thiết bị đã xóa; dấu nhận diện đỏ `ĐÃ XÓA`. Chưa triển khai khôi phục.
- Xóa chỉ áp dụng với thiết bị đã liên kết Cloud và đang có kết nối; Local ghi snapshot + mutation queue trước, Cloud xác nhận bằng RPC riêng, khóa chỉnh sửa, optimistic timestamp và receipt. Nếu Cloud chưa xác nhận, giữ mutation pending để retry.
- Migration thêm `assets.deleted_at`, RPC xóa mềm, tombstone sync cho KTV (chỉ trả mã/trạng thái xóa, không trả hồ sơ), và lọc RLS/list để non-Admin không đọc được hồ sơ đã xóa.
- Không xóa vật lý bản ghi thiết bị hoặc lịch sử liên quan. Không sửa dữ liệu Supabase Production.
- Migration đã áp dụng thành công lên Supabase Test `BAOTRI Mini New` (`dskeaiyvldiwlsfqkboq`), ghi nhận version `20261122133229` / `admin_soft_delete_assets`; xác minh cột `deleted_at`, helper Admin, RPC xóa mềm, RPC tombstone và policy RLS đều tồn tại.
- Cần CI build/test và kiểm thử thực tế Admin xóa → Cloud → PC/Mobile khác đồng bộ; KTV không thấy/tìm được; Admin tìm thấy; xác nhận hồ sơ/lịch sử vẫn còn.


### Bổ sung trạng thái thiết bị, lịch sử hoạt động, xóa mềm và quyền Người xem — 22/11/2026

- Thêm trạng thái `Lưu kho` vào danh mục trạng thái thiết bị; trong Chi tiết thiết bị có chức năng Thay đổi trạng thái, chỉ tiếp tục phiên chỉnh sửa khi đã có quyền và khóa Cloud hợp lệ.
- Đồng bộ `Lưu kho` với `archivedAt/archived_at` để tương thích danh sách lưu kho, khôi phục và Cloud; không sử dụng trạng thái Lưu kho thay cho xóa mềm.
- Bổ sung lịch sử hoạt động thiết bị Local (Dexie v6): tạo mới, cập nhật hồ sơ, đổi trạng thái, lưu kho, khôi phục, xóa mềm; ghi giá trị trước/sau, không lưu nội dung ảnh.
- Bổ sung lịch sử Cloud append-only, RPC ghi lịch sử giới hạn Admin/KTV, RLS đọc theo quyền `assets.view`; lịch sử thiết bị đã xóa chỉ Admin có quyền `assets.delete` được xem.
- Cập nhật `private.apply_asset_mutation_with_lock` để chấp nhận trạng thái Lưu kho và chặn Viewer ở tầng DB; đóng gói `private.lock_asset_anchor` để tránh phụ thuộc PR #19 chưa merge.
- App đồng bộ lịch sử Cloud theo ID mutation để tránh ghi trùng; giữ lịch sử Local pending khi Cloud chưa sẵn sàng.
- Viewer chỉ đọc; không được thêm, sửa, lưu kho, xóa, chỉnh sửa hồ sơ cá nhân hoặc thao tác draft. Kiểm tra quyền tại handler, không chỉ ẩn nút.
- Xóa mềm thiết bị dành riêng cho Admin; dùng `deleted_at` độc lập với `archived_at`. Thiết bị xóa được đánh dấu `ĐÃ XÓA`; non-Admin không được đọc hồ sơ đã xóa. Không xóa vật lý thiết bị hoặc lịch sử.
- Migration xóa mềm đã áp dụng trên Supabase Test `BAOTRI Mini New` (`dskeaiyvldiwlsfqkboq`), version `20261122133229` / `admin_soft_delete_assets`.
- Migration lịch sử `asset_activity_history` đã áp dụng trên Supabase Test, version `20261122141731`; đã xác minh bảng, RPC, RLS, policy và ACL: anon không được SELECT/EXECUTE; authenticated truy cập theo RLS và kiểm tra quyền trong RPC.
- Đã bỏ nút Lưu kho riêng khỏi danh sách thiết bị; thao tác thay đổi trạng thái thực hiện trong form Sửa. Danh sách lưu kho vẫn hỗ trợ Khôi phục.
- Cập nhật hiển thị trạng thái danh sách: thiết bị xóa mềm hiển thị `ĐÃ XÓA` màu đỏ; lưu kho màu xám; đang hoạt động màu xanh; đang sửa chữa màu cam; thanh lý màu đỏ.
- PR #21 `admin-soft-delete-assets` đang OPEN, chưa merge tại checkpoint này. Head `314b762a414d5c2f111d92c9b366da92b92fc8f8`; base `66a75b0b10b5aafc5f149737f6bacf926b96c50c`.
- CI trên head PR #21 đã pass: Validate run `45031764581`; Build and test run `45031764540`. Chưa kiểm thử trình duyệt E2E thực tế.
- Supabase Security Advisor còn cảnh báo SECURITY DEFINER trên một số RPC; đã ghi nhận, chưa mở rộng xử lý ngoài phạm vi PR.
- Chưa merge PR #21; không thay đổi main/Production. Chỉ làm việc với Supabase Test.

#### Trạng thái workspace Local ngày 23/11/2026
- Thư mục local `E:\BaoTri_Mini`, branch `feature/admin-soft-delete-assets`, HEAD `314b762` tại checkpoint trước khi cập nhật tài liệu.
- `TIENDO.md`: đã cập nhật checkpoint này.
- `src/App.tsx`: có thay đổi local về màu/nhãn status badge; đã rà soát logic và ghi nhận cần giữ lại.
- `.env.local`: file local untracked; giữ nguyên trên máy, tuyệt đối không add/commit/push.
- Trước cập nhật tài liệu trên GitHub, các thay đổi local chưa commit/push. Cần đồng bộ branch qua GitHub Desktop và kiểm tra tránh ghi đè thay đổi local.
- Bước tiếp theo: chạy app Local và kiểm thử thực tế Admin/KTV/Viewer theo checklist.


### Rà soát đồng bộ Cloud deletion — 23/11/2026
- Phát hiện lỗi: luồng Cloud → Local nhận `deleted_at` từ trang assets hoặc tombstone và ghi đè `updatedAt` Local, đồng thời đặt link thành `linked` kể cả khi Local có thay đổi chưa đồng bộ hoặc mutation đang chờ. Luồng tombstone còn có thể đánh dấu xóa Local theo mã thiết bị dù không có liên kết Cloud hợp lệ.
- Đã sửa trên nhánh `fix/cloud-delete-sync-preserve-local`:
  - Dùng một hàm reconcile chung cho deletion từ trang Cloud và tombstone.
  - Chỉ áp dụng tombstone khi có liên kết đúng organization/asset/code.
  - Nếu Local có phiên bản mới hơn, mutation pending/processing/conflict, hoặc link đã conflict: phản ánh dấu xóa Cloud nhưng giữ nguyên Local `updatedAt`, giữ nguyên nội dung, chuyển link/mutation sang conflict để người dùng đối chiếu.
  - Nếu không có thay đổi Local: áp dụng dấu xóa và cập nhật mốc đồng bộ bình thường.
  - Tránh tạo conflict record trùng khi mutation pending/processing đã tồn tại.
  - Không cho chọn “Chọn Local” để ghi đè Cloud đã xóa mềm vì hiện chưa có RPC khôi phục thiết bị đã xóa trên Cloud; giao diện chỉ cho chọn Cloud trong trường hợp này.
- Thêm regression test cho bảo toàn Local, kiểm tra liên kết tombstone và chặn conflict resolution không hợp lệ.
- Build and test + Validate BAOTRI Mini đều **success** tại head `698570f7bd550267160709f165ad9e37fa43fa5e` (Build run 479, Validate run 191). Regression tests và TypeScript/Vite build đều pass.
- Chỉ thay đổi repository/tests; không thay Supabase Test/Production, dữ liệu, Edge Functions hoặc deploy. Chưa chạy browser E2E.
- Rà soát bổ sung: hai vòng lặp phân trang `listCloudAssets` và `syncCloudAssetsToLocal` trước đây chỉ kiểm tra cursor rỗng; nếu API lặp lại cursor hợp lệ, vòng lặp có thể chạy mãi. Đã thêm tập cursor đã thấy và dừng có thông báo khi cursor bị lặp; bổ sung regression test.
- Phát hiện thêm khác biệt phân quyền: KTV chỉ nhận tombstone code/date, không được xem hồ sơ thiết bị đã xóa trên Cloud. Conflict panel trước đây chỉ nhìn danh sách Cloud nên có thể hiện sai lựa chọn “Chọn Local” hoặc cho thao tác không khả thi. Đã bổ sung tải tombstone metadata trong panel; nếu KTV không có quyền xem hồ sơ deleted thì ẩn cả hai lựa chọn và yêu cầu Admin xác nhận. Khi xử lý Local, luôn xác minh lại tombstone từ RPC trước khi ghi Cloud.
- Rà soát retry: mutation `pending` trước đây chỉ được retry thủ công trong Cloud panel; mutation bị kẹt ở `processing` sau khi tab/trình duyệt đóng cũng không tự phục hồi. Đã bổ sung tự retry sau lần đồng bộ đầu và khi trình duyệt phát sự kiện `online`, chỉ cho tài khoản có `assets.update`; xử lý `pending` và `processing` đã cũ hơn 60 giây. Mỗi lần retry vẫn đi qua Cloud edit lock + mutation receipt idempotent; conflict không được tự retry. Thêm regression test.
- CI cuối cùng sau phần tự retry và xử lý tombstone theo quyền: Build and test **success** (run 489), Validate BAOTRI Mini **success** (run 201) tại commit `e881a6ee82295a45c93512c52bfff108b94d6316`. Commit sau đó chỉ chỉnh tài liệu TIENDO.
