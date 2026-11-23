# Thiết kế RESET toàn bộ thiết bị theo tổ chức — Superadmin

Ngày chốt yêu cầu: 23/11/2026

## Mục tiêu

Superadmin có thể yêu cầu reset một tổ chức. Sau reset:
- Hồ sơ thiết bị trên Cloud bị xóa vật lý.
- Mọi Local cài BAOTRI Mini trên các nền tảng xóa dữ liệu thiết bị của đúng tổ chức khi nhận được generation reset mới.
- Máy offline không được phép đồng bộ snapshot thiết bị cũ lên Cloud khi kết nối lại.
- Nhật ký kiểm toán được giữ; danh mục thiết bị, tài khoản, vai trò, quyền, gói dịch vụ và cấu hình tổ chức không bị thay đổi.

Không reset Local Preview hoặc dữ liệu của tổ chức khác.

## Giao diện

Trong trang Quản trị Superadmin, ở từng dòng tổ chức thêm thao tác **Reset thiết bị**. Modal yêu cầu:
1. Tên tổ chức nhập lại chính xác.
2. Mật khẩu Superadmin xác thực lại.
3. Chọn xác nhận Có.
4. Hiển thị số hồ sơ Cloud và số thiết bị Local đã đăng ký/đang chờ nhận lệnh (nếu có).

Không đặt nút này cạnh nút xóa tổ chức mà không có nhãn riêng; reset không xóa tổ chức, thành viên, tài khoản hay cấu hình.

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
- Trước khi load dữ liệu tenant, trước Cloud sync, và khi app nhận sự kiện online/focus, client đọc generation hiện tại.
- Nếu generation trên Cloud lớn hơn generation đã xử lý tại Local, thực hiện transaction Dexie theo organization scope:
  - Xóa assets (bao gồm ảnh data URL nằm trong hồ sơ).
  - Xóa assetCloudLinks, assetMutations, assetDrafts.
  - Giữ assetHistory; giữ assetGroupChanges nhưng không để các event pending cũ tự đồng bộ lại.
  - Không xóa Local Preview hoặc scope tổ chức khác.
- Chỉ ghi nhận Local đã áp dụng generation sau khi transaction xóa thành công; sau đó gửi acknowledgement lên Cloud.
- Khi offline, Local không thể nhận lệnh tức thời. Khi online trở lại, phải kiểm tra và áp dụng reset trước mọi Cloud sync/retry. Không báo reset hoàn tất toàn hệ thống nếu còn device đã đăng ký chưa acknowledge.

### Chống dữ liệu cũ sống lại
- Reset generation là mốc server-side.
- Các RPC import phải từ chối hồ sơ có created_at trước hoặc bằng thời điểm reset gần nhất; chỉ hồ sơ được tạo mới sau reset mới được import. Điều này chặn phiên bản ứng dụng cũ cố import lại snapshot Local trước reset.
- Mutation update của asset cũ sẽ thất bại vì asset đã bị xóa; reservation đang reserved phải được chuyển released, nên xác nhận reservation cũ không thể khôi phục asset.
- Client mới bắt buộc purge trước khi đồng bộ hoặc retry mutation.
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

Thiết bị không kết nối được không thể bị xóa vật lý từ xa tại thời điểm reset; trạng thái phải là **Chờ thiết bị kết nối**, không được giả mạo là đã xóa.

## An toàn và kiểm thử bắt buộc

- Chỉ Edge Function xác thực Superadmin được gọi reset RPC; không cấp EXECUTE cho anon/authenticated.
- Xác thực lại mật khẩu và tên tổ chức.
- Khóa theo organization và idempotency request.
- Transaction rollback toàn bộ nếu có lỗi; không xóa một phần.
- Test: reset tổ chức A không ảnh hưởng B; giữ audit/catalog/membership/plan; xóa receipts/assets; retry cùng request id; máy online purge; máy offline reconnect purge trước sync; old client import snapshot cũ bị từ chối; Local Preview không đổi; mất mạng trong lúc reset không tạo thông báo thành công sai.

## Trạng thái triển khai

- Đã khảo sát Dexie stores, Cloud tables, Superadmin Edge Function và các FK đang chặn hard-delete lịch sử.
- Chưa có migration, chưa sửa dữ liệu Test/Production, chưa deploy Edge Function, chưa merge PR.
- Bước tiếp theo: tạo migration và RPC, triển khai Edge Function + UI, bổ sung local generation guard và regression tests; sau đó xin phép áp dụng migration trên Supabase Test để kiểm thử tích hợp.