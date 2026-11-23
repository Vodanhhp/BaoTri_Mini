# Thiết kế kỹ thuật – Cloud Change Feed (Giai đoạn 2)

## 1. Mục tiêu và phạm vi

Thay việc tải lại toàn bộ danh sách thiết bị theo chu kỳ bằng Pull tăng dần theo cursor. Local vẫn là nơi thao tác nghiệp vụ; Cloud là nguồn xác thực và nơi phản ánh các thay đổi đã được chấp nhận.

Giai đoạn này chỉ xây nền dữ liệu và API Pull. Giai đoạn 3 mới kết nối Realtime và polling fallback vào Sync Engine. Không đồng bộ ảnh, không tự import thiết bị Local chưa liên kết, không thay đổi edit-lock hay luồng reset.

## 2. Những gì đã xác minh trên Supabase Test

Project được kiểm tra: `BAOTRI-Mini-New` (`dskeaiyvldiwlsfqkboq`).

- Bảng `public.assets` có `id`, `organization_id`, `code`, `updated_at`, `deleted_at` và dữ liệu thiết bị hiện hành.
- RLS hiện có policy SELECT `assets_select_member`; điều kiện dựa trên `private.is_org_member`, Admin xem bản ghi đã xóa khi có `assets.delete`.
- Helper `private.has_org_permission(org_id,'assets.view')` đã tồn tại và kiểm tra thành viên đang hoạt động, tổ chức đang hoạt động cùng permission.
- Các trigger hiện có trên assets: `assets_apply_local_issuance`, `assets_guard_identity_fields`, `assets_log_group_change`.
- Chưa có `asset_sync_events`; publication `supabase_realtime` hiện chưa có bảng public nào.
- Reset vật lý thiết bị được thực hiện trong transaction, tăng `private.organization_asset_reset_state.generation`, xóa assets rồi ghi `private.organization_asset_reset_requests`. History được giữ lại bằng cách tách `asset_id`.

## 3. Schema đề xuất

### 3.1. Bộ đếm theo tổ chức

Tạo `private.asset_sync_counters`:

- `organization_id uuid primary key references public.organizations(id) on delete cascade`
- `last_sequence bigint not null default 0 check (last_sequence >= 0)`

Bảng chỉ nằm trong schema private, bật RLS, revoke mọi quyền từ PUBLIC/anon/authenticated; chỉ trigger/function nội bộ được quyền thao tác.

**Không dùng sequence/bigserial thông thường làm cursor.** Trigger sẽ tăng `last_sequence` bằng UPDATE trên đúng hàng counter của tổ chức. Row lock được giữ tới khi transaction commit/rollback, buộc các transaction cùng tổ chức xếp hàng và cursor theo đúng thứ tự commit. Một transaction rollback cũng rollback cả counter và event.

### 3.2. Nhật ký thay đổi

Tạo `public.asset_sync_events` với các cột tối thiểu:

- `organization_id uuid not null`
- `sequence bigint not null`
- `asset_id uuid null` — không FK để giữ được dấu xóa vật lý
- `asset_code text null`
- `event_type text not null`: `upsert`, `soft_delete`, `hard_delete`, `reset`
- `asset_updated_at timestamptz null`
- `reset_generation bigint null`
- `occurred_at timestamptz not null default clock_timestamp()`
- Primary key `(organization_id, sequence)`
- Index hỗ trợ `(organization_id, sequence)` (PK đã đáp ứng).

Feed chỉ chứa metadata định tuyến, không chứa payload thiết bị hay ảnh. RPC Pull sẽ ghép snapshot hiện tại của asset để client lấy trạng thái mới nhất thay vì áp dụng payload cũ từ một event cũ.

Bật RLS; chỉ cấp SELECT cho authenticated và policy SELECT yêu cầu `private.has_org_permission(organization_id,'assets.view')`. Không cấp INSERT/UPDATE/DELETE cho client. Không tạo policy cho anon. Viewer được phép nhận thay đổi vì đây là đọc dữ liệu, không trao quyền sửa.

## 4. Trigger và thứ tự sự kiện

### 4.1. Asset trigger

Một trigger AFTER INSERT/UPDATE/DELETE trên `public.assets`:

- INSERT → `upsert`
- UPDATE từ chưa xóa sang có `deleted_at` → `soft_delete`
- UPDATE từ đã xóa sang chưa xóa → `upsert`
- UPDATE khác → `upsert`
- DELETE vật lý → `hard_delete`

Trigger cấp sequence bằng cách khóa/cập nhật counter theo organization_id và insert event trong cùng transaction với thay đổi asset. Không có event mồ côi nếu nghiệp vụ rollback.

Nếu OLD/NEW.organization_id khác nhau, phải phát event ở cả tenant cũ và tenant mới; tuy nhiên organization_id nên tiếp tục bất biến như hiện tại và test phải bảo vệ điều này.

### 4.2. Reset marker

Không phát reset marker từ UPDATE reset_state vì nó xảy ra trước khi các asset bị xóa. Thay vào đó, trigger AFTER INSERT trên `private.organization_asset_reset_requests` phát event `reset` sau các event hard_delete của đợt reset, kèm generation. Nhờ vậy thiết bị luôn nhận được marker ngay cả khi tổ chức không có asset nào.

Các event reset và hard-delete đều cùng transaction với thao tác reset hiện hữu; không sửa function reset hoặc chạy reset trong triển khai này.

## 5. RPC Pull

### 5.1. Checkpoint

`public.get_asset_sync_checkpoint(p_organization_id uuid)` trả về:

- `last_sequence` hiện tại của tenant (0 nếu chưa có counter)
- `reset_generation` hiện tại từ bảng reset state

RPC phải kiểm tra `auth.uid() is not null` và `private.has_org_permission(org_id,'assets.view')`. Chỉ authenticated được EXECUTE.

Checkpoint được lấy trước initial snapshot. Các thay đổi commit sau checkpoint đều có sequence lớn hơn checkpoint và sẽ được Pull bù sau snapshot.

### 5.2. Incremental changes

`public.list_asset_sync_changes(p_organization_id uuid, p_after_sequence bigint, p_limit integer)`:

- Giới hạn `p_limit` trong khoảng 1–500.
- Trả event có sequence lớn hơn cursor, tăng dần.
- Mỗi event có metadata và snapshot hiện tại của asset theo cặp organization_id + asset_id; hard delete trả snapshot null.
- Trả `items`, `has_more`, `next_cursor`, `current_generation`.
- Kiểm tra permission như checkpoint; không cho client truyền organization_id để vượt tenant.
- Hàm SECURITY DEFINER nếu cần đọc bảng private phải có check auth/permission tường minh, `search_path = ''`, revoke PUBLIC/anon, grant authenticated; không dựa vào RLS trong hàm bypass RLS.

Cursor chỉ được lưu sau khi toàn bộ event page đã được áp dụng thành công vào IndexedDB. Áp dụng data và cập nhật cursor trong cùng Dexie transaction để crash không làm mất event.

## 6. Initial snapshot và cursor

- Thiết bị chưa có cursor: lấy checkpoint + generation, chạy full snapshot hiện tại, sau đó Pull tất cả event sau checkpoint đến khi `has_more=false`.
- Thiết bị đã có cursor: Pull tăng dần, không full scan.
- Nếu snapshot bị thay đổi trong lúc phân trang, mọi thay đổi sau checkpoint đều có event để bù.
- Snapshot từ RPC là trạng thái mới nhất tại thời điểm đọc. Nếu nhiều event cùng asset trong một page, client coalesce theo asset_id, chỉ áp dụng event cuối của asset đó.
- Cursor theo organization_id, tuyệt đối không dùng chung giữa hai tenant hoặc hai tài khoản.
- Reset generation vẫn là barrier độc lập. Trước/sau Pull và khi gặp event reset, client gọi cơ chế `ensureOrganizationAssetResetApplied`; không được coi event feed là thay thế kiểm tra reset.

## 7. Realtime – thuộc Giai đoạn 3

- Chỉ subscribe `INSERT` trên `public.asset_sync_events`, filter `organization_id=eq.<currentOrgId>`.
- Realtime chỉ đánh thức Sync Engine để gọi Pull RPC; không áp dụng payload Realtime trực tiếp vào Local.
- Sau khi subscribe thành công, chạy Pull ngay để bù khoảng trống trước khi kết nối.
- Giữ polling fallback 30–60 giây, cùng online/focus/visible.
- Cleanup channel khi logout, đổi organization hoặc unmount.
- Migration phải thêm đúng bảng vào publication `supabase_realtime`; không sửa schema `realtime`.

## 8. Kiểm thử bắt buộc trước khi bật cho người dùng

1. INSERT/UPDATE/status/archived/soft-delete/restore phát đúng một event mỗi transaction.
2. Hai transaction cùng organization chạy đồng thời: cursor không nhảy qua transaction commit muộn.
3. Transaction rollback không để lại counter/event.
4. Hai organization có cursor độc lập; member tenant A không đọc được event tenant B.
5. Viewer đọc được event nhưng không thể ghi bảng feed hay sửa assets.
6. Reset organization có assets và reset organization rỗng đều phát reset marker đúng generation; lịch sử vẫn còn.
7. Initial snapshot + concurrent writes không bỏ sót thay đổi.
8. Pull nhiều trang, crash giữa trang, retry idempotent và cursor chỉ tăng sau apply thành công.
9. Hard-delete event không xóa nhầm asset mới có code khác/ID khác.
10. Feed chỉ có metadata, không có image URL hoặc payload nhạy cảm.

## 9. Thứ tự triển khai

1. Tạo migration và SQL regression tests.
2. Rà security advisor + kiểm tra RLS/grants/publication trên Test.
3. Chỉ sau khi SQL Test an toàn mới thêm Dexie cursor và Pull client.
4. Kiểm thử PC/Mobile hai phiên trên Test.
5. Giai đoạn 3 mới bật Realtime + polling fallback.

**Ranh giới an toàn:** không Production, không deploy, không reset dữ liệu, không merge PR khi chưa có phê duyệt riêng.
