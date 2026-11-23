# Thiết kế RESET toàn bộ thiết bị theo tổ chức — Superadmin

Ngày chốt yêu cầu: 23/11/2026

## Mục tiêu

Superadmin có thể yêu cầu reset một tổ chức. Sau reset:
- Hồ sơ thiết bị trên Cloud bị xóa vật lý.
- Mọi Local cài BAOTRI Mini trên các nền tảng xóa dữ liệu thiết bị của đúng tổ chức khi nhận được generation reset mới.
- Máy offline không được phép đồng bộ snapshot thiết bị cũ lên Cloud khi kết nối lại.
- Nhật ký kiểm toán được giữ; danh mục thiết bị, tài khoản, vai trò, quyền, gói dịch vụ và cấu hình tổ chức không bị thay đổi.

Không reset Local Preview hoặc dữ liệu của tổ chức khác.


## Quy trình yêu cầu và duyệt Reset — cập nhật 23/11/2026

Reset không còn là thao tác trực tiếp của Superadmin tại bảng tổ chức.

1. Admin doanh nghiệp mở **Cài đặt → Gói dịch vụ → Yêu cầu Reset toàn bộ thiết bị**, nhập lý do (không bắt buộc) và xác nhận đã hiểu hậu quả.
2. Backend kiểm tra membership Admin đang hoạt động, tổ chức đang hoạt động; ghi yêu cầu pending, người gửi, thời điểm, lý do, số hồ sơ Cloud và số Local đã đăng ký tại thời điểm gửi. Mỗi tổ chức chỉ có một yêu cầu pending/approved cùng lúc.
3. Superadmin mở **Quản trị nền tảng → Duyệt yêu cầu → Yêu cầu Reset toàn bộ thiết bị**, xem thông tin và số liệu trước khi quyết định.
4. Superadmin có thể từ chối (ghi phản hồi) hoặc duyệt. Duyệt yêu cầu mật khẩu Superadmin và xác nhận lần cuối. Backend khóa yêu cầu, ghi người duyệt, gọi reset RPC trong transaction và chỉ ghi executed sau khi reset thành công. Nếu reset lỗi, transaction con rollback và yêu cầu ghi failed kèm lỗi; không thông báo thành công.
5. Doanh nghiệp xem được trạng thái và phản hồi trong lịch sử yêu cầu.

Trạng thái: pending (Chờ duyệt), approved (đang xử lý trong transaction duyệt), executed (Đã thực hiện), rejected (Từ chối), failed (Thực hiện thất bại). Trong thao tác duyệt đồng bộ, approved là trạng thái chuyển tiếp nội bộ; trạng thái cuối cùng được lưu là executed hoặc failed.

Bảo mật: hai Edge Function mới đều yêu cầu JWT; endpoint doanh nghiệp chỉ nhận yêu cầu từ Admin active của đúng tổ chức; endpoint duyệt chỉ cho Superadmin đã xác thực email và yêu cầu re-auth mật khẩu. RPC create/list/review chỉ EXECUTE bởi service_role; không cấp quyền cho anon hoặc authenticated. Endpoint Reset trực tiếp cũ trả HTTP 410 để các client cũ không thể bỏ qua quy trình.

Migration 20261123150000_organization_asset_reset_approval_workflow đã apply trên Supabase Test BAOTRI Mini New. Bảng yêu cầu hiện có 0 dòng sau triển khai; không có yêu cầu hoặc dữ liệu thiết bị nào bị tạo/xóa bởi migration. Hai Edge Function mới ACTIVE với verify_jwt=true; Edge Function Reset trực tiếp cũ đã được vô hiệu hóa bằng HTTP 410. Chưa chạy browser E2E với tài khoản Admin/Superadmin thực tế.

## Giao diện

Admin doanh nghiệp gửi yêu cầu trong khu vực Gói dịch vụ. Superadmin xử lý yêu cầu trong bảng Duyệt yêu cầu; không còn nút Reset trực tiếp ở từng dòng tổ chức. Khi duyệt, Superadmin xác thực lại mật khẩu và xác nhận thao tác.

## Giao thức reset

### Cloud authority
- Dùng generation tăng đơn điệu theo tổ chức, không dùng timestamp làm nguồn chân lý.
- Một reset request có UUID idempotency; retry cùng request không chạy reset lần hai.
- Trong một transaction: khóa tổ chức; ghi reset audit; tăng generation; xóa Cloud assets và các receipt/lock gắn thiết bị; xóa hoặc vô hiệu hóa reservation chưa hoàn tất; giữ bộ đếm sequence để không tái sử dụng mã quản lý; commit cùng generation mới.
- Giữ asset_activity_history và private.asset_group_change_history; cho phép asset_id NULL và đặt NULL trước khi xóa asset. Giữ nguyên asset_code, actor, thời điểm, summary, changes.
- Giữ nguyên organization equipment catalog, roles, permissions, memberships, plan, plan history, organization config.
- Lưu reset audit độc lập: organization, generation, request UUID, actor Superadmin, thời điểm, số Cloud assets xóa.

### Local authority and all platforms
- Mỗi installation tiếp tục dùng device ID hiện tại (baotri-mini-device-id) và đăng ký/cập nhật last-seen trên Cloud.
- Trước khi load dữ liệu tenant, import, lấy khóa sửa, Cloud sync/retry/audit mirror, và khi app nhận sự kiện online/focus, client đăng ký/đọc generation hiện tại.
- Nếu generation trên Cloud lớn hơn generation đã xử lý tại Local, thực hiện transaction Dexie theo organization scope:
  - Xóa assets (bao gồm ảnh data URL nằm trong hồ sơ).
  - Xóa assetCloudLinks, assetMutations, assetDrafts.
  - Giữ assetHistory; giữ assetGroupChanges nhưng không để các event pending cũ tự đồng bộ lại.
  - Không xóa Local Preview hoặc scope tổ chức khác.
- Chỉ ghi nhận Local đã áp dụng generation sau khi transaction xóa thành công; sau đó gửi acknowledgement lên Cloud.
- Khi offline, Local không thể nhận lệnh tức thời. Khi online trở lại, phải kiểm tra và áp dụng reset trước mọi Cloud sync/retry. Không báo reset hoàn tất toàn hệ thống nếu còn device đã đăng ký chưa acknowledge.

### Chống dữ liệu cũ sống lại
- Reset generation là mốc server-side.
- Các RPC ghi quan trọng mang `p_reset_generation`; server khóa hàng generation bằng `FOR SHARE` khi import/mutation/audit và reset khóa `FOR UPDATE`, vì vậy thao tác cũ không thể chạy xuyên qua reset.
- Giữ chữ ký RPC cũ ở chế độ tương thích chỉ khi generation = 0 để tránh gián đoạn trước lần reset đầu tiên; sau khi generation tăng, server từ chối các bundle cũ. RPC mới dùng tên riêng hậu tố `_v2` (không overload cùng tên) và bắt buộc mang generation hiện hành; private implementation không được authenticated gọi trực tiếp.
- Mutation update của asset cũ sẽ thất bại vì asset đã bị xóa; reservation đang reserved được chuyển released, còn confirmed reservation history và sequence counters được giữ.
- Client mới bắt buộc purge trước khi đồng bộ hoặc retry mutation; Local snapshot phải còn tồn tại và đúng phiên bản trong IndexedDB trước khi được gửi lên Cloud.
- Không có thao tác nào tự động tải lại hồ sơ từ backup cũ sau reset.

## Phạm vi dữ liệu

| Dữ liệu | Sau reset |
|---|---|
| public.assets và hồ sơ Local theo organization | Xóa |
| Ảnh nằm trong hồ sơ Local | Xóa cùng hồ sơ |
| Cloud import/mutation receipts, edit locks | Xóa |
| Local Cloud links, mutations, drafts | Xóa |
| Lịch sử hoạt động Cloud/Local | Giữ |
| Lịch sử đổi nhóm thiết bị | Giữ |
| Catalog thiết bị tổ chức | Giữ |
| Tài khoản, membership, role, permission | Giữ |
| Plan và cấu hình tổ chức | Giữ |
| Sequence counters và confirmed reservation history | Giữ để tránh tái sử dụng mã |
| Reservation đang chờ | Chuyển released |

## Theo dõi thiết bị

Bảng đăng ký device lưu organization, device ID, user, nhãn nền tảng, last-seen, generation đã acknowledge và số hồ sơ Local gần nhất (chỉ dùng thống kê). Dashboard báo:
- Đã reset Cloud.
- Bao nhiêu Local đã acknowledge generation mới.
- Bao nhiêu Local đã đăng ký còn chờ.
- Thời điểm last-seen của từng Local.
- Lưu ý: số thiết bị là số đã đăng ký bằng phiên bản hỗ trợ reset. Các installation cũ chưa chạy bản mới chưa thể xuất hiện trong registry; khi mở bản mới và kết nối bằng tài khoản còn quyền truy cập, chúng sẽ đăng ký, purge và acknowledge. Thiết bị đã đăng ký trước đó vẫn có thể acknowledge sau khi user bị gỡ membership. RPC legacy sẽ bị server từ chối sau khi generation tăng, kể cả khi installation chưa được registry nhận diện.

Thiết bị không kết nối được không thể bị xóa vật lý từ xa tại thời điểm reset; trạng thái phải là **Chờ thiết bị kết nối**, không được giả mạo là đã xóa.

## An toàn và kiểm thử bắt buộc

- Chỉ Edge Function xác thực Superadmin được gọi reset RPC; không cấp EXECUTE cho anon/authenticated.
- Xác thực lại mật khẩu và tên tổ chức.
- Khóa theo organization và idempotency request.
- Transaction rollback toàn bộ nếu có lỗi; không xóa một phần.
- Test: reset tổ chức A không ảnh hưởng B; giữ audit/catalog/membership/plan; xóa receipts/assets; retry cùng request id; máy online purge; máy offline reconnect purge trước sync; old client import snapshot cũ bị từ chối; Local Preview không đổi; mất mạng trong lúc reset không tạo thông báo thành công sai.

## Trạng thái triển khai — 23/11/2026

- Đã khảo sát schema Supabase Test ở chế độ chỉ đọc: các FK từ Cloud audit/group history, import/mutation receipts và edit locks tới assets; xác nhận sequence reservations và counters.
- Đã tạo migration nguồn `20261123130000_superadmin_organization_asset_reset.sql`: state generation, device registry, idempotent reset audit, reset/status RPC, các RPC import/mutation/soft-delete/audit tên riêng hậu tố `_v2`, giới hạn legacy signatures ở generation 0, giữ audit và sequence history.
- Đã thêm Edge Function `platform-reset-organization-assets` với xác thực Superadmin, re-auth password, xác nhận tên tổ chức và request UUID.
- Đã thêm nút Reset thiết bị và modal xác nhận ở Superadmin.
- Đã thêm Dexie v7 reset state; Local guard purge theo organization scope, giữ history dưới trạng thái `local_only`, acknowledge sau transaction; chặn thao tác với Local snapshot cũ.
- Đã thêm regression tests nguồn tại `scripts/organizationAssetReset.test.mjs`.
- Migration chỉ là source trên nhánh GitHub; **chưa áp dụng Supabase Test/Production**, chưa deploy Edge Function, chưa merge PR. Chưa chạy browser E2E; CI chưa xác minh.
- Registry chỉ thống kê installation đã chạy phiên bản hỗ trợ reset; installation cũ phải mở bản mới và kết nối để được nhận diện/purge. RPC legacy chỉ được phép trước reset đầu tiên và bị từ chối sau khi generation tăng, nhằm chặn ghi ngược từ bundle cũ.
- Bước tiếp theo: rà soát migration/RPC/TypeScript, kiểm tra CI/build, hoàn thiện test tích hợp; sau đó xin phép riêng trước khi áp dụng migration trên Supabase Test.

## Rà soát bổ sung sau triển khai

- Đăng ký installation khóa hàng generation bằng `FOR SHARE`, tránh reset bỏ sót thiết bị đăng ký đồng thời.
- Local lưu cặp `deviceId + generation`; nếu IndexedDB được khôi phục/copy nhưng localStorage tạo installation ID mới sau reset, bắt buộc purge lại trước khi acknowledge.
- Tạo Local audit event trong cùng Dexie transaction kiểm tra hồ sơ còn tồn tại; reset chạy trước thì không sinh audit pending mồ côi. Bộ đồng bộ audit cũng chuyển sự kiện không còn hồ sơ Local tương ứng sang `local_only`.
- Đọc danh sách Cloud phân trang có kiểm tra generation lần nữa sau khi đọc xong.


## Cập nhật trạng thái thực tế — 23/11/2026

- Migration `20261123130000_superadmin_organization_asset_reset` đã được apply lên **Supabase Test BAOTRI Mini New** sau khi có phê duyệt; lịch sử ghi version `20261123132922`. Chưa apply Production.
- Edge Function `platform-reset-organization-assets` đã deploy, trạng thái ACTIVE, `verify_jwt=true`; nội dung deployed khớp source branch tại thời điểm deploy.
- Post-check chỉ đọc: reset state/device/request đều 0 rows; reset chưa được invoke. Chưa có dữ liệu thiết bị/tổ chức nào bị xóa.
- Quyền DB đã kiểm tra: reset/status RPC chỉ service_role; register/acknowledge và RPC đồng bộ generation-aware cấp cho authenticated; nhóm RPC kiểm tra không cấp EXECUTE cho anon. Các SECURITY DEFINER dùng `search_path=''`, `row_security=off`; cần tiếp tục review thân hàm và Advisor findings, không thu hồi quyền hàng loạt.
- CI run `45183190303`: Unit tests và Build thành công; 78/78 tests theo kết quả CI.
- Browser E2E chưa chạy do chưa có phiên Superadmin/browser; kiểm thử Reset thực tế chưa chạy. Reset cần tổ chức Test riêng và phê duyệt destructive riêng.
- PR #31 còn OPEN/DRAFT, chưa merge; PR #30 (base) còn OPEN, chưa merge. Production/DNS/Pages không thay đổi.
