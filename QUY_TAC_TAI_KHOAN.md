# QUY TẮC TÀI KHOẢN — BAOTRI Mini

Cập nhật: 21/11/2026  
Repo: `Vodanhhp/BaoTri_Mini` — branch `main`  
Tài liệu này là bản ghi tập trung về **quy tắc nghiệp vụ, quyền, bảo mật và hành vi tài khoản**. Khi tiếp tục phát triển tài khoản, đăng nhập, tổ chức, phân quyền hoặc quản trị, hãy đọc file này trước và đối chiếu code/migrations hiện tại. `TIENDO.md` vẫn là nhật ký tiến độ chính.

---

## 1. Nguyên tắc nền tảng

- Không có đăng ký tài khoản tự do (public signup). Tài khoản được tạo/mời theo luồng có kiểm soát.
- Người dùng phải xác thực bằng Supabase Auth. Không tự tạo cơ chế lưu mật khẩu riêng.
- **Tách tenant theo organization UUID**: dữ liệu, membership, quyền và thao tác phải thuộc đúng tổ chức đang làm việc. Không cho truy cập chéo tổ chức.
- Backend (RLS, RPC, Edge Function) là nguồn quyết định quyền thực tế. Ẩn/hiện UI chỉ là UX, không phải cơ chế bảo mật.
- Không cấp quyền dựa trên user metadata do người dùng tự sửa, email hiển thị ở client, hoặc trạng thái UI. Những quyền đặc biệt phải xác minh ở server.
- Không đưa service-role/secret key, mật khẩu hoặc token vào frontend, repo hay tài liệu.
- Mọi thay đổi tài khoản phải hạn chế đúng phạm vi; không thay đổi chức năng/dữ liệu module khác nếu không cần.

## 2. Các khái niệm cần phân biệt

### Auth user
Tài khoản đăng nhập do Supabase Auth quản lý, định danh bằng Auth user ID (UUID). Email và mật khẩu thuộc Auth; mật khẩu không được lưu/đọc trong bảng nghiệp vụ.

### Profile
Thông tin hồ sơ gắn với Auth user ID. Profile không đồng nghĩa membership và không tự cấp quyền vào tổ chức.

### Organization
Doanh nghiệp/tenant. Trạng thái tổ chức có thể active hoặc suspended. Tổ chức suspended không được coi là tổ chức làm việc hợp lệ.

### Organization membership
Liên kết Auth user với một tổ chức, có trạng thái riêng. Membership không đồng nghĩa role; vai trò và quyền thực tế lấy từ RBAC assignments.

### Role / Permission
Role là nhóm quyền trong một tổ chức; permission là quyền nhỏ nhất để cho phép một hành động. Phải kiểm tra assignment và phạm vi organization.

## 3. Trạng thái và khả năng vào tổ chức

- Membership `active`: có thể được xét để vào tổ chức nếu tổ chức cũng active.
- Membership `invited`: chưa được xem là thành viên làm việc hợp lệ; chờ người được mời xác nhận email/hoàn tất kích hoạt theo luồng hiện hành.
- Membership `suspended`: không được vào/hoạt động trong tổ chức.
- Organization `suspended`: không được vào tổ chức, dù membership người dùng còn active.
- Chỉ các organization context có membership active **và** organization active mới được đưa vào lựa chọn sau đăng nhập.
- Không tự chọn organization đầu tiên nếu người dùng có nhiều tổ chức hợp lệ.

## 4. Quy tắc chọn tổ chức sau đăng nhập

1. Đăng nhập Auth thành công, tải danh sách organization context hợp lệ của user.
2. Nếu có đúng **1 tổ chức hợp lệ**, tự động vào tổ chức đó.
3. Nếu có **2 tổ chức trở lên**, hiển thị màn hình **Chọn tổ chức làm việc**; người dùng phải chọn trước khi vào màn hình nghiệp vụ.
4. Nếu không có tổ chức hợp lệ, không tự tạo tổ chức hoặc tự cấp quyền; hiển thị trạng thái phù hợp và hướng dẫn.
5. Không có dropdown chuyển tổ chức trong phiên làm việc. Muốn đổi tổ chức: đăng xuất, đăng nhập lại và chọn tổ chức khác.
6. Organization đang chọn là phạm vi của Local data, Cloud data, RBAC và nghiệp vụ. Không để context hoặc dữ liệu tenant cũ lộ tạm thời khi đổi user: xóa context/organization ID phiên trước trước khi tải context user mới.
7. Mọi truy vấn/backend vẫn phải xác minh tenant; lựa chọn organization trên client không đủ để cấp quyền.

## 5. Ba role mặc định

Các role built-in của mỗi tổ chức được seed tự động khi tạo organization:

| Role | Code | Ý nghĩa |
|---|---|---|
| Admin | `admin` | Quản trị toàn bộ chức năng trong tổ chức |
| Kỹ thuật viên | `technician` | Thực hiện nghiệp vụ kỹ thuật; không có quyền quản trị người dùng/role hay cấu hình quản trị |
| Người xem | `viewer` | Quyền xem, read-only |

- Catalog hiện có 27 permission codes (bao gồm `assets.import`). Role grants được seed: Admin 27, Technician 17, Viewer 10; cần đối chiếu migration/RBAC thực tế nếu thay đổi catalog.
- Viewer là read-only: không cấp quyền tạo/sửa/xóa/điều chỉnh nghiệp vụ.
- Technician không được quản trị Users/Roles, cấu hình quản trị, hoặc các quyền xóa ngoài grants được định nghĩa.
- Admin có quyền trong **tổ chức hiện tại**, không mặc nhiên là Super Admin nền tảng.
- Không gán role bằng cách ghi role name vào cột legacy nếu schema không cho phép. Schema hiện tại: `organization_members.role` legacy chỉ chấp nhận `admin` hoặc `user`; Technician/Viewer phải thông qua `member_roles` + `roles.code`.
- Khi đổi role, chỉ đổi role assignment, không tự đổi membership status. User đang suspended phải vẫn suspended; invited vẫn invited.

## 6. Mời thành viên và kích hoạt

- Chỉ Admin của organization hiện tại, với permission/backend authorization phù hợp (`users.manage`), được quản lý thành viên trong tổ chức đó.
- Luồng mời nhập email và role được phép; backend kiểm tra JWT, quyền Admin và organization scope, không tin dữ liệu client.
- Người mới nhận invitation email; xác nhận email và đặt mật khẩu lần đầu theo luồng Auth. Membership được tạo trạng thái invited và chuyển active theo trigger sau khi email được xác nhận, theo implementation hiện hành.
- Người đã có Auth user và đã xác nhận có thể được thêm vào tổ chức theo luồng quản trị; người tồn tại nhưng chưa xác nhận cần chờ xác nhận/luồng mời phù hợp.
- Nếu email invitation lỗi hoặc chưa được xác nhận, không tự ý nâng membership thành active để bỏ qua quy trình.
- Resend invitation có thể cần thao tác từ Supabase Dashboard trong trường hợp user chưa xác nhận và đã tồn tại, theo ghi chú triển khai hiện tại.
- Không tự tạo password thay cho người được mời hoặc gửi password qua chat/email quản trị.

## 7. Quản lý thành viên trong tổ chức

Admin có thể (theo UI/backend đã triển khai) xem danh sách/thống kê, tìm thành viên, mời, quản lý trạng thái, đổi role Technician ↔ Viewer và các thao tác quản lý thành viên được hỗ trợ.

Quy tắc an toàn:
- Tất cả thao tác giới hạn trong organization đang quản lý.
- Backend xác minh token thật, actor có membership active và quyền Admin; target phải thuộc organization.
- Không cho tự đổi role (self role-change).
- Không cho đổi role của Admin qua luồng Technician/Viewer; không chấp nhận role lạ, role không active, assignment bất thường hoặc target có nhiều role assignments nếu backend quy định từ chối.
- Không cho thao tác khi actor không phải Admin.
- Việc xóa membership không đồng nghĩa xóa Auth user hay profile; user có thể còn tài khoản và memberships ở tổ chức khác.
- Đổi role không tự kích hoạt membership, không bỏ suspension và không đổi trạng thái invited.
- Nếu đổi role thất bại, backend phải báo lỗi; implementation có cơ chế cố khôi phục assignment cũ khi bước gán role mới thất bại.

## 8. Hồ sơ cá nhân và thông tin đăng nhập

Mọi tài khoản đã đăng nhập có thể:
- Cập nhật họ tên, số điện thoại.
- Cập nhật ngày sinh.
- Tự yêu cầu đổi email đăng nhập; email mới chỉ có hiệu lực sau khi hoàn thành xác nhận của Supabase.
- Tự đổi mật khẩu qua Supabase Auth.

Lưu trữ/hiển thị:
- Họ tên và số điện thoại lưu ở profile theo Auth user ID.
- Ngày sinh lưu trong Auth user metadata, không thêm vào bảng profile có chính sách đọc hồ sơ thành viên cùng tổ chức, nhằm tránh lộ ngày sinh.
- Email và password thuộc Supabase Auth; không lưu password dạng plaintext.
- Tên hiển thị topbar ưu tiên `profiles.display_name`, fallback `user_metadata.full_name`, cuối cùng là email.
- Khi lưu hồ sơ, phải kiểm tra kết quả cập nhật thực sự có bản ghi; thông báo lỗi phải hiển thị nội dung hữu ích, không ép object thành chuỗi `[object Object]`.
- Nếu một phần cập nhật thành công và phần khác thất bại (ví dụ profile lưu nhưng metadata ngày sinh lỗi), phải thông báo rõ phần nào đã lưu/phần nào chưa, không báo thành công chung.

## 9. Super Admin / quản trị nền tảng

- Super Admin là quyền quản trị **nền tảng**, khác Admin của từng organization.
- Quyền Super Admin hiện dựa trên owner allowlist được kiểm tra ở server (Edge Function); UI cũng giới hạn hiển thị, nhưng UI không phải bảo vệ chính.
- Không dùng user metadata do client sửa để xác định Super Admin. Backend xác minh JWT/Auth user thật và owner allowlist.
- Super Admin có thể tạo tổ chức/khách hàng, quản lý vòng đời organization: suspend, reactivate, permanent delete theo chức năng đã triển khai.
- Tạo khách hàng: nhập organization name và email Admin đầu tiên; nếu Auth user đã tồn tại và verified thì có thể gắn membership; nếu user mới thì gửi invite; nếu user hiện hữu chưa verified thì membership chờ trạng thái invited. Organization mới tự seed 3 built-in roles/grants.
- Không tự động thêm owner/Super Admin vào organization khách hàng nếu luồng không yêu cầu.
- Các thao tác lifecycle tổ chức yêu cầu xác thực lại mật khẩu; backend xác minh đúng Auth user ID/token và yêu cầu xác nhận hành động. Không lưu mật khẩu hoặc trả session phụ về client.
- Xóa vĩnh viễn organization yêu cầu nhập đúng tên tổ chức và xác nhận; chỉ owner Super Admin. Thao tác backend xóa dữ liệu tenant theo thứ tự FK đã thiết kế, không xóa Auth users hoặc profiles.
- Suspend organization chỉ đổi status, giữ dữ liệu; reactivate chuyển status về active.
- Organization suspended phải bị chặn Cloud access qua membership/RLS/helper, kể cả session đăng nhập còn tồn tại.
- Xóa organization **không xóa dữ liệu Local IndexedDB đã tải trên thiết bị**; UI cần cảnh báo rõ.
- Không thử xóa organization thật đang sử dụng. Kiểm thử destructive chỉ trên fixture/organization thử và rollback khi phù hợp.

## 10. UI và giới hạn thiết bị

- Hồ sơ cá nhân có thể truy cập từ Cài đặt và shortcut thẻ tài khoản/topbar.
- Quản lý tài khoản tổ chức và Quản trị nền tảng đặt trong Cài đặt/sidebar.
- Các màn hình thao tác quản trị account/organization được thống nhất **PC-only** (desktop/laptop); không hỗ trợ thao tác quản trị trên điện thoại/tablet.
- Mobile vẫn có menu hamburger/drawer, điều hướng, submenu Cài đặt và truy cập Hồ sơ cá nhân; không mở chức năng quản trị.
- UI responsive/ẩn mục chỉ là giới hạn trải nghiệm; backend vẫn phải từ chối request trái quyền dù gọi trực tiếp API.
- Không thay đổi chính sách PC-only nếu không có yêu cầu rõ ràng.

## 11. Bảo mật và kiểm tra bắt buộc khi sửa account code

Checklist trước khi merge/deploy:
- [ ] Không mở public signup.
- [ ] JWT/Auth user được xác minh ở backend; không tin client-supplied user ID, role, organization, metadata.
- [ ] Tenant scope đúng organization; kiểm tra cả organization active và membership active.
- [ ] RLS/policies/RPC/Edge Functions không cấp quyền vượt role.
- [ ] Super Admin allowlist xác minh server-side.
- [ ] Không lộ secret/service-role key; không lưu password/token.
- [ ] Invitation/activation giữ đúng trạng thái invited → active theo xác nhận email.
- [ ] Role change không bypass membership status; chỉ Technician/Viewer theo rule; cấm self/Admin/role invalid.
- [ ] Profile privacy: ngày sinh không lộ qua profile table; email change có confirmation; password dùng Auth.
- [ ] Organization suspend/re-activate/delete được bảo vệ và đúng semantics; xóa vĩnh viễn cần re-auth + đúng tên.
- [ ] Khi đổi user, clear context tenant cũ ngay để tránh rò dữ liệu tạm thời.
- [ ] Build/CI thành công; test các trường hợp quyền được phép và bị từ chối; kiểm tra PC/mobile.
- [ ] Chỉ thay đổi phạm vi account/admin khi user yêu cầu cụ thể; module đã chốt không tự mở lại.

## 12. Trạng thái đã chốt / các lưu ý kiểm thử

Ngày 21/11/2026, người dùng xác nhận **đã chốt phần Tài khoản và Quản trị**. Không tiếp tục chỉnh sửa phần này nếu không có yêu cầu cụ thể.

- Profile; quản lý thành viên organization; đổi Technician/Viewer; Super Admin create/suspend/reactivate/delete organization; organization chooser; settings/sidebar; mobile drawer và giới hạn PC-only được ghi nhận hoàn tất theo TIENDO.
- CI Build and test run `44872238366` và Pages deploy run `44872238426` success tại commit `6c3146839bdf51db8c7d92747c7cda38b221f20`.
- Production URL: https://baotri.vieclamhp247.com/
- Đừng nhầm kiểm thử SQL transaction rollback với kiểm thử E2E bằng user thật. Một số chức năng từng được ghi nhận chưa E2E đầy đủ (ví dụ invitation email, đổi role qua UI/quyền thực tế, lifecycle với tổ chức test, PC/mobile flows). Trước khi tuyên bố test E2E hoàn tất, phải đọc TIENDO cập nhật và xác minh test mới.
- TIENDO là nhật ký tiến độ/commit/deploy chi tiết; file này là **quy tắc và ngữ cảnh nghiệp vụ account**. Nếu có thay đổi mới, cập nhật cả hai khi thích hợp.

---

## 13. Cách dùng tài liệu khi mở phiên sau

Khi tiếp tục BAOTRI Mini và đụng tới account/auth/profile/organization/RBAC/invitation/admin:
1. Đọc file này trước để nắm quy tắc đã thống nhất.
2. Đọc phần mới nhất trong `TIENDO.md` để biết trạng thái thực tế và những thay đổi sau ngày tài liệu.
3. Đối chiếu source code, migrations, Edge Functions và Supabase hiện trạng trước khi sửa. Tài liệu không thay thế xác minh implementation.
4. Không hỏi lại các quy tắc đã ghi rõ; chỉ hỏi khi có mâu thuẫn thật hoặc quyết định mới cần người dùng xác nhận.
5. Mọi thay đổi phải giữ nguyên các nguyên tắc trên hoặc ghi rõ đề xuất thay đổi để user quyết định.
