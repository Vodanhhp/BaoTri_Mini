# VATTU — Chuẩn giao diện phân hệ Quản lý kho vật tư

Cập nhật: 24/11/2026  
Nguồn giao diện: `src/InventoryPanel.tsx`, `src/OrganizationPlanSummary.tsx`, `src/style.css`.

## 1. Nguyên tắc giao diện

- Đồng bộ nhận diện với phân hệ Thiết bị: banner xanh, typography, Plan/Catalog, panel, bảng và trạng thái.
- Trang Kho vật tư có banner riêng `.welcome.inventory-welcome`; dùng chung component `OrganizationPlanSummary` với Dashboard/Thiết bị.
- Plan và Catalog phải lấy từ dữ liệu tổ chức thực tế; không hardcode Plan A/B hoặc hạn mức.
- Hiển thị rõ “Lưu tại thiết bị Local · Cloud chưa bật” khi đúng trạng thái hiện tại.
- Desktop dùng bảng danh mục; mobile dùng thẻ vật tư để không ép người dùng cuộn ngang qua nhiều cột.

## 2. Banner Kho vật tư

| Thành phần | Desktop | Mobile ≤ 680px |
|---|---:|---:|
| Banner | Kế thừa `.welcome`; radius 14px; padding 25px 29px | padding 18px 16px |
| Khoảng cách nội dung/khối bên | gap 18px | gap 10px |
| Icon bên phải | Theo `.welcome-icon` | 48×48px; SVG 24×24px |
| Nhãn Local/Cloud | padding 6px 9px; font 10px | max-width 130px; căn giữa; cho phép xuống dòng |
| Plan/Catalog | Các nhãn gọn trong banner; tương phản sáng | Tự xuống dòng theo chiều rộng khả dụng |

Banner dùng gradient chung `linear-gradient(110deg,#16483f,#236d5e)`, chữ trắng và các nhãn Plan/Catalog nền trắng mờ. Không tạo banner màu khác nếu không có yêu cầu thiết kế mới.

## 3. Khung trang và thẻ thống kê

| Thành phần | Kích thước / cấu hình mẫu |
|---|---|
| Workspace | `.inventory-workspace`; gap 10px trên mobile |
| Stat grid desktop | Kế thừa `.stat-grid`; 4 cột ở layout chung nếu đủ chỗ |
| Inventory stats | `.inventory-stats`; 2 cột ở mobile |
| Stat card mobile | min-height 68px; padding 9px 10px |
| Stat card số liệu mobile | font-size 19px |
| Thẻ thống kê thứ 3 mobile | Chiếm toàn bộ hàng (2 cột) |
| Panel mobile | padding 12px |
| Khoảng cách giữa các card mobile | 8px |

## 4. Bảng danh mục vật tư — kích thước mẫu chuẩn

Bảng dùng class `.inventory-catalog-table`, table-layout fixed và min-width 820px. Wrapper cuộn ngang chỉ nằm trong vùng bảng.

| Cột | Tỷ lệ rộng |
|---|---:|
| Mã / Tên vật tư | 22% |
| Nhóm | 14% |
| Tồn kho | 10% |
| Tồn tối thiểu | 12% |
| Vị trí | 12% |
| Trạng thái | 12% |
| Thao tác | 18% |
| **Tổng** | **100%** |

Kích thước dòng/cell:
- Header cao 42px; dòng dữ liệu cao 62px.
- Cell padding 10px 11px; line-height 1.45; căn giữa theo chiều dọc.
- Nút/menu thao tác trong bảng cao tối thiểu 36px, chiếm đủ chiều rộng cột thao tác.
- Tên vật tư và mã được phép wrap; không làm rộng cột vô hạn.
- Khi mở menu thao tác, chỉ wrapper bảng danh mục được phép overflow visible; giữ z-index theo scope hiện hành, không nới overflow cho toàn bộ workspace.

## 5. Bộ lọc và nút thao tác

- Bộ lọc desktop xếp gọn trong `.inventory-filters`; ô tìm kiếm có thể chiếm hàng riêng khi breakpoint tablet.
- Mobile: bộ lọc xếp 1 cột; select cao tối thiểu 40px và font 16px để thao tác trên màn hình cảm ứng.
- Cụm nút đầu bảng mobile dùng grid 2 cột; nút cao 40px.
- Card vật tư mobile padding 10px, radius 9px; khoảng cách giữa card 8px.
- Các nút nhập/xuất/kiểm kê/sửa/lưu trữ trong card mobile dùng grid 2 cột, gap 6px; nút cao 38px.
- Không đưa tất cả thao tác thành nút dày đặc trên một hàng nhỏ; ưu tiên menu gọn ở bảng desktop và nhóm nút dễ chạm trên card mobile.

## 6. Bảng lịch sử giao dịch

Bảng lịch sử có cấu hình độc lập, không kế thừa min-width 820px của bảng danh mục:
- `table-layout: fixed`, min-width 0, cho phép nội dung wrap.
- Tỷ lệ cột: Ngày 10%; Mã vật tư 10%; Loại 10%; Số lượng 11%; Tồn trước 10%; Tồn sau 10%; Lý do 17%; Người thực hiện 22%.
- Cell padding 7px 8px; font 11px; line-height 1.4; vertical-align middle.
- Header font 10px; trạng thái trong lịch sử font 9px.
- Wrapper được phép cuộn ngang khi màn hình quá hẹp, nhưng bảng không được ép theo min-width lớn của danh mục.

## 7. Quy tắc nghiệp vụ cần giữ khi sửa UI

- Số tồn chỉ thay đổi qua giao dịch kho: Nhập, Xuất, Điều chỉnh/kiểm kê.
- Lịch sử giao dịch append-only; không thêm thao tác sửa/xóa phiếu đã ghi.
- Viewer chỉ xem; không hiển thị hoặc kích hoạt thao tác thay đổi dữ liệu nếu không có permission.
- Lưu trữ vật tư không đồng nghĩa xóa lịch sử giao dịch.
- Dữ liệu kho vẫn lưu Local; không bật Cloud Sync trong thay đổi giao diện.

## 8. Checklist trước khi hoàn tất UI

- [ ] Banner, Plan/Catalog và trạng thái Local/Cloud nhất quán với Thiết bị.
- [ ] Tỷ lệ 7 cột bảng danh mục tổng đúng 100%; min-width 820px chỉ áp dụng cho bảng danh mục.
- [ ] Menu thao tác không bị cắt; overflow không ảnh hưởng panel khác.
- [ ] Mobile: bộ lọc 1 cột, card vật tư dễ đọc, nút chạm cao tối thiểu 38–40px.
- [ ] Bảng lịch sử không bị áp min-width của bảng danh mục.
- [ ] Viewer không thấy thao tác ghi; trạng thái tồn chỉ thay đổi qua giao dịch.
- [ ] Build/tests đạt; ghi rõ mức độ kiểm tra browser/device.
