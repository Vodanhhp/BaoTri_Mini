# BAOTRI Mini — Thiết kế tích hợp Kho vật tư

Ngày: 24/11/2026  
Trạng thái: Đối chiếu nghiệp vụ hoàn tất; thiết kế tích hợp cho dự án mới. Chưa triển khai UI/DB, chưa chạy migration hoặc ghi dữ liệu Supabase.

## 1. Phạm vi repository và môi trường

- Repository tham khảo (chỉ đọc): `Vodanhhp/DuAn_BaoTRi`.
- Repository triển khai duy nhất: `Vodanhhp/BaoTri_Mini`.
- Nhánh triển khai: `feat/inventory-management-foundation`, tạo từ `main` tại commit `5446a4bce29614940d3921be2783cd7139b46849`.
- Supabase đích của dự án mới: `BAOTRI Mini New`, project ref `dskeaiyvldiwlsfqkboq`.
- Không dùng schema, credentials, migration history hoặc dữ liệu từ project cũ/Test để suy ra trạng thái của project New.
- Không apply migration, sửa dữ liệu, RLS, Auth, Storage, Edge Function hoặc cấu hình Supabase trong giai đoạn này.

## 2. Nghiệp vụ kế thừa từ dự án cũ

### Danh mục vật tư

Giữ các trường đã có trong dự án cũ:

- Mã vật tư (do người dùng nhập; không dùng Smart Equipment ID).
- Tên vật tư, nhóm, đơn vị tính.
- Mã phụ tùng, kích cỡ.
- Số lượng tồn hiện tại, tồn tối thiểu.
- Vị trí, nhà cung cấp, đơn giá.
- Người thêm và dấu thời gian cập nhật.

Mặc định một kho chung; chưa triển khai nhiều kho/điều chuyển kho. Trường vị trí là vị trí lưu vật tư trong kho, không phải một kho độc lập.

### Giao dịch kho

- Nhập kho: số lượng dương, tăng tồn.
- Xuất kho: số lượng dương, giảm tồn; không cho phép tồn âm.
- Tồn đầu kỳ: khi tạo vật tư với số lượng ban đầu lớn hơn 0, ghi một movement loại Nhập với lý do Tồn đầu kỳ trong cùng transaction tạo vật tư. Nếu tồn ban đầu bằng 0 thì không tạo movement giả.
- Điều chỉnh: người dùng nhập số lượng thực tế sau kiểm kê; hệ thống tự tính chênh lệch so với số tồn hiện tại. Chênh lệch bằng 0 thì trả no_change, không tạo movement.
- Movement có thể liên kết thiết bị qua `linkedAssetId`; không bắt buộc.
- Movement là lịch sử append-only; không sửa/xóa giao dịch đã ghi nhận.
- Báo cáo tồn hiện tại và cảnh báo sắp hết hàng khi `quantity <= minQuantity`.

### Phân quyền đã có trong permission catalog

- Admin: xem, tạo/sửa vật tư, nhập/xuất/điều chỉnh, xóa/lưu trữ theo chính sách, xem lịch sử.
- Technician: xem, tạo/sửa vật tư, nhập/xuất/điều chỉnh; không xóa.
- Viewer: chỉ xem danh mục, tồn và lịch sử.
- UI phải kiểm tra từng permission; database/RPC phải enforce độc lập. Không dựa vào ẩn nút làm lớp bảo mật duy nhất.

## 3. Kiến trúc tích hợp vào dự án mới

Dự án mới hiện có Dexie/IndexedDB cho Asset, Smart ID draft/reservation, Cloud link, mutation queue và Asset history. Chưa có Inventory table/model/UI trong `src/db.ts` hoặc module kho trong `src/App.tsx`.

Kho vật tư phải tuân theo nguyên tắc Local-first của sản phẩm:

1. Local là nơi thao tác nghiệp vụ và phải giữ được thay đổi khi mất mạng.
2. Cloud là nơi xác thực tổ chức/quyền, lưu bản sao có thẩm quyền để các thiết bị trong tổ chức dùng chung và xác nhận mutation.
3. Không tải Cloud đè Local khi có mutation chưa được xác nhận; không dùng last-write-wins.
4. Không đồng bộ tồn kho bằng upsert thông thường. Balance và movement phải được xử lý như một giao dịch nghiệp vụ thống nhất.
5. Mỗi mutation có ID ổn định, idempotency/replay an toàn; timeout phải retry cùng mutation ID.
6. Conflict phải giữ Local và Cloud snapshot để xử lý rõ ràng; không tự chọn phía mới hơn theo đồng hồ thiết bị.
7. Không đưa dữ liệu demo hoặc queue từ backup vào tenant Cloud.

### Local data model dự kiến

- `InventoryItem`: id, localScope/organizationId, code, name, group, unit, partNumber, size, quantity, minQuantity, location, supplier, unitPrice, createdByUserId, createdByLabel, createdAt, updatedAt, identity/sync status.
- `InventoryMovement`: id, itemId, date, type, quantity, reason, note, performedBy snapshot, actorUserId, linkedAssetId, sync/mutation metadata.
- Bổ sung index theo scope + mã, scope + tên/nhóm, itemId + ngày giao dịch.
- Mã vật tư là mã nghiệp vụ do người dùng nhập; kiểm tra trùng không phân biệt hoa/thường và khoảng trắng trong phạm vi organization. Không tự đổi mã cũ khi phát hiện trùng.
- Chính sách UUID/draft identity của vật tư phải độc lập Smart Equipment ID. Giữ nguyên mã vật tư khi rekey; không đưa mã vật tư vào bộ cấp mã thiết bị.

### Cloud data model/RPC dự kiến

Tên bảng và contract cuối cùng phải được đối chiếu migration hiện hành của project New trước khi viết SQL:

- `inventory_items`: metadata + current balance + row version + soft-delete/inactive marker.
- `inventory_movements`: append-only movement history.
- Mutation receipt/idempotency và change-feed phải có phạm vi organization, payload hash, actor và kết quả replay; đánh giá khả năng dùng chung hạ tầng hiện có thay vì tạo cơ chế song song không cần thiết.

Các RPC nghiệp vụ tối thiểu:

1. `create_inventory_item`: kiểm tra `inventory.create`; tạo Item và optional opening Movement trong một transaction.
2. `update_inventory_item_metadata`: kiểm tra `inventory.update`; payload allowlist không có quantity; optimistic concurrency bằng expected version.
3. `post_inventory_movement`: kiểm tra `inventory.adjust`; chỉ Nhập/Xuất; lock Item, kiểm tra version, tính balance ở server, không cho xuất âm; ghi Item + Movement + receipt/event atomically.
4. `adjust_inventory_count`: kiểm tra `inventory.adjust`; nhận counted_quantity >= 0; server tính signed delta; delta 0 không tạo movement/version/event.
5. `archive_inventory_item` (hoặc soft-delete tương đương): Admin-only; không hard-delete Item đã có movement.

Không cho client ghi trực tiếp `inventory_items.quantity` hoặc INSERT trực tiếp `inventory_movements`. Không dùng upsert metadata để thay đổi balance.

### Audit movement

Movement mới cần lưu đủ dữ liệu để giải thích thay đổi tồn:

- quantity: lượng tuyệt đối dương để tương thích kiểu giao dịch cũ.
- quantity_delta: delta có dấu.
- balance_before, balance_after.
- counted_quantity chỉ áp dụng cho Điều chỉnh kiểm kê.
- reason không rỗng.
- actor user ID + snapshot tên người thực hiện.
- mutation_id và expected item version.

Các trường mới phải nullable với dữ liệu legacy nếu có; không suy đoán/backfill lịch sử khi không có nguồn chứng minh.

## 4. UI dự kiến

Tích hợp một mục điều hướng “Kho vật tư” bên cạnh “Danh mục thiết bị”, responsive cho PC/mobile.

Màn hình danh sách:
- Tìm kiếm mã/tên; lọc nhóm và trạng thái tồn.
- Cột mã/tên, nhóm, tồn/đơn vị, tồn tối thiểu, vị trí, trạng thái.
- Thao tác thêm/sửa, nhập, xuất, điều chỉnh theo permission.
- Cảnh báo sắp hết hàng.
- Xuất Excel và in danh sách theo quyền phù hợp.

Chi tiết vật tư:
- Thông tin metadata và người thêm.
- Số tồn hiện tại, tồn tối thiểu.
- Lịch sử Nhập/Xuất/Điều chỉnh, số tồn trước/sau, lý do, người thực hiện, ngày, thiết bị liên quan.
- Không cho sửa số tồn từ form metadata.
- Không cho sửa/xóa movement đã ghi.

## 5. Các điểm không được bê nguyên từ dự án cũ

- Không port nguyên `src/App.tsx` monolith hoặc Dexie database name/version từ repo cũ.
- Không tái sử dụng module `cloudSync.ts` JSON cũ.
- Không bật lại syncQueue cũ hoặc upload hàng loạt dữ liệu Local.
- Không copy nguyên migration cũ: schema, helper RBAC, receipt, feed và migration history của project New khác.
- Không dùng SQL draft trong repo cũ như migration đã sẵn sàng.
- Không tự quyết định đổi mã vật tư, xóa lịch sử, multi-warehouse, purchase order hoặc quản lý nhà cung cấp nâng cao.

## 6. Lộ trình triển khai và cổng kiểm thử

### Phase 0 — đối chiếu target (read-only)
- Chốt commit main, migration inventory và schema/RLS/permission thực tế của project New.
- Đối chiếu các helper/receipt/change-feed hiện có, Asset sync engine và Local scope.
- Kiểm tra các quyền inventory đã có trong catalog/role seed; không thêm quyền trùng.
- Chốt contract UUID/draft identity và unique code.

### Phase 1 — Local domain + UI
- Dexie schema migration không làm mất dữ liệu Asset hiện có.
- Local transaction: tạo Item + opening movement; Nhập/Xuất/Điều chỉnh cập nhật balance + movement cùng transaction.
- UI danh sách, chi tiết, form metadata, movement forms, low-stock, permission gating.
- Unit tests cho tồn âm, decimal quantity, code normalization, duplicate code, atomicity và Viewer read-only.

### Phase 2 — Cloud vertical slice
- Viết migration mới dành riêng cho project New, không sửa migration đã áp dụng.
- RLS/grants/RPC/receipt/change-feed; server-side permission, row lock, expected version, idempotency, audit.
- SQL regression tests cho tenant isolation, permission denied, duplicate code/UUID, replay, payload mismatch, rollback, race và no_change.
- Chỉ apply lên Test/New khi có phê duyệt riêng và đúng project scope.

### Phase 3 — Local ↔ Cloud
- Worker riêng cho Inventory hoặc adapter được chứng minh tương thích với sync engine hiện tại.
- Push/pull phân trang, retry cùng mutation ID, conflict preservation, không ghi đè Local pending.
- Kiểm thử PC ↔ Mobile, offline/online, timeout sau commit, permission revoked, duplicate retry.

### Phase 4 — nghiệm thu
- Build/unit/SQL tests và browser workflow.
- Admin/Technician/Viewer test matrix.
- User xác nhận trên trình duyệt trước khi phát hành.
- Merge PR và production deployment là hai cổng riêng; không tự merge hoặc deploy.

## 7. Trạng thái tại checkpoint

- Đã đọc repo cũ `Vodanhhp/DuAn_BaoTRi`, README, `src/db.ts`, inventory UI handlers, các phần liên quan trong `BAOTRI_TIENDO_VA_QUYETDINH.md`, và tài liệu thiết kế RPC kho.
- Đã đối chiếu repo mới `Vodanhhp/BaoTri_Mini`: hiện có Asset Local/Cloud architecture; chưa có Inventory model/UI/table/migration. Permission catalog đã có các quyền inventory.
- Tài liệu này là thiết kế triển khai, không phải xác nhận chức năng đã được code.
- Chưa sửa source code, chưa chạy test, chưa tạo/chạy migration, chưa truy cập ghi Supabase Test/New, chưa sửa dữ liệu hoặc deploy.
