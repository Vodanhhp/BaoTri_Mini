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


## 10. Rà soát bổ sung sau khi đối chiếu Test DB (23/11/2026)

### 10.1. Quyền đọc feed và snapshot không được đánh đồng

- Trên Test, policy hiện tại của `public.assets` là `assets_select_member`: thành viên tổ chức đọc thiết bị chưa xóa; Admin với `assets.delete` mới đọc được bản ghi soft-delete. Không giả định policy assets hiện đang dùng `assets.view`.
- Feed phải có policy SELECT riêng, kiểm tra `private.has_org_permission(organization_id,'assets.view')`. Đây là quyền đọc event metadata, không được cấp quyền ghi feed.
- RPC Pull phải kiểm tra membership/permission rõ ràng. Snapshot asset phải tôn trọng quyền đọc dữ liệu hiện có; nếu event soft-delete mà snapshot bị RLS che, client vẫn phải xử lý metadata event để ẩn/đánh dấu thiết bị, không suy diễn đó là hard-delete.
- Không trả payload asset hoặc dữ liệu nhạy cảm qua Realtime. Event chỉ là tín hiệu và metadata.

### 10.2. Reset integration đã đối chiếu

- Test DB hiện có các bảng private `organization_asset_reset_state`, `organization_asset_reset_requests`, `organization_asset_reset_devices` và `organization_asset_reset_approval_requests`; chưa có trigger trên reset request.
- Function `platform_reset_organization_assets` tăng generation, xóa assets trong transaction và sau đó insert reset request. Vì vậy trigger marker gắn AFTER INSERT trên reset request có thể phát reset event sau các hard-delete events cùng transaction; rollback phải rollback cả feed/counter.
- Reset generation vẫn là cơ chế authoritative để áp dụng reset Local. Event reset chỉ bổ sung checkpoint/wake-up, không tự thay thế `ensureOrganizationAssetResetApplied`.
- Không chỉnh function reset, không gọi reset và không thay đổi dữ liệu trong triển khai Sync Engine.

### 10.3. Hard-delete và soft-delete semantics

- `soft_delete`: event phải giúp client loại thiết bị khỏi danh sách thường; không hard-delete Local record hoặc lịch sử. Snapshot null do quyền đọc không được coi là hard-delete.
- `hard_delete`: metadata chỉ dùng reconciliation; reset generation barrier là cơ chế dọn Local chính trong reset. Không xóa Local theo code đơn thuần, phải dùng asset ID + organization và kiểm tra cloud-link để tránh ảnh hưởng bản ghi Local khác.
- `restore` (deleted_at chuyển về null) phát `upsert` để Local nhận lại snapshot khi có quyền.

### 10.4. Điều kiện bảo đảm cursor

Counter row lock chỉ đúng khi mọi event của cùng organization đi qua cùng một row counter trong transaction, và việc cấp sequence + insert event là atomic. Trigger/helper phải không cho client gọi trực tiếp, không cho tự chọn organization/cursor, và không dùng một sequence PostgreSQL global làm cursor commit-order.

### 10.5. Kiểm tra trước khi viết migration

Migration workflow/CLI hiện không có trong môi trường thực thi. Không tạo filename migration thủ công và không apply DDL bằng MCP. Trước khi triển khai schema, cần khôi phục Supabase CLI/repository workspace, tạo migration bằng `supabase migration new`, kiểm tra migration history của Test so với source, sau đó review SQL + tests trước khi apply Test.


## 11. Client contract – incremental Pull implementation

### 11.1. Dexie schema

Add a dedicated table (rather than reusing reset-state storage):

- `assetSyncCursors`: primary key `organizationId`; fields `organizationId`, `lastSequence`, `resetGeneration`, `initializedAt`, `updatedAt`.
- Cursor is tenant-scoped; no global cursor and no cursor for `local-preview`.
- Cursor table must be upgraded with a new Dexie version. Upgrade callback must not initialize a cursor from current wall-clock time; cursor is initialized only from server checkpoint.
- Do not store event history locally unless required for diagnostics. Feed replay is idempotent and the cursor is the durable checkpoint.

### 11.2. Pull client interfaces

Keep server RPC wrappers in `src/lib/cloudAssets.ts` or a dedicated `src/lib/cloudAssetChanges.ts` module, and keep orchestration in `syncEngine.ts`.

Typed contract (names may be adjusted to match the final SQL):

```ts
 type AssetSyncCheckpoint = { lastSequence: number; resetGeneration: number }
 type AssetSyncEvent = {
   organizationId: string; sequence: number; assetId: string | null;
   assetCode: string | null; eventType: 'upsert'|'soft_delete'|'hard_delete'|'reset';
   assetUpdatedAt: string | null; resetGeneration: number | null;
   snapshot: CloudAsset | null;
 }
 type AssetSyncPage = { items: AssetSyncEvent[]; hasMore: boolean; nextCursor: number; currentGeneration: number }
```

Never trust the client-supplied organization ID alone. The RPC verifies auth and membership/permission; the client additionally validates every returned event's organization matches the active tenant, sequence is strictly increasing within the page and greater than the cursor, page size is bounded, and next cursor advances.

### 11.3. Snapshot bootstrap algorithm

1. Call checkpoint RPC; store `checkpoint.lastSequence` only as a temporary bootstrap boundary, not as the durable cursor yet.
2. Run current paginated snapshot download while preserving the existing conflict/mutation protections. A full snapshot page must not delete Local-only rows or unlinked Local equipment.
3. After snapshot succeeds, Pull from the checkpoint boundary until caught up. This includes concurrent Cloud changes committed after the checkpoint.
4. Commit the final Pull page's asset changes and cursor in one Dexie transaction. Bootstrap becomes initialized only after snapshot and catch-up succeed. If any stage fails, retry bootstrap safely; do not mark cursor initialized prematurely.
5. Reset generation checks bracket snapshot and Pull; a generation change aborts the pass and delegates to the existing reset barrier before retry.

### 11.4. Incremental page apply

For each page:

- Validate tenant, sequence ordering, event type, and bounded page size before touching IndexedDB.
- Coalesce multiple non-reset events for the same asset to the newest event in the page, but never reorder across reset markers. Simpler initial implementation may apply events serially; correctness is preferred over optimization.
- `upsert`: only apply snapshot if present, linked/local identity is consistent, and no Local pending mutation/conflict/active edit-lock protection requires preserving Local. Reuse current reconciliation rules; do not bypass optimistic conflict logic.
- `soft_delete`: update deletedAt on the matching linked asset and Cloud link using current deletion reconciliation. Keep asset/history; preserve local unsynced changes as conflict.
- `hard_delete`: remove only the matching Cloud-linked Local row/link after validating org, asset ID and code. If Local is unlinked, preserve it. Reset hard-deletes are primarily handled by generation barrier.
- `reset`: call existing reset barrier with generation, then continue; reset marker may not be coalesced away.
- Applying a Pull must not create outgoing `assetMutations`, group-change mutations, or history mutations. Cloud is not a Local user action.
- Cursor advances to page `nextCursor` only in the same Dexie transaction as successfully applying all records from the page. If an operation requiring the reset barrier cannot be included in a Dexie transaction, perform it before cursor commit and make retry idempotent.

### 11.5. Tenant / session change

Before each page and before commit, Sync Engine checks its captured session identity and organization. If account/org changes, cancel pass and do not commit cursor from the old tenant into the new session. Local cursor key remains tenant ID, but ensure no old in-flight work can mutate the currently selected tenant's rows.

### 11.6. Feed retention / cursor expiration

The initial implementation should not delete feed rows. Before adding retention, design a tenant minimum cursor / feed floor. If a client cursor is older than the floor, RPC returns an explicit `cursor_expired` error; client performs controlled snapshot bootstrap, not silent cursor jump. Realtime reconnect never changes the durable cursor.

### 11.7. Feature rollout and fallback

Do not silently switch the existing full scan to incremental mode until Test validates the feed end-to-end. A capability/checkpoint RPC may signal feed availability. If RPC is missing, client uses existing full scan, emits a non-fatal diagnostic, and does not create an initialized cursor. Once incremental mode is enabled for a tenant, failures must not reset cursor or trigger destructive fallback; recovery is explicit bootstrap only.

## 12. Review risks identified before coding

1. Event trigger ordering with existing assets triggers: feed trigger should not mutate the asset; it should run AFTER row operation. Existing identity issuance guard remains authoritative.
2. Reset request may contain platform/admin context; marker trigger must derive tenant and generation from trusted row values and not accept caller-supplied organization from a client RPC.
3. Snapshot visibility differs for soft-deleted assets. The Pull RPC must not return a null snapshot that clients misinterpret as physical deletion; event type determines semantics.
4. SECURITY DEFINER RPCs must have explicit auth/permission checks, fixed empty search path, restricted EXECUTE grants, and no caller-controlled arbitrary organization/cursor writes.
5. Migration must be idempotent only where safe, and test rollback/transaction behavior. Avoid `CREATE OR REPLACE` with changed return types; use deliberate versioning if needed.
6. Event volume and hot counter row: per-org row lock is acceptable initially; if an organization becomes high-volume, optimize only after measurement without weakening commit ordering.
7. Pull page snapshots may reflect newer state than the event sequence. This is safe if reconciliation is idempotent and cursor remains sequence-based, but must be documented and tested; event payload must not be treated as historical row version.


## 13. Client scaffolding added on PR #33 (23/11/2026)

- `src/lib/cloudAssetChanges.ts` now contains typed checkpoint/change-feed RPC wrappers and validation for tenant ID, event type, strictly increasing sequence, bounded page size, snapshot shape, and cursor progress. It is deliberately not wired into the existing sync cycle yet.
- Dexie schema version 8 adds `assetSyncCursors`, keyed by `organizationId`, without initializing cursor values during upgrade.
- `readAssetSyncCursor()` is read-only and refuses `local-preview` or malformed cursor records. No cursor write helper is exposed yet: cursor persistence must be performed atomically with page application in the eventual Pull orchestrator.
- Regression tests cover the client contract and cursor schema/read safeguards.
- Server RPCs are not present in Test yet; no migration/DDL was applied. The current full scan remains the active sync path. This scaffolding does not activate incremental mode.


## 14. Server Change Feed implementation on Test (23/11/2026)

Applied to **Test only**: migration history versions `20261123155243_asset_sync_change_feed` and `20261123155408_asset_sync_feed_index_cleanup`. No Production changes.

- Private tables: `asset_sync_counters` and `asset_sync_events`; RLS enabled, direct client grants revoked.
- Per-organization counter row is updated in the same transaction as event insertion. The row lock serializes sequence allocation and preserves commit order within a tenant.
- Asset trigger captures create/update/soft-delete/restore/hard-delete. Snapshots use the existing Cloud RPC shape: omit database UUID `id`, add `asset_key` (management code), retain `code` and organization metadata. Hard delete events have no snapshot.
- Reset state generation trigger emits one reset barrier. The reset RPC sets a transaction-local suppression flag while deleting assets so a reset does not produce a storm of hard-delete events.
- Public RPC wrappers are SECURITY INVOKER and call private SECURITY DEFINER functions with fixed search_path. Both enforce authenticated user, active organization and `assets.view`. Soft-delete snapshots are null for users lacking `assets.delete`.
- Checkpoint reads sequence and reset generation in one statement snapshot. Pull is bounded (1–500), ordered by sequence, reports `has_more`, `next_cursor` and current generation; an empty page does not advance the cursor.
- The initial migration does not backfill events. Existing Cloud assets remain handled by the bootstrap Full Scan. No records or counters were inserted by this migration; feed and counter tables are empty on Test at verification.
- Verified RPC existence, trigger count, table RLS, grants (authenticated may execute RPCs; anon cannot; authenticated cannot SELECT private feed/counter tables), and an authenticated-membership smoke test calling Checkpoint + empty Pull.
- Supabase advisors report the private feed tables as RLS-enabled with no policies (intentional fail-closed: direct table access is revoked; access only via checked RPC). Existing unrelated advisor warnings remain.

Incremental mode remains **not activated**. Next work: implement page application with cursor persisted atomically in Dexie, bootstrap checkpoint → current Full Scan → catch-up Pull, reset barriers, event reconciliation/conflict handling, cancellation/session-org checks, and end-to-end tests. Realtime is only a wake-up after durable Pull is in place.
